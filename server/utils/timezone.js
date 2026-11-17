// Timezone math without any date library, using the Intl API built into Node.
//
// Why this exists: the database stores moments in UTC, but people think in local
// wall-clock time ("class is at 10:00"). To place a 10:00 class on a calendar, or to
// say "study between 8am and 10pm", we must convert local times to UTC correctly,
// including daylight-saving changes.

const formatters = new Map();

function formatterFor(tz) {
  let f = formatters.get(tz);
  if (!f) {
    // Creating a formatter is slow, so each timezone's is built once and reused
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

// The wall-clock fields a given instant shows in `tz`
function readParts(utcMs, tz) {
  const parts = {};
  for (const p of formatterFor(tz).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour % 24, // some runtimes print midnight as "24"
    minute: +parts.minute,
    second: +parts.second,
  };
}

// How far `tz` is ahead of UTC at that instant, in ms (e.g. -8h for Los Angeles in winter)
function offsetMs(utcMs, tz) {
  const p = readParts(utcMs, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

export function isValidTimezone(tz) {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Wall-clock time in `tz` -> the UTC instant. The offset is looked up twice because
// the first guess can land on the wrong side of a daylight-saving change.
export function zonedToUtc(year, month, day, hour, minute, tz) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// A UTC instant -> its local calendar fields in `tz`, plus weekday (0 = Sunday)
export function localParts(date, tz) {
  const p = readParts(date.getTime(), tz);
  return { ...p, weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() };
}

// Calendar arithmetic on a plain y/m/d (no timezone involved)
export function addDays(year, month, day, n) {
  const dt = new Date(Date.UTC(year, month - 1, day + n));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    weekday: dt.getUTCDay(),
  };
}

// "09:30" or "09:30:00" -> { hour: 9, minute: 30 }
export function parseHHMM(str) {
  const m = /^(\d{2}):(\d{2})/.exec(String(str));
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

// Human-readable local time, used inside AI prompts: "Tue, Nov 17, 2:00 PM"
export function localLabel(date, tz) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}