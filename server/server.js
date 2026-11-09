// This import MUST come first. It reads .env into process.env before any other
// module (like db/index.js) tries to use those values.
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pool from "./db/index.js";

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware (runs on every request, in this order) ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // allow the browser to send/receive cookies cross-origin
  })
);
app.use(express.json()); // parses JSON request bodies into req.body
app.use(cookieParser()); // parses the Cookie header into req.cookies

// --- Routes ---
// Quick check that the server is up AND can talk to PostgreSQL.
app.get("/api/health", async (req, res) => {
  const { rows } = await pool.query("SELECT NOW() AS now");
  res.json({ status: "ok", dbTime: rows[0].now });
});

// Future routers from /routes get mounted here, e.g.:
// import authRoutes from "./routes/auth.js";
// app.use("/api/auth", authRoutes);

// --- Error handler (must be last, takes 4 arguments) ---
// Express 5 forwards errors from async handlers here automatically.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Verify the database is reachable before accepting traffic.
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
