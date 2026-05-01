"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/header";
import { getRunDetail, getExportUrl } from "@/lib/api";

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"scores" | "explanation" | "trace">("scores");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runId) {
      getRunDetail(runId)
        .then((data) => setRun(data.run))
        .catch((e) => setError(e.message || "Failed to load run"))
        .finally(() => setLoading(false));
    }
  }, [runId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navigation />
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
          <div className="animate-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navigation />
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
          <div className="glass-card-static animate-fade-in" style={{ padding: 40, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <h2 style={{ color: "#f87171", marginBottom: 16 }}>Error Loading Run</h2>
            <p style={{ color: "var(--hb-text-muted)", marginBottom: 24 }}>{error || "Run not found"}</p>
            <Link href="/runs" className="btn-secondary" style={{ textDecoration: "none" }}>← Back to runs</Link>
          </div>
        </div>
      </div>
    );
  }

  const completedCases = run.cases?.filter((c: any) => c.status === "completed") || [];
  const getScoreColor = (score: number) =>
    score >= 0.8 ? "#34d399" : score >= 0.5 ? "#fbbf24" : "#f87171";

  const handleExportPng = async () => {
    const el = document.getElementById("run-report-container");
    if (!el) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { backgroundColor: "#0f172a" });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `healobench_run_${run.id.slice(0, 8)}.png`;
      a.click();
    } catch (e) {
      console.error("Failed to export PNG:", e);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div id="run-report-container" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Breadcrumb */}
        <div className="animate-fade-in" style={{ marginBottom: 24, fontSize: 14 }}>
          <Link href="/runs" style={{ color: "var(--hb-text-muted)", textDecoration: "none" }}>
            ← Runs
          </Link>
          <span style={{ color: "var(--hb-text-muted)", margin: "0 8px" }}>/</span>
          <span style={{ color: "#818cf8", fontFamily: "var(--font-mono)" }}>
            {run.id.slice(0, 20)}
          </span>
        </div>

        {/* Summary Cards */}
        <div
          className="animate-fade-in"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}
        >
          {[
            { label: "Overall F1", value: `${(run.overall_f1 * 100).toFixed(1)}%`, color: getScoreColor(run.overall_f1) },
            { label: "Strategy", value: run.strategy, color: "#818cf8" },
            { label: "Cases", value: `${run.completed_cases}/${run.total_cases}`, color: "#e2e8f0" },
            { label: "Hallucinations", value: String(run.hallucination_count), color: run.hallucination_count > 0 ? "#f59e0b" : "#34d399" },
            { label: "Cost", value: `$${run.total_cost_usd.toFixed(4)}`, color: "#e2e8f0" },
            { label: "Duration", value: `${(run.wall_time_ms / 1000).toFixed(1)}s`, color: "#e2e8f0" },
          ].map((card) => (
            <div key={card.label} className="glass-card-static" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--hb-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Export Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={handleExportPng} className="btn-secondary btn-sm">
            📸 Export PNG
          </button>
          {(["json", "csv", "pdf"] as const).map((fmt) => (
            <a
              key={fmt}
              href={getExportUrl(runId, fmt)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              📥 {fmt.toUpperCase()}
            </a>
          ))}
        </div>

        {/* Per-Field Scores */}
        {run.field_scores && Object.keys(run.field_scores).length > 0 && (
          <div className="glass-card-static animate-fade-in" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Per-Field Aggregate Scores
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {Object.entries(run.field_scores).map(([field, score]: [string, any]) => (
                <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--hb-text-secondary)" }}>{field}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                      <div style={{ width: `${score * 100}%`, height: "100%", borderRadius: 3, background: getScoreColor(score), transition: "width 1s ease" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(score), minWidth: 45, textAlign: "right" }}>
                      {(score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cases Table + Detail Panel */}
        <div style={{ display: "grid", gridTemplateColumns: selectedCase ? "1fr 1fr" : "1fr", gap: 20 }}>
          {/* Cases Table */}
          <div className="glass-card-static animate-fade-in" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hb-border)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                Case Results ({completedCases.length})
              </h3>
            </div>
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Halluc.</th>
                  </tr>
                </thead>
                <tbody>
                  {run.cases?.map((c: any) => (
                    <tr
                      key={c.case_id}
                      onClick={() => setSelectedCase(c)}
                      style={{
                        background: selectedCase?.case_id === c.case_id ? "rgba(99, 102, 241, 0.08)" : undefined,
                      }}
                    >
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{c.case_id}</td>
                      <td>
                        <span
                          className={`score-badge ${c.overall_score >= 0.8 ? "score-high" : c.overall_score >= 0.5 ? "score-mid" : "score-low"}`}
                        >
                          {(c.overall_score * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${c.status === "completed" ? "status-completed" : "status-failed"}`}>
                          {c.status === "completed" ? "✓ Pass" : "✗ Fail"}
                        </span>
                      </td>
                      <td style={{ color: c.hallucination_count > 0 ? "#f59e0b" : "var(--hb-text-muted)" }}>
                        {c.hallucination_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedCase && (
            <div className="glass-card-static animate-slide-up" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hb-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                  {selectedCase.case_id}
                </h3>
                <button
                  onClick={() => setSelectedCase(null)}
                  style={{ background: "none", border: "none", color: "var(--hb-text-muted)", cursor: "pointer", fontSize: 18 }}
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--hb-border)" }}>
                {(["scores", "explanation", "trace"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "12px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      background: "transparent",
                      color: activeTab === tab ? "#818cf8" : "var(--hb-text-muted)",
                      borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ padding: 20, maxHeight: 500, overflowY: "auto" }}>
                {activeTab === "scores" && (
                  <div>
                    {selectedCase.scores?.map((s: any) => (
                      <div
                        key={s.field}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 0",
                          borderBottom: "1px solid rgba(99, 102, 241, 0.06)",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{s.field}</div>
                          <div style={{ fontSize: 12, color: "var(--hb-text-muted)" }}>{s.metric}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                            <div style={{ width: `${s.score * 100}%`, height: "100%", borderRadius: 3, background: getScoreColor(s.score) }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(s.score), minWidth: 48, textAlign: "right" }}>
                            {(s.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "explanation" && selectedCase.explanation && (
                  <div>
                    <div style={{ padding: 16, background: "rgba(99, 102, 241, 0.06)", borderRadius: 8, marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
                      {selectedCase.explanation.summary}
                    </div>

                    {selectedCase.explanation.field_explanations?.map((fe: any) => (
                      <div key={fe.field} style={{ marginBottom: 12, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{fe.field}</span>
                          <span className={`score-badge ${fe.verdict === "correct" ? "score-high" : fe.verdict === "partially_correct" ? "score-mid" : "score-low"}`}>
                            {fe.verdict}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--hb-text-secondary)", lineHeight: 1.5 }}>
                          {fe.reason}
                        </p>
                      </div>
                    ))}

                    {selectedCase.explanation.hallucinated_items?.length > 0 && (
                      <div style={{ marginTop: 16, padding: 12, background: "rgba(239, 68, 68, 0.06)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>⚠ Hallucinated Values</div>
                        {selectedCase.explanation.hallucinated_items.map((h: string, i: number) => (
                          <div key={i} style={{ fontSize: 13, color: "var(--hb-text-secondary)", padding: "2px 0" }}>
                            • {h}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "trace" && (
                  <div>
                    {selectedCase.attempts?.map((a: any) => (
                      <div key={a.attempt_number} style={{ marginBottom: 16, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            Attempt #{a.attempt_number}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--hb-text-muted)" }}>
                            {a.latency_ms}ms | {a.cache_hit ? "Cache ✓" : "No cache"}
                          </span>
                        </div>
                        {a.validation_errors?.length > 0 && (
                          <div style={{ padding: 8, background: "rgba(239, 68, 68, 0.08)", borderRadius: 4, marginBottom: 8 }}>
                            {a.validation_errors.map((e: string, i: number) => (
                              <div key={i} style={{ fontSize: 12, color: "#f87171" }}>❌ {e}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "var(--hb-text-muted)" }}>
                          Tokens: {a.tokens.input_tokens} in / {a.tokens.output_tokens} out
                          {a.tokens.cache_read_input_tokens > 0 && ` / ${a.tokens.cache_read_input_tokens} cache`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
