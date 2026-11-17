import { Router } from "express";
import pool from "../db/index.js";
import { withTransaction } from "../db/transaction.js";
import { assertCourseOwned } from "../db/ownership.js";
import { getUserTimezone } from "../db/users.js";
import { validateId } from "../middleware/validateId.js";
import { uploadSyllabus } from "../middleware/upload.js";
import { consumeAiQuota } from "../utils/aiQuota.js";
import { extractSyllabus } from "../services/gemini.js";
import { HttpError, parseId, parseString, parseBoolean, parseInteger } from "../utils/validate.js";

const router = Router();
router.param("id", validateId);

// How this feature works, in two deliberate steps:
//   1. POST /api/syllabi         upload a PDF (or paste text) -> Gemini reads it -> the
//                                extracted data is SAVED but NOT yet applied.
//   2. POST /api/syllabi/:id/apply   the student reviews it, then confirms -> assignments
//                                (and optionally class times / course info) are created.
// The review step exists because AI extraction can be wrong; nothing lands in the
// student's real course data until they approve it.

// POST /api/syllabi
// multipart/form-data:  course_id (text) + file (a PDF)
// or JSON:              { "course_id": 3, "text": "...pasted syllabus..." }
router.post("/", uploadSyllabus, async (req, res) => {
  const body = req.body ?? {};
  const courseId = parseId(body.course_id, "course_id", { required: true });
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

  await assertCourseOwned(courseId, req.userId);
  const timezone = await getUserTimezone(req.userId);

  consumeAiQuota(req.userId);
  const parsed = await extractSyllabus({ pdfBuffer: file?.buffer, text, timezone });

  const { rows } = await pool.query(
    `INSERT INTO syllabi (course_id, original_filename, parsed_metadata)
     VALUES ($1, $2, $3)
     RETURNING id, course_id, original_filename, uploaded_at, applied_at`,
    [courseId, file ? file.originalname.slice(0, 255) : null, JSON.stringify(parsed)]
  );
  res.status(201).json({ ...rows[0], parsed });
});

// GET /api/syllabi?course_id=3   (the "extraction history" list)
router.get("/", async (req, res) => {
  const courseId = parseId(req.query.course_id, "course_id");
  const { rows } = await pool.query(
    `SELECT s.id, s.course_id, c.name AS course_name, s.original_filename,
            s.uploaded_at, s.applied_at,
            CASE WHEN jsonb_typeof(s.parsed_metadata->'assignments') = 'array'
                 THEN jsonb_array_length(s.parsed_metadata->'assignments') ELSE 0 END
              AS assignment_count
       FROM syllabi s
       JOIN courses c ON c.id = s.course_id
      WHERE c.user_id = $1 AND ($2::int IS NULL OR s.course_id = $2)
      ORDER BY s.uploaded_at DESC, s.id DESC`,
    [req.userId, courseId]
  );
  res.json(rows);
});

// GET /api/syllabi/:id   (includes everything the AI extracted, for the review screen)
router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.course_id, c.name AS course_name, s.original_filename,
            s.uploaded_at, s.applied_at, s.parsed_metadata AS parsed
       FROM syllabi s JOIN courses c ON c.id = s.course_id
      WHERE s.id = $1 AND c.user_id = $2`,
    [req.params.id, req.userId]
  );
  if (rows.length === 0) throw new HttpError(404, "Syllabus not found");
  res.json(rows[0]);
});

// POST /api/syllabi/:id/apply
// body (all optional):
//   assignment_indexes  [0, 2, 5]  only these items from parsed.assignments (default: all)
//   apply_schedule      true       replace the course's weekly class times with the extracted ones
//   apply_course_info   true       fill in the course's BLANK code / teacher / semester
router.post("/:id/apply", async (req, res) => {
  const body = req.body ?? {};
  const applySchedule = parseBoolean(body.apply_schedule, "apply_schedule") ?? false;
  const applyCourseInfo = parseBoolean(body.apply_course_info, "apply_course_info") ?? false;

  let indexes = null;
  if (body.assignment_indexes !== undefined) {
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
    `SELECT s.id, s.course_id, s.parsed_metadata
       FROM syllabi s JOIN courses c ON c.id = s.course_id
      WHERE s.id = $1 AND c.user_id = $2`,
    [req.params.id, req.userId]
  );
  const syllabus = found.rows[0];
  if (!syllabus) throw new HttpError(404, "Syllabus not found");

  const meta = syllabus.parsed_metadata ?? {};
  const all = Array.isArray(meta.assignments) ? meta.assignments : [];
  if (indexes) {
    for (const i of indexes) {
      if (i >= all.length) {
        throw new HttpError(400, `assignment_indexes has ${i}, but only ${all.length} assignments were found`);
      }
    }
  }
  const chosen = all.filter((_, i) => !indexes || indexes.has(i));
  const courseId = syllabus.course_id;

  const result = await withTransaction(async (client) => {
    // Claim the syllabus FIRST. If two requests race (a double-click), only one gets
    // the row back, so assignments can't be created twice.
    const claim = await client.query(
      "UPDATE syllabi SET applied_at = NOW() WHERE id = $1 AND applied_at IS NULL RETURNING id",
      [syllabus.id]
    );
    if (claim.rowCount === 0) {
      throw new HttpError(409, "This syllabus was already applied to the course.");
    }

    // Don't re-create an assignment that already exists with the same title and due time
    const existing = await client.query(
      "SELECT title, due_date FROM assignments WHERE course_id = $1",
      [courseId]
    );
    const seen = new Set(
      existing.rows.map((r) => `${r.title.toLowerCase()}|${new Date(r.due_date).getTime()}`)
    );

    let created = 0;
    let duplicates = 0;
    let missingDate = 0;
    for (const a of chosen) {
      if (!a.due_date) {
        missingDate++; // assignments.due_date is NOT NULL, so these need a manual date
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
    if (applySchedule && Array.isArray(meta.class_schedule) && meta.class_schedule.length > 0) {
      await client.query("DELETE FROM course_schedules WHERE course_id = $1", [courseId]);
      for (const s of meta.class_schedule) {
        await client.query(
          `INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
          [courseId, s.day_of_week, s.start_time, s.end_time]
        );
      }
      scheduleApplied = true;
    }

    let courseInfoApplied = false;
    if (applyCourseInfo && meta.course) {
      // NULLIF(x, '') treats empty text like NULL, so ONLY blank fields get filled in
      await client.query(
        `UPDATE courses
            SET code         = COALESCE(NULLIF(code, ''), $2),
                teacher_name = COALESCE(NULLIF(teacher_name, ''), $3),
                semester     = COALESCE(NULLIF(semester, ''), $4)
          WHERE id = $1`,
        [courseId, meta.course.code ?? null, meta.course.teacher_name ?? null, meta.course.semester ?? null]
      );
      courseInfoApplied = true;
    }

    return {
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
// Removes the saved extraction only. Assignments already created from it are kept.
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM syllabi
      WHERE id = $1 AND course_id IN (SELECT id FROM courses WHERE user_id = $2)`,
    [req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Syllabus not found");
  res.json({ message: "Syllabus deleted" });
});

export default router;