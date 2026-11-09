// This import MUST come first. It reads .env into process.env before any other
// module (db, config/cookies.js, routes/auth.js) tries to use those values.
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pool from "./db/index.js";
import authRoutes from "./routes/auth.js";

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

// --- Error handler (must be last, takes 4 arguments) ---
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
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