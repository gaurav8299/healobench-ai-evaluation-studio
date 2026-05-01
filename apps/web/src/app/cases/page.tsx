"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/header";
import { getCases, getCaseData } from "@/lib/api";

export default function CasesPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [caseDetail, setCaseDetail] = useState<any>(null);

  useEffect(() => {
    getCases()
      .then((data) => setCases(data.cases))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectCase = async (caseId: string) => {
    if (selectedCase === caseId) {
      setSelectedCase(null);
      setCaseDetail(null);
      return;
    }
    setSelectedCase(caseId);
    try {
      const data = await getCaseData(caseId);
      setCaseDetail(data);
    } catch (e) {
      console.error("Failed to load case:", e);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        <div className="animate-fade-in" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Test <span className="gradient-text">Cases</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>
            Browse {cases.length} clinical transcripts and gold standard extractions
          </p>
        </div>

        {loading ? (
          <div className="animate-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: selectedCase ? "1fr 1fr" : "1fr", gap: 20 }}>
            {/* Cases Grid */}
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}>
                {cases.map((c, i) => (
                  <div
                    key={c.id}
                    className={`glass-card animate-fade-in stagger-${Math.min(i % 6 + 1, 6)}`}
                    onClick={() => handleSelectCase(c.id)}
                    style={{
                      padding: 20,
                      cursor: "pointer",
                      borderColor: selectedCase === c.id ? "var(--hb-border-active)" : undefined,
                      background: selectedCase === c.id ? "rgba(99, 102, 241, 0.08)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#818cf8",
                      }}>
                        {c.id}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "rgba(99, 102, 241, 0.1)",
                        fontSize: 11,
                        color: "var(--hb-text-muted)",
                      }}>
                        {c.has_vitals ? "✓ Vitals" : "No vitals"}
                      </span>
                    </div>

                    {c.chief_complaint && (
                      <p style={{
                        fontSize: 13,
                        color: "var(--hb-text-secondary)",
                        lineHeight: 1.5,
                        marginBottom: 12,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {c.chief_complaint}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--hb-text-muted)" }}>
                      <span>💊 {c.medication_count} meds</span>
                      <span>🩺 {c.diagnosis_count} dx</span>
                      <span>📝 {c.plan_count} plan</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Case Detail */}
            {caseDetail && (
              <div className="glass-card-static animate-slide-up" style={{ position: "sticky", top: 80, alignSelf: "flex-start", maxHeight: "calc(100vh - 120px)", overflow: "auto" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hb-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                    {caseDetail.id}
                  </h3>
                  <button
                    onClick={() => { setSelectedCase(null); setCaseDetail(null); }}
                    style={{ background: "none", border: "none", color: "var(--hb-text-muted)", cursor: "pointer", fontSize: 18 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Transcript */}
                <div style={{ padding: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--hb-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                    📄 Transcript
                  </h4>
                  <pre style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "var(--hb-text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: "rgba(0,0,0,0.3)",
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: 300,
                    overflowY: "auto",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {caseDetail.transcript}
                  </pre>

                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--hb-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 24, marginBottom: 12 }}>
                    🏆 Gold Standard
                  </h4>
                  <pre style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#34d399",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: "rgba(16, 185, 129, 0.04)",
                    border: "1px solid rgba(16, 185, 129, 0.1)",
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: 400,
                    overflowY: "auto",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {JSON.stringify(caseDetail.gold, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
