import { Router } from "express";
import pool from "../db/index.js";
import { parseString } from "../utils/validate.js";

const router = Router();

// GET /api/dashboard/summary
// The four stat cards on My Courses (Active Credits, Timeline Progression,
// Due This Cycle, Execution Trajectory), computed in a single round trip.
router.get("/summary", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(units) FROM courses WHERE user_id = $1), 0)::float AS active_credits,
       (SELECT COUNT(*)::int FROM courses WHERE user_id = $1) AS course_count,
       (SELECT current_semester_week FROM users WHERE id = $1) AS current_week,
       (SELECT COUNT(*)::int FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.user_id = $1 AND a.completed IS NOT TRUE
           AND a.due_date >= NOW() AND a.due_date < NOW() + INTERVAL '7 days') AS due_this_week,
       (SELECT COUNT(*)::int FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.user_id = $1 AND a.completed IS NOT TRUE AND a.due_date < NOW()) AS overdue,
       (SELECT COUNT(*)::int FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.user_id = $1) AS assignments_total,
       (SELECT COUNT(*)::int FROM assignments a JOIN courses c ON c.id = a.course_id
         WHERE c.user_id = $1 AND a.completed IS TRUE) AS assignments_completed`,
    [req.userId]
  );
  const s = rows[0];
  res.json({
    ...s,
    completion_percent:
      s.assignments_total > 0 ? Math.round((s.assignments_completed / s.assignments_total) * 100) : 0,
  });
});

// GET /api/dashboard/search?q=midterm
// The top-bar search box ("Search syllabi, assignments, exam dates...")
router.get("/search", async (req, res) => {
  const q = parseString(req.query.q, "q", { required: true, max: 100 });
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const [courses, assignments] = await Promise.all([
    pool.query(
      `SELECT id, name, code, teacher_name FROM courses
        WHERE user_id = $1 AND (name ILIKE $2 OR code ILIKE $2 OR teacher_name ILIKE $2)
        ORDER BY name LIMIT 10`,
      [req.userId, like]
    ),
    pool.query(
      `SELECT a.id, a.title, a.due_date, a.completed, a.course_id, c.name AS course_name
         FROM assignments a JOIN courses c ON c.id = a.course_id
        WHERE c.user_id = $1 AND (a.title ILIKE $2 OR a.description ILIKE $2)
        ORDER BY a.due_date LIMIT 10`,
      [req.userId, like]
    ),
  ]);
  res.json({ courses: courses.rows, assignments: assignments.rows });
});

export default router;