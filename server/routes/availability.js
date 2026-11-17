import { Router } from "express";
import pool from "../db/index.js";
import { validateId } from "../middleware/validateId.js";
import {
  HttpError,
  parseString,
  parseEnum,
  parseDate,
  parseBoolean,
  parseAll,
  buildUpdate,
  assertRange,
} from "../utils/validate.js";

const router = Router();
router.param("id", validateId);

// The four categories the Study Availability page offers
const CATEGORIES = ["Work/job", "commute", "family/personal", "campus organization"];

const parsers = {
  name: (v) => parseString(v, "name", { required: true }),
  category: (v) => parseEnum(v, "category", CATEGORIES, { required: true }),
  start_time: (v) => parseDate(v, "start_time", { required: true }),
  end_time: (v) => parseDate(v, "end_time", { required: true }),
  is_recurring: (v) => parseBoolean(v, "is_recurring", { required: true }),
  recurrence_rule: (v) => parseString(v, "recurrence_rule", { max: 255 }), // e.g. FREQ=WEEKLY;BYDAY=MO,WE
};

const COLUMNS = "id, name, category, start_time, end_time, is_recurring, recurrence_rule";

// GET /api/availability?from=...&to=...&category=commute
// Recurring blocks are ALWAYS returned: their stored start_time is just the first
// occurrence, so a date filter would wrongly hide them. The client expands the
// recurrence_rule into the days it is drawing.
router.get("/", async (req, res) => {
  const from = parseDate(req.query.from, "from");
  const to = parseDate(req.query.to, "to");
  const category = parseEnum(req.query.category, "category", CATEGORIES);

  const { rows } = await pool.query(
    `SELECT ${COLUMNS}
       FROM availability_blocks
      WHERE user_id = $1
        AND ($4::text IS NULL OR category = $4)
        AND (is_recurring IS TRUE
             OR (($3::timestamptz IS NULL OR start_time < $3)
                 AND ($2::timestamptz IS NULL OR end_time > $2)))
      ORDER BY start_time ASC, id ASC`,
    [req.userId, from, to, category]
  );
  res.json(rows);
});

// POST /api/availability
router.post("/", async (req, res) => {
  const data = parseAll(req.body ?? {}, parsers, { is_recurring: false });
  assertRange(data.start_time, data.end_time);

  const { rows } = await pool.query(
    `INSERT INTO availability_blocks
            (user_id, name, category, start_time, end_time, is_recurring, recurrence_rule)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [req.userId, data.name, data.category, data.start_time, data.end_time, data.is_recurring, data.recurrence_rule]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/availability/:id
router.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const { setClause, values } = buildUpdate(body, parsers);

  // If either end of the time range changes, the NEW pair must still be valid, so
  // compare against the stored row for whichever side the client didn't send.
  if (body.start_time !== undefined || body.end_time !== undefined) {
    const { rows } = await pool.query(
      "SELECT start_time, end_time FROM availability_blocks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (rows.length === 0) throw new HttpError(404, "Availability block not found");
    assertRange(
      body.start_time !== undefined ? parsers.start_time(body.start_time) : rows[0].start_time,
      body.end_time !== undefined ? parsers.end_time(body.end_time) : rows[0].end_time
    );
  }

  const n = values.length;
  const { rows } = await pool.query(
    `UPDATE availability_blocks SET ${setClause}
      WHERE id = $${n + 1} AND user_id = $${n + 2}
      RETURNING ${COLUMNS}`,
    [...values, req.params.id, req.userId]
  );
  if (rows.length === 0) throw new HttpError(404, "Availability block not found");
  res.json(rows[0]);
});

// DELETE /api/availability/:id
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM availability_blocks WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Availability block not found");
  res.json({ message: "Availability block deleted" });
});

export default router;