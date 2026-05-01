"use client";

import Link from "next/link";
import Navigation from "@/components/header";
import { useEffect, useState } from "react";
import { getHealth, getRuns } from "@/lib/api";

const FEATURES = [
  {
    icon: "🧬",
    title: "Clinical Extraction",
    desc: "Extract structured data from doctor-patient transcripts using three prompt strategies",
  },
  {
    icon: "📊",
    title: "Per-Field Scoring",
    desc: "Fuzzy matching, set-F1, numeric tolerance — the right metric for every field type",
  },
  {
    icon: "🔍",
    title: "Hallucination Detection",
    desc: "Grounding check verifies every predicted value against the source transcript",
  },
  {
    icon: "⚡",
    title: "Strategy Comparison",
    desc: "Side-by-side comparison showing which prompt wins on which fields",
  },
  {
    icon: "🛡️",
    title: "Safety & Validation",
    desc: "Schema validation with retry loops, error tracking, and audit trails",
  },
  {
    icon: "📈",
    title: "Visual Analytics",
    desc: "Beautiful charts showing accuracy, trends, error distribution, and costs",
  },
];

const STATS = [
  { label: "Test Cases", value: "50", suffix: "+" },
  { label: "Prompt Strategies", value: "3", suffix: "" },
  { label: "Scoring Metrics", value: "10", suffix: "" },
  { label: "API Cost", value: "$0", suffix: "" },
];

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    getHealth()
      .then((h) => setApiStatus(h.status === "healthy" ? "Connected" : "Error"))
      .catch(() => setApiStatus("Offline"));

    getRuns()
      .then((r) => setRunCount(r.runs.length))
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      {/* Hero Section */}
      <section
        className="hero-bg"
        style={{
          padding: "80px 24px 60px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          className="animate-fade-in"
          style={{ maxWidth: 800, margin: "0 auto" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: 999,
              padding: "6px 16px",
              marginBottom: 24,
              fontSize: 13,
              color: "#818cf8",
              fontWeight: 500,
            }}
          >
            <span className="animate-pulse-dot" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#10b981", display: "inline-block",
            }} />
            Mock LLM Mode — No API Key Required
          </div>

          <h1
            className="gradient-text"
            style={{
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 20,
            }}
          >
            AI Evaluation
            <br />
            Studio
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "var(--hb-text-secondary)",
              lineHeight: 1.6,
              maxWidth: 600,
              margin: "0 auto 36px",
            }}
          >
            Production-grade evaluation harness for clinical NLP.
            Test, compare, and ship better prompts with confidence.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button 
              className="btn-secondary" 
              style={{ fontSize: 16 }}
              onClick={async () => {
                try {
                  const { startRun } = await import("@/lib/api");
                  const res = await startRun({
                    strategy: "cot",
                    prompt_content: "Think step-by-step. First identify all medications, then vitals, then diagnoses. Output JSON.",
                    dataset_filter: ["case_001", "case_002", "case_003", "case_004", "case_005"],
                    force: true,
                  });
                  window.location.href = `/runs/${res.run_id}`;
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              ⚡ Run Demo
            </button>
            <Link href="/runs">
              <button className="btn-primary" style={{ fontSize: 16 }}>
                🚀 Start Evaluation
              </button>
            </Link>
            <Link href="/cases">
              <button className="btn-secondary" style={{ fontSize: 16 }}>
                📋 Browse Cases
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section
        style={{
          maxWidth: 900,
          margin: "-20px auto 0",
          padding: "0 24px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="glass-card-static"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            padding: "24px 0",
          }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`animate-fade-in stagger-${i + 1}`}
              style={{
                textAlign: "center",
                borderRight: i < 3 ? "1px solid var(--hb-border)" : "none",
              }}
            >
              <div
                className="gradient-text"
                style={{ fontSize: 32, fontWeight: 800 }}
              >
                {stat.value}
                <span style={{ fontSize: 18 }}>{stat.suffix}</span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--hb-text-muted)",
                  fontWeight: 500,
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section
        style={{
          maxWidth: 1200,
          margin: "60px auto",
          padding: "0 24px",
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 40,
            textAlign: "center",
            color: "var(--hb-text-primary)",
          }}
        >
          Evaluation{" "}
          <span className="gradient-text">Capabilities</span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`glass-card animate-slide-up stagger-${i + 1}`}
              style={{ padding: 28 }}
            >
              <div
                style={{
                  fontSize: 36,
                  marginBottom: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  background: "rgba(99, 102, 241, 0.08)",
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--hb-text-primary)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--hb-text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* API Status */}
      <section
        style={{
          maxWidth: 600,
          margin: "40px auto 60px",
          padding: "0 24px",
        }}
      >
        <div className="glass-card-static" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--hb-text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                API Status
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color:
                    apiStatus === "Connected"
                      ? "#34d399"
                      : apiStatus === "Offline"
                        ? "#f87171"
                        : "var(--hb-text-secondary)",
                }}
              >
                {apiStatus === "Connected" ? "🟢" : apiStatus === "Offline" ? "🔴" : "⏳"}{" "}
                {apiStatus}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--hb-text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Completed Runs
              </div>
              <div
                className="gradient-text"
                style={{ fontSize: 24, fontWeight: 800 }}
              >
                {runCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--hb-border)",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--hb-text-muted)",
        }}
      >
        HealoBench AI Evaluation Studio — Built for Production
      </footer>
    </div>
  );
}
