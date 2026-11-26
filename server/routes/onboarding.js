import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// GET /api/onboarding/status
//
// Where is this student in the first-run flow? The app calls this right after login to decide
// which screen to show, instead of asking four different endpoints.
//
// Everything is worked out from the student's real data, so there is nothing to keep in sync:
//
//   next_step "review_syllabus"  a syllabus was uploaded but not approved yet; pending_syllabus_id
//                                says which one, so the review screen can be reopened
//             "availability"     nothing set up yet: ask for their study availability first
//             "syllabus"         availability done (or skipped by uploading): ask for a syllabus
//             "plan"             coursework exists but no study plan yet
//             null               onboarding is complete
//
// Availability is OPTIONAL: a student who skips it and uploads a syllabus anyway moves on.
router.get("/status", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT timezone FROM users WHERE id = $1) AS timezone,
       (SELECT COUNT(*)::int FROM availability_blocks WHERE user_id = $1) AS availability_count,
       (SELECT COUNT(*)::int FROM syllabi WHERE user_id = $1 AND applied_at IS NULL) AS pending_syllabi,
       (SELECT COUNT(*)::int FROM syllabi WHERE user_id = $1 AND applied_at IS NOT NULL) AS applied_syllabi,
       (SELECT id FROM syllabi WHERE user_id = $1 AND applied_at IS NULL
         ORDER BY uploaded_at DESC, id DESC LIMIT 1) AS pending_syllabus_id,
       (SELECT COUNT(*)::int FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.user_id = $1) AS assignment_count,
       (SELECT COUNT(*)::int FROM study_sessions WHERE user_id = $1) AS session_count`,
    [req.userId]
  );
  const s = rows[0];

  const availabilityDone = s.availability_count > 0;
  // "Done" if a syllabus was applied, or the student already has coursework some other way
  const syllabusDone = s.applied_syllabi > 0 || s.assignment_count > 0;
  const planDone = s.session_count > 0;

  let nextStep = null;
  if (s.pending_syllabi > 0) nextStep = "review_syllabus";
  else if (!syllabusDone) nextStep = availabilityDone ? "syllabus" : "availability";
  else if (!planDone) nextStep = "plan";

  res.json({
    completed: syllabusDone && planDone && s.pending_syllabi === 0,
    next_step: nextStep,
    pending_syllabus_id: s.pending_syllabus_id ?? null,
    timezone: s.timezone,
    steps: {
      availability: { done: availabilityDone, count: s.availability_count, optional: true },
      syllabus: { done: syllabusDone, pending: s.pending_syllabi, applied: s.applied_syllabi },
      plan: { done: planDone, count: s.session_count },
    },
  });
});

export default router;