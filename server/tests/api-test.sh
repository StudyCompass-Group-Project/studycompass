#!/usr/bin/env bash
# StudyCompass API test script.
#
#   bash tests/api-test.sh                 run everything (includes the Gemini tests)
#   SKIP_AI=1 bash tests/api-test.sh       skip the tests that call Gemini
#   PDF=/path/to/syllabus.pdf bash tests/api-test.sh   also upload a real PDF
#   BASE=http://localhost:5000 ...         change the server address
#
# It creates two throw-away users (apitest_a_..., apitest_b_...), exercises every
# route, prints a pass/fail line for each check, and exits non-zero if any failed.
# Needs: curl and node (you already have both). Works with macOS's old bash 3.2.

BASE="${BASE:-http://localhost:5000}"
SKIP_AI="${SKIP_AI:-0}"
PDF="${PDF:-}"

PASS=0
FAIL=0
STATUS=""
BODY=$(mktemp)
JAR_A=$(mktemp)   # logged-in user A
JAR_B=$(mktemp)   # logged-in user B (used to prove users can't see each other's data)
JAR_X=$(mktemp)   # never logged in
TMPFILES="$BODY $JAR_A $JAR_B $JAR_X"
trap 'rm -f $TMPFILES' EXIT

GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
section() { printf "\n%s== %s ==%s\n" "$BOLD" "$1" "$RESET"; }
note()    { printf "  %s%s%s\n" "$DIM" "$1" "$RESET"; }
pass()    { PASS=$((PASS + 1)); printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; }
fail() {
  FAIL=$((FAIL + 1))
  printf "  %s✗ %s%s\n" "$RED" "$1" "$RESET"
  printf "      %slast response: HTTP %s  %s%s\n" "$DIM" "$STATUS" "$(head -c 500 "$BODY")" "$RESET"
  if [ "$STATUS" = "502" ] || [ "$STATUS" = "503" ]; then
    if grep -qi "quota" "$BODY"; then
      printf "      %s-> Google says your Gemini QUOTA or rate limit was exceeded. Wait a minute, raise AI_PAUSE, or check your plan at aistudio.google.com%s\n" "$DIM" "$RESET"
    elif grep -qi "high demand" "$BODY"; then
      printf "      %s-> Google's model was overloaded (temporary). Re-run in a few minutes, or set GEMINI_MODEL / GEMINI_FALLBACK_MODEL to another model%s\n" "$DIM" "$RESET"
    else
      printf "      %s-> the Gemini call failed. See \"detail\" above or the SERVER terminal. Test your key with: node tests/gemini-check.mjs%s\n" "$DIM" "$RESET"
    fi
  fi
}

# call JAR METHOD PATH [JSON_BODY]  -> sets $STATUS and writes the response to $BODY
call() {
  local jar="$1" method="$2" path="$3" data="$4"
  if [ -n "$data" ]; then
    STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$jar" -c "$jar" -X "$method" \
      -H "Content-Type: application/json" -d "$data" "$BASE$path")
  else
    STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$jar" -c "$jar" -X "$method" "$BASE$path")
  fi
}

# jeval 'JS expression'  -> evaluates it with the last response parsed into `j`
jeval() {
  node -e '
    let j;
    try { j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); }
    catch (e) { console.log("<not json>"); process.exit(0); }
    try {
      const v = eval(process.argv[2]);
      console.log(typeof v === "object" ? JSON.stringify(v) : String(v));
    } catch (e) { console.log("<eval error: " + e.message + ">"); }
  ' "$BODY" "$1"
}

# check "name" EXPECTED_STATUS ["JS expression" EXPECTED_VALUE]
check() {
  local name="$1" code="$2" expr="$3" want="$4"
  if [ "$STATUS" != "$code" ]; then fail "$name (expected HTTP $code)"; return; fi
  if [ -n "$expr" ]; then
    local got
    got=$(jeval "$expr")
    if [ "$got" != "$want" ]; then fail "$name (expected [$want], got [$got])"; return; fi
  fi
  pass "$name"
}

iso_in()    { node -e 'console.log(new Date(Date.now() + Number(process.argv[1]) * 3600e3).toISOString())' -- "$1"; }
date_text() { node -e 'console.log(new Date(Date.now() + Number(process.argv[1]) * 864e5).toLocaleDateString("en-US", {month:"long", day:"numeric", year:"numeric", timeZone:"America/Los_Angeles"}))' -- "$1"; }

# The id from the last response, or nothing if the request failed
id_of() { local v; v=$(jeval "j.id"); case "$v" in ''|*[!0-9]*) echo "" ;; *) echo "$v" ;; esac; }

# Free Gemini keys allow only a few requests per minute, so wait between AI calls.
# AI_PAUSE=0 disables the wait (use it if your key has a higher limit).
AI_PAUSE="${AI_PAUSE:-12}"
ai_pause() { if [ "$AI_PAUSE" -gt 0 ]; then note "(waiting ${AI_PAUSE}s so the next Gemini call stays under the per-minute limit)"; sleep "$AI_PAUSE"; fi; }

# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------
RUN="$RANDOM$RANDOM"
PROJ_OLD=""
COURSE_NEW=""
USER_A="apitest_a_$RUN"; EMAIL_A="$USER_A@example.com"; PW_A="password123"
USER_B="apitest_b_$RUN"; EMAIL_B="$USER_B@example.com"; PW_B="password123"

call "$JAR_X" GET /api/health ""
if [ "$STATUS" = "000" ]; then
  echo "Can't reach $BASE. Is the server running (npm run dev)?"
  exit 2
fi

# ===========================================================================
section "1. Health, errors and protection"
# ===========================================================================
call "$JAR_X" GET /api/health "";                    check "health check" 200 "j.status" "ok"
call "$JAR_X" GET /api/nope "";                      check "unknown /api route returns JSON 404" 404 "j.error" "Not found"
call "$JAR_X" POST /api/auth/login '{bad json';      check "malformed JSON body -> 400 (not 500)" 400
call "$JAR_X" GET /api/courses "";                   check "protected route without a cookie -> 401" 401 "j.error" "No token found"
STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -H "Cookie: token=garbage" "$BASE/api/courses")
check "garbage token -> 401" 401 "j.error" "Invalid or expired token"
for p in assignments projects availability study-sessions settings dashboard/summary syllabi onboarding/status; do
  call "$JAR_X" GET "/api/$p" "";                    check "/api/$p requires login" 401
done
call "$JAR_X" POST /api/study-plan/generate '{}';    check "/api/study-plan requires login" 401

# ===========================================================================
section "2. Auth: register, login, me"
# ===========================================================================
call "$JAR_X" POST /api/auth/register '{"email":"x@example.com"}';  check "register with missing fields -> 400" 400
call "$JAR_X" POST /api/auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"$USER_A\",\"password\":\"short\"}"
check "register with a short password -> 400" 400
call "$JAR_X" POST /api/auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"bad@name\",\"password\":\"$PW_A\"}"
check "username containing @ -> 400" 400
call "$JAR_X" POST /api/auth/register "{\"email\":\"not-an-email\",\"username\":\"$USER_A\",\"password\":\"$PW_A\"}"
check "invalid email -> 400" 400
call "$JAR_X" POST /api/auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"$USER_A\",\"password\":\"$PW_A\"}"
check "register user A" 201 "j.user.username" "$USER_A"
note "password_hash must never appear in a response:"
check "register response hides the hash" 201 '"password_hash" in j.user' "false"
call "$JAR_X" POST /api/auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"other_$RUN\",\"password\":\"$PW_A\"}"
check "duplicate email -> 409" 409
UPPER_A=$(echo "$USER_A" | tr '[:lower:]' '[:upper:]')
call "$JAR_X" POST /api/auth/register "{\"email\":\"other_$RUN@example.com\",\"username\":\"$UPPER_A\",\"password\":\"$PW_A\"}"
check "username differing only by case -> 409" 409
call "$JAR_X" POST /api/auth/register "{\"email\":\"$EMAIL_B\",\"username\":\"$USER_B\",\"password\":\"$PW_B\"}"
check "register user B" 201

call "$JAR_X" POST /api/auth/login '{}';                                       check "login with nothing -> 400" 400
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$EMAIL_A\",\"password\":\"wrongpass1\"}"
check "wrong password -> 401" 401 "j.error" "Invalid credentials"
call "$JAR_X" POST /api/auth/login '{"identifier":"nobody_here_zz","password":"password123"}'
check "unknown user gives the SAME 401 message" 401 "j.error" "Invalid credentials"
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$USER_A\",\"password\":\"$PW_A\"}"
check "login by username" 200 "j.user.email" "$EMAIL_A"
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$UPPER_A\",\"password\":\"$PW_A\"}"
check "login by USERNAME in capitals" 200
call "$JAR_A" POST /api/auth/login "{\"identifier\":\"$EMAIL_A\",\"password\":\"$PW_A\"}"
check "login user A by email" 200 "j.user.username" "$USER_A"
call "$JAR_B" POST /api/auth/login "{\"identifier\":\"$EMAIL_B\",\"password\":\"$PW_B\"}"
check "login user B" 200

HDRS=$(curl -s -D - -o /dev/null -X POST -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$EMAIL_A\",\"password\":\"$PW_A\"}" "$BASE/api/auth/login")
if echo "$HDRS" | grep -i '^set-cookie: token=' | grep -qi 'httponly'; then
  pass "login cookie is HttpOnly"
else
  STATUS="-"; : > "$BODY"; fail "login cookie is HttpOnly"
fi

call "$JAR_A" GET /api/auth/me "";   check "/me returns the logged-in user" 200 "j.user.email" "$EMAIL_A"

# ===========================================================================
section "3. Settings"
# ===========================================================================
call "$JAR_A" GET /api/settings "";  check "get settings" 200 "j.email" "$EMAIL_A"
check "settings never include password_hash" 200 '"password_hash" in j' "false"
call "$JAR_A" PATCH /api/settings '{"theme_mode":"Dark","study_reminder_minutes":30,"urgent_exam_alerts":false}'
check "update preferences (theme_mode normalised)" 200 'j.theme_mode+"|"+j.study_reminder_minutes+"|"+j.urgent_exam_alerts' "dark|30|false"
call "$JAR_A" PATCH /api/settings '{"theme_mode":"neon"}';                   check "invalid theme_mode -> 400" 400
call "$JAR_A" PATCH /api/settings '{"study_reminder_minutes":0}';            check "reminder minutes out of range -> 400" 400
call "$JAR_A" PATCH /api/settings '{"background_photo_url":"ftp://x.com/a.png"}'; check "non-http background URL -> 400" 400
call "$JAR_A" PATCH /api/settings '{"password_hash":"hacked","id":999}';     check "unknown fields can't be set (mass assignment) -> 400" 400
call "$JAR_A" PATCH /api/settings '{"timezone":"Mars/Olympus"}';             check "invalid timezone -> 400" 400
call "$JAR_A" PATCH /api/settings '{"timezone":"America/Los_Angeles","current_semester_week":8}'
check "set timezone + semester week (needs the migration)" 200 'j.timezone+"|"+j.current_semester_week' "America/Los_Angeles|8"

call "$JAR_A" PATCH /api/settings/profile "{\"username\":\"$USER_B\"}"; check "rename to a taken username -> 409" 409
call "$JAR_A" PATCH /api/settings/profile "{\"email\":\"$EMAIL_B\"}";   check "change to a taken email -> 409" 409
call "$JAR_A" PATCH /api/settings/profile '{"username":"a@b"}';          check "invalid new username -> 400" 400
call "$JAR_A" PATCH /api/settings/profile '{}';                          check "profile update with nothing -> 400" 400
NEW_USER_A="${USER_A}_v2"
call "$JAR_A" PATCH /api/settings/profile "{\"username\":\"$NEW_USER_A\"}"; check "rename own username" 200 "j.username" "$NEW_USER_A"
USER_A="$NEW_USER_A"

call "$JAR_A" PATCH /api/settings/password "{\"current_password\":\"nottheone\",\"new_password\":\"newpassword456\"}"
check "wrong current password -> 400" 400 "j.error" "Current password is incorrect"
call "$JAR_A" PATCH /api/settings/password "{\"current_password\":\"$PW_A\",\"new_password\":\"$PW_A\"}"
check "new password same as current -> 400" 400
call "$JAR_A" PATCH /api/settings/password "{\"current_password\":\"$PW_A\",\"new_password\":\"short\"}"
check "new password too short -> 400" 400
call "$JAR_A" PATCH /api/settings/password "{\"current_password\":\"$PW_A\",\"new_password\":\"newpassword456\"}"
check "change password" 200
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$EMAIL_A\",\"password\":\"$PW_A\"}"
check "old password no longer works -> 401" 401
PW_A="newpassword456"
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$EMAIL_A\",\"password\":\"$PW_A\"}"
check "new password works" 200

# ===========================================================================
section "4. Courses"
# ===========================================================================
call "$JAR_A" POST /api/courses '{}';                                        check "course without a name -> 400" 400
call "$JAR_A" POST /api/courses '{"name":"x","color_code":"red"}';           check "bad color -> 400" 400
call "$JAR_A" POST /api/courses '{"name":"x","units":500}';                  check "units out of range -> 400" 400
call "$JAR_A" POST /api/courses '{"name":"x","schedules":[{"day_of_week":"Monday","start_time":"15:00","end_time":"14:00"}]}'
check "class ending before it starts -> 400" 400
call "$JAR_A" POST /api/courses '{"name":"x","schedules":[{"day_of_week":"Funday","start_time":"09:00","end_time":"10:00"}]}'
check "invalid weekday -> 400" 400
call "$JAR_A" POST /api/courses '{"name":"  General Biology  ","code":"BIO-120","semester":"Fall 2026","units":4,"teacher_name":"Dr. Reed","color_code":"#2E7D32","schedules":[{"day_of_week":"tuesday","start_time":"13:00","end_time":"15:50"}]}'
check "create course (name trimmed, weekday normalised, units 4)" 201 'j.name+"|"+j.units+"|"+j.schedules.length+"|"+j.schedules[0].day_of_week' "General Biology|4|1|Tuesday"
COURSE1=$(jeval "j.id")
call "$JAR_A" POST /api/courses '{"name":"Chemistry"}'
check "create 2nd course (units default to 3)" 201 "j.units" "3"
COURSE2=$(jeval "j.id")

call "$JAR_A" GET /api/courses "";                         check "list courses" 200 "j.length" "2"
check "course card has progress + deadline fields" 200 '["next_deadlines","assignments_total","study_hours_this_week"].every(k=>k in j[0])' "true"
call "$JAR_A" GET "/api/courses?search=bio" "";            check "search courses (case-insensitive)" 200 "j.length" "1"
call "$JAR_A" GET "/api/courses?search=%25" "";            check "search for a literal % matches nothing" 200 "j.length" "0"
call "$JAR_A" GET "/api/courses?semester=Fall%202026" "";  check "filter by semester" 200 "j.length" "1"
call "$JAR_A" GET "/api/courses/$COURSE1" "";              check "get one course (with assignments + syllabi arrays)" 200 "Array.isArray(j.assignments)&&Array.isArray(j.syllabi)" "true"
call "$JAR_A" GET /api/courses/abc "";                     check "non-numeric id -> 400" 400
call "$JAR_A" GET /api/courses/999999 "";                  check "missing course -> 404" 404

call "$JAR_A" PATCH "/api/courses/$COURSE1" '{"name":"Biology 120","teacher_name":"Dr. Patel"}'
check "update course fields" 200 'j.name+"|"+j.teacher_name' "Biology 120|Dr. Patel"
COURSE1_NAME="Biology 120"
call "$JAR_A" PATCH "/api/courses/$COURSE1" '{"schedules":[{"day_of_week":"Tuesday","start_time":"13:00","end_time":"15:50"},{"day_of_week":"Thursday","start_time":"13:00","end_time":"15:50"}]}'
check "replace the weekly schedule" 200 "j.schedules.length" "2"
call "$JAR_A" PATCH "/api/courses/$COURSE1" '{}';           check "empty update -> 400" 400
call "$JAR_A" PATCH "/api/courses/$COURSE1" '{"id":5,"user_id":99}'; check "can't change id/user_id -> 400" 400
call "$JAR_A" PATCH /api/courses/999999 '{"name":"x"}';     check "update a missing course -> 404" 404

# ===========================================================================
section "5. Assignments"
# ===========================================================================
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"due_date\":\"$(iso_in 72)\"}"; check "assignment without title -> 400" 400
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"x\",\"due_date\":\"next friday\"}"; check "invalid due date -> 400" 400
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"x\",\"due_date\":\"$(iso_in 72)\",\"estimated_hours\":500}"
check "estimated_hours out of range -> 400" 400
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"x\",\"due_date\":\"$(iso_in 72)\",\"completed\":\"yes\"}"
check "completed must be a boolean -> 400" 400
call "$JAR_A" POST /api/assignments "{\"course_id\":999999,\"title\":\"x\",\"due_date\":\"$(iso_in 72)\"}"
check "assignment on a course that isn't yours -> 404" 404

call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"Problem Set 3\",\"description\":\"Chapters 4-5\",\"due_date\":\"$(iso_in 72)\",\"estimated_hours\":3}"
check "create assignment 1 (joined course name, defaults)" 201 'j.title+"|"+j.completed+"|"+j.course_name+"|"+j.estimated_hours' "Problem Set 3|false|$COURSE1_NAME|3"
ASG1=$(jeval "j.id")
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"Midterm Study Guide\",\"due_date\":\"$(iso_in 144)\",\"estimated_hours\":6}"
check "create assignment 2" 201;  ASG2=$(jeval "j.id")
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"Reading Quiz\",\"due_date\":\"$(iso_in 24)\",\"completed\":true}"
check "create assignment 3 (already completed)" 201;  ASG3=$(jeval "j.id")

call "$JAR_A" GET /api/assignments "";                                check "list assignments, soonest first" 200 'j.length+"|"+j[0].title' "3|Reading Quiz"
call "$JAR_A" GET "/api/assignments?completed=false" "";              check "filter completed=false" 200 "j.length" "2"
call "$JAR_A" GET "/api/assignments?completed=true" "";               check "filter completed=true" 200 "j.length" "1"
call "$JAR_A" GET "/api/assignments?course_id=$COURSE2" "";           check "filter by the other course" 200 "j.length" "0"
call "$JAR_A" GET "/api/assignments?from=$(iso_in 100)" "";           check "filter by from= date" 200 "j.length" "1"
call "$JAR_A" GET "/api/assignments?from=$(iso_in 10)&to=$(iso_in 80)" ""; check "filter by from + to" 200 "j.length" "2"
call "$JAR_A" GET "/api/assignments?completed=maybe" "";              check "bad completed value -> 400" 400
call "$JAR_A" GET "/api/assignments?from=notadate" "";                check "bad date filter -> 400" 400
call "$JAR_A" GET "/api/assignments?course_id=abc" "";                check "bad course_id filter -> 400" 400

call "$JAR_A" GET "/api/assignments/$ASG1" "";                        check "get one assignment" 200 "j.title" "Problem Set 3"
call "$JAR_A" PATCH "/api/assignments/$ASG1" '{"completed":true}';    check "tick an assignment off" 200 "j.completed" "true"
call "$JAR_A" PATCH "/api/assignments/$ASG1" '{"completed":false}';   check "untick it" 200 "j.completed" "false"
call "$JAR_A" PATCH "/api/assignments/$ASG1" '{"completed":"yes"}';   check "bad completed value -> 400" 400
call "$JAR_A" PATCH "/api/assignments/$ASG1" '{}';                    check "empty update -> 400" 400
call "$JAR_A" PATCH "/api/assignments/$ASG1" "{\"course_id\":$COURSE2}"; check "move to another of your courses" 200 "j.course_id==$COURSE2" "true"
call "$JAR_A" PATCH "/api/assignments/$ASG1" "{\"course_id\":$COURSE1}"; check "move it back" 200 "j.course_id==$COURSE1" "true"
call "$JAR_A" PATCH "/api/assignments/999999" '{"completed":true}';  check "update a missing assignment -> 404" 404
call "$JAR_A" DELETE "/api/assignments/$ASG3" "";                     check "delete assignment" 200
call "$JAR_A" GET "/api/assignments/$ASG3" "";                        check "deleted assignment is gone -> 404" 404

# ===========================================================================
section "6. Projects and steps"
# ===========================================================================
call "$JAR_A" POST /api/projects '{"title":"x"}';                     check "project without deadline -> 400" 400
call "$JAR_A" POST /api/projects "{\"title\":\"x\",\"deadline\":\"$(iso_in 500)\",\"course_id\":999999}"
check "project on a course that isn't yours -> 404" 404
call "$JAR_A" POST /api/projects "{\"title\":\"Final Project\",\"description\":\"Build a small web app\",\"deadline\":\"$(iso_in 504)\",\"course_id\":$COURSE1,\"steps\":[{\"week_number\":1,\"title\":\"Plan\"},{\"week_number\":2,\"title\":\"Build\"}]}"
check "create project with 2 steps" 201 'j.steps_total+"|"+j.course_name' "2|$COURSE1_NAME"
PROJ=$(jeval "j.id")
call "$JAR_A" GET "/api/projects/$PROJ" "";                           check "get project with its steps in order" 200 'j.steps.length+"|"+j.steps[0].title' "2|Plan"
call "$JAR_A" POST "/api/projects/$PROJ/steps" '{"week_number":3,"title":"Polish","description":"Final touches"}'
check "add a step" 201 "j.week_number" "3";  STEP=$(jeval "j.id")
call "$JAR_A" POST "/api/projects/$PROJ/steps" '{"week_number":0,"title":"x"}'; check "week_number 0 -> 400" 400
call "$JAR_A" PATCH "/api/projects/$PROJ/steps/$STEP" '{"completed":true}';       check "complete a step" 200 "j.completed" "true"
call "$JAR_A" GET "/api/projects/$PROJ" "";                           check "progress counts update" 200 'j.steps_completed+"/"+j.steps_total' "1/3"
call "$JAR_A" PATCH "/api/projects/$PROJ/steps/999999" '{"completed":true}'; check "update a missing step -> 404" 404
call "$JAR_A" DELETE "/api/projects/$PROJ/steps/$STEP" "";            check "delete a step" 200
call "$JAR_A" DELETE "/api/projects/$PROJ/steps/$STEP" "";            check "delete it again -> 404" 404
call "$JAR_A" PATCH "/api/projects/$PROJ" '{"title":"Capstone Project"}'; check "rename project" 200 "j.title" "Capstone Project"
call "$JAR_A" GET /api/projects "";                                   check "list projects" 200 "j.length" "1"
call "$JAR_A" GET "/api/projects?course_id=$COURSE2" "";              check "filter projects by another course" 200 "j.length" "0"

# ===========================================================================
section "7. Availability"
# ===========================================================================
call "$JAR_A" POST /api/availability "{\"name\":\"x\",\"category\":\"gym\",\"start_time\":\"$(iso_in 10)\",\"end_time\":\"$(iso_in 12)\"}"
check "unknown category -> 400" 400
call "$JAR_A" POST /api/availability "{\"name\":\"x\",\"category\":\"commute\",\"start_time\":\"$(iso_in 12)\",\"end_time\":\"$(iso_in 10)\"}"
check "end before start -> 400" 400
AV_START=$(iso_in 30); AV_END=$(iso_in 34)
call "$JAR_A" POST /api/availability "{\"name\":\"Evening Shift\",\"category\":\"work/JOB\",\"start_time\":\"$AV_START\",\"end_time\":\"$AV_END\",\"is_recurring\":true,\"recurrence_rule\":\"FREQ=WEEKLY\"}"
check "create recurring block (category normalised)" 201 'j.category+"|"+j.is_recurring' "Work/job|true"
AV1=$(jeval "j.id")
call "$JAR_A" GET /api/availability "";                               check "list blocks" 200 "j.length" "1"
call "$JAR_A" GET "/api/availability?category=commute" "";            check "filter by category" 200 "j.length" "0"
call "$JAR_A" GET "/api/availability?category=gym" "";                check "bad category filter -> 400" 400
call "$JAR_A" GET "/api/availability?from=$(iso_in 5000)&to=$(iso_in 5100)" ""
check "recurring block still listed for a far-future range" 200 "j.some(b=>b.id==$AV1)" "true"
call "$JAR_A" POST /api/availability "{\"name\":\"Bus\",\"category\":\"commute\",\"start_time\":\"$(iso_in 20)\",\"end_time\":\"$(iso_in 21)\"}"
check "create a one-off block" 201 "j.is_recurring" "false";  AV2=$(jeval "j.id")
call "$JAR_A" GET "/api/availability?from=$(iso_in 5000)&to=$(iso_in 5100)" ""
check "one-off block outside the range is hidden" 200 "j.some(b=>b.id==$AV2)" "false"
call "$JAR_A" PATCH "/api/availability/$AV1" '{"name":"Late Shift"}';  check "rename block" 200 "j.name" "Late Shift"
call "$JAR_A" PATCH "/api/availability/$AV1" "{\"end_time\":\"$(iso_in 1)\"}"
check "moving end_time before the STORED start -> 400" 400
call "$JAR_A" PATCH "/api/availability/$AV1" '{}';                    check "empty update -> 400" 400
call "$JAR_A" DELETE "/api/availability/$AV2" "";                     check "delete a block" 200
call "$JAR_A" DELETE "/api/availability/$AV2" "";                     check "delete it again -> 404" 404

# ===========================================================================
section "8. Study sessions (calendar)"
# ===========================================================================
call "$JAR_A" POST /api/study-sessions "{\"start_time\":\"$(iso_in 50)\",\"end_time\":\"$(iso_in 52)\"}"; check "session without title -> 400" 400
call "$JAR_A" POST /api/study-sessions "{\"title\":\"x\",\"start_time\":\"$(iso_in 52)\",\"end_time\":\"$(iso_in 50)\"}"; check "end before start -> 400" 400
call "$JAR_A" POST /api/study-sessions "{\"title\":\"x\",\"course_id\":999999,\"start_time\":\"$(iso_in 50)\",\"end_time\":\"$(iso_in 52)\"}"
check "session on a course that isn't yours -> 404" 404
call "$JAR_A" POST /api/study-sessions "{\"title\":\"x\",\"assignment_id\":999999,\"start_time\":\"$(iso_in 50)\",\"end_time\":\"$(iso_in 52)\"}"
check "session on an assignment that isn't yours -> 404" 404
call "$JAR_A" POST /api/study-sessions "{\"title\":\"Review PS3\",\"course_id\":$COURSE1,\"assignment_id\":$ASG1,\"start_time\":\"$(iso_in 50)\",\"end_time\":\"$(iso_in 52)\",\"source\":\"auto-generated\"}"
check "create session (client can't choose source)" 201 'j.source+"|"+j.course_name+"|"+j.assignment_title' "manual|$COURSE1_NAME|Problem Set 3"
SES1=$(jeval "j.id")
call "$JAR_A" GET "/api/study-sessions?from=$(iso_in 48)&to=$(iso_in 60)" ""; check "calendar range query includes it" 200 "j.some(s=>s.id==$SES1)" "true"
call "$JAR_A" GET "/api/study-sessions?from=$(iso_in 100)&to=$(iso_in 110)" ""; check "range query excludes it" 200 "j.some(s=>s.id==$SES1)" "false"
call "$JAR_A" GET "/api/study-sessions?completed=true" "";            check "filter completed=true" 200 "j.length" "0"
call "$JAR_A" PATCH "/api/study-sessions/$SES1" '{"completed":true}'; check "complete a session" 200 "j.completed" "true"
call "$JAR_A" PATCH "/api/study-sessions/$SES1" "{\"end_time\":\"$(iso_in 1)\"}"; check "end_time before the STORED start -> 400" 400
call "$JAR_A" PATCH "/api/study-sessions/$SES1" '{"course_id":999999}'; check "re-assign to a course that isn't yours -> 404" 404
call "$JAR_A" PATCH "/api/study-sessions/$SES1" '{}';                 check "empty update -> 400" 400
call "$JAR_A" DELETE "/api/study-sessions/$SES1" "";                  check "delete session" 200
call "$JAR_A" DELETE "/api/study-sessions/$SES1" "";                  check "delete again -> 404" 404

# ===========================================================================
section "9. Dashboard"
# ===========================================================================
call "$JAR_A" GET /api/dashboard/summary ""
check "summary numbers" 200 'j.course_count+"|"+j.assignments_total+"|"+j.assignments_completed+"|"+j.due_this_week+"|"+j.completion_percent+"|"+j.current_week' "2|2|0|2|0|8"
call "$JAR_A" GET "/api/dashboard/search?q=biology" "";               check "search finds the course" 200 "j.courses.length" "1"
call "$JAR_A" GET "/api/dashboard/search?q=problem" "";               check "search finds the assignment" 200 "j.assignments.length" "1"
call "$JAR_A" GET "/api/dashboard/search?q=%25" "";                  check "search for % is literal" 200 "j.courses.length+j.assignments.length" "0"
call "$JAR_A" GET /api/dashboard/search "";                           check "search without q -> 400" 400

# ===========================================================================
section "10. Users can't touch each other's data"
# ===========================================================================
call "$JAR_B" POST /api/courses '{"name":"B Course"}';                check "B creates a course" 201;  COURSE_B=$(jeval "j.id")
call "$JAR_B" POST /api/assignments "{\"course_id\":$COURSE_B,\"title\":\"B Task\",\"due_date\":\"$(iso_in 72)\"}"
check "B creates an assignment" 201;  ASG_B=$(jeval "j.id")
call "$JAR_B" GET /api/courses "";                                    check "B only sees its own courses" 200 "j.length" "1"
call "$JAR_B" GET /api/assignments "";                                check "B only sees its own assignments" 200 "j.length" "1"
call "$JAR_B" GET /api/dashboard/summary "";                          check "B's dashboard counts only B's data" 200 'j.course_count+"|"+j.assignments_total' "1|1"
call "$JAR_B" GET "/api/courses/$COURSE1" "";                         check "B reads A's course -> 404" 404
call "$JAR_B" PATCH "/api/courses/$COURSE1" '{"name":"hacked"}';      check "B edits A's course -> 404" 404
call "$JAR_B" DELETE "/api/courses/$COURSE1" "";                      check "B deletes A's course -> 404" 404
call "$JAR_B" GET "/api/assignments/$ASG1" "";                        check "B reads A's assignment -> 404" 404
call "$JAR_B" PATCH "/api/assignments/$ASG1" '{"completed":true}';    check "B edits A's assignment -> 404" 404
call "$JAR_B" DELETE "/api/assignments/$ASG1" "";                     check "B deletes A's assignment -> 404" 404
call "$JAR_B" POST /api/assignments "{\"course_id\":$COURSE1,\"title\":\"sneaky\",\"due_date\":\"$(iso_in 72)\"}"
check "B adds an assignment to A's course -> 404" 404
call "$JAR_A" POST /api/assignments "{\"course_id\":$COURSE_B,\"title\":\"sneaky\",\"due_date\":\"$(iso_in 72)\"}"
check "A adds an assignment to B's course -> 404" 404
call "$JAR_A" PATCH "/api/assignments/$ASG1" "{\"course_id\":$COURSE_B}"
check "A moves its assignment into B's course -> 404" 404
call "$JAR_B" POST /api/study-sessions "{\"title\":\"x\",\"assignment_id\":$ASG1,\"start_time\":\"$(iso_in 50)\",\"end_time\":\"$(iso_in 52)\"}"
check "B links a session to A's assignment -> 404" 404
call "$JAR_B" GET "/api/projects/$PROJ" "";                           check "B reads A's project -> 404" 404
call "$JAR_B" POST "/api/projects/$PROJ/steps" '{"week_number":1,"title":"x"}'; check "B adds a step to A's project -> 404" 404
call "$JAR_B" PATCH "/api/availability/$AV1" '{"name":"hacked"}';     check "B edits A's availability -> 404" 404

# ===========================================================================
section "11. URL id validation"
# ===========================================================================
for bad in 0 -5 1.5 99999999999 abc; do
  call "$JAR_A" GET "/api/courses/$bad" "";                           check "/api/courses/$bad -> 400" 400
done
call "$JAR_A" DELETE "/api/projects/$PROJ/steps/abc" "";              check "bad nested :stepId -> 400" 400

# ===========================================================================
section "12. Gemini: syllabus upload (no AI call for these)"
# ===========================================================================
call "$JAR_A" POST /api/syllabi "{\"course_id\":$COURSE1}";           check "no file and no text -> 400" 400
call "$JAR_A" POST /api/syllabi '{"text":"   "}';                      check "blank text and no file -> 400" 400
call "$JAR_B" POST /api/syllabi "{\"course_id\":$COURSE1,\"text\":\"hello\"}"
check "B uploads to A's course -> 404 (before any AI call)" 404
printf 'this is definitely not a pdf' > /tmp/fake-$RUN.pdf
TMPFILES="$TMPFILES /tmp/fake-$RUN.pdf /tmp/notes-$RUN.txt"
STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR_A" -X POST -F "course_id=$COURSE1" -F "file=@/tmp/fake-$RUN.pdf;type=application/pdf" "$BASE/api/syllabi")
check "fake PDF (wrong file signature) -> 400" 400 "j.error" "That file is not a valid PDF."
printf 'plain text' > /tmp/notes-$RUN.txt
STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR_A" -X POST -F "course_id=$COURSE1" -F "file=@/tmp/notes-$RUN.txt;type=text/plain" "$BASE/api/syllabi")
check "non-PDF upload -> 400" 400
STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR_A" -X POST -F "course_id=$COURSE1" -F "text=hi" -F "file=@/tmp/fake-$RUN.pdf;type=application/pdf" "$BASE/api/syllabi")
check "file AND text together -> 400" 400
call "$JAR_A" GET /api/syllabi "";                                    check "syllabus list starts empty" 200 "j.length" "0"
call "$JAR_A" GET /api/syllabi/999999 "";                             check "missing syllabus -> 404" 404

# ===========================================================================
section "12b. Onboarding status, and syllabi that have no course yet (no AI calls)"
# ===========================================================================
JAR_C=$(mktemp); TMPFILES="$TMPFILES $JAR_C"
USER_C="apitest_c_$RUN"
call "$JAR_C" POST /api/auth/register "{\"email\":\"$USER_C@example.com\",\"username\":\"$USER_C\",\"password\":\"password123\"}"; check "register a fresh user" 201
call "$JAR_C" POST /api/auth/login "{\"identifier\":\"$USER_C\",\"password\":\"password123\"}";                                  check "log in" 200
call "$JAR_C" GET /api/onboarding/status ""
check "a new user is told to start with availability (which is optional)" 200 'j.next_step+"|"+j.completed+"|"+j.steps.availability.optional+"|"+j.pending_syllabus_id' "availability|false|true|null"
check "status lists every step" 200 'Object.keys(j.steps).sort().join(",")' "availability,plan,syllabus"
call "$JAR_C" POST /api/availability "{\"name\":\"Job\",\"category\":\"Work/job\",\"start_time\":\"$(iso_in 24)\",\"end_time\":\"$(iso_in 26)\"}"; check "add an availability block" 201
call "$JAR_C" GET /api/onboarding/status "";                           check "then the app is told to ask for a syllabus" 200 'j.next_step+"|"+j.steps.availability.done' "syllabus|true"

call "$JAR_C" POST /api/syllabi '{"course_id":"abc","text":"x"}';      check "a non-numeric course_id -> 400" 400
call "$JAR_C" POST /api/syllabi "{\"course_id\":$COURSE1,\"text\":\"x\"}"; check "uploading into someone else's course -> 404 (before any AI call)" 404
call "$JAR_C" GET "/api/syllabi?status=pending" "";                    check "no pending syllabi yet" 200 "j.length" "0"
call "$JAR_C" GET "/api/syllabi?status=bogus" "";                      check "unknown status filter -> 400" 400
call "$JAR_C" POST /api/syllabi/999999/apply '{}';                     check "apply a syllabus that doesn't exist -> 404" 404
call "$JAR_C" DELETE /api/syllabi/999999 "";                           check "delete a syllabus that doesn't exist -> 404" 404
call "$JAR_C" POST /api/syllabi/999999/apply '{"assignments":"nope"}'; check "assignments must be an array -> 400" 400
call "$JAR_C" POST /api/syllabi/999999/apply '{"course":"Biology"}';   check "course must be an object -> 400" 400
call "$JAR_C" POST /api/syllabi/999999/apply '{"assignments":[{"title":"x"}]}'
check "an edited assignment without a due date -> 400 naming the item" 400 "j.error" "assignments[0].due_date is required"
call "$JAR_C" POST /api/syllabi/999999/apply '{"class_schedule":[{"day_of_week":"Monday","start_time":"11:00","end_time":"10:00"}]}'
check "an edited class time that ends before it starts -> 400" 400
call "$JAR_C" POST /api/syllabi/999999/apply '{"assignments":[],"assignment_indexes":[0]}'
check "assignments and assignment_indexes together -> 400" 400

if [ "$SKIP_AI" = "1" ]; then
  section "AI tests skipped (SKIP_AI=1)"
else

# ===========================================================================
section "13. Gemini: syllabus -> assignments  (real API calls; takes a few seconds each)"
# ===========================================================================
SYL_TEXT="BIO 120 General Biology, instructor Dr. Patel, Fall 2026. Lectures are Tuesday and Thursday 1:00 PM to 2:15 PM. Assignments: Lab Report 4 is due $(date_text 10) at 11:59 PM. Problem Set 5 is due $(date_text 14). The midterm exam is on $(date_text 20) at 2:30 PM. Late work is not accepted."
PAYLOAD=$(node -e 'console.log(JSON.stringify({course_id: Number(process.argv[1]), text: process.argv[2]}))' "$COURSE1" "$SYL_TEXT")
ai_pause
call "$JAR_A" POST /api/syllabi "$PAYLOAD"
check "pasted syllabus is analysed" 201 "Array.isArray(j.parsed.assignments) && j.parsed.assignments.length >= 2" "true"
if [ "$STATUS" != "201" ]; then
  note "Skipping the checks that depend on this call (they would only repeat the same failure)."
else
SYL=$(id_of)
note "Gemini found: $(jeval 'j.parsed.assignments.length') assignments, $(jeval 'j.parsed.class_schedule.length') class times, $(jeval 'j.parsed.warnings.length') warnings"
note "assignments: $(jeval 'j.parsed.assignments.map(a=>a.title+" ("+(a.due_date||"no date")+")").join("; ")')"
check "extracted due dates are real future timestamps" 201 "j.parsed.assignments.some(a=>a.due_date && new Date(a.due_date) > new Date())" "true"
check "not applied yet" 201 "j.applied_at" "null"
call "$JAR_A" GET "/api/syllabi/$SYL" "";                             check "fetch the extraction for review" 200 "j.parsed.assignments.length >= 2" "true"
call "$JAR_A" GET "/api/syllabi?course_id=$COURSE1" "";               check "syllabus history lists it" 200 "j[0].id==$SYL && j[0].assignment_count >= 2" "true"
call "$JAR_B" GET "/api/syllabi/$SYL" "";                             check "B reads A's syllabus -> 404" 404
call "$JAR_B" POST "/api/syllabi/$SYL/apply" '{}';                    check "B applies A's syllabus -> 404" 404
call "$JAR_A" POST "/api/syllabi/$SYL/apply" '{"assignment_indexes":[999]}'; check "apply with out-of-range index -> 400" 400
call "$JAR_A" POST "/api/syllabi/$SYL/apply" '{"apply_schedule":true,"apply_course_info":true}'
check "apply to the course" 200 "j.assignments_created >= 1" "true"
note "applied: $(jeval 'JSON.stringify(j)')"
call "$JAR_A" POST "/api/syllabi/$SYL/apply" '{}';                    check "applying twice -> 409 (no duplicates)" 409
call "$JAR_A" GET "/api/assignments?course_id=$COURSE1" "";           check "new assignments exist on the course" 200 "j.length >= 3" "true"
call "$JAR_A" GET "/api/syllabi/$SYL" "";                             check "syllabus now marked as applied" 200 "j.applied_at !== null" "true"

if [ -n "$PDF" ] && [ -f "$PDF" ]; then
  STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR_A" -X POST -F "course_id=$COURSE2" -F "file=@$PDF;type=application/pdf" "$BASE/api/syllabi")
  check "real PDF is analysed" 201 "Array.isArray(j.parsed.assignments)" "true"
  note "PDF result: $(jeval 'j.parsed.course.name') / $(jeval 'j.parsed.assignments.length') assignments / filename $(jeval 'j.original_filename')"
else
  note "(set PDF=/path/to/syllabus.pdf to also test a real PDF upload)"
fi
fi

# ===========================================================================
section "13b. Gemini: upload with NO course, edit it, approve it (the course is created)"
# ===========================================================================
NEW_TEXT="CHEM 101 Intro Chemistry, Spring 2027. Instructor: Dr. Okafor. Lectures Tuesday and Thursday 9:00 AM to 10:15 AM. Problem Set 1 is due $(date_text 12) at 11:59 PM. The final exam is on $(date_text 20) at 1:00 PM."
PAYLOAD=$(node -e 'console.log(JSON.stringify({text: process.argv[1]}))' -- "$NEW_TEXT")
ai_pause
call "$JAR_A" POST /api/syllabi "$PAYLOAD"
check "a syllabus can be uploaded before any course exists" 201 'j.course_id===null && j.status==="pending"' "true"
if [ "$STATUS" != "201" ]; then
  note "Skipping the rest of this section (the AI call failed)."
else
SYL_NEW=$(id_of)
call "$JAR_A" GET /api/courses "";                                     check "the course list did not change" 200 "j.length" "2"
call "$JAR_A" GET /api/onboarding/status ""
check "status points at the review screen, with this syllabus" 200 "j.next_step+\"|\"+(j.pending_syllabus_id==$SYL_NEW)" "review_syllabus|true"
call "$JAR_A" GET "/api/syllabi?status=pending" "";                    check "it is listed as pending" 200 "j.length===1 && j[0].id==$SYL_NEW && j[0].course_id===null" "true"
call "$JAR_B" POST "/api/syllabi/$SYL_NEW/apply" '{}';                 check "B can't approve A's syllabus -> 404" 404
EDITED="{\"course\":{\"name\":\"Intro Chemistry (edited)\",\"color_code\":\"#1565C0\"},\"class_schedule\":[{\"day_of_week\":\"tuesday\",\"start_time\":\"09:00\",\"end_time\":\"10:15\"}],\"assignments\":[{\"title\":\"Problem Set 1 (edited)\",\"due_date\":\"$(iso_in 288)\",\"estimated_hours\":2.5},{\"title\":\"Added by the student\",\"due_date\":\"$(iso_in 300)\"}]}"
call "$JAR_A" POST "/api/syllabi/$SYL_NEW/apply" "$EDITED"
check "approve with edits: the course is created from them" 200 'j.course_created===true && j.assignments_created===2 && j.schedule_applied===true' "true"
COURSE_NEW=$(jeval "j.course_id")
call "$JAR_A" GET "/api/courses/$COURSE_NEW" ""
check "the course has exactly what the student approved" 200 'j.name+"|"+j.color_code+"|"+j.assignments.length+"|"+j.schedules.length+"|"+j.schedules[0].day_of_week' "Intro Chemistry (edited)|#1565C0|2|1|Tuesday"
check "details the student did not edit were kept (teacher)" 200 '/okafor/i.test(j.teacher_name||"")' "true"
call "$JAR_A" GET /api/courses "";                                     check "the new course is in the list" 200 "j.length" "3"
call "$JAR_A" GET "/api/syllabi/$SYL_NEW" "";                          check "the syllabus is applied and linked to the new course" 200 "j.status+\"|\"+(j.course_id==$COURSE_NEW)" "applied|true"
call "$JAR_A" POST "/api/syllabi/$SYL_NEW/apply" '{}';                 check "approving twice -> 409" 409
fi

# ===========================================================================
section "14. Gemini: study plan"
# ===========================================================================
call "$JAR_A" POST /api/study-plan/generate '{"days":99}';                      check "days out of range -> 400" 400
call "$JAR_A" POST /api/study-plan/generate '{"day_start":"20:00","day_end":"08:00"}'; check "day_end before day_start -> 400" 400
call "$JAR_A" POST /api/study-plan/generate '{"max_session_minutes":5}';        check "max_session_minutes too small -> 400" 400
call "$JAR_A" POST /api/study-plan/generate '{"dry_run":"yes"}';                check "dry_run must be a boolean -> 400" 400

ai_pause
call "$JAR_A" POST /api/study-plan/generate '{"days":14,"dry_run":true}'
check "dry run returns a proposal" 200 "Array.isArray(j.sessions) && j.sessions.length >= 1" "true"
if [ "$STATUS" != "200" ]; then
  note "Skipping the rest of the study-plan checks (the AI call failed)."
else
note "proposed $(jeval 'j.sessions.length') sessions; rejected by the safety checks: $(jeval 'j.rejected_count'); notes: $(jeval 'j.notes')"
check "every proposed session ends after it starts" 200 "j.sessions.every(s=>new Date(s.end_time) > new Date(s.start_time))" "true"
check "no two proposed sessions overlap" 200 "(()=>{const s=[...j.sessions].sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)); return s.every((x,i)=>i===0||new Date(x.start_time)>=new Date(s[i-1].end_time));})()" "true"
check "no proposed session is longer than 2 hours" 200 "j.sessions.every(s=>(new Date(s.end_time)-new Date(s.start_time))<=120*60000)" "true"
call "$JAR_A" GET "/api/study-sessions?completed=false" "";                     check "a dry run saved nothing" 200 "j.filter(s=>s.source==='auto-generated').length" "0"

ai_pause
call "$JAR_A" POST /api/study-plan/generate '{"days":14}'
check "generate and save a plan" 201 "j.sessions.length >= 1 && j.sessions.every(s=>s.source==='auto-generated')" "true"
if [ "$STATUS" != "201" ]; then
  note "Skipping the checks on the saved plan (the AI call failed)."
else
N1=$(jeval "j.sessions.length")
check "no session overlaps your recurring work block" 201 "j.sessions.every(s=>![0,7,14].some(w=>new Date(s.start_time) < new Date(Date.parse('$AV_END')+w*864e5) && new Date(s.end_time) > new Date(Date.parse('$AV_START')+w*864e5)))" "true"
GEN_JSON=$(cat "$BODY")
call "$JAR_A" GET /api/assignments ""
DUE_OK=$(node -e 'const s=JSON.parse(process.argv[1]).sessions, a=JSON.parse(process.argv[2]); console.log(s.every(x=>{const as=a.find(y=>y.id===x.assignment_id); return !!as && new Date(x.end_time) <= new Date(as.due_date);}))' -- "$GEN_JSON" "$(cat "$BODY")" 2>/dev/null)
if [ "$DUE_OK" = "true" ]; then pass "every session finishes before its assignment is due"; else fail "every session finishes before its assignment is due (got $DUE_OK)"; fi
call "$JAR_A" GET "/api/study-sessions?from=$(iso_in 0)&to=$(iso_in 400)" ""
check "saved sessions show up on the calendar" 200 "j.filter(s=>s.source==='auto-generated').length" "$N1"

ai_pause
call "$JAR_A" POST /api/study-plan/generate '{"days":14}'
check "regenerating removes the old plan" 201 "j.replaced_previous >= 1" "true"
if [ "$STATUS" = "201" ]; then
  N2=$(jeval "j.sessions.length")
  call "$JAR_A" GET "/api/study-sessions?from=$(iso_in 0)&to=$(iso_in 400)" ""
  check "no duplicate/overlapping sessions after regenerating" 200 "(()=>{const s=j.filter(x=>x.source==='auto-generated').sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)); return s.length >= $N2 && s.every((x,i)=>i===0||new Date(x.start_time)>=new Date(s[i-1].end_time));})()" "true"
fi
fi
ai_pause
call "$JAR_B" POST /api/study-plan/generate '{"days":7,"dry_run":true}'
check "B's plan only ever uses B's assignments" 200 "j.sessions.every(s=>s.assignment_id==$ASG_B)" "true"
fi

# ===========================================================================
section "15. Gemini: project steps"
# ===========================================================================
call "$JAR_B" POST "/api/projects/$PROJ/generate-steps" '{}';                  check "B generates steps for A's project -> 404" 404
call "$JAR_A" POST "/api/projects/$PROJ/generate-steps" '{}';                  check "project already has steps -> 409" 409
call "$JAR_A" POST "/api/projects/$PROJ/generate-steps" '{"replace":"yes"}';   check "replace must be a boolean -> 400" 400
ai_pause
call "$JAR_A" POST "/api/projects/$PROJ/generate-steps" '{"replace":true}'
check "regenerate steps with replace:true" 201 "Array.isArray(j) && j.length >= 3" "true"
if [ "$STATUS" = "201" ]; then
  note "steps: $(jeval 'j.map(s=>"wk"+s.week_number+": "+s.title).join(" | ")')"
  check "steps run from week 1 and are sorted" 201 "j[0].week_number===1 && j.every((s,i)=>i===0||s.week_number>=j[i-1].week_number)" "true"
fi
call "$JAR_A" POST /api/projects "{\"title\":\"Overdue\",\"deadline\":\"$(iso_in -48)\"}"
check "create a project whose deadline passed" 201;  PROJ_OLD=$(id_of)
call "$JAR_A" POST "/api/projects/$PROJ_OLD/generate-steps" '{}';              check "deadline already passed -> 400" 400
fi

# ===========================================================================
section "16. Cleanup and logout"
# ===========================================================================
call "$JAR_A" DELETE "/api/courses/$COURSE1" "";                      check "delete course 1" 200
call "$JAR_A" GET "/api/courses/$COURSE1" "";                         check "deleted course is gone -> 404" 404
call "$JAR_A" GET "/api/assignments?course_id=$COURSE1" "";           check "its assignments were deleted with it (cascade)" 200 "j.length" "0"
call "$JAR_A" DELETE "/api/courses/$COURSE2" "";                      check "delete course 2" 200
call "$JAR_A" DELETE "/api/courses/$COURSE2" "";                      check "delete again -> 404" 404
if [ -n "$COURSE_NEW" ]; then call "$JAR_A" DELETE "/api/courses/$COURSE_NEW" ""; check "delete the course created from the syllabus" 200; fi
call "$JAR_A" DELETE "/api/projects/$PROJ" "";                        check "delete project" 200
if [ -n "$PROJ_OLD" ]; then call "$JAR_A" DELETE "/api/projects/$PROJ_OLD" ""; check "delete the overdue project" 200; fi
call "$JAR_A" GET "/api/projects/$PROJ" "";                           check "deleted project is gone -> 404" 404
call "$JAR_A" DELETE "/api/availability/$AV1" "";                     check "delete availability block" 200
call "$JAR_B" DELETE "/api/courses/$COURSE_B" "";                     check "B deletes its own course" 200
call "$JAR_A" POST /api/auth/logout "";                               check "logout" 200 "j.message" "Logged out"
call "$JAR_A" GET /api/auth/me "";                                    check "after logout the cookie is gone -> 401" 401

# ---------------------------------------------------------------------------
printf "\n%s== Summary ==%s\n" "$BOLD" "$RESET"
if [ "$FAIL" -eq 0 ]; then
  printf "  %s%d passed, 0 failed%s\n" "$GREEN" "$PASS" "$RESET"
else
  printf "  %s%d passed, %d failed%s\n" "$RED" "$PASS" "$FAIL" "$RESET"
fi
note "Test users were left in the database. To remove them (cascades to all their data), run in Neon:"
note "  DELETE FROM users WHERE username LIKE 'apitest\\_%';"
[ "$FAIL" -eq 0 ]