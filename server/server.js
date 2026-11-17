// This import MUST come first. It reads .env into process.env before any other
// module (db, config/cookies.js, routes/auth.js) tries to use those values.
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pool from "./db/index.js";
import requireAuth from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import assignmentRoutes from "./routes/assignments.js";
import projectRoutes from "./routes/projects.js";
import availabilityRoutes from "./routes/availability.js";
import sessionRoutes from "./routes/sessions.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";
import syllabusRoutes from "./routes/syllabi.js";
import studyPlanRoutes from "./routes/studyPlan.js";


const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware (runs on every request, in this order) ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// --- Routes ---
app.get("/api/health", async (req, res) => {
  const { rows } = await pool.query("SELECT NOW() AS now");
  res.json({ status: "ok", dbTime: rows[0].now });
});

app.use("/api/auth", authRoutes); // -> /api/auth/register, /api/auth/login

app.use("/api/courses", requireAuth, courseRoutes);
app.use("/api/assignments", requireAuth, assignmentRoutes);
app.use("/api/projects", requireAuth, projectRoutes);
app.use("/api/availability", requireAuth, availabilityRoutes);
app.use("/api/study-sessions", requireAuth, sessionRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/syllabi", requireAuth, syllabusRoutes); // Gemini: syllabus -> assignments
app.use("/api/study-plan", requireAuth, studyPlanRoutes); // Gemini: free time -> study sessions

// Any other /api URL: a JSON 404 instead of Express's default HTML page
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// --- Error handler (must be last, takes 4 arguments) ---
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  // 4xx messages are for the client. 5xx messages stay hidden unless we threw the error
  // on purpose with a safe message (HttpError sets expose = true, e.g. "AI service busy").
  const showMessage = status < 500 || err.expose === true;
  res.status(status).json({
    error: showMessage ? err.message : "Internal server error",
  });
});

try {
  await pool.query("SELECT 1");
  console.log("Connected to PostgreSQL");
} catch (err) {
  console.error("Could not connect to PostgreSQL:", err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});