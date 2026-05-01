"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navigation from "@/components/header";
import { getRuns, startRun, subscribeToRunStream } from "@/lib/api";

type RunSummary = {
  id: string;
  strategy: string;
  model: string;
  status: string;
  overall_f1: number;
  total_cases: number;
  completed_cases: number;
  total_cost_usd: number;
  wall_time_ms: number;
  started_at: string;
  hallucination_count: number;
};

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState("zero_shot");
  const [promptContent, setPromptContent] = useState("");
  const [showModal, setShowModal] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getRuns();
      setRuns(data.runs);
    } catch (e) {
      console.error("Failed to fetch runs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 3000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const handleStartRun = async () => {
    setStarting(true);
    try {
      const result = await startRun({
        strategy: selectedStrategy,
        prompt_content: promptContent || undefined,
        force: true,
      });
      setShowModal(false);

      // Subscribe to SSE for live updates
      subscribeToRunStream(result.run_id, () => {
        fetchRuns();
      });

      // Refresh immediately
      setTimeout(fetchRuns, 500);
    } catch (e) {
      console.error("Failed to start run:", e);
    } finally {
      setStarting(false);
    }
  };

  const handleRunDemo = async () => {
    setStarting(true);
    try {
      const result = await startRun({
        strategy: "cot",
        prompt_content: "Think step-by-step. First identify all medications, then vitals, then diagnoses. Output JSON.",
        dataset_filter: ["case_001", "case_002", "case_003", "case_004", "case_005"], // Subset 5 cases for speed
        force: true,
      });
      // Redirect to the run detail view immediately
      window.location.href = `/runs/${result.run_id}`;
    } catch (e) {
      console.error("Failed to start demo:", e);
      setStarting(false);
    }
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 0.8) return "score-high";
    if (score >= 0.5) return "score-mid";
    return "score-low";
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "running": return "status-running";
      case "completed": return "status-completed";
      case "failed": return "status-failed";
      default: return "status-pending";
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div
          className="animate-fade-in"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              Evaluation <span className="gradient-text">Runs</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>
              Start, monitor, and analyze evaluation runs
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={handleRunDemo}
              disabled={starting}
            >
              ⚡ Run Demo (5 Cases)
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowModal(true)}
            >
              🚀 New Run
            </button>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowModal(false)}
          >
            <div
              className="glass-card-static animate-slide-up"
              style={{ padding: 32, width: 440, maxWidth: "90vw" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
                Start New Evaluation
              </h2>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--hb-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Prompt Strategy
                </label>
                {["zero_shot", "few_shot", "cot"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStrategy(s)}
                    style={{
                      padding: "10px 20px",
                      marginRight: 8,
                      marginBottom: 8,
                      borderRadius: 8,
                      border:
                        selectedStrategy === s
                          ? "2px solid #6366f1"
                          : "1px solid var(--hb-border)",
                      background:
                        selectedStrategy === s
                          ? "rgba(99, 102, 241, 0.15)"
                          : "transparent",
                      color:
                        selectedStrategy === s
                          ? "#818cf8"
                          : "var(--hb-text-secondary)",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {s === "zero_shot" ? "Zero-Shot" : s === "few_shot" ? "Few-Shot" : "Chain-of-Thought"}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--hb-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    System Prompt
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPromptContent("Extract chief complaint, vitals, medications, diagnoses, and plan.")} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.1)", color: "white", border: "none", cursor: "pointer" }}>Preset 1: Basic</button>
                    <button onClick={() => setPromptContent("Think step-by-step. First identify all medications, then vitals, then diagnoses. Output JSON.")} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.1)", color: "white", border: "none", cursor: "pointer" }}>Preset 2: Step-by-Step</button>
                    <button onClick={() => setPromptContent("Extract data strictly following the JSON schema. Do not hallucinate. Return only JSON.")} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.1)", color: "white", border: "none", cursor: "pointer" }}>Preset 3: Strict</button>
                  </div>
                </div>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  placeholder="Enter custom prompt instructions..."
                  style={{
                    width: "100%",
                    height: 100,
                    padding: "12px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 8,
                    border: "1px solid var(--hb-border)",
                    color: "var(--hb-text-primary)",
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    resize: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--hb-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Model
                </label>
                <div
                  style={{
                    padding: "10px 16px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 8,
                    border: "1px solid var(--hb-border)",
                    fontSize: 14,
                    color: "var(--hb-text-secondary)",
                  }}
                >
                  claude-haiku-4-5-20251001 (Mock)
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button className="btn-secondary btn-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleStartRun}
                  disabled={starting}
                  style={{ opacity: starting ? 0.7 : 1 }}
                >
                  {starting ? "Starting..." : "🚀 Start Run"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Runs Table */}
        {loading ? (
          <div
            className="glass-card-static"
            style={{ padding: 60, textAlign: "center" }}
          >
            <div className="animate-shimmer" style={{ height: 200, borderRadius: 12 }} />
          </div>
        ) : runs.length === 0 ? (
          <div
            className="glass-card-static animate-fade-in"
            style={{ padding: 60, textAlign: "center" }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              No runs yet
            </h3>
            <p style={{ color: "var(--hb-text-muted)", marginBottom: 24 }}>
              Start your first evaluation to see results here
            </p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              Start First Run
            </button>
          </div>
        ) : (
          <div className="glass-card-static animate-fade-in" style={{ overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Strategy</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Overall F1</th>
                  <th>Cases</th>
                  <th>Hallucinations</th>
                  <th>Cost</th>
                  <th>Duration</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link
                        href={`/runs/${run.id}`}
                        style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600, fontFamily: "var(--font-mono)" }}
                      >
                        {run.id.slice(0, 16)}...
                      </Link>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          background: "rgba(99, 102, 241, 0.1)",
                          color: "#818cf8",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {run.strategy}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--hb-text-muted)" }}>
                      {run.model.split("-").slice(0, 2).join("-")}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(run.status)}`}>
                        {run.status === "running" && (
                          <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        )}
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <span className={`score-badge ${getScoreBadgeClass(run.overall_f1)}`}>
                        {(run.overall_f1 * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {run.completed_cases}/{run.total_cases}
                    </td>
                    <td>
                      <span style={{ color: run.hallucination_count > 0 ? "#f59e0b" : "var(--hb-text-muted)" }}>
                        {run.hallucination_count}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      ${run.total_cost_usd.toFixed(4)}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {(run.wall_time_ms / 1000).toFixed(1)}s
                    </td>
                    <td style={{ fontSize: 13, color: "var(--hb-text-muted)" }}>
                      {new Date(run.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
