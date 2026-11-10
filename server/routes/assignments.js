import { Router } from "express";
import pool from "../db/index.js";
import { assertCourseOwned } from "../db/ownership.js";
import { validateId } from "../middleware/validateId.js";
import {
  HttpError,
  parseString,
  parseNumber,
  parseId,
  parseDate,
  parseBoolean,
  parseQueryBoolean,
  parseAll,
  buildUpdate,
} from "../utils/validate.js";
 
const router = Router();
router.param("id", validateId);
 
const parsers = {
  course_id: (v) => parseId(v, "course_id", { required: true }),
  title: (v) => parseString(v, "title", { required: true }),
  description: (v) => parseString(v, "description", { max: 10000 }),
  due_date: (v) => parseDate(v, "due_date", { required: true }),
  completed: (v) => parseBoolean(v, "completed", { required: true }),
  estimated_hours: (v) => parseNumber(v, "estimated_hours", { min: 0, max: 99.99 }), // NUMERIC(4,2)
};
 
// assignments have no user_id column, so ownership always goes through the course
const ASSIGNMENT_SELECT = `
  SELECT a.id, a.course_id, a.title, a.description, a.due_date, a.completed,
         a.estimated_hours::float AS estimated_hours,
         c.name AS course_name, c.code AS course_code, c.color_code
    FROM assignments a
    JOIN courses c ON c.id = a.course_id`;
 
async function fetchAssignment(id, userId) {
  const { rows } = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.id = $1 AND c.user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] ?? null;
}
 
// GET /api/assignments?course_id=3&completed=false&from=2026-11-01T00:00:00Z&to=...
router.get("/", async (req, res) => {
  const courseId = parseId(req.query.course_id, "course_id");
  const completed = parseQueryBoolean(req.query.completed, "completed");
  const from = parseDate(req.query.from, "from");
  const to = parseDate(req.query.to, "to");
 
  // "($2 IS NULL OR ...)" makes each filter optional without building SQL by hand
  const { rows } = await pool.query(
    `${ASSIGNMENT_SELECT}
      WHERE c.user_id = $1
        AND ($2::int IS NULL OR a.course_id = $2)
        AND ($3::boolean IS NULL OR a.completed = $3)
        AND ($4::timestamptz IS NULL OR a.due_date >= $4)
        AND ($5::timestamptz IS NULL OR a.due_date <= $5)
      ORDER BY a.due_date ASC, a.id ASC`,
    [req.userId, courseId, completed, from, to]
  );
  res.json(rows);
});
 
// POST /api/assignments
router.post("/", async (req, res) => {
  const data = parseAll(req.body ?? {}, parsers, { completed: false });
  await assertCourseOwned(data.course_id, req.userId);
 
  const { rows } = await pool.query(
    `INSERT INTO assignments (course_id, title, description, due_date, completed, estimated_hours)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [data.course_id, data.title, data.description, data.due_date, data.completed, data.estimated_hours]
  );
  res.status(201).json(await fetchAssignment(rows[0].id, req.userId));
});
 
// GET /api/assignments/:id
router.get("/:id", async (req, res) => {
  const assignment = await fetchAssignment(req.params.id, req.userId);
  if (!assignment) throw new HttpError(404, "Assignment not found");
  res.json(assignment);
});
 
// PATCH /api/assignments/:id   (e.g. { "completed": true } to tick one off)
router.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const { setClause, values } = buildUpdate(body, parsers);
 
  // Moving an assignment to another course? That course must be yours too.
  if (body.course_id !== undefined) {
    await assertCourseOwned(parsers.course_id(body.course_id), req.userId);
  }
 
  const n = values.length;
  const { rowCount } = await pool.query(
    `UPDATE assignments SET ${setClause}
      WHERE id = $${n + 1}
        AND course_id IN (SELECT id FROM courses WHERE user_id = $${n + 2})`,
    [...values, req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Assignment not found");
  res.json(await fetchAssignment(req.params.id, req.userId));
});
 
// DELETE /api/assignments/:id
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM assignments
      WHERE id = $1 AND course_id IN (SELECT id FROM courses WHERE user_id = $2)`,
    [req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Assignment not found");
  res.json({ message: "Assignment deleted" });
});
 
export default router;