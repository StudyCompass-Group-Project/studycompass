import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/index.js";
import { COOKIE_NAME, cookieOptions, clearCookieOptions } from "../config/cookies.js";
import requireAuth from "../middleware/auth.js";
 
const router = Router();
 
// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 10; // bcrypt work factor: each +1 doubles the hashing time
const TOKEN_LIFETIME = "7d"; // how long the JWT stays valid (match maxAge in config/cookies.js)
 
// Fail fast: without a secret we can't sign tokens, so refuse to start rather
// than crash on the first login attempt.
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file.");
}
 
// Usernames can't contain "@", so an identifier containing "@" can only ever be
// an email. That keeps "log in with email OR username" unambiguous.
const USERNAME_REGEX = /^[A-Za-z0-9_.-]{3,50}$/; // 50 matches VARCHAR(50) in schema.sql
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
// A real bcrypt hash of a throwaway string. Login compares against this when
// the user doesn't exist, so "unknown user" and "wrong password" take the same
// time and an attacker can't use response speed to discover which emails or
// usernames are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);
 
// ---------------------------------------------------------------------------
// POST /api/auth/register   body: { email, username, password }
// ---------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  // Express 5 leaves req.body undefined if no JSON body was sent, hence "?? {}".
  const { email, username, password } = req.body ?? {};
 
  // typeof checks matter: JSON lets a client send an object or array where we
  // expect a string, which could break the string methods below.
  if (
    typeof email !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !username.trim() ||
    !password
  ) {
    return res
      .status(400)
      .json({ error: "Email, username, and password are required" });
  }
 
  // Normalise: emails are stored lowercase so "Me@x.com" and "me@x.com" are the
  // same account. Usernames keep the case the user typed.
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();
 
  if (cleanEmail.length > 255 || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!USERNAME_REGEX.test(cleanUsername)) {
    return res.status(400).json({
      error:
        "Username must be 3-50 characters: letters, numbers, underscores, dots, or hyphens",
    });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }
  // bcrypt only uses the first 72 BYTES of a password, so reject longer ones
  // instead of silently ignoring the rest.
  if (Buffer.byteLength(password, "utf8") > 72) {
    return res
      .status(400)
      .json({ error: "Password must be 72 bytes or fewer" });
  }
 
  // Friendly duplicate check. The username comparison is case-insensitive so
  // "Nathan" and "nathan" can't both exist (login treats them as the same).
  const existing = await pool.query(
    "SELECT email FROM users WHERE email = $1 OR LOWER(username) = LOWER($2)",
    [cleanEmail, cleanUsername]
  );
  if (existing.rows.length > 0) {
    const emailTaken = existing.rows.some((row) => row.email === cleanEmail);
    return res.status(409).json({
      error: emailTaken
        ? "An account with that email already exists"
        : "That username is already taken",
    });
  }
 
  // bcrypt generates a random salt, mixes it with the password, and embeds the
  // salt and cost in the resulting string, so only password_hash is stored.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
 
  try {
    // $1, $2, $3 placeholders keep user input out of the SQL string itself,
    // which is what prevents SQL injection. RETURNING hands back the new row
    // without a second query, and never includes password_hash.
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`,
      [cleanEmail, cleanUsername, passwordHash]
    );
    return res.status(201).json({ message: "Account created", user: rows[0] });
  } catch (err) {
    // 23505 = unique_violation. The check above can't catch two sign-ups that
    // arrive at the same instant; the database's UNIQUE constraints are the
    // real guarantee, so handle that case here.
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "That email or username is already in use" });
    }
    throw err; // anything else goes to the global error handler (500)
  }
});
 
// ---------------------------------------------------------------------------
// POST /api/auth/login   body: { identifier, password }
// "identifier" is either the account's email or its username.
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body ?? {};
 
  if (
    typeof identifier !== "string" ||
    typeof password !== "string" ||
    !identifier.trim() ||
    !password
  ) {
    return res
      .status(400)
      .json({ error: "Email or username and password are required" });
  }
 
  // Emails are stored lowercase and usernames are matched case-insensitively,
  // so lowercasing both sides makes login forgiving about capitalisation.
  const { rows } = await pool.query(
    `SELECT id, email, username, password_hash
       FROM users
      WHERE email = LOWER($1) OR LOWER(username) = LOWER($1)
      LIMIT 1`,
    [identifier.trim()]
  );
  const user = rows[0];
 
  // Always run one bcrypt comparison, even for unknown users (see DUMMY_HASH).
  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.password_hash : DUMMY_HASH
  );
 
  // One identical message for both failures, so the response never reveals
  // whether the account exists.
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
 
  // The payload is readable by anyone who holds the token (it's signed, not
  // encrypted), so only put non-sensitive identifiers in it.
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_LIFETIME }
  );
 
  // The token travels only in an httpOnly cookie, never in the response body.
  res.cookie(COOKIE_NAME, token, cookieOptions);
 
  return res.json({
    message: "Logged in",
    user: { id: user.id, email: user.email, username: user.username },
  });
});
 
// ---------------------------------------------------------------------------
// POST /api/auth/logout
// The cookie is httpOnly, so JavaScript on the page can't delete it; only the
// server can, by sending a Set-Cookie that expires it. The attributes must match
// the ones used when it was set (see clearCookieOptions in config/cookies.js).
// ---------------------------------------------------------------------------
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, clearCookieOptions);
  res.json({ message: "Logged out" });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// The client calls this on page load to learn "am I logged in, and as whom?".
// requireAuth has already verified the cookie and set req.userId.
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, username FROM users WHERE id = $1",
    [req.userId]
  );
  // A valid token for a deleted account: treat the session as over
  if (rows.length === 0) {
    res.clearCookie(COOKIE_NAME, clearCookieOptions);
    return res.status(401).json({ error: "User no longer exists" });
  }
  return res.json({ user: rows[0] });
});

export default router;