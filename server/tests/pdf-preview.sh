#!/usr/bin/env bash
# Upload a REAL syllabus PDF and print what Gemini found, so you can compare it to the PDF.
#
#   bash tests/pdf-preview.sh "/path/to/syllabus.pdf"
#   PLAN=1 bash tests/pdf-preview.sh "/path/to/syllabus.pdf"    also apply it and preview a study plan
#
# Options (environment variables):
#   PLAN=1            after the extraction: apply it to a course, then preview a 21-day study plan
#   DAYS=28           how many days the preview plan covers (with PLAN=1)
#   TZ_NAME=...       timezone, e.g. America/New_York. Default: this computer's timezone
#   KEEP=1            keep the temporary course afterwards so you can look at it
#   BASE=...          server address (default http://localhost:5000)
#
# It makes a throw-away user (preview_...) and a throw-away course; nothing of yours is touched.
# Uses 1 Gemini call (2 with PLAN=1). Needs curl and node. Works with macOS's bash 3.2.
#
# PRIVACY: the PDF is sent to Google's Gemini API to be read.

BASE="${BASE:-http://localhost:5000}"
PDF="$1"
PLAN="${PLAN:-0}"
DAYS="${DAYS:-21}"
KEEP="${KEEP:-0}"
TZ_NAME="${TZ_NAME:-$(node -e 'console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)')}"

BODY=$(mktemp); JAR=$(mktemp)
trap 'rm -f "$BODY" "$JAR"' EXIT
BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; RESET=$'\033[0m'
STATUS=""

call() { # call METHOD PATH [JSON]
  if [ -n "$3" ]; then
    STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR" -c "$JAR" -X "$1" -H "Content-Type: application/json" -d "$3" "$BASE$2")
  else
    STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR" -c "$JAR" -X "$1" "$BASE$2")
  fi
}
jeval() {
  node -e '
    let j; try { j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); } catch { console.log(""); process.exit(0); }
    try { const v = eval(process.argv[2]); console.log(v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)); } catch { console.log(""); }
  ' "$BODY" "$1"
}
die() { printf "%s%s%s\n" "$RED" "$1" "$RESET"; [ -s "$BODY" ] && printf "%s  server said (HTTP %s): %s%s\n" "$DIM" "$STATUS" "$(head -c 500 "$BODY")" "$RESET"; exit 1; }

# ---------------------------------------------------------------------------
# Printing
# ---------------------------------------------------------------------------
print_extraction() { # reads the upload response in $BODY
  node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")), tz = process.argv[2], p = j.parsed;
    const when = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
    const clock = (t) => { const [h, m] = t.split(":").map(Number); return ((h + 11) % 12 + 1) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM"); };
    const line = (label, v) => console.log("  " + label.padEnd(10) + (v ?? "(not found)"));
    console.log("\nCOURSE");
    line("name", p.course.name); line("code", p.course.code); line("teacher", p.course.teacher_name);
    line("semester", p.course.semester); line("units", p.course.units);
    console.log("\nCLASS TIMES (" + p.class_schedule.length + ")");
    if (!p.class_schedule.length) console.log("  (none found)");
    for (const c of p.class_schedule) console.log("  " + c.day_of_week.padEnd(10) + clock(c.start_time) + " - " + clock(c.end_time));
    console.log("\nASSIGNMENTS (" + p.assignments.length + "), due dates shown in " + tz);
    if (!p.assignments.length) console.log("  (none found)");
    p.assignments.forEach((a, i) => {
      const due = a.due_date ? when(a.due_date) : "NO DATE FOUND (will be skipped)";
      const hrs = a.estimated_hours == null ? "  ?h" : String(a.estimated_hours).padStart(4) + "h";
      console.log("  " + String(i).padStart(2) + ". " + due.padEnd(34) + hrs + "  " + a.category.padEnd(12) + a.title);
    });
    if (p.grading.length) { console.log("\nGRADING"); for (const g of p.grading) console.log("  " + String(g.weight_percent).padStart(5) + "%  " + g.component); }
    if (p.policies.length) { console.log("\nPOLICIES"); for (const x of p.policies) console.log("  - " + x); }
    if (p.warnings.length) { console.log("\nWARNINGS FROM GEMINI"); for (const x of p.warnings) console.log("  ! " + x); }
  ' -- "$BODY" "$TZ_NAME"
}

print_plan() { # reads the plan response in $BODY; $1 = assignments JSON
  node -e '
    const plan = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")), tz = process.argv[2], assigns = JSON.parse(process.argv[3]);
    const title = (id) => (assigns.find((a) => a.id === id) || {}).title || "?";
    const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
    const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
    let last = "";
    console.log("\nPROPOSED STUDY PLAN: " + plan.sessions.length + " sessions (preview only, nothing saved)");
    for (const s of plan.sessions) {
      const d = day.format(new Date(s.start_time));
      if (d !== last) { console.log("  " + d); last = d; }
      console.log("      " + time.format(new Date(s.start_time)).padStart(8) + " - " + time.format(new Date(s.end_time)).padEnd(8) + "  " + title(s.assignment_id));
    }
    const hrs = {};
    for (const s of plan.sessions) hrs[s.assignment_id] = (hrs[s.assignment_id] || 0) + (Date.parse(s.end_time) - Date.parse(s.start_time)) / 36e5;
    console.log("\n  hours planned per assignment:");
    for (const [id, h] of Object.entries(hrs)) console.log("    " + h.toFixed(1).padStart(5) + "h  " + title(Number(id)));
    if (plan.notes) console.log("\n  Gemini says: " + plan.notes);
    if (plan.rejected_count) console.log("  (" + plan.rejected_count + " proposed session(s) were rejected by the safety checks)");
    for (const w of plan.warnings || []) console.log("  ! " + w);
  ' -- "$BODY" "$TZ_NAME" "$1"
}

# ---------------------------------------------------------------------------
# Main (skipped when this file is only being sourced for testing)
# ---------------------------------------------------------------------------
if [ "${PDF_PREVIEW_SOURCE_ONLY:-0}" = "1" ]; then return 0 2>/dev/null || exit 0; fi

if [ -z "$PDF" ]; then
  echo "Usage: bash tests/pdf-preview.sh /path/to/syllabus.pdf"
  echo "Tip: in Terminal, type  bash tests/pdf-preview.sh  and then DRAG the PDF file into the window to paste its path."
  exit 2
fi
[ -f "$PDF" ] || { echo "File not found: $PDF"; exit 2; }
[ "$(head -c 5 "$PDF")" = "%PDF-" ] || { echo "That file doesn't look like a PDF (it doesn't start with %PDF-)."; exit 2; }
SIZE=$(wc -c < "$PDF" | tr -d ' ')
[ "$SIZE" -le 10485760 ] || { echo "That PDF is $((SIZE / 1048576)) MB. The server's limit is 10 MB."; exit 2; }

call GET /api/health ""
[ "$STATUS" = "000" ] && { echo "Can't reach $BASE. Is the server running (npm run dev)?"; exit 2; }

RUN="$RANDOM$RANDOM"; USERNAME="preview_$RUN"; PW="password123"
printf "%sFile:%s %s (%s KB)   %sTimezone:%s %s\n" "$BOLD" "$RESET" "$PDF" "$((SIZE / 1024))" "$BOLD" "$RESET" "$TZ_NAME"

call POST /api/auth/register "{\"email\":\"$USERNAME@example.com\",\"username\":\"$USERNAME\",\"password\":\"$PW\"}"; [ "$STATUS" = "201" ] || die "Could not create the throw-away user."
call POST /api/auth/login "{\"identifier\":\"$USERNAME\",\"password\":\"$PW\"}";                                       [ "$STATUS" = "200" ] || die "Could not log in."
call PATCH /api/settings "{\"timezone\":\"$TZ_NAME\"}";                                                              [ "$STATUS" = "200" ] || die "Could not save the timezone (is '$TZ_NAME' valid, and did you run the migration?)."
call POST /api/courses '{"name":"Preview course"}';                                                                  [ "$STATUS" = "201" ] || die "Could not create a course."
COURSE=$(jeval "j.id")

echo "Sending the PDF to Gemini (this can take 10-40 seconds)..."
STATUS=$(curl -s -o "$BODY" -w "%{http_code}" -b "$JAR" -X POST -F "course_id=$COURSE" -F "file=@$PDF;type=application/pdf" "$BASE/api/syllabi")
if [ "$STATUS" != "201" ]; then
  case "$STATUS" in
    503) die "Gemini is busy or over its limit. Wait a minute and try again (or switch GEMINI_MODEL, see node tests/gemini-models.mjs)." ;;
    422) die "Gemini couldn't read anything from this PDF. Is it a scanned image or password-protected?" ;;
    413) die "The PDF is larger than the server allows (10 MB)." ;;
    *)   die "The upload failed." ;;
  esac
fi
SYL=$(jeval "j.id")

printf "\n%s================ WHAT GEMINI FOUND ================%s" "$BOLD" "$RESET"
print_extraction
printf "\n%sCompare this with the PDF. Things worth checking: the YEAR on every date, am/pm on times, any assignment that is missing, and 'Week N' items that have no date.%s\n" "$DIM" "$RESET"

if [ "$PLAN" = "1" ]; then
  call POST "/api/syllabi/$SYL/apply" '{"apply_schedule":true,"apply_course_info":true}'
  [ "$STATUS" = "200" ] || die "Could not apply the syllabus."
  printf "\n%sApplied:%s %s\n" "$BOLD" "$RESET" "$(cat "$BODY")"
  call GET /api/assignments ""; ASSIGNMENTS=$(cat "$BODY")
  echo "Asking Gemini for a ${DAYS}-day study plan (preview only)..."
  call POST /api/study-plan/generate "{\"days\":$DAYS,\"dry_run\":true}"
  [ "$STATUS" = "200" ] || die "Could not generate a plan."
  if [ -n "$(jeval "j.message")" ]; then echo "$(jeval "j.message")"; else printf "\n%s================ STUDY PLAN PREVIEW ================%s" "$BOLD" "$RESET"; print_plan "$ASSIGNMENTS"; fi
  printf "\n%sNo availability was set for this throw-away user, so the plan only avoids the class times found above.%s\n" "$DIM" "$RESET"
fi

if [ "$KEEP" = "1" ]; then
  printf "\n%sKept course %s. Log in as %s / %s to look at it.%s\n" "$DIM" "$COURSE" "$USERNAME" "$PW" "$RESET"
else
  call DELETE "/api/courses/$COURSE" ""
  printf "\n%sThe temporary course was deleted.%s\n" "$DIM" "$RESET"
fi
CLEANUP_SQL="DELETE FROM users WHERE username LIKE 'preview\_%';"
printf "%sTo remove the throw-away users, run in Neon:  %s%s\n" "$DIM" "$CLEANUP_SQL" "$RESET"