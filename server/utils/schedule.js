// Pure scheduling logic (no database, no AI). The study-plan route uses it to work
// out WHEN the student is free, and to double-check whatever the AI proposes.
//
// All intervals are { start, end } in epoch milliseconds.

import {
  zonedToUtc,
  localParts,
  addDays,
  parseHHMM,
  WEEKDAY_NAMES,
} from "./timezone.js";

const MIN = 60_000;
const DAY = 86_400_000;
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Every local calendar date from `from` to `to`, as { year, month, day, weekday }.
// `padBefore` adds earlier days so an overnight block that STARTED yesterday is seen.
function localDates(from, to, tz, padBefore = 1) {
  const first = localParts(from, tz);
  const total = Math.ceil((to - from) / DAY) + padBefore + 2;
  const out = [];
  for (let i = -padBefore; i < total; i++) {
    out.push(addDays(first.year, first.month, first.day, i));
  }
  return out;
}

// Understands the small subset of iCalendar rules the Availability page needs:
//   FREQ=DAILY          FREQ=WEEKLY;BYDAY=MO,WE,FR
// Missing rule on a recurring block = weekly on the weekday it starts.
// Other parts (INTERVAL, UNTIL, COUNT...) are reported in `ignored`, not applied.
export function parseRecurrence(rule, startWeekday) {
  if (!rule) {
    return { supported: true, days: new Set([startWeekday]), ignored: [] };
  }
  const parts = {};
  for (const piece of String(rule).replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  const ignored = Object.keys(parts).filter((k) => k !== "FREQ" && k !== "BYDAY");

  if (parts.FREQ === "DAILY") {
    return { supported: true, days: new Set([0, 1, 2, 3, 4, 5, 6]), ignored };
  }
  if (parts.FREQ === "WEEKLY") {
    const days = new Set();
    for (const code of (parts.BYDAY ?? "").split(",")) {
      const i = DAY_CODES.indexOf(code.trim().slice(-2)); // "MO", or "1MO"
      if (i !== -1) days.add(i);
    }
    if (days.size === 0) days.add(startWeekday);
    return { supported: true, days, ignored };
  }
  return { supported: false, days: new Set(), ignored };
}

export function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of sorted) {
    const last = out.at(-1);
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

// Everything that makes the student unavailable between rangeStart and rangeEnd:
//   blocks         availability_blocks rows (one-off or recurring)
//   classSchedules course_schedules rows (weekly class times, local wall-clock)
//   sessions       study sessions that already exist and will be kept
export function buildBusyIntervals({ blocks, classSchedules, sessions, rangeStart, rangeEnd, tz }) {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const busy = [];
  const warnings = [];
  const push = (s, e) => {
    if (e > startMs && s < endMs) busy.push({ start: Math.max(s, startMs), end: Math.min(e, endMs) });
  };
  const dates = localDates(rangeStart, rangeEnd, tz, 1);

  for (const b of blocks) {
    const bs = new Date(b.start_time);
    const be = new Date(b.end_time);
    if (!b.is_recurring) {
      push(bs.getTime(), be.getTime());
      continue;
    }
    const base = localParts(bs, tz);
    const rule = parseRecurrence(b.recurrence_rule, base.weekday);
    if (!rule.supported) {
      warnings.push(
        `"${b.name}" repeats in a way the planner can't read, so only its first occurrence was avoided.`
      );
      push(bs.getTime(), be.getTime());
      continue;
    }
    if (rule.ignored.length) {
      warnings.push(`"${b.name}": ignored repeat settings ${rule.ignored.join(", ")}.`);
    }
    const firstDay = Date.UTC(base.year, base.month - 1, base.day);
    const duration = be - bs;
    for (const d of dates) {
      if (Date.UTC(d.year, d.month - 1, d.day) < firstDay) continue; // before it began
      if (!rule.days.has(d.weekday)) continue;
      const s = zonedToUtc(d.year, d.month, d.day, base.hour, base.minute, tz).getTime();
      push(s, s + duration);
    }
  }

  for (const c of classSchedules) {
    const st = parseHHMM(c.start_time);
    const et = parseHHMM(c.end_time);
    for (const d of dates) {
      if (WEEKDAY_NAMES[d.weekday] !== c.day_of_week) continue;
      push(
        zonedToUtc(d.year, d.month, d.day, st.hour, st.minute, tz).getTime(),
        zonedToUtc(d.year, d.month, d.day, et.hour, et.minute, tz).getTime()
      );
    }
  }

  for (const s of sessions) push(new Date(s.start_time).getTime(), new Date(s.end_time).getTime());

  return { busy: mergeIntervals(busy), warnings };
}

// window minus busy time -> the free pieces (busy must be merged and sorted)
function subtract(window, busy) {
  const free = [];
  let cursor = window.start;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start >= window.end) break;
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free;
}

// The free study slots over the next `days` days: each day's waking window
// (dayStart-dayEnd local time) minus everything busy, never starting in the past.
export function computeFreeSlots({ now, days, tz, dayStart, dayEnd, busy, minMinutes = 30 }) {
  const ds = parseHHMM(dayStart);
  const de = parseHHMM(dayEnd);
  const earliest = Math.ceil(now.getTime() / (15 * MIN)) * (15 * MIN); // next quarter hour
  const horizonEnd = now.getTime() + days * DAY;
  const slots = [];

  for (const d of localDates(now, new Date(horizonEnd), tz, 0)) {
    const ws = zonedToUtc(d.year, d.month, d.day, ds.hour, ds.minute, tz).getTime();
    const we = zonedToUtc(d.year, d.month, d.day, de.hour, de.minute, tz).getTime();
    const window = { start: Math.max(ws, earliest), end: Math.min(we, horizonEnd) };
    if (window.end - window.start < minMinutes * MIN) continue;
    for (const piece of subtract(window, busy)) {
      if (piece.end - piece.start >= minMinutes * MIN) slots.push(piece);
    }
  }
  return slots;
}

// The AI proposes sessions; we do NOT trust it. A proposal survives only if it
//  - lasts between minMinutes and maxMinutes
//  - belongs to a real assignment and ends before that assignment is due
//  - fits entirely inside a free slot (so it can't hit class, work, or another session)
// `proposed` items: { assignment_id, start, end, title } with start/end in epoch ms.
export function validatePlan(proposed, slots, { minMinutes = 30, maxMinutes = 120, dueMsByAssignment }) {
  const free = slots.map((s) => ({ ...s }));
  const accepted = [];
  const rejected = [];

  for (const p of [...proposed].sort((a, b) => a.start - b.start)) {
    const reject = (reason) => rejected.push({ ...p, reason });
    const minutes = (p.end - p.start) / MIN;
    if (!(minutes >= minMinutes)) { reject("too short"); continue; }
    if (minutes > maxMinutes) { reject("too long"); continue; }
    const due = dueMsByAssignment.get(p.assignment_id);
    if (due === undefined) { reject("unknown assignment"); continue; }
    if (p.end > due) { reject("ends after the due date"); continue; }
    const i = free.findIndex((s) => s.start <= p.start && p.end <= s.end);
    if (i === -1) { reject("not inside a free slot"); continue; }

    // Use up that part of the slot so the next proposal can't double-book it
    const s = free[i];
    const rest = [];
    if (p.start > s.start) rest.push({ start: s.start, end: p.start });
    if (p.end < s.end) rest.push({ start: p.end, end: s.end });
    free.splice(i, 1, ...rest);
    accepted.push(p);
  }
  return { accepted, rejected };
}