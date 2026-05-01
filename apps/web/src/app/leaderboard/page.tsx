"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/header";
import { getLeaderboard } from "@/lib/api";

const MEDAL_ICONS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then((data) => setEntries(data.leaderboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getScoreColor = (s: number) => s >= 0.8 ? "#34d399" : s >= 0.5 ? "#fbbf24" : "#f87171";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navigation />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div className="animate-fade-in" style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
            🏆 <span className="gradient-text">Leaderboard</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--hb-text-muted)" }}>
            Ranked model × strategy performance
          </p>
        </div>

        {loading ? (
          <div className="animate-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : entries.length === 0 ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No entries yet</h3>
            <p style={{ color: "var(--hb-text-muted)" }}>Complete evaluation runs to populate the leaderboard</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {entries.length >= 3 && (
              <div className="animate-slide-up" style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 40, alignItems: "flex-end" }}>
                {[entries[1], entries[0], entries[2]].map((entry, idx) => {
                  const heights = [180, 220, 160];
                  const order = [1, 0, 2];
                  return (
                    <div
                      key={entry.strategy + entry.model}
                      className="glass-card-static"
                      style={{
                        width: 200,
                        height: heights[idx],
                        padding: 24,
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        borderColor: idx === 1 ? "rgba(99, 102, 241, 0.4)" : undefined,
                        boxShadow: idx === 1 ? "0 0 30px rgba(99, 102, 241, 0.15)" : undefined,
                      }}
                    >
                      <div style={{ fontSize: 36, marginBottom: 8 }}>
                        {MEDAL_ICONS[order[idx]]}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: getScoreColor(entry.overall_f1), marginBottom: 4 }}>
                        {(entry.overall_f1 * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                        {entry.strategy}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--hb-text-muted)" }}>
                        ${entry.total_cost_usd.toFixed(4)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Table */}
            <div className="glass-card-static animate-fade-in" style={{ overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Strategy</th>
                    <th>Model</th>
                    <th>Overall F1</th>
                    <th>Cost</th>
                    <th>Avg Latency</th>
                    <th>Runs</th>
                    <th>Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.strategy + entry.model}>
                      <td>
                        <span style={{ fontSize: 18 }}>
                          {entry.rank <= 3 ? MEDAL_ICONS[entry.rank - 1] : `#${entry.rank}`}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          background: "rgba(99, 102, 241, 0.1)",
                          color: "#818cf8",
                          fontSize: 13,
                          fontWeight: 600,
                        }}>
                          {entry.strategy}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--hb-text-muted)" }}>
                        {entry.model.split("-").slice(0, 2).join("-")}
                      </td>
                      <td>
                        <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(entry.overall_f1) }}>
                          {(entry.overall_f1 * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>${entry.total_cost_usd.toFixed(4)}</td>
                      <td style={{ fontSize: 13 }}>{entry.avg_latency_ms.toFixed(0)}ms</td>
                      <td>{entry.run_count}</td>
                      <td style={{ fontSize: 13, color: "var(--hb-text-muted)" }}>
                        {new Date(entry.last_run_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
