import { Router } from "express";
import pool from "../db/index.js";
import { assertCourseOwned, assertAssignmentOwned } from "../db/ownership.js";
import { validateId } from "../middleware/validateId.js";
import {
  HttpError,
  parseString,
  parseId,
  parseDate,
  parseBoolean,
  parseQueryBoolean,
  parseAll,
  buildUpdate,
  assertRange,
} from "../utils/validate.js";

const router = Router();
router.param("id", validateId);

const parsers = {
  course_id: (v) => parseId(v, "course_id"),
  assignment_id: (v) => parseId(v, "assignment_id"),
  title: (v) => parseString(v, "title", { required: true }),
  start_time: (v) => parseDate(v, "start_time", { required: true }),
  end_time: (v) => parseDate(v, "end_time", { required: true }),
  completed: (v) => parseBoolean(v, "completed", { required: true }),
};

// `source` is deliberately NOT a parser: clients can't choose it. Sessions created
// here are always 'manual'; the future Gemini/calendar code will insert its own.
const SESSION_SELECT = `
  SELECT ss.id, ss.course_id, ss.assignment_id, ss.title, ss.start_time, ss.end_time,
         ss.completed, ss.source,
         c.name AS course_name, c.color_code, a.title AS assignment_title
    FROM study_sessions ss
    LEFT JOIN courses c ON c.id = ss.course_id
    LEFT JOIN assignments a ON a.id = ss.assignment_id`;

async function fetchSession(id, userId) {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE ss.id = $1 AND ss.user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] ?? null;
}

// GET /api/study-sessions?from=...&to=...&course_id=3&completed=false
// This feeds the Calendar Dashboard: ask for the visible week or month.
router.get("/", async (req, res) => {
  const from = parseDate(req.query.from, "from");
  const to = parseDate(req.query.to, "to");
  const courseId = parseId(req.query.course_id, "course_id");
  const completed = parseQueryBoolean(req.query.completed, "completed");

  // A session is "in range" if it overlaps [from, to] at all
  const { rows } = await pool.query(
    `${SESSION_SELECT}
      WHERE ss.user_id = $1
        AND ($2::timestamptz IS NULL OR ss.end_time > $2)
        AND ($3::timestamptz IS NULL OR ss.start_time < $3)
        AND ($4::int IS NULL OR ss.course_id = $4)
        AND ($5::boolean IS NULL OR ss.completed = $5)
      ORDER BY ss.start_time ASC, ss.id ASC`,
    [req.userId, from, to, courseId, completed]
  );
  res.json(rows);
});

// POST /api/study-sessions
router.post("/", async (req, res) => {
  const data = parseAll(req.body ?? {}, parsers, { completed: false });
  assertRange(data.start_time, data.end_time);
  if (data.course_id !== null) await assertCourseOwned(data.course_id, req.userId);
  if (data.assignment_id !== null) await assertAssignmentOwned(data.assignment_id, req.userId);

  const { rows } = await pool.query(
    `INSERT INTO study_sessions
            (user_id, course_id, assignment_id, title, start_time, end_time, completed, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
     RETURNING id`,
    [req.userId, data.course_id, data.assignment_id, data.title, data.start_time, data.end_time, data.completed]
  );
  res.status(201).json(await fetchSession(rows[0].id, req.userId));
});

// GET /api/study-sessions/:id
router.get("/:id", async (req, res) => {
  const session = await fetchSession(req.params.id, req.userId);
  if (!session) throw new HttpError(404, "Study session not found");
  res.json(session);
});

// PATCH /api/study-sessions/:id   (drag-to-reschedule, or { "completed": true })
router.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const { setClause, values } = buildUpdate(body, parsers);

  const existing = await fetchSession(req.params.id, req.userId);
  if (!existing) throw new HttpError(404, "Study session not found");

  if (body.start_time !== undefined || body.end_time !== undefined) {
    assertRange(
      body.start_time !== undefined ? parsers.start_time(body.start_time) : existing.start_time,
      body.end_time !== undefined ? parsers.end_time(body.end_time) : existing.end_time
    );
  }
  if (body.course_id !== undefined && body.course_id !== null) {
    await assertCourseOwned(parsers.course_id(body.course_id), req.userId);
  }
  if (body.assignment_id !== undefined && body.assignment_id !== null) {
    await assertAssignmentOwned(parsers.assignment_id(body.assignment_id), req.userId);
  }

  const n = values.length;
  await pool.query(
    `UPDATE study_sessions SET ${setClause} WHERE id = $${n + 1} AND user_id = $${n + 2}`,
    [...values, req.params.id, req.userId]
  );
  res.json(await fetchSession(req.params.id, req.userId));
});

// DELETE /api/study-sessions/:id
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM study_sessions WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Study session not found");
  res.json({ message: "Study session deleted" });
});

export default router;