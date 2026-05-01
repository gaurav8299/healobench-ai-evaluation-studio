"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/header";
import { getRuns } from "@/lib/api";

import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRuns()
      .then((data) => setRuns(data.runs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completedRuns = runs.filter((r) => r.status === "completed");
  const avgF1 = completedRuns.length > 0
    ? completedRuns.reduce((s, r) => s + r.overall_f1, 0) / completedRuns.length
    : 0;
  const totalCost = completedRuns.reduce((s, r) => s + r.total_cost_usd, 0);
  const totalHallucinations = completedRuns.reduce((s, r) => s + r.hallucination_count, 0);
  const totalCases = completedRuns.reduce((s, r) => s + r.completed_cases, 0);

  // Aggregate field scores across runs
  const fieldAgg: Record<string, { sum: number; count: number }> = {};
  for (const run of completedRuns) {
    if (run.field_scores) {
      for (const [field, score] of Object.entries(run.field_scores)) {
        if (!fieldAgg[field]) fieldAgg[field] = { sum: 0, count: 0 };
        fieldAgg[field].sum += score as number;
        fieldAgg[field].count += 1;
      }
    }
  }
  const fieldAvg = Object.entries(fieldAgg)
    .map(([field, { sum, count }]) => ({
      field,
      score: sum / count,
    }))
    .sort((a, b) => b.score - a.score);

  // Strategy breakdown
  const strategyBreakdown = completedRuns.reduce((acc, run) => {
    if (!acc[run.strategy]) acc[run.strategy] = { sum: 0, count: 0, cost: 0 };
    acc[run.strategy].sum += run.overall_f1;
    acc[run.strategy].count += 1;
    acc[run.strategy].cost += run.total_cost_usd;
    return acc;
  }, {} as Record<string, { sum: number; count: number; cost: number }>);

  const getScoreColor = (s: number) => s >= 0.8 ? "#34d399" : s >= 0.5 ? "#fbbf24" : "#f87171";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        <div className="animate-fade-in" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Visual <span className="gradient-text">Analytics</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>
            Performance insights across all evaluation runs
          </p>
        </div>

        {loading ? (
          <div className="animate-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : completedRuns.length === 0 ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              No data yet
            </h3>
            <p style={{ color: "var(--hb-text-muted)" }}>
              Run some evaluations to see analytics
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div
              className="animate-fade-in"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {[
                { label: "Average F1", value: `${(avgF1 * 100).toFixed(1)}%`, icon: "🎯", color: getScoreColor(avgF1) },
                { label: "Total Runs", value: String(completedRuns.length), icon: "🚀", color: "#818cf8" },
                { label: "Cases Evaluated", value: String(totalCases), icon: "📋", color: "#e2e8f0" },
                { label: "Hallucinations", value: String(totalHallucinations), icon: "⚠️", color: totalHallucinations > 0 ? "#f59e0b" : "#34d399" },
                { label: "Total Cost", value: `$${totalCost.toFixed(4)}`, icon: "💰", color: "#e2e8f0" },
              ].map((kpi) => (
                <div key={kpi.label} className="glass-card" style={{ padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--hb-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        {kpi.label}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>
                        {kpi.value}
                      </div>
                    </div>
                    <span style={{ fontSize: 28 }}>{kpi.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Accuracy Gauge */}
            <div
              className="animate-slide-up stagger-1"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}
            >
              {/* Overall Accuracy Gauge */}
              <div className="glass-card-static" style={{ padding: 32, textAlign: "center" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                  Overall Accuracy
                </h3>
                <div style={{ position: "relative", width: 180, height: 180, margin: "0 auto" }}>
                  <svg viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
                    {/* Background circle */}
                    <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    {/* Score arc */}
                    <circle
                      cx="90" cy="90" r="75" fill="none"
                      stroke={getScoreColor(avgF1)}
                      strokeWidth="12"
                      strokeDasharray={`${avgF1 * 471} 471`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 1.5s ease" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(avgF1) }}>
                      {(avgF1 * 100).toFixed(1)}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>% F1</span>
                  </div>
                </div>
              </div>

              {/* Strategy Comparison */}
              <div className="glass-card-static" style={{ padding: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                  Strategy Performance
                </h3>
                {Object.entries(strategyBreakdown).map(([strategy, _data]) => {
                  const data = _data as { sum: number; count: number; cost: number };
                  const avg = data.sum / data.count;
                  return (
                    <div key={strategy} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{strategy}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(avg) }}>
                          {(avg * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${avg * 100}%`,
                            height: "100%",
                            borderRadius: 5,
                            background: `linear-gradient(90deg, ${getScoreColor(avg)}88, ${getScoreColor(avg)})`,
                            transition: "width 1s ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--hb-text-muted)", marginTop: 4 }}>
                        {data.count} run(s) · ${data.cost.toFixed(4)} total
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Score Trend Chart */}
            <div className="glass-card-static animate-slide-up stagger-2" style={{ padding: 32, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                Prompt Score Trend
              </h3>
              <div style={{ height: 300, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={completedRuns.map((r, i) => ({
                      name: `Run ${i + 1}`,
                      f1: r.overall_f1 * 100,
                      strategy: r.strategy,
                    }))}
                    margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--hb-text-muted)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--hb-text-muted)" fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                      contentStyle={{ background: "rgba(15, 23, 42, 0.9)", border: "1px solid var(--hb-border)", borderRadius: 8 }}
                      itemStyle={{ color: "#34d399", fontWeight: 700 }}
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Overall F1"]}
                      labelStyle={{ color: "var(--hb-text-muted)", marginBottom: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="f1"
                      stroke="#818cf8"
                      strokeWidth={3}
                      dot={{ fill: "#818cf8", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#34d399", stroke: "none" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-Field Scores Chart */}
            <div className="glass-card-static animate-slide-up stagger-3" style={{ padding: 32, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                Per-Field Score Distribution
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fieldAvg.map((f) => (
                  <div key={f.field} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ width: 160, fontSize: 13, color: "var(--hb-text-secondary)", textAlign: "right", flexShrink: 0 }}>
                      {f.field}
                    </span>
                    <div style={{ flex: 1, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.03)", overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          width: `${f.score * 100}%`,
                          height: "100%",
                          borderRadius: 6,
                          background: `linear-gradient(90deg, ${getScoreColor(f.score)}66, ${getScoreColor(f.score)})`,
                          transition: "width 1.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          paddingRight: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                          {(f.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Distribution */}
            <div className="glass-card-static animate-slide-up stagger-3" style={{ padding: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                Run History
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                {completedRuns.map((run) => (
                  <div key={run.id} style={{ padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: "#818cf8" }}>{run.strategy}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--hb-text-muted)", marginTop: 2 }}>
                        {new Date(run.started_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(run.overall_f1) }}>
                        {(run.overall_f1 * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 11, color: "var(--hb-text-muted)" }}>
                        ${run.total_cost_usd.toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
