// Tries each Gemini model with a tiny request and reports which ones work RIGHT NOW.
// Run from the server/ folder:
//   node tests/gemini-models.mjs                       tests every text "flash" model your key lists
//   node tests/gemini-models.mjs gemini-2.5-flash ...  tests only the models you name
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log("No GEMINI_API_KEY found. Run this from server/, where .env lives.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: key });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The inner message of Google's JSON error, shortened
const brief = (e) => {
  let msg = String(e?.message ?? e);
  try { msg = JSON.parse(msg).error?.message ?? msg; } catch { /* not JSON */ }
  return msg.replace(/\s+/g, " ").slice(0, 90);
};

let candidates = process.argv.slice(2);
if (candidates.length === 0) {
  for await (const m of await ai.models.list()) {
    const name = m.name.replace(/^models\//, "");
    // text models only: skip image, audio, live, preview and similar variants
    if (/flash/i.test(name) && !/image|omni|preview|live|tts|audio|native|embed/i.test(name)) {
      candidates.push(name);
    }
  }
}

console.log(`Testing ${candidates.length} model(s) with one tiny request each...\n`);
const working = [];
for (const model of candidates) {
  const started = Date.now();
  try {
    const r = await ai.models.generateContent({
      model,
      contents: 'Return {"ok": true} as JSON and nothing else.',
      config: { systemInstruction: "You output only JSON." },
    });
    const text = (r.text ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    let jsonOk = false;
    try { jsonOk = JSON.parse(text).ok === true; } catch { /* not JSON */ }
    console.log(`  OK    ${model.padEnd(30)} ${String(Date.now() - started).padStart(5)} ms   valid JSON: ${jsonOk}`);
    if (jsonOk) working.push(model);
  } catch (e) {
    console.log(`  FAIL  ${model.padEnd(30)} status ${e?.status ?? "?"}   ${brief(e)}`);
  }
  await sleep(2500); // stay polite to per-minute limits
}

console.log("\nWorking now:", working.length ? working.join(", ") : "(none, try again in a few minutes)");
if (working.length) {
  console.log("\nPut one of them in server/.env, for example:");
  console.log(`  GEMINI_MODEL=${working[0]}`);
}