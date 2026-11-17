import { Router } from "express";
import pool from "../db/index.js";
import { withTransaction } from "../db/transaction.js";
import { assertCourseOwned, assertProjectOwned } from "../db/ownership.js";
import { validateId } from "../middleware/validateId.js";
import { consumeAiQuota } from "../utils/aiQuota.js";
import { generateProjectSteps } from "../services/gemini.js";
import {
  HttpError,
  parseString,
  parseId,
  parseInteger,
  parseDate,
  parseBoolean,
  parseAll,
  buildUpdate,
} from "../utils/validate.js";

const router = Router();
router.param("id", validateId);
router.param("stepId", validateId);

const projectParsers = {
  course_id: (v) => parseId(v, "course_id"), // optional: a project can exist without a course
  title: (v) => parseString(v, "title", { required: true }),
  description: (v) => parseString(v, "description", { max: 10000 }),
  deadline: (v) => parseDate(v, "deadline", { required: true }),
};

const stepParsers = {
  week_number: (v) => parseInteger(v, "week_number", { required: true, min: 1, max: 60 }),
  title: (v) => parseString(v, "title", { required: true }),
  description: (v) => parseString(v, "description", { max: 10000 }),
  completed: (v) => parseBoolean(v, "completed", { required: true }),
};

const STEP_COLUMNS = "id, project_id, week_number, title, description, completed";

const PROJECT_SELECT = `
  SELECT p.id, p.course_id, p.title, p.description, p.deadline, p.created_at,
         c.name AS course_name, c.code AS course_code,
         (SELECT COUNT(*)::int FROM project_steps s WHERE s.project_id = p.id) AS steps_total,
         (SELECT COUNT(*)::int FROM project_steps s
           WHERE s.project_id = p.id AND s.completed IS TRUE) AS steps_completed
    FROM projects p
    LEFT JOIN courses c ON c.id = p.course_id`;

async function fetchProject(id, userId) {
  const { rows } = await pool.query(`${PROJECT_SELECT} WHERE p.id = $1 AND p.user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] ?? null;
}

// Optional list of weekly steps sent along when a project is created
function parseSteps(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 60) {
    throw new HttpError(400, "steps must be an array of at most 60 entries");
  }
  return value.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new HttpError(400, `steps[${i}] must be an object`);
    }
    return parseAll(item, stepParsers, { completed: false });
  });
}

// GET /api/projects?course_id=3
router.get("/", async (req, res) => {
  const courseId = parseId(req.query.course_id, "course_id");
  const { rows } = await pool.query(
    `${PROJECT_SELECT}
      WHERE p.user_id = $1 AND ($2::int IS NULL OR p.course_id = $2)
      ORDER BY p.deadline ASC, p.id ASC`,
    [req.userId, courseId]
  );
  res.json(rows);
});

// POST /api/projects   (optionally with "steps": [{ week_number, title, description }])
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const data = parseAll(body, projectParsers);
  const steps = parseSteps(body.steps);
  if (data.course_id !== null) await assertCourseOwned(data.course_id, req.userId);

  const projectId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO projects (user_id, course_id, title, description, deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.userId, data.course_id, data.title, data.description, data.deadline]
    );
    for (const s of steps) {
      await client.query(
        `INSERT INTO project_steps (project_id, week_number, title, description, completed)
         VALUES ($1, $2, $3, $4, $5)`,
        [rows[0].id, s.week_number, s.title, s.description, s.completed]
      );
    }
    return rows[0].id;
  });

  res.status(201).json(await fetchProject(projectId, req.userId));
});

// GET /api/projects/:id   (project + its weekly steps)
router.get("/:id", async (req, res) => {
  const project = await fetchProject(req.params.id, req.userId);
  if (!project) throw new HttpError(404, "Project not found");
  const { rows: steps } = await pool.query(
    `SELECT ${STEP_COLUMNS} FROM project_steps WHERE project_id = $1 ORDER BY week_number, id`,
    [project.id]
  );
  res.json({ ...project, steps });
});

// PATCH /api/projects/:id
router.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const { setClause, values } = buildUpdate(body, projectParsers);
  if (body.course_id !== undefined && body.course_id !== null) {
    await assertCourseOwned(projectParsers.course_id(body.course_id), req.userId);
  }
  const n = values.length;
  const { rowCount } = await pool.query(
    `UPDATE projects SET ${setClause} WHERE id = $${n + 1} AND user_id = $${n + 2}`,
    [...values, req.params.id, req.userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Project not found");
  res.json(await fetchProject(req.params.id, req.userId));
});

// DELETE /api/projects/:id   (its steps are removed by ON DELETE CASCADE)
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (rowCount === 0) throw new HttpError(404, "Project not found");
  res.json({ message: "Project deleted" });
});

// POST /api/projects/:id/generate-steps   body: { "replace": true }  (optional)
// Asks Gemini to break the project into a week-by-week plan, from this week up to the
// deadline. If the project already has steps you must send replace: true, so a
// handwritten plan is never overwritten by accident.
router.post("/:id/generate-steps", async (req, res) => {
  const replace = parseBoolean((req.body ?? {}).replace, "replace") ?? false;

  const project = await fetchProject(req.params.id, req.userId);
  if (!project) throw new HttpError(404, "Project not found");

  const now = new Date();
  const deadline = new Date(project.deadline);
  if (deadline <= now) throw new HttpError(400, "This project's deadline has already passed");
  if (project.steps_total > 0 && !replace) {
    throw new HttpError(409, 'This project already has steps. Send { "replace": true } to regenerate them.');
  }

  const weeks = Math.max(1, Math.min(16, Math.ceil((deadline - now) / (7 * 86_400_000))));

  consumeAiQuota(req.userId);
  const steps = await generateProjectSteps({
    title: project.title,
    description: project.description,
    courseName: project.course_name,
    deadline,
    weeks,
    now,
  });
  if (steps.length === 0) {
    throw new HttpError(502, "The AI did not return any usable steps. Nothing was changed.");
  }

  await withTransaction(async (client) => {
    if (replace) await client.query("DELETE FROM project_steps WHERE project_id = $1", [project.id]);
    for (const s of steps) {
      await client.query(
        `INSERT INTO project_steps (project_id, week_number, title, description, completed)
         VALUES ($1, $2, $3, $4, FALSE)`,
        [project.id, s.week_number, s.title, s.description]
      );
    }
  });

  const { rows } = await pool.query(
    `SELECT ${STEP_COLUMNS} FROM project_steps WHERE project_id = $1 ORDER BY week_number, id`,
    [project.id]
  );
  res.status(201).json(rows);
});

// --- Steps -----------------------------------------------------------------

// POST /api/projects/:id/steps
router.post("/:id/steps", async (req, res) => {
  const data = parseAll(req.body ?? {}, stepParsers, { completed: false });
  await assertProjectOwned(req.params.id, req.userId);
  const { rows } = await pool.query(
    `INSERT INTO project_steps (project_id, week_number, title, description, completed)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${STEP_COLUMNS}`,
    [req.params.id, data.week_number, data.title, data.description, data.completed]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/projects/:id/steps/:stepId   (e.g. { "completed": true })
router.patch("/:id/steps/:stepId", async (req, res) => {
  const { setClause, values } = buildUpdate(req.body ?? {}, stepParsers);
  await assertProjectOwned(req.params.id, req.userId);
  const n = values.length;
  const { rows } = await pool.query(
    `UPDATE project_steps SET ${setClause}
      WHERE id = $${n + 1} AND project_id = $${n + 2}
      RETURNING ${STEP_COLUMNS}`,
    [...values, req.params.stepId, req.params.id]
  );
  if (rows.length === 0) throw new HttpError(404, "Step not found");
  res.json(rows[0]);
});

// DELETE /api/projects/:id/steps/:stepId
router.delete("/:id/steps/:stepId", async (req, res) => {
  await assertProjectOwned(req.params.id, req.userId);
  const { rowCount } = await pool.query(
    "DELETE FROM project_steps WHERE id = $1 AND project_id = $2",
    [req.params.stepId, req.params.id]
  );
  if (rowCount === 0) throw new HttpError(404, "Step not found");
  res.json({ message: "Step deleted" });
});

export default router;