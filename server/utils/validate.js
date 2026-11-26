// Shared input validation. Every parser either returns a clean value or throws an
// HttpError(400). Because Express 5 forwards errors thrown inside async handlers to
// the global error handler in server.js, a route never needs its own try/catch for
// bad input: it just calls a parser, and the client gets { error: "<message>" }.
 
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    // expose = "this message is safe to show the client", even for 5xx errors we throw
    // on purpose (e.g. 502 when the AI service fails). server.js checks it.
    this.expose = true;
  }
}
 
const bad = (message) => {
  throw new HttpError(400, message);
};
 
const isBlank = (v) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");
 
// ---------------------------------------------------------------------------
// Value parsers. Optional fields that are missing or blank come back as null.
// ---------------------------------------------------------------------------
export function parseString(value, field, { required = false, max = 255 } = {}) {
  if (isBlank(value)) {
    if (required) bad(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") bad(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) bad(`${field} must be ${max} characters or fewer`);
  return trimmed;
}
 
export function parseNumber(
  value,
  field,
  { required = false, min = -Infinity, max = Infinity } = {}
) {
  if (isBlank(value)) {
    if (required) bad(`${field} is required`);
    return null;
  }
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) bad(`${field} must be a number`);
  if (n < min || n > max) bad(`${field} must be between ${min} and ${max}`);
  return n;
}
 
export function parseInteger(value, field, opts = {}) {
  const n = parseNumber(value, field, opts);
  if (n !== null && !Number.isInteger(n)) bad(`${field} must be a whole number`);
  return n;
}
 
// A database id (SERIAL = positive 32-bit integer).
export const parseId = (value, field, opts = {}) =>
  parseInteger(value, field, { ...opts, min: 1, max: 2147483647 });
 
export function parseBoolean(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) bad(`${field} is required and must be true or false`);
    return null;
  }
  if (typeof value !== "boolean") bad(`${field} must be true or false`);
  return value;
}
 
// Dates must be ISO 8601 strings. Send them WITH a timezone (the browser's
// date.toISOString() does). Without one, the server's own timezone is assumed.
export function parseDate(value, field, { required = false } = {}) {
  if (isBlank(value)) {
    if (required) bad(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") bad(`${field} must be an ISO 8601 date string`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) bad(`${field} is not a valid date`);
  return d.toISOString();
}
 
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
 
// "09:30" or "14:05:00" -> always returned as "HH:MM:SS" for the TIME column.
export function parseTime(value, field, { required = true } = {}) {
  if (isBlank(value)) {
    if (required) bad(`${field} is required`);
    return null;
  }
  const t = typeof value === "string" ? value.trim() : "";
  if (!TIME_REGEX.test(t)) bad(`${field} must be a time like "09:30" or "14:05:00"`);
  return t.length === 5 ? `${t}:00` : t;
}
 
// Matches case-insensitively and returns the canonical spelling from `allowed`.
export function parseEnum(value, field, allowed, { required = false } = {}) {
  if (isBlank(value)) {
    if (required) bad(`${field} is required`);
    return null;
  }
  const match =
    typeof value === "string"
      ? allowed.find((a) => a.toLowerCase() === value.trim().toLowerCase())
      : undefined;
  if (!match) bad(`${field} must be one of: ${allowed.join(", ")}`);
  return match;
}
 
export function parseColor(value, field, { required = false } = {}) {
  const v = parseString(value, field, { required, max: 7 });
  if (v !== null && !/^#[0-9A-Fa-f]{6}$/.test(v)) bad(`${field} must look like #FF5733`);
  return v;
}
 
export function parseUrl(value, field, { required = false, max = 2048 } = {}) {
  const v = parseString(value, field, { required, max });
  if (v === null) return null;
  let url;
  try {
    url = new URL(v);
  } catch {
    bad(`${field} must be a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    bad(`${field} must start with http:// or https://`);
  }
  return v;
}
 
// Query-string booleans arrive as the strings "true" / "false".
export function parseQueryBoolean(value, field) {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return bad(`${field} must be "true" or "false"`);
}
 
// ---------------------------------------------------------------------------
// Account field rules (same rules as routes/auth.js)
// ---------------------------------------------------------------------------
export const USERNAME_REGEX = /^[A-Za-z0-9_.-]{3,50}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
export function parseEmail(value, field = "email") {
  const v = parseString(value, field, { required: true, max: 255 });
  const lower = v.toLowerCase();
  if (!EMAIL_REGEX.test(lower)) bad("Please enter a valid email address");
  return lower;
}
 
export function parseUsername(value, field = "username") {
  const v = parseString(value, field, { required: true, max: 50 });
  if (!USERNAME_REGEX.test(v)) {
    bad("Username must be 3-50 characters: letters, numbers, underscores, dots, or hyphens");
  }
  return v;
}
 
// Not trimmed on purpose: spaces are legitimate password characters.
export function parsePassword(value, field = "password") {
  if (typeof value !== "string" || value === "") bad(`${field} is required`);
  if (value.length < 8) bad(`${field} must be at least 8 characters`);
  if (Buffer.byteLength(value, "utf8") > 72) bad(`${field} must be 72 bytes or fewer`);
  return value;
}
 
// ---------------------------------------------------------------------------
// Turning a request body into database-ready values
// ---------------------------------------------------------------------------
 
// For INSERTs: run every parser (a missing required field throws). `defaults`
// supplies a value when the client omits a field entirely.
export function parseAll(body, parsers, defaults = {}) {
  const out = {};
  for (const [key, parse] of Object.entries(parsers)) {
    const raw = body[key] === undefined && key in defaults ? defaults[key] : body[key];
    out[key] = parse(raw);
  }
  return out;
}
 
// For PATCH: only fields the client actually sent are updated. The column names
// come from the keys of `parsers` (written in our code), NEVER from the request, so
// building SQL text this way is safe; the values still go through $1, $2 placeholders.
// Returns { setClause: "name = $1, code = $2", values: [...] }.
export function buildUpdate(body, parsers, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const [column, parse] of Object.entries(parsers)) {
    if (body[column] === undefined) continue;
    values.push(parse(body[column]));
    sets.push(`${column} = $${startIndex + values.length - 1}`);
  }
  if (sets.length === 0) throw new HttpError(400, "No valid fields to update");
  return { setClause: sets.join(", "), values };
}
 
// end must come after start (both are ISO strings or Dates).
export function assertRange(start, end, label = "end_time") {
  if (new Date(end) <= new Date(start)) {
    throw new HttpError(400, `${label} must be after start_time`);
  }
}

// An IANA timezone name such as "America/Los_Angeles" or "UTC".
export function parseTimezone(value, field = "timezone", { required = false } = {}) {
  const v = parseString(value, field, { required, max: 64 });
  if (v === null) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
  } catch {
    bad(`${field} must be an IANA timezone like "America/Los_Angeles"`);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Weekly class times: [{ day_of_week: "Monday", start_time: "10:00", end_time: "11:15" }]
// Returns the cleaned array ("HH:MM:SS" times, canonical weekday names). An empty array is
// valid and means "no class times". Used when a syllabus is applied (routes/syllabi.js).
// ---------------------------------------------------------------------------
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function parseClassSchedule(value, field = "class_schedule") {
  if (!Array.isArray(value) || value.length > 30) {
    bad(`${field} must be an array of at most 30 entries`);
  }
  return value.map((item, i) => {
    if (typeof item !== "object" || item === null) bad(`${field}[${i}] must be an object`);
    const day_of_week = parseEnum(item.day_of_week, `${field}[${i}].day_of_week`, WEEKDAYS, { required: true });
    const start_time = parseTime(item.start_time, `${field}[${i}].start_time`);
    const end_time = parseTime(item.end_time, `${field}[${i}].end_time`);
    if (end_time <= start_time) bad(`${field}[${i}]: end_time must be after start_time`);
    return { day_of_week, start_time, end_time };
  });
}