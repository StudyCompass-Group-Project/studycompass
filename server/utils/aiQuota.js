import { HttpError } from "./validate.js";

// Every Gemini call costs money and takes seconds, so each user gets a limited
// number per hour. Without a cap, one bug (or one person in a loop) could burn
// through your API quota. This lives in memory, so it resets when the server
// restarts and is per-process; that's fine for one server. Several servers would
// need a shared store such as Redis.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS = Number(process.env.AI_CALLS_PER_HOUR) || 20;

const callsByUser = new Map(); // userId -> [timestamps of recent calls]

// Call right BEFORE contacting Gemini (after validation), so rejected requests
// don't use up the allowance. Throws a 429 when the user is over the limit.
export function consumeAiQuota(userId) {
  const now = Date.now();
  const recent = (callsByUser.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    callsByUser.set(userId, recent);
    const minutes = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 60000));
    throw new HttpError(
      429,
      `AI request limit reached (${MAX_CALLS} per hour). Try again in about ${minutes} minute(s).`
    );
  }
  recent.push(now);
  callsByUser.set(userId, recent);
}

// Forget users with no recent calls so the map can't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of callsByUser) {
    if (times.every((t) => now - t >= WINDOW_MS)) callsByUser.delete(id);
  }
}, 10 * 60 * 1000).unref(); // unref: this timer never keeps the process alive