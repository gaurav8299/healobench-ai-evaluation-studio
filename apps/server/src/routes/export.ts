/**
 * Export API Routes
 */

import { Hono } from "hono";
import { getRun } from "../services/runner.service";

const exportRoutes = new Hono();

// JSON export
exportRoutes.get("/:id/json", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) return c.json({ error: "Run not found" }, 404);

  c.header("Content-Type", "application/json");
  c.header(
    "Content-Disposition",
    `attachment; filename="healobench-${run.strategy}-${run.id}.json"`
  );

  return c.json(run);
});

// CSV export
exportRoutes.get("/:id/csv", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) return c.json({ error: "Run not found" }, 404);

  const headers = [
    "case_id",
    "status",
    "overall_score",
    "chief_complaint",
    "vitals_bp",
    "vitals_hr",
    "vitals_temp_f",
    "vitals_spo2",
    "medications",
    "diagnoses",
    "plan",
    "follow_up_days",
    "follow_up_reason",
    "hallucination_count",
    "schema_valid",
    "wall_time_ms",
  ];

  let csv = headers.join(",") + "\n";

  for (const caseResult of run.cases) {
    const scoreMap = new Map(
      caseResult.scores.map((s) => [s.field, s.score])
    );

    const row = [
      caseResult.case_id,
      caseResult.status,
      caseResult.overall_score.toFixed(3),
      (scoreMap.get("chief_complaint") || 0).toFixed(3),
      (scoreMap.get("vitals.bp") || 0).toFixed(3),
      (scoreMap.get("vitals.hr") || 0).toFixed(3),
      (scoreMap.get("vitals.temp_f") || 0).toFixed(3),
      (scoreMap.get("vitals.spo2") || 0).toFixed(3),
      (scoreMap.get("medications") || 0).toFixed(3),
      (scoreMap.get("diagnoses") || 0).toFixed(3),
      (scoreMap.get("plan") || 0).toFixed(3),
      (scoreMap.get("follow_up.interval_days") || 0).toFixed(3),
      (scoreMap.get("follow_up.reason") || 0).toFixed(3),
      caseResult.hallucination_count,
      caseResult.schema_valid ? "true" : "false",
      caseResult.wall_time_ms,
    ];

    csv += row.join(",") + "\n";
  }

  // Add summary row
  csv += "\n# Summary\n";
  csv += `Strategy,${run.strategy}\n`;
  csv += `Model,${run.model}\n`;
  csv += `Overall F1,${run.overall_f1.toFixed(3)}\n`;
  csv += `Total Cases,${run.total_cases}\n`;
  csv += `Completed,${run.completed_cases}\n`;
  csv += `Failed,${run.failed_cases}\n`;
  csv += `Total Cost,$${run.total_cost_usd.toFixed(4)}\n`;
  csv += `Wall Time,${run.wall_time_ms}ms\n`;
  csv += `Hallucinations,${run.hallucination_count}\n`;

  c.header("Content-Type", "text/csv");
  c.header(
    "Content-Disposition",
    `attachment; filename="healobench-${run.strategy}-${run.id}.csv"`
  );

  return c.text(csv);
});

// PDF export (simplified HTML-to-print approach)
exportRoutes.get("/:id/pdf", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) return c.json({ error: "Run not found" }, 404);

  // Generate a printable HTML report
  const completedCases = run.cases.filter((c) => c.status === "completed");
  const avgScore = run.overall_f1;

  const fieldRows = Object.entries(run.field_scores)
    .map(
      ([field, score]) =>
        `<tr><td>${field}</td><td>${(score * 100).toFixed(1)}%</td></tr>`
    )
    .join("\n");

  const caseRows = completedCases
    .map(
      (c) =>
        `<tr><td>${c.case_id}</td><td>${(c.overall_score * 100).toFixed(1)}%</td><td>${c.hallucination_count}</td><td>${c.schema_valid ? "✓" : "✗"}</td></tr>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>HealoBench Report — ${run.strategy}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
    h1 { color: #6366f1; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    .metric { display: inline-block; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; margin: 4px; }
    .metric strong { color: #6366f1; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .pass { background: #dcfce7; color: #166534; }
    .fail { background: #fef2f2; color: #991b1b; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>🏥 HealoBench Evaluation Report</h1>
  <p><strong>Strategy:</strong> ${run.strategy} | <strong>Model:</strong> ${run.model} | <strong>Date:</strong> ${new Date(run.started_at).toLocaleDateString()}</p>
  
  <h2>📊 Summary</h2>
  <div>
    <div class="metric"><strong>Overall F1:</strong> ${(avgScore * 100).toFixed(1)}%</div>
    <div class="metric"><strong>Cases:</strong> ${run.completed_cases}/${run.total_cases}</div>
    <div class="metric"><strong>Cost:</strong> $${run.total_cost_usd.toFixed(4)}</div>
    <div class="metric"><strong>Duration:</strong> ${(run.wall_time_ms / 1000).toFixed(1)}s</div>
    <div class="metric"><strong>Hallucinations:</strong> ${run.hallucination_count}</div>
  </div>

  <h2>📋 Per-Field Scores</h2>
  <table>
    <tr><th>Field</th><th>Score</th></tr>
    ${fieldRows}
  </table>

  <h2>📝 Case Results</h2>
  <table>
    <tr><th>Case</th><th>Score</th><th>Hallucinations</th><th>Schema Valid</th></tr>
    ${caseRows}
  </table>

  <p style="color: #94a3b8; margin-top: 40px; text-align: center;">Generated by HealoBench AI Evaluation Studio</p>
</body>
</html>`;

  c.header("Content-Type", "text/html");
  c.header(
    "Content-Disposition",
    `attachment; filename="healobench-report-${run.strategy}-${run.id}.html"`
  );

  return c.html(html);
});

export default exportRoutes;
