import { Router } from "express";
import pool from "../db/index.js";
import { withTransaction } from "../db/transaction.js";
import { getUserTimezone } from "../db/users.js";
import { consumeAiQuota } from "../utils/aiQuota.js";
import { generateStudyPlan } from "../services/gemini.js";
import { buildBusyIntervals, computeFreeSlots, validatePlan } from "../utils/schedule.js";
import { HttpError, parseInteger, parseTime, parseBoolean } from "../utils/validate.js";

const router = Router();

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DEFAULT_HOURS = 2; // used when an assignment has no estimated_hours
const MIN_SESSION_MINUTES = 30;

const SESSION_COLUMNS =
  "id, course_id, assignment_id, title, start_time, end_time, completed, source";

// POST /api/study-plan/generate
// body (everything optional):
//   days                 how many days ahead to plan, 1-28          (default 14)
//   day_start, day_end   the hours you're willing to study, "HH:MM" (default 08:00-22:00)
//   max_session_minutes  longest single session, 30-240             (default 120)
//   replace              first remove old AUTO-GENERATED, not-yet-done, future sessions
//                        in this window                             (default true)
//   dry_run              return the proposed plan without saving it (default false)
//
// How a plan is made:
//   1. Work out when the student is busy: classes, availability blocks, kept sessions.
//   2. Subtract that from each day's study window -> the FREE SLOTS.
//   3. Give Gemini the assignments and ONLY those free slots; it proposes sessions.
//   4. Verify every proposal in code (inside a free slot, before the due date, no
//      overlaps, sensible length). The AI can't double-book you or schedule over class.
//   5. Save what survived as study_sessions with source = 'auto-generated'.
router.post("/generate", async (req, res) => {
  const body = req.body ?? {};
  const days = parseInteger(body.days, "days", { min: 1, max: 28 }) ?? 14;
  const dayStart = parseTime(body.day_start ?? "08:00", "day_start");
  const dayEnd = parseTime(body.day_end ?? "22:00", "day_end");
  if (dayEnd <= dayStart) throw new HttpError(400, "day_end must be after day_start");
  const maxSession =
    parseInteger(body.max_session_minutes, "max_session_minutes", { min: 30, max: 240 }) ?? 120;
  const replace = parseBoolean(body.replace, "replace") ?? true;
  const dryRun = parseBoolean(body.dry_run, "dry_run") ?? false;

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + days * DAY_MS);
  const timezone = await getUserTimezone(req.userId);

  // ---- 1. Gather what we know about the student -----------------------------
  const assignmentRes = await pool.query(
    `SELECT a.id, a.course_id, a.title, a.description, a.due_date,
            a.estimated_hours::float AS estimated_hours, c.name AS course_name
       FROM assignments a JOIN courses c ON c.id = a.course_id
      WHERE c.user_id = $1 AND a.completed IS NOT TRUE
        AND a.due_date > $2 AND a.due_date <= $3
      ORDER BY a.due_date ASC
      LIMIT 40`,
    [req.userId, now, rangeEnd]
  );
  const assignmentIds = assignmentRes.rows.map((a) => a.id);

  const [blockRes, classRes, sessionRes] = await Promise.all([
    pool.query(
      `SELECT name, start_time, end_time, is_recurring, recurrence_rule
         FROM availability_blocks
        WHERE user_id = $1
          AND (is_recurring IS TRUE OR (end_time > $2 AND start_time < $3))`,
      [req.userId, now, rangeEnd]
    ),
    pool.query(
      `SELECT cs.day_of_week, cs.start_time, cs.end_time
         FROM course_schedules cs JOIN courses c ON c.id = cs.course_id
        WHERE c.user_id = $1`,
      [req.userId]
    ),
    // Sessions overlapping the window, plus any session for these assignments (to
    // count hours already studied)
    pool.query(
      `SELECT assignment_id, start_time, end_time, completed, source
         FROM study_sessions
        WHERE user_id = $1
          AND ((end_time > $2 AND start_time < $3) OR assignment_id = ANY($4::int[]))`,
      [req.userId, now, rangeEnd, assignmentIds]
    ),
  ]);

  // Sessions that "replace" will delete don't count as busy or as hours already planned
  const willBeReplaced = (s) =>
    replace &&
    s.source === "auto-generated" &&
    !s.completed &&
    new Date(s.start_time) >= now &&
    new Date(s.start_time) < rangeEnd;
  const keptSessions = sessionRes.rows.filter((s) => !willBeReplaced(s));

  // Hours still needed per assignment = estimate minus time already scheduled/done
  const hoursPlanned = new Map();
  for (const s of keptSessions) {
    if (s.assignment_id === null) continue;
    const hours = (new Date(s.end_time) - new Date(s.start_time)) / HOUR_MS;
    hoursPlanned.set(s.assignment_id, (hoursPlanned.get(s.assignment_id) ?? 0) + hours);
  }
  const todo = assignmentRes.rows
    .map((a) => ({
      ...a,
      due: new Date(a.due_date),
      hours_needed: Math.round(
        Math.max(0, (a.estimated_hours ?? DEFAULT_HOURS) - (hoursPlanned.get(a.id) ?? 0)) * 4
      ) / 4,
    }))
    .filter((a) => a.hours_needed >= 0.25);

  if (todo.length === 0) {
    return res.json({
      message: "Nothing to plan: no upcoming assignments in this window need more study time.",
      sessions: [],
    });
  }

  // ---- 2. Free time ----------------------------------------------------------
  const { busy, warnings } = buildBusyIntervals({
    blocks: blockRes.rows,
    classSchedules: classRes.rows,
    sessions: keptSessions,
    rangeStart: now,
    rangeEnd,
    tz: timezone,
  });
  const slots = computeFreeSlots({
    now, days, tz: timezone, dayStart, dayEnd, busy, minMinutes: MIN_SESSION_MINUTES,
  });
  if (slots.length === 0) {
    return res.json({
      message: "No free time found in this window. Try more days or a wider daily study window.",
      sessions: [],
      warnings,
    });
  }

  // ---- 3. Ask Gemini ---------------------------------------------------------
  consumeAiQuota(req.userId);
  const { proposed, notes } = await generateStudyPlan({
    assignments: todo.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      course: a.course_name,
      due: a.due,
      hours_needed: a.hours_needed,
      description: a.description,
    })),
    slots,
    timezone,
    now,
    minSessionMinutes: MIN_SESSION_MINUTES,
    maxSessionMinutes: maxSession,
  });

  // ---- 4. Verify the proposal ------------------------------------------------
  const byId = new Map(todo.map((a) => [a.id, a]));
  const { accepted: valid, rejected } = validatePlan(proposed, slots, {
    minMinutes: MIN_SESSION_MINUTES,
    maxMinutes: maxSession,
    dueMsByAssignment: new Map(todo.map((a) => [a.id, a.due.getTime()])),
  });

  // Guard against the AI scheduling far more time than an assignment needs
  const scheduled = new Map();
  const accepted = [];
  for (const p of valid) {
    const total = (scheduled.get(p.assignment_id) ?? 0) + (p.end - p.start);
    if (total > (byId.get(p.assignment_id).hours_needed + 1) * HOUR_MS) {
      rejected.push({ ...p, reason: "more time than the assignment needs" });
      continue;
    }
    scheduled.set(p.assignment_id, total);
    accepted.push(p);
  }

  const toRow = (p) => {
    const a = byId.get(p.assignment_id);
    return {
      course_id: a.course_id,
      assignment_id: a.id,
      title: (p.title ?? `Study: ${a.title}`).slice(0, 255),
      start_time: new Date(p.start).toISOString(),
      end_time: new Date(p.end).toISOString(),
    };
  };
  const summary = {
    notes,
    warnings,
    assignments_planned: todo.length,
    free_slots_considered: slots.length,
    rejected_count: rejected.length,
    rejected: rejected.slice(0, 20).map((r) => ({
      assignment_id: r.assignment_id,
      start_time: new Date(r.start).toISOString(),
      end_time: new Date(r.end).toISOString(),
      reason: r.reason,
    })),
  };

  if (dryRun) {
    return res.json({ dry_run: true, sessions: accepted.map(toRow), ...summary });
  }
  if (accepted.length === 0) {
    throw new HttpError(
      502,
      "The AI did not produce a usable plan. Nothing was changed. Please try again."
    );
  }

  // ---- 5. Save (old plan is removed only now that a good new one exists) -----
  const { sessions, removed } = await withTransaction(async (client) => {
    let removedCount = 0;
    if (replace) {
      const del = await client.query(
        `DELETE FROM study_sessions
          WHERE user_id = $1 AND source = 'auto-generated' AND completed IS NOT TRUE
            AND start_time >= $2 AND start_time < $3`,
        [req.userId, now, rangeEnd]
      );
      removedCount = del.rowCount;
    }
    const created = [];
    for (const p of accepted) {
      const r = toRow(p);
      const { rows } = await client.query(
        `INSERT INTO study_sessions
                (user_id, course_id, assignment_id, title, start_time, end_time, completed, source)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, 'auto-generated')
         RETURNING ${SESSION_COLUMNS}`,
        [req.userId, r.course_id, r.assignment_id, r.title, r.start_time, r.end_time]
      );
      created.push(rows[0]);
    }
    return { sessions: created, removed: removedCount };
  });

  res.status(201).json({ sessions, replaced_previous: removed, ...summary });
});

export default router;