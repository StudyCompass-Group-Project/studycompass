#!/usr/bin/env bash
# StudyCompass ONBOARDING test: the first-run experience, step by step.
#
#   1. a brand-new user registers and logs in
#   2. sets their study availability (work, commute, family, campus)
#   3. uploads their first syllabus -> reviews it -> applies it to a course
#   4. gets their first study plan (made by Gemini, then verified against their calendar)
#   5. logs in again later and the app can tell onboarding is finished
#   + a second user who SKIPS the availability step and still gets a usable plan
#
#   bash tests/onboarding-test.sh                          uses a short built-in syllabus (pasted text)
#   PDF=/path/to/syllabus.pdf bash tests/onboarding-test.sh   uses your real PDF instead
#   AI_PAUSE=0 ...                                         no waiting between Gemini calls
#   BASE=http://localhost:5000 ...                         change the server address
#
# Makes 3 Gemini calls (syllabus, plan, plan for the second user). Run it from server/.
# Needs curl and node. Works with macOS's bash 3.2.

BASE="${BASE:-http://localhost:5000}"
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


MODE="text"
if [ -n "$PDF" ] && [ -f "$PDF" ]; then MODE="pdf"; fi
TZ_NAME="America/Los_Angeles"

# ---------------------------------------------------------------------------
# Calendar helpers. They are written independently of the server's own timezone code,
# so a bug there can't hide itself in this test.
# ---------------------------------------------------------------------------

# local_iso YYYY-MM-DD HH:MM -> the UTC instant for that wall-clock time in $TZ_NAME
local_iso() {
  node -e '
    const [date, time, tz] = process.argv.slice(1);
    const [y, m, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number);
    const off = (ms) => {
      const v = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
        .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName").value;
      const x = /GMT([+-])(\d{2}):(\d{2})/.exec(v);
      return x ? (x[1] === "-" ? -1 : 1) * (Number(x[2]) * 60 + Number(x[3])) * 60000 : 0;
    };
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let t = guess - off(guess); t = guess - off(t);
    console.log(new Date(t).toISOString());
  ' -- "$1" "$2" "$TZ_NAME"
}

# recent_weekday N -> the most recent date (YYYY-MM-DD, in $TZ_NAME) on weekday N (0=Sun..6=Sat)
recent_weekday() {
  node -e '
    const [target, tz] = process.argv.slice(1);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const base = Date.parse(today + "T00:00:00Z");
    const wd = new Date(base).getUTCDay();
    console.log(new Date(base - ((wd - Number(target) + 7) % 7) * 864e5).toISOString().slice(0, 10));
  ' -- "$1" "$TZ_NAME"
}

# verify_calendar SESSIONS_JSON EXTRA_BUSY_JSON CLASSES_JSON
#   Prints "ok", or every way the sessions break the rules: they must sit inside the
#   08:00-22:00 study window (local time) and never overlap a busy block or a class.
verify_calendar() {
  node -e '
    const [sessionsJson, busyJson, classesJson, tz] = process.argv.slice(1);
    const sessions = JSON.parse(sessionsJson), extra = JSON.parse(busyJson), classes = JSON.parse(classesJson);
    const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const loc = (iso) => { const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value])); return { day: p.weekday, date: p.year + "-" + p.month + "-" + p.day, min: Number(p.hour) * 60 + Number(p.minute) }; };
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const busy = [
      ...extra.map((b) => ({ name: b.name, days: b.days.map((i) => DAYS[i]), s: toMin(b.start), e: toMin(b.end) })),
      ...classes.map((c) => ({ name: "class", days: [c.day_of_week], s: toMin(c.start_time), e: toMin(c.end_time) })),
    ];
    const problems = [];
    for (const s of sessions) {
      const a = loc(s.start_time), b = loc(s.end_time);
      if (a.date !== b.date) { problems.push("a session crosses midnight"); continue; }
      if (a.min < 480 || b.min > 1320) problems.push("outside 08:00-22:00: " + a.day + " " + a.min + "-" + b.min);
      for (const x of busy) if (x.days.includes(a.day) && a.min < x.e && b.min > x.s) problems.push("overlaps " + x.name + " on " + a.day);
    }
    console.log(problems.length ? problems.join("; ") : "ok");
  ' -- "$1" "$2" "$3" "$TZ_NAME"
}

# verify_coverage SESSIONS_JSON ASSIGNMENTS_JSON
#   Every unfinished assignment due within 14 days must get study time, no more than its
#   estimated hours + 1, and every session must end before the assignment is due.
verify_coverage() {
  node -e '
    const sessions = JSON.parse(process.argv[1]), assignments = JSON.parse(process.argv[2]);
    const now = Date.now(), horizon = now + 14 * 864e5, problems = [];
    for (const a of assignments) {
      const due = Date.parse(a.due_date);
      if (a.completed || due <= now || due > horizon) continue;
      const mine = sessions.filter((s) => s.assignment_id === a.id);
      if (mine.length === 0) problems.push("no study time for " + a.title);
      const hours = mine.reduce((t, s) => t + (Date.parse(s.end_time) - Date.parse(s.start_time)) / 36e5, 0);
      const cap = (a.estimated_hours ?? 2) + 1;
      if (hours > cap) problems.push(a.title + ": " + hours + "h planned, cap " + cap + "h");
      if (mine.some((s) => Date.parse(s.end_time) > due)) problems.push(a.title + ": a session ends after the due date");
    }
    console.log(problems.length ? problems.join("; ") : "ok");
  ' -- "$1" "$2"
}

expect_ok() { # expect_ok "name" "$value-that-should-be-ok"
  if [ "$2" = "ok" ]; then pass "$1"; else STATUS="-"; : > "$BODY"; fail "$1 -> $2"; fi
}

# ---------------------------------------------------------------------------
RUN="$RANDOM$RANDOM"
USER_A="onboard_a_$RUN"; EMAIL_A="$USER_A@example.com"; PW="password123"
USER_B="onboard_b_$RUN"; EMAIL_B="$USER_B@example.com"

call "$JAR_X" GET /api/health ""
if [ "$STATUS" = "000" ]; then
  echo "Can't reach $BASE. Is the server running (npm run dev)?"
  exit 2
fi
echo "Syllabus source: $MODE   |   timezone used: $TZ_NAME"

# ===========================================================================
section "1. A brand-new user signs up"
# ===========================================================================
call "$JAR_A" POST /api/auth/register "{\"email\":\"$EMAIL_A\",\"username\":\"$USER_A\",\"password\":\"$PW\"}"
check "create the account" 201 "j.user.username" "$USER_A"
call "$JAR_A" POST /api/auth/login "{\"identifier\":\"$EMAIL_A\",\"password\":\"$PW\"}"
check "log in" 200
call "$JAR_A" GET /api/auth/me "";                                     check "the app can load the current user" 200 "j.user.email" "$EMAIL_A"
call "$JAR_A" PATCH /api/settings "{\"timezone\":\"$TZ_NAME\"}"
check "the client saves the browser's timezone" 200 "j.timezone" "$TZ_NAME"

note "Everything starts empty:"
call "$JAR_A" GET /api/courses "";                                     check "no courses yet" 200 "j.length" "0"
call "$JAR_A" GET /api/assignments "";                                 check "no assignments yet" 200 "j.length" "0"
call "$JAR_A" GET /api/availability "";                                check "no availability yet" 200 "j.length" "0"
call "$JAR_A" GET /api/study-sessions "";                              check "no study sessions yet" 200 "j.length" "0"
call "$JAR_A" GET /api/syllabi "";                                     check "no syllabi yet" 200 "j.length" "0"
call "$JAR_A" GET /api/dashboard/summary ""
check "dashboard shows zeros" 200 'j.course_count+"|"+j.assignments_total+"|"+j.completion_percent+"|"+j.active_credits' "0|0|0|0"

note "Pressing buttons out of order must fail politely:"
call "$JAR_A" POST /api/study-plan/generate '{}'
check "plan with nothing to plan -> friendly message, no AI call" 200 'j.sessions.length+"|"+j.message.startsWith("Nothing to plan")' "0|true"
call "$JAR_A" POST /api/syllabi '{"text":"hello"}';                   check "syllabus without a course -> 400" 400
call "$JAR_A" POST /api/syllabi '{"course_id":999999,"text":"hello"}'; check "syllabus for a course that doesn't exist -> 404" 404

# ===========================================================================
section "2. Step 1: set study availability"
# ===========================================================================
# Recurring blocks: the first occurrence is the most recent matching day, so they apply from now on.
MON=$(recent_weekday 1); SUN=$(recent_weekday 0); TUE=$(recent_weekday 2)
call "$JAR_A" POST /api/availability "{\"name\":\"Part-time job\",\"category\":\"Work/job\",\"start_time\":\"$(local_iso $MON 17:00)\",\"end_time\":\"$(local_iso $MON 21:00)\",\"is_recurring\":true,\"recurrence_rule\":\"FREQ=WEEKLY;BYDAY=MO,WE,FR\"}"
check "work: Mon/Wed/Fri 5pm-9pm" 201 'j.category+"|"+j.is_recurring' "Work/job|true"
call "$JAR_A" POST /api/availability "{\"name\":\"Commute\",\"category\":\"commute\",\"start_time\":\"$(local_iso $MON 07:30)\",\"end_time\":\"$(local_iso $MON 08:30)\",\"is_recurring\":true,\"recurrence_rule\":\"FREQ=DAILY\"}"
check "commute: every day 7:30am-8:30am" 201 "j.category" "commute"
call "$JAR_A" POST /api/availability "{\"name\":\"Family dinner\",\"category\":\"family/personal\",\"start_time\":\"$(local_iso $SUN 18:00)\",\"end_time\":\"$(local_iso $SUN 20:00)\",\"is_recurring\":true,\"recurrence_rule\":\"FREQ=WEEKLY;BYDAY=SU\"}"
check "family: Sundays 6pm-8pm" 201 "j.category" "family/personal"
call "$JAR_A" POST /api/availability "{\"name\":\"Robotics club\",\"category\":\"campus organization\",\"start_time\":\"$(local_iso $TUE 18:30)\",\"end_time\":\"$(local_iso $TUE 20:00)\",\"is_recurring\":true,\"recurrence_rule\":\"FREQ=WEEKLY;BYDAY=TU\"}"
check "campus: Tuesdays 6:30pm-8pm" 201 "j.category" "campus organization"

call "$JAR_A" GET /api/availability "";                                check "all four blocks are saved" 200 "j.length" "4"
call "$JAR_A" GET "/api/availability?category=commute" "";             check "can filter by category" 200 "j.length" "1"
call "$JAR_A" GET "/api/availability?from=$(iso_in 2000)&to=$(iso_in 2100)" ""
check "recurring blocks show up in any date range" 200 "j.length" "4"
call "$JAR_A" POST /api/study-plan/generate '{}'
check "still nothing to plan before a syllabus exists" 200 'j.sessions.length' "0"

# ===========================================================================
section "3. Step 2: upload the first syllabus"
# ===========================================================================
call "$JAR_A" POST /api/courses '{"name":"New course"}'
check "the app creates a course to attach it to" 201 "j.name" "New course"
COURSE=$(id_of)
SYL_OK=0
PLAN_OK=0

SYL_TEXT="BIO 120: General Biology, Fall 2026. Instructor: Dr. Patel. Lectures meet Monday and Wednesday from 10:00 AM to 11:15 AM. Assignments: Lab Report 1 is due $(date_text 6) at 11:59 PM. Problem Set 2 is due $(date_text 9). The midterm exam is on $(date_text 13) at 2:30 PM. Late work is not accepted."
ai_pause
if [ "$MODE" = "pdf" ]; then
  STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR_A" -c "$JAR_A" -X POST -F "course_id=$COURSE" -F "file=@$PDF;type=application/pdf" "$BASE/api/syllabi")
else
  PAYLOAD=$(node -e 'console.log(JSON.stringify({course_id: Number(process.argv[1]), text: process.argv[2]}))' -- "$COURSE" "$SYL_TEXT")
  call "$JAR_A" POST /api/syllabi "$PAYLOAD"
fi
check "Gemini reads the syllabus" 201 "Array.isArray(j.parsed.assignments) && j.parsed.assignments.length >= 1" "true"
if [ "$STATUS" != "201" ]; then
  note "Skipping the rest of the onboarding flow: it needs the syllabus to be analysed."
else
SYL_OK=1
SYL=$(id_of)
EXTRACTED_NAME=$(jeval "j.parsed.course.name")
note "found: $(jeval 'j.parsed.assignments.length') assignments, $(jeval 'j.parsed.class_schedule.length') class times; course name: $EXTRACTED_NAME"
check "nothing is applied yet (the student reviews first)" 201 "j.applied_at" "null"

if [ "$MODE" = "text" ]; then
  check "found the course name, teacher and semester" 201 '/biology/i.test(j.parsed.course.name||"") && /patel/i.test(j.parsed.course.teacher_name||"") && /fall/i.test(j.parsed.course.semester||"")' "true"
  check "found Monday AND Wednesday 10:00-11:15 class times" 201 "['Monday','Wednesday'].every(d=>j.parsed.class_schedule.some(c=>c.day_of_week===d && c.start_time==='10:00:00' && c.end_time==='11:15:00'))" "true"
  check "found all 3 assignments with real future dates" 201 "j.parsed.assignments.length>=3 && j.parsed.assignments.every(a=>a.due_date && new Date(a.due_date)>new Date())" "true"
  check "the 11:59 PM deadline was converted from Pacific time" 201 "j.parsed.assignments.some(a=>new Date(a.due_date).toISOString().slice(11,16) === '07:59')" "true"
fi

call "$JAR_A" GET "/api/syllabi/$SYL" "";                              check "the review screen can load it" 200 "j.parsed.assignments.length >= 1 && j.applied_at === null" "true"

if [ -n "$EXTRACTED_NAME" ] && [ "$EXTRACTED_NAME" != "null" ]; then
  RENAME=$(node -e 'console.log(JSON.stringify({name: process.argv[1]}))' -- "$EXTRACTED_NAME")
  call "$JAR_A" PATCH "/api/courses/$COURSE" "$RENAME";                check "the course takes the name found in the syllabus" 200 "j.name" "$EXTRACTED_NAME"
fi

call "$JAR_A" POST "/api/syllabi/$SYL/apply" '{"apply_schedule":true,"apply_course_info":true}'
check "the student confirms: assignments are created" 200 "j.assignments_created >= 1" "true"
note "applied: $(cat "$BODY")"

call "$JAR_A" GET "/api/courses/$COURSE" ""
check "the course has its assignments" 200 "j.assignments.length >= 1" "true"
if [ "$MODE" = "text" ]; then
  check "the course has the weekly class times" 200 "j.schedules.some(s=>s.day_of_week==='Monday') && j.schedules.some(s=>s.day_of_week==='Wednesday')" "true"
  check "the blank teacher name was filled in" 200 '/patel/i.test(j.teacher_name||"")' "true"
fi
call "$JAR_A" GET /api/courses "";                                     check "the course card shows upcoming deadlines" 200 "j[0].next_deadlines.length >= 1 && j[0].assignments_total >= 1" "true"
call "$JAR_A" GET /api/dashboard/summary "";                           check "dashboard now counts the course and assignments" 200 "j.course_count===1 && j.assignments_total >= 1" "true"
call "$JAR_A" GET "/api/syllabi?course_id=$COURSE" "";                 check "extraction history shows it as applied" 200 "j.length===1 && j[0].applied_at !== null" "true"
fi

# ===========================================================================
section "4. Step 3: the first study plan"
# ===========================================================================
if [ "$SYL_OK" != "1" ]; then
  note "Skipped (the syllabus step did not complete)."
else
ai_pause
call "$JAR_A" POST /api/study-plan/generate '{}'
check "Gemini creates the first plan" 201 "j.sessions.length >= 1 && j.sessions.every(s=>s.source==='auto-generated' && s.course_id==$COURSE)" "true"
if [ "$STATUS" != "201" ]; then
  note "Skipping the plan checks (the AI call failed)."
else
PLAN_JSON=$(cat "$BODY")
PLAN_OK=1
note "plan: $(jeval 'j.sessions.length') sessions. Gemini says: $(jeval 'j.notes')"
check "no proposals were rejected by the safety checks" 201 "j.rejected_count" "0"

call "$JAR_A" GET "/api/courses/$COURSE" "";   CLASSES_JSON=$(jeval "j.schedules")
call "$JAR_A" GET /api/assignments "";         ASSIGN_JSON=$(cat "$BODY")
EXTRA_BUSY='[{"name":"work","days":[1,3,5],"start":"17:00","end":"21:00"},{"name":"commute","days":[0,1,2,3,4,5,6],"start":"07:30","end":"08:30"},{"name":"family dinner","days":[0],"start":"18:00","end":"20:00"},{"name":"campus org","days":[2],"start":"18:30","end":"20:00"}]'
SESSIONS_ONLY=$(node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]).sessions))' -- "$PLAN_JSON")

expect_ok "every session is inside 8am-10pm and avoids work, commute, family, campus and class" "$(verify_calendar "$SESSIONS_ONLY" "$EXTRA_BUSY" "$CLASSES_JSON")"
expect_ok "every assignment gets study time, within its hour estimate, finished before it is due" "$(verify_coverage "$SESSIONS_ONLY" "$ASSIGN_JSON")"

call "$JAR_A" GET "/api/study-sessions?from=$(iso_in 0)&to=$(iso_in 400)" ""
N=$(node -e 'console.log(JSON.parse(process.argv[1]).sessions.length)' -- "$PLAN_JSON")
check "the plan appears on the calendar" 200 "j.filter(s=>s.source==='auto-generated').length" "$N"
call "$JAR_A" GET /api/courses "";                                     check "the course card shows this week's study sessions" 200 "typeof j[0].study_sessions_this_week === 'number'" "true"
fi
fi

# ===========================================================================
section "5. Coming back later: is onboarding finished?"
# ===========================================================================
call "$JAR_X" POST /api/auth/login "{\"identifier\":\"$USER_A\",\"password\":\"$PW\"}"
check "log in again from a fresh browser" 200
call "$JAR_X" GET /api/availability "";    HAS_AVAIL=$(jeval "j.length > 0")
call "$JAR_X" GET /api/courses "";         HAS_COURSE=$(jeval "j.length > 0")
call "$JAR_X" GET /api/syllabi "";         HAS_SYL=$(jeval "j.some(s=>s.applied_at !== null)")
call "$JAR_X" GET /api/study-sessions "";  HAS_PLAN=$(jeval "j.length > 0")
note "availability=$HAS_AVAIL  course=$HAS_COURSE  applied syllabus=$HAS_SYL  study plan=$HAS_PLAN"
[ "$HAS_AVAIL" = "true" ]  && pass "availability step detected as done"       || { STATUS="-"; : > "$BODY"; fail "availability step detected as done"; }
[ "$HAS_COURSE" = "true" ] && pass "course exists"                            || { STATUS="-"; : > "$BODY"; fail "course exists"; }
if [ "$SYL_OK" = "1" ]; then
  [ "$HAS_SYL" = "true" ] && pass "syllabus step detected as done" || { STATUS="-"; : > "$BODY"; fail "syllabus step detected as done"; }
else
  note "(skipped: the syllabus step did not complete in this run)"
fi
if [ "$PLAN_OK" = "1" ]; then
  [ "$HAS_PLAN" = "true" ] && pass "first plan detected as done" || { STATUS="-"; : > "$BODY"; fail "first plan detected as done"; }
else
  note "(skipped: the plan step did not complete in this run)"
fi

# ===========================================================================
section "6. A second user skips the availability step"
# ===========================================================================
call "$JAR_B" POST /api/auth/register "{\"email\":\"$EMAIL_B\",\"username\":\"$USER_B\",\"password\":\"$PW\"}"; check "create the second account" 201
call "$JAR_B" POST /api/auth/login "{\"identifier\":\"$EMAIL_B\",\"password\":\"$PW\"}";                         check "log in" 200
call "$JAR_B" PATCH /api/settings "{\"timezone\":\"$TZ_NAME\"}";                                                  check "save timezone" 200
call "$JAR_B" POST /api/courses '{"name":"Chemistry","units":3}';                                                 check "create a course" 201
COURSE_B=$(id_of)
call "$JAR_B" POST /api/assignments "{\"course_id\":$COURSE_B,\"title\":\"Lab write-up\",\"due_date\":\"$(iso_in 72)\",\"estimated_hours\":3}"; check "add an assignment by hand" 201
call "$JAR_B" POST /api/assignments "{\"course_id\":$COURSE_B,\"title\":\"Quiz prep\",\"due_date\":\"$(iso_in 120)\",\"estimated_hours\":2}";    check "add another" 201
call "$JAR_B" GET /api/availability "";                                check "no availability was set" 200 "j.length" "0"
ai_pause
call "$JAR_B" POST /api/study-plan/generate '{"dry_run":true}'
check "a plan is still produced (previewed, not saved)" 200 "j.dry_run===true && j.sessions.length >= 1" "true"
if [ "$STATUS" = "200" ]; then
  SESS_B=$(jeval "j.sessions"); call "$JAR_B" GET /api/assignments ""
  expect_ok "sessions stay inside 8am-10pm and finish before each due date" "$(verify_calendar "$SESS_B" '[]' '[]')"
  expect_ok "both assignments are covered" "$(verify_coverage "$SESS_B" "$(cat "$BODY")")"
  call "$JAR_B" GET /api/study-sessions "";                            check "a preview saved nothing" 200 "j.length" "0"
fi

# ===========================================================================
section "7. Done"
# ===========================================================================
call "$JAR_A" POST /api/auth/logout "";                                check "log out" 200

printf "\n%s== Summary ==%s\n" "$BOLD" "$RESET"
if [ "$FAIL" -eq 0 ]; then
  printf "  %s%d passed, 0 failed%s\n" "$GREEN" "$PASS" "$RESET"
else
  printf "  %s%d passed, %d failed%s\n" "$RED" "$PASS" "$FAIL" "$RESET"
fi
note "Test users were left in the database. To remove them (cascades to all their data), run in Neon:"
note "  DELETE FROM users WHERE username LIKE 'onboard\\_%';"
[ "$FAIL" -eq 0 ]