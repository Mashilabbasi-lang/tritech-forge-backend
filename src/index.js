import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import companyRoutes from "./routes/companies.js";
import bookingRoutes from "./routes/bookings.js";
import statsRoutes from "./routes/stats.js";
import webhookRoutes from "./routes/webhook.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(limiter);

// ─── Routes ──────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/companies", bookingRoutes);
app.use("/api/stats", statsRoutes);
app.use("/webhook", webhookRoutes);

// ─── Health ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ─────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, error: "Not found" }));

// ─── Error ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────
await initDb();
app.listen(PORT, () => {
  console.log(`✅ TriTech Forge API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
