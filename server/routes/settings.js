import { Router } from "express";
import bcrypt from "bcrypt";
import pool from "../db/index.js";
import {
  HttpError,
  parseString,
  parseInteger,
  parseBoolean,
  parseEnum,
  parseUrl,
  parseTimezone,
  parseEmail,
  parseUsername,
  parsePassword,
  buildUpdate,
} from "../utils/validate.js";

const router = Router();
const SALT_ROUNDS = 10;

// password_hash is never selected here, so it can't leak into a response
const PROFILE_SELECT = `
  SELECT id, email, username, current_semester_week, theme_mode, theme_color,
         background_photo_url, urgent_exam_alerts, deadline_alerts,
         study_reminder_minutes, timezone, created_at, updated_at
    FROM users WHERE id = $1`;

async function fetchProfile(userId) {
  const { rows } = await pool.query(PROFILE_SELECT, [userId]);
  return rows[0] ?? null;
}

// Everything in the Appearance and Notifications panels, plus the semester week
const preferenceParsers = {
  theme_mode: (v) => parseEnum(v, "theme_mode", ["light", "dark", "system"], { required: true }),
  theme_color: (v) => parseString(v, "theme_color", { required: true, max: 50 }),
  background_photo_url: (v) => parseUrl(v, "background_photo_url"), // null removes the backdrop
  urgent_exam_alerts: (v) => parseBoolean(v, "urgent_exam_alerts", { required: true }),
  deadline_alerts: (v) => parseBoolean(v, "deadline_alerts", { required: true }),
  study_reminder_minutes: (v) =>
    parseInteger(v, "study_reminder_minutes", { required: true, min: 1, max: 1440 }),
  // IANA name such as "America/Los_Angeles". The client should send
  // Intl.DateTimeFormat().resolvedOptions().timeZone once, after login.
  timezone: (v) => parseTimezone(v, "timezone", { required: true }),
  current_semester_week: (v) =>
    parseInteger(v, "current_semester_week", { required: true, min: 1, max: 60 }),
};

// GET /api/settings
router.get("/", async (req, res) => {
  const profile = await fetchProfile(req.userId);
  if (!profile) throw new HttpError(404, "User not found");
  res.json(profile);
});

// PATCH /api/settings   (the "Save Changes" button; send only what changed)
router.patch("/", async (req, res) => {
  const { setClause, values } = buildUpdate(req.body ?? {}, preferenceParsers);
  await pool.query(
    `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`,
    [...values, req.userId]
  );
  res.json(await fetchProfile(req.userId));
});

// PATCH /api/settings/profile   body: { email?, username? }
router.patch("/profile", async (req, res) => {
  const body = req.body ?? {};
  const fields = {};
  if (body.email !== undefined) fields.email = parseEmail(body.email);
  if (body.username !== undefined) fields.username = parseUsername(body.username);
  const columns = Object.keys(fields); // only ever the literal names "email" / "username"
  if (columns.length === 0) throw new HttpError(400, "No valid fields to update");

  // Friendly duplicate check against OTHER users (changing to your own value is fine)
  const clash = await pool.query(
    `SELECT email FROM users
      WHERE id <> $3 AND (email = $1::text OR LOWER(username) = LOWER($2::text))`,
    [fields.email ?? null, fields.username ?? null, req.userId]
  );
  if (clash.rows.length > 0) {
    const emailTaken = clash.rows.some((r) => r.email === fields.email);
    throw new HttpError(
      409,
      emailTaken ? "An account with that email already exists" : "That username is already taken"
    );
  }

  const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
  try {
    await pool.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1}`,
      [...columns.map((c) => fields[c]), req.userId]
    );
  } catch (err) {
    // 23505 = unique_violation: two requests raced past the check above
    if (err.code === "23505") throw new HttpError(409, "That email or username is already in use");
    throw err;
  }
  res.json(await fetchProfile(req.userId));
});

// PATCH /api/settings/password   body: { current_password, new_password }
router.patch("/password", async (req, res) => {
  const { current_password, new_password } = req.body ?? {};
  if (typeof current_password !== "string" || current_password === "") {
    throw new HttpError(400, "current_password is required");
  }
  const newPassword = parsePassword(new_password, "new_password");
  if (newPassword === current_password) {
    throw new HttpError(400, "New password must be different from the current one");
  }

  const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
  if (rows.length === 0) throw new HttpError(404, "User not found");

  // 400, not 401: a 401 would make the client think the login session expired
  const matches = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!matches) throw new HttpError(400, "Current password is incorrect");

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    hash,
    req.userId,
  ]);
  res.json({ message: "Password updated" });
});

export default router;