"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/header";
import { getRuns, compareRuns as compareRunsApi } from "@/lib/api";

export default function ComparePage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runA, setRunA] = useState<string>("");
  const [runB, setRunB] = useState<string>("");
  const [comparison, setComparison] = useState<any>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    getRuns()
      .then((data) => {
        const completed = data.runs.filter((r: any) => r.status === "completed");
        setRuns(completed);
        if (completed.length >= 2) {
          setRunA(completed[0].id);
          setRunB(completed[1].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCompare = async () => {
    if (!runA || !runB || runA === runB) return;
    setComparing(true);
    try {
      const result = await compareRunsApi(runA, runB);
      setComparison(result.comparison);
    } catch (e) {
      console.error("Compare failed:", e);
    } finally {
      setComparing(false);
    }
  };

  const getWinnerColor = (w: string) =>
    w === "a" ? "#34d399" : w === "b" ? "#f87171" : "#94a3b8";

  const getWinnerLabel = (w: string) =>
    w === "a" ? "Run A Wins" : w === "b" ? "Run B Wins" : "Tie";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        <div className="animate-fade-in" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Strategy <span className="gradient-text">Comparison</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>
            Compare two runs to find which strategy wins on which fields
          </p>
        </div>

        {/* Run Selector */}
        <div className="glass-card-static animate-fade-in" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 16, alignItems: "center" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--hb-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                🟢 Run A
              </label>
              <select
                value={runA}
                onChange={(e) => setRunA(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--hb-border)",
                  borderRadius: 8,
                  color: "var(--hb-text-primary)",
                  fontSize: 14,
                }}
              >
                <option value="">Select run...</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.strategy} — {(r.overall_f1 * 100).toFixed(1)}% — {new Date(r.started_at).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 24, color: "var(--hb-text-muted)", fontWeight: 800 }}>VS</div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--hb-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                🔴 Run B
              </label>
              <select
                value={runB}
                onChange={(e) => setRunB(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--hb-border)",
                  borderRadius: 8,
                  color: "var(--hb-text-primary)",
                  fontSize: 14,
                }}
              >
                <option value="">Select run...</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.strategy} — {(r.overall_f1 * 100).toFixed(1)}% — {new Date(r.started_at).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn-primary"
              onClick={handleCompare}
              disabled={!runA || !runB || runA === runB || comparing}
              style={{ opacity: !runA || !runB || runA === runB ? 0.5 : 1, alignSelf: "flex-end" }}
            >
              {comparing ? "Comparing..." : "⚡ Compare"}
            </button>
          </div>
        </div>

        {/* Comparison Results */}
        {comparison && (
          <>
            {/* Overall Winner */}
            <div
              className="glass-card-static animate-slide-up"
              style={{
                padding: 32,
                marginBottom: 24,
                textAlign: "center",
                borderColor: getWinnerColor(comparison.overall_winner),
              }}
            >
              <div style={{ fontSize: 14, color: "var(--hb-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Overall Winner
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: getWinnerColor(comparison.overall_winner), marginBottom: 8 }}>
                {comparison.overall_winner === "a" ? "🟢 " : comparison.overall_winner === "b" ? "🔴 " : ""}
                {getWinnerLabel(comparison.overall_winner)}
              </div>
              <div style={{ fontSize: 14, color: "var(--hb-text-secondary)" }}>
                {comparison.run_a.strategy} ({(comparison.run_a.overall_f1 * 100).toFixed(1)}%)
                {" vs "}
                {comparison.run_b.strategy} ({(comparison.run_b.overall_f1 * 100).toFixed(1)}%)
              </div>
            </div>

            {/* Field Deltas */}
            <div className="glass-card-static animate-slide-up stagger-1" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                Per-Field Score Deltas
              </h3>
              {comparison.field_deltas?.map((fd: any) => (
                <div
                  key={fd.field}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 60px 1fr 80px",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(99, 102, 241, 0.06)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--hb-text-secondary)", fontWeight: 600 }}>
                    {fd.field}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ width: `${fd.run_a_score * 100}%`, height: "100%", borderRadius: 4, background: "#34d399" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", minWidth: 40 }}>
                      {(fd.run_a_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span style={{
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    color: getWinnerColor(fd.winner),
                  }}>
                    {fd.delta > 0 ? "+" : ""}{(fd.delta * 100).toFixed(1)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ width: `${fd.run_b_score * 100}%`, height: "100%", borderRadius: 4, background: "#f87171" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171", minWidth: 40 }}>
                      {(fd.run_b_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className={`score-badge ${fd.winner === "a" ? "score-high" : fd.winner === "b" ? "score-low" : "score-mid"}`} style={{ justifySelf: "end" }}>
                    {fd.winner === "a" ? "A wins" : fd.winner === "b" ? "B wins" : "Tie"}
                  </span>
                </div>
              ))}
            </div>

            {/* Case-Level Deltas */}
            <div className="glass-card-static animate-slide-up stagger-2" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hb-border)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                  Top Case Differences
                </h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Run A Score</th>
                    <th>Run B Score</th>
                    <th>Delta</th>
                    <th>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.case_deltas?.slice(0, 15).map((cd: any) => (
                    <tr key={cd.case_id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{cd.case_id}</td>
                      <td style={{ color: "#34d399", fontWeight: 600 }}>{(cd.run_a_score * 100).toFixed(1)}%</td>
                      <td style={{ color: "#f87171", fontWeight: 600 }}>{(cd.run_b_score * 100).toFixed(1)}%</td>
                      <td style={{ fontWeight: 700, color: getWinnerColor(cd.delta > 0.01 ? "a" : cd.delta < -0.01 ? "b" : "tie") }}>
                        {cd.delta > 0 ? "+" : ""}{(cd.delta * 100).toFixed(1)}
                      </td>
                      <td>
                        <span className={`score-badge ${cd.delta > 0.01 ? "score-high" : cd.delta < -0.01 ? "score-low" : "score-mid"}`}>
                          {cd.delta > 0.01 ? "A" : cd.delta < -0.01 ? "B" : "="}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!comparison && !loading && (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Select two runs to compare
            </h3>
            <p style={{ color: "var(--hb-text-muted)" }}>
              {runs.length < 2
                ? "You need at least 2 completed runs. Run some evaluations first!"
                : "Choose runs above and click Compare to see per-field deltas"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
