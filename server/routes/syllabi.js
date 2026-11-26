import { Router } from "express";
import pool from "../db/index.js";
import { withTransaction } from "../db/transaction.js";
import { assertCourseOwned } from "../db/ownership.js";
import { getUserTimezone } from "../db/users.js";
import { validateId } from "../middleware/validateId.js";
import { uploadSyllabus } from "../middleware/upload.js";
import { consumeAiQuota } from "../utils/aiQuota.js";
import { extractSyllabus } from "../services/gemini.js";
import {
  HttpError,
  parseId,
  parseString,
  parseNumber,
  parseColor,
  parseDate,
  parseBoolean,
  parseInteger,
  parseEnum,
  parseClassSchedule,
} from "../utils/validate.js";

const router = Router();
router.param("id", validateId);

// How a syllabus moves through the app, in two deliberate steps:
//
//   1. POST /api/syllabi              upload a PDF (or paste text). Gemini reads it. The result is
//                                     SAVED as "pending" but NOT applied: nothing in the student's
//                                     real data changes. No course is needed yet.
//   2. POST /api/syllabi/:id/apply    the student reviews and EDITS the result, then confirms.
//                                     Now the course (if it doesn't exist yet), its class times and
//                                     its assignments are created.
//
// A syllabus belongs to a USER (user_id). Its course_id is empty until it is applied, or it can be
// set at upload time when the student already has the course.

const STATUS_SQL = "CASE WHEN s.applied_at IS NULL THEN 'pending' ELSE 'applied' END";

// ---------------------------------------------------------------------------
// POST /api/syllabi
// multipart/form-data:  file (a PDF)         [+ course_id (optional)]
// or JSON:              { "text": "...pasted syllabus..." }   [+ "course_id" (optional)]
// ---------------------------------------------------------------------------
router.post("/", uploadSyllabus, async (req, res) => {
  const body = req.body ?? {};
  const courseId = parseId(body.course_id, "course_id"); // optional: null when not sent
  const text = parseString(body.text, "text", { max: 100000 });
  const file = req.file; // set by multer when a PDF was uploaded

  if (!file && !text) {
    throw new HttpError(400, 'Upload a PDF in the "file" field, or send the syllabus as "text".');
  }
  if (file && text) {
    throw new HttpError(400, 'Send either a "file" or "text", not both.');
  }
  // The browser-supplied content type can be faked, so check the file's real signature
  if (file && file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new HttpError(400, "That file is not a valid PDF.");
  }

  if (courseId !== null) await assertCourseOwned(courseId, req.userId);
  const timezone = await getUserTimezone(req.userId);

  consumeAiQuota(req.userId);
  const parsed = await extractSyllabus({ pdfBuffer: file?.buffer, text, timezone });

  const { rows } = await pool.query(
    `INSERT INTO syllabi (user_id, course_id, original_filename, parsed_metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, course_id, original_filename, uploaded_at, applied_at`,
    [req.userId, courseId, file ? file.originalname.slice(0, 255) : null, JSON.stringify(parsed)]
  );
  res.status(201).json({ ...rows[0], status: "pending", parsed });
});

// ---------------------------------------------------------------------------
// GET /api/syllabi?status=pending&course_id=3
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  const courseId = parseId(req.query.course_id, "course_id");
  const status = parseEnum(req.query.status, "status", ["pending", "applied"]);
  const { rows } = await pool.query(
    `SELECT s.id, s.course_id, c.name AS course_name, s.original_filename,
            s.uploaded_at, s.applied_at, ${STATUS_SQL} AS status,
            s.parsed_metadata->'course'->>'name' AS detected_name,
            CASE WHEN jsonb_typeof(s.parsed_metadata->'assignments') = 'array'
                 THEN jsonb_array_length(s.parsed_metadata->'assignments') ELSE 0 END
              AS assignment_count
       FROM syllabi s
       LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.user_id = $1
        AND ($2::int IS NULL OR s.course_id = $2)
        AND ($3::text IS NULL OR ${STATUS_SQL} = $3)
      ORDER BY s.uploaded_at DESC, s.id DESC`,
    [req.userId, courseId, status]
  );
  res.json(rows);
});

// GET /api/syllabi/:id   (everything the AI extracted, for the review screen)
router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.course_id, c.name AS course_name, s.original_filename,
            s.uploaded_at, s.applied_at, ${STATUS_SQL} AS status,
            s.parsed_metadata AS parsed
       FROM syllabi s
       LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.id = $1 AND s.user_id = $2`,
    [req.params.id, req.userId]
  );
  if (rows.length === 0) throw new HttpError(404, "Syllabus not found");
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// POST /api/syllabi/:id/apply
//
// The review screen sends back WHAT THE STUDENT APPROVED. Every field is optional; anything
// left out falls back to what Gemini extracted.
//
//   course            { name, code, semester, teacher_name, units, color_code }
//                     the course details. Creating a course needs a name, from here or the syllabus.
//   class_schedule    [{ day_of_week, start_time, end_time }]  replaces the weekly class times
//                     ([] clears them)
//   assignments       [{ title, description, due_date, estimated_hours }]  the EDITED list.
//                     Every item needs a due_date (the student fills in missing ones).
//   assignment_indexes [0, 2]   alternative to "assignments": apply only these extracted items
//   course_id         attach to one of the student's EXISTING courses instead of creating one
//   apply_schedule    false to skip the extracted class times / true to force them on
//   apply_course_info true to fill BLANK fields of an existing course from the syllabus
//
// New course  -> course, class times and assignments are all applied by default.
// Existing    -> assignments are applied; class times and course info only when asked.
// ---------------------------------------------------------------------------
const COURSE_PARSERS = {
  name: (v) => parseString(v, "course.name", { max: 255 }),
  code: (v) => parseString(v, "course.code", { max: 50 }),
  semester: (v) => parseString(v, "course.semester", { max: 50 }),
  teacher_name: (v) => parseString(v, "course.teacher_name", { max: 255 }),
  units: (v) => parseNumber(v, "course.units", { min: 0, max: 99.9 }), // NUMERIC(3,1)
  color_code: (v) => parseColor(v, "course.color_code"),
};

// Only the fields that were sent; the column names come from COURSE_PARSERS, never the request
function parseCourseOverrides(value) {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "course must be an object");
  }
  const out = {};
  for (const [key, parse] of Object.entries(COURSE_PARSERS)) {
    if (value[key] !== undefined) out[key] = parse(value[key]);
  }
  if ("name" in out && out.name === null) throw new HttpError(400, "course.name can't be empty");
  return out;
}

function parseEditedAssignments(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 200) {
    throw new HttpError(400, "assignments must be an array of at most 200 items");
  }
  return value.map((a, i) => {
    if (typeof a !== "object" || a === null) throw new HttpError(400, `assignments[${i}] must be an object`);
    return {
      title: parseString(a.title, `assignments[${i}].title`, { required: true }),
      description: parseString(a.description, `assignments[${i}].description`, { max: 10000 }),
      due_date: parseDate(a.due_date, `assignments[${i}].due_date`, { required: true }),
      estimated_hours: parseNumber(a.estimated_hours, `assignments[${i}].estimated_hours`, { min: 0, max: 99.99 }),
    };
  });
}

router.post("/:id/apply", async (req, res) => {
  const body = req.body ?? {};
  const applySchedule = parseBoolean(body.apply_schedule, "apply_schedule"); // null if not sent
  const applyCourseInfo = parseBoolean(body.apply_course_info, "apply_course_info") ?? false;
  const attachTo = parseId(body.course_id, "course_id");
  const courseOverrides = parseCourseOverrides(body.course);
  const editedAssignments = parseEditedAssignments(body.assignments);
  const editedSchedule =
    body.class_schedule === undefined ? undefined : parseClassSchedule(body.class_schedule, "class_schedule");

  let indexes = null;
  if (body.assignment_indexes !== undefined) {
    if (editedAssignments) {
      throw new HttpError(400, 'Send either "assignments" or "assignment_indexes", not both.');
    }
    if (!Array.isArray(body.assignment_indexes) || body.assignment_indexes.length > 200) {
      throw new HttpError(400, "assignment_indexes must be an array of at most 200 numbers");
    }
    indexes = new Set(
      body.assignment_indexes.map((v, i) =>
        parseInteger(v, `assignment_indexes[${i}]`, { required: true, min: 0, max: 100000 })
      )
    );
  }

  const found = await pool.query(
    `SELECT id, course_id, parsed_metadata, applied_at
       FROM syllabi WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  const syllabus = found.rows[0];
  if (!syllabus) throw new HttpError(404, "Syllabus not found");
  if (syllabus.applied_at) throw new HttpError(409, "This syllabus was already applied.");

  // Which course does this go into?
  let targetCourseId = syllabus.course_id;
  if (attachTo !== null) {
    if (targetCourseId !== null && targetCourseId !== attachTo) {
      throw new HttpError(400, "This syllabus is already attached to a different course.");
    }
    await assertCourseOwned(attachTo, req.userId);
    targetCourseId = attachTo;
  }
  const creating = targetCourseId === null;

  const meta = syllabus.parsed_metadata ?? {};
  const extracted = meta.course ?? {};

  // --- the course to create (details = Gemini's, overridden by what the student edited) ---
  let newCourse = null;
  if (creating) {
    const merged = {
      name: extracted.name ?? null,
      code: extracted.code ?? null,
      semester: extracted.semester ?? null,
      teacher_name: extracted.teacher_name ?? null,
      units: extracted.units ?? null,
      color_code: null,
      ...courseOverrides,
    };
    if (!merged.name) {
      throw new HttpError(400, "course.name is required: no course name was found in the syllabus.");
    }
    newCourse = { ...merged, units: merged.units ?? 3 }; // 3 credits when nothing says otherwise
  }

  // --- assignments ---
  const all = Array.isArray(meta.assignments) ? meta.assignments : [];
  let items;
  if (editedAssignments) {
    items = editedAssignments;
  } else {
    if (indexes) {
      for (const i of indexes) {
        if (i >= all.length) {
          throw new HttpError(400, `assignment_indexes has ${i}, but only ${all.length} assignments were found`);
        }
      }
    }
    items = all.filter((_, i) => !indexes || indexes.has(i));
  }

  // --- class times: null = leave the course's schedule alone ---
  const extractedSchedule = Array.isArray(meta.class_schedule) ? meta.class_schedule : [];
  let scheduleToWrite = null;
  if (editedSchedule !== undefined) scheduleToWrite = editedSchedule; // the student's version, even []
  else if ((applySchedule ?? creating) && extractedSchedule.length > 0) scheduleToWrite = extractedSchedule;

  const result = await withTransaction(async (client) => {
    // Claim the syllabus FIRST. If two requests race (a double-click), only one gets the
    // row back, so nothing can be created twice.
    const claim = await client.query(
      `UPDATE syllabi SET applied_at = NOW()
        WHERE id = $1 AND user_id = $2 AND applied_at IS NULL RETURNING id`,
      [syllabus.id, req.userId]
    );
    if (claim.rowCount === 0) throw new HttpError(409, "This syllabus was already applied.");

    let courseId = targetCourseId;
    let courseInfoApplied = false;

    if (creating) {
      const made = await client.query(
        `INSERT INTO courses (user_id, name, code, semester, teacher_name, units, color_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.userId, newCourse.name, newCourse.code, newCourse.semester, newCourse.teacher_name, newCourse.units, newCourse.color_code]
      );
      courseId = made.rows[0].id;
      courseInfoApplied = true;
    } else {
      // Fields the student edited are overwritten
      const keys = Object.keys(courseOverrides);
      if (keys.length > 0) {
        const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", "); // keys come from COURSE_PARSERS
        await client.query(`UPDATE courses SET ${set} WHERE id = $1`, [courseId, ...keys.map((k) => courseOverrides[k])]);
        courseInfoApplied = true;
      }
      // Then blank fields are filled from the syllabus (NULLIF treats empty text like NULL)
      if (applyCourseInfo) {
        await client.query(
          `UPDATE courses
              SET code         = COALESCE(NULLIF(code, ''), $2),
                  teacher_name = COALESCE(NULLIF(teacher_name, ''), $3),
                  semester     = COALESCE(NULLIF(semester, ''), $4)
            WHERE id = $1`,
          [courseId, extracted.code ?? null, extracted.teacher_name ?? null, extracted.semester ?? null]
        );
        courseInfoApplied = true;
      }
    }

    // Remember which course this syllabus ended up in (new course, or one chosen with course_id)
    if (syllabus.course_id !== courseId) {
      await client.query("UPDATE syllabi SET course_id = $1 WHERE id = $2", [courseId, syllabus.id]);
    }

    // Don't create an assignment that already exists with the same title and due time
    const existing = await client.query("SELECT title, due_date FROM assignments WHERE course_id = $1", [courseId]);
    const seen = new Set(existing.rows.map((r) => `${r.title.toLowerCase()}|${new Date(r.due_date).getTime()}`));

    let created = 0;
    let duplicates = 0;
    let missingDate = 0;
    for (const a of items) {
      if (!a.due_date) {
        missingDate++; // assignments.due_date is NOT NULL: these need a date from the student
        continue;
      }
      const key = `${a.title.toLowerCase()}|${new Date(a.due_date).getTime()}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      await client.query(
        `INSERT INTO assignments (course_id, title, description, due_date, completed, estimated_hours)
         VALUES ($1, $2, $3, $4, FALSE, $5)`,
        [courseId, a.title, a.description ?? null, a.due_date, a.estimated_hours ?? null]
      );
      created++;
    }

    let scheduleApplied = false;
    if (scheduleToWrite !== null) {
      await client.query("DELETE FROM course_schedules WHERE course_id = $1", [courseId]);
      for (const s of scheduleToWrite) {
        await client.query(
          `INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
          [courseId, s.day_of_week, s.start_time, s.end_time]
        );
      }
      scheduleApplied = true;
    }

    return {
      course_id: courseId,
      course_created: creating,
      assignments_created: created,
      skipped_duplicates: duplicates,
      skipped_missing_date: missingDate,
      schedule_applied: scheduleApplied,
      course_info_applied: courseInfoApplied,
    };
  });

  res.json(result);
});

// DELETE /api/syllabi/:id
// Removes the saved extraction only (e.g. the student discards a pending one). Courses and
// assignments already created from it are kept.
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM syllabi WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (rowCount === 0) throw new HttpError(404, "Syllabus not found");
  res.json({ message: "Syllabus deleted" });
});

export default router;