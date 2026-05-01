import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Route imports
import runs from "./routes/runs";
import compare from "./routes/compare";
import leaderboard from "./routes/leaderboard";
import cases from "./routes/cases";
import exportRoutes from "./routes/export";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Health check
app.get("/", (c) => {
  return c.json({
    service: "HealoBench API",
    status: "healthy",
    version: "1.0.0",
    mode: "mock_llm",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.route("/api/v1/runs", runs);
app.route("/api/v1/compare", compare);
app.route("/api/v1/leaderboard", leaderboard);
app.route("/api/v1/cases", cases);
app.route("/api/v1/export", exportRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error", message: err.message }, 500);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 8787;
console.log(`🏥 HealoBench API running at http://localhost:${port}`);
console.log(`   Mode: Mock LLM (no API key required)`);
console.log(`   Endpoints:`);
console.log(`     GET  /api/v1/runs          - List runs`);
console.log(`     POST /api/v1/runs          - Start new run`);
console.log(`     GET  /api/v1/runs/:id      - Run detail`);
console.log(`     POST /api/v1/compare       - Compare runs`);
console.log(`     GET  /api/v1/leaderboard   - Leaderboard`);
console.log(`     GET  /api/v1/cases         - Browse cases`);
console.log(`     GET  /api/v1/export/:id/*  - Export results`);

export default {
  port,
  fetch: app.fetch,
};
