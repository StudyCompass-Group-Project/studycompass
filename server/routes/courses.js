
import { Router } from "express";
import pool from "../db/index.js";
import { withTransaction } from "../db/transaction.js";
import { assertCourseOwned } from "../db/ownership.js";
import { validateId } from "../middleware/validateId.js";
import {
  HttpError,
  parseString,
  parseNumber,
  parseColor,
  parseEnum,
  parseTime,
  parseAll,
  buildUpdate,
} from "../utils/validate.js";

const router = Router();
router.param("id", validateId);

const WEEKDAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
];

// One parser per editable column.
const courseParsers = {
  name: (v) => parseString(v, "name", { required: true }),
  code: (v) => parseString(v, "code", { max: 50 }),
  semester: (v) => parseString(v, "semester", { max: 50 }),
  teacher_name: (v) => parseString(v, "teacher_name"),
  units: (v) => parseNumber(v, "units", { min: 0, max: 99.9 }),
  color_code: (v) => parseColor(v, "color_code"),
};

// Parse weekly class schedules.
function parseSchedules(value) {
  if (value === undefined) return undefined;

  if (!Array.isArray(value) || value.length > 30) {
    throw new HttpError(400, "schedules must be an array of at most 30 entries");
  }

  return value.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new HttpError(400, `schedules[${i}] must be an object`);
    }

    const day_of_week = parseEnum(
      item.day_of_week,
      `schedules[${i}].day_of_week`,
      WEEKDAYS,
      { required: true }
    );

    const start_time = parseTime(
      item.start_time,
      `schedules[${i}].start_time`
    );

    const end_time = parseTime(
      item.end_time,
      `schedules[${i}].end_time`
    );

    if (end_time <= start_time) {
      throw new HttpError(
        400,
        `schedules[${i}]: end_time must be after start_time`
      );
    }

    return { day_of_week, start_time, end_time };
  });
}

// Insert schedules.
async function insertSchedules(client, courseId, schedules) {
  for (const s of schedules) {
    await client.query(
      `INSERT INTO course_schedules
        (course_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)`,
      [courseId, s.day_of_week, s.start_time, s.end_time]
    );
  }
}

// Check whether a user already has this course.
async function checkDuplicateCourse({
  userId,
  name,
  code,
  semester,
  excludeId = null,
  client = pool,
}) {
  const { rows } = await client.query(
    `SELECT id
       FROM courses
      WHERE user_id = $1
        AND (
          (
            LOWER(TRIM(name)) = LOWER(TRIM($2))
            AND (
              $3::text IS NULL
              OR $4::text IS NULL
              OR (
                LOWER(TRIM(code)) = LOWER(TRIM($3))
                AND LOWER(TRIM(semester)) = LOWER(TRIM($4))
              )
            )
          )
        )
        AND ($5::int IS NULL OR id <> $5)
      LIMIT 1`,
    [userId, name, code ?? null, semester ?? null, excludeId]
  );

  if (rows.length > 0) {
    throw new HttpError(409, "You already have this course");
  }
}

// Course card query.
const COURSE_SELECT = `
  SELECT
    c.id, c.name, c.code, c.semester, c.teacher_name,
    c.units::float AS units, c.color_code, c.created_at,

    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', s.id,
          'day_of_week', s.day_of_week,
          'start_time', s.start_time,
          'end_time', s.end_time
        )
        ORDER BY
          array_position(
            ARRAY[
              'Monday','Tuesday','Wednesday','Thursday',
              'Friday','Saturday','Sunday'
            ],
            s.day_of_week::text
          ),
          s.start_time
      )
      FROM course_schedules s
      WHERE s.course_id = c.id
    ), '[]'::json) AS schedules,

    COALESCE((
      SELECT json_agg(d)
      FROM (
        SELECT a.id, a.title, a.due_date
        FROM assignments a
        WHERE a.course_id = c.id
          AND a.completed IS NOT TRUE
          AND a.due_date >= NOW()
        ORDER BY a.due_date
        LIMIT 2
      ) d
    ), '[]'::json) AS next_deadlines,

    (SELECT COUNT(*)::int
       FROM assignments a
      WHERE a.course_id = c.id) AS assignments_total,

    (SELECT COUNT(*)::int
       FROM assignments a
      WHERE a.course_id = c.id
        AND a.completed IS TRUE) AS assignments_completed,

    (SELECT COUNT(*)::int
       FROM study_sessions ss
      WHERE ss.course_id = c.id
        AND ss.start_time >= date_trunc('week', NOW())
        AND ss.start_time < date_trunc('week', NOW()) + INTERVAL '7 days'
    ) AS study_sessions_this_week,

    COALESCE((
      SELECT SUM(
        EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600
      )
      FROM study_sessions ss
      WHERE ss.course_id = c.id
        AND ss.start_time >= date_trunc('week', NOW())
        AND ss.start_time < date_trunc('week', NOW()) + INTERVAL '7 days'
    ), 0)::float AS study_hours_this_week

  FROM courses c
`;

async function fetchCourse(id, userId) {
  const { rows } = await pool.query(
    `${COURSE_SELECT}
     WHERE c.id = $1 AND c.user_id = $2`,
    [id, userId]
  );

  return rows[0] ?? null;
}

// GET /api/courses?search=bio&semester=Fall%202026
router.get("/", async (req, res) => {
  const search = parseString(req.query.search, "search", { max: 100 });
  const semester = parseString(req.query.semester, "semester", { max: 50 });

  const like = search
    ? `%${search.replace(/[\\%_]/g, "\\$&")}%`
    : null;

  const { rows } = await pool.query(
    `${COURSE_SELECT}
     WHERE c.user_id = $1
       AND (
         $2::text IS NULL
         OR c.name ILIKE $2
         OR c.code ILIKE $2
         OR c.teacher_name ILIKE $2
       )
       AND ($3::text IS NULL OR c.semester = $3)
     ORDER BY c.created_at DESC, c.id DESC`,
    [req.userId, like, semester]
  );

  res.json(rows);
});

// POST /api/courses
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const data = parseAll(body, courseParsers, { units: 3.0 });
  const schedules = parseSchedules(body.schedules) ?? [];

  try {
    const courseId = await withTransaction(async (client) => {
      // Check duplicates inside the transaction.
      await checkDuplicateCourse({
        userId: req.userId,
        name: data.name,
        code: data.code,
        semester: data.semester,
        client,
      });

      const { rows } = await client.query(
        `INSERT INTO courses
          (user_id, name, code, semester, teacher_name, units, color_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          req.userId,
          data.name,
          data.code,
          data.semester,
          data.teacher_name,
          data.units,
          data.color_code,
        ]
      );

      await insertSchedules(client, rows[0].id, schedules);

      return rows[0].id;
    });

    res.status(201).json(
      await fetchCourse(courseId, req.userId)
    );
  } catch (err) {
    if (err.code === "23505") {
      throw new HttpError(
        409,
        "You already have this course"
      );
    }

    throw err;
  }
});

// GET /api/courses/:id
router.get("/:id", async (req, res) => {
  const course = await fetchCourse(req.params.id, req.userId);

  if (!course) {
    throw new HttpError(404, "Course not found");
  }

  const [assignments, syllabi] = await Promise.all([
    pool.query(
      `SELECT
         id, title, description, due_date, completed,
         estimated_hours::float AS estimated_hours
       FROM assignments
       WHERE course_id = $1
       ORDER BY due_date`,
      [course.id]
    ),

    pool.query(
      `SELECT id, file_url, uploaded_at
       FROM syllabi
       WHERE course_id = $1
       ORDER BY uploaded_at DESC`,
      [course.id]
    ),
  ]);

  res.json({
    ...course,
    assignments: assignments.rows,
    syllabi: syllabi.rows,
  });
});

// PATCH /api/courses/:id
router.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const schedules = parseSchedules(body.schedules);

  const hasFieldUpdates = Object.keys(courseParsers).some(
    (key) => body[key] !== undefined
  );

  if (!hasFieldUpdates && schedules === undefined) {
    throw new HttpError(400, "No valid fields to update");
  }

  const update = hasFieldUpdates
    ? buildUpdate(body, courseParsers)
    : null;

  await assertCourseOwned(req.params.id, req.userId);

  const currentCourse = await fetchCourse(req.params.id, req.userId);

  if (!currentCourse) {
    throw new HttpError(404, "Course not found");
  }

  // Use submitted values when provided; otherwise use existing values.
  const newCode = body.code !== undefined
    ? courseParsers.code(body.code)
    : currentCourse.code;

  const newSemester = body.semester !== undefined
    ? courseParsers.semester(body.semester)
    : currentCourse.semester;

  const newName = body.name !== undefined
    ? courseParsers.name(body.name)
    : currentCourse.name;

  try {
    await withTransaction(async (client) => {
      // Prevent changing a course into a duplicate.
      await checkDuplicateCourse({
        userId: req.userId,
        name: newName,
        code: newCode,
        semester: newSemester,
        excludeId: req.params.id,
        client,
      });

      if (update) {
        const n = update.values.length;

        await client.query(
          `UPDATE courses
           SET ${update.setClause}
           WHERE id = $${n + 1}
             AND user_id = $${n + 2}`,
          [...update.values, req.params.id, req.userId]
        );
      }

      if (schedules !== undefined) {
        await client.query(
          "DELETE FROM course_schedules WHERE course_id = $1",
          [req.params.id]
        );

        await insertSchedules(client, req.params.id, schedules);
      }
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new HttpError(
        409,
        "You already have this course"
      );
    }

    throw err;
  }

  res.json(
    await fetchCourse(req.params.id, req.userId)
  );
});

// DELETE /api/courses/:id
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM courses
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );

  if (rowCount === 0) {
    throw new HttpError(404, "Course not found");
  }

  res.json({ message: "Course deleted" });
});

export default router;
