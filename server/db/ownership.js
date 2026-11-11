import pool from "./index.js";
import { HttpError } from "../utils/validate.js";
 
// When a request body contains an id that points at another record (course_id,
// assignment_id, ...), the id came from the client, so it can't be trusted. Without
// these checks a user could attach their data to SOMEONE ELSE'S course just by
// guessing a number. They return 404, not 403, so we never confirm that a record
// belonging to another user exists.
 
export async function assertCourseOwned(courseId, userId, db = pool) {
  const { rowCount } = await db.query(
    "SELECT 1 FROM courses WHERE id = $1 AND user_id = $2",
    [courseId, userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Course not found");
}
 
// assignments have no user_id of their own; they belong to a user through their course
export async function assertAssignmentOwned(assignmentId, userId, db = pool) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM assignments a
       JOIN courses c ON c.id = a.course_id
      WHERE a.id = $1 AND c.user_id = $2`,
    [assignmentId, userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Assignment not found");
}
 
export async function assertProjectOwned(projectId, userId, db = pool) {
  const { rowCount } = await db.query(
    "SELECT 1 FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId]
  );
  if (rowCount === 0) throw new HttpError(404, "Project not found");
}