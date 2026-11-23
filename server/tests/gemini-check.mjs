// Tests your Gemini key and model directly, with no database or server involved.
// Run from the server/ folder:   node tests/gemini-check.mjs
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

console.log("1. Settings read from .env");
console.log("   GEMINI_API_KEY set:        ", Boolean(key));
if (key) {
  console.log("   key length:                ", key.length, "(Google keys are usually 39)");
  console.log("   starts with AIza:          ", key.startsWith("AIza"));
  console.log("   stray quotes/spaces in it: ", /^["'\s]|["'\s]$/.test(key));
}
console.log("   GEMINI_MODEL:              ", JSON.stringify(model));
if (!key) {
  console.log("\nNo key found. Is it in server/.env, and did you run this from server/?");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: key });
const show = (e) => {
  console.log("   FAILED");
  console.log("   status :", e?.status);
  console.log("   message:", String(e?.message ?? e).slice(0, 600));
};

console.log("\n2. Simplest possible call");
try {
  const r = await ai.models.generateContent({ model, contents: "Reply with the single word: ready" });
  console.log("   OK ->", JSON.stringify(r.text));
} catch (e) {
  show(e);
}

console.log("\n3. Same call shape the app uses (parts array + systemInstruction)");
try {
  const r = await ai.models.generateContent({
    model,
    contents: [{ text: 'Return {"ok": true} as JSON and nothing else.' }],
    config: { systemInstruction: "You output only JSON." },
  });
  console.log("   OK ->", JSON.stringify(r.text));
} catch (e) {
  show(e);
}

console.log("\n4. Models your key can use (names containing 'flash')");
try {
  const names = [];
  for await (const m of await ai.models.list()) {
    if (/flash/i.test(m.name)) names.push(m.name.replace(/^models\//, ""));
  }
  console.log("  ", names.length ? names.join(", ") : "(none listed)");
} catch (e) {
  show(e);
}