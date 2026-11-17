import pool from "./index.js";

// The user's timezone (IANA name like "America/Los_Angeles"). Falls back to UTC.
export async function getUserTimezone(userId, db = pool) {
  const { rows } = await db.query("SELECT timezone FROM users WHERE id = $1", [userId]);
  return rows[0]?.timezone || "UTC";
}