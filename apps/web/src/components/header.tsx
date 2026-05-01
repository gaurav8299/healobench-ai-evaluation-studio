"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/runs", label: "Runs", icon: "🚀" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/compare", label: "Compare", icon: "⚡" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/cases", label: "Cases", icon: "📋" },
] as const;

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--hb-border)",
        background: "rgba(10, 10, 26, 0.85)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 24 }}>🏥</span>
          <span
            className="gradient-text"
            style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            HealoBench
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              background: "rgba(99, 102, 241, 0.2)",
              color: "#818cf8",
              borderRadius: 4,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Studio
          </span>
        </Link>

        {/* Nav Links */}
        <nav style={{ display: "flex", gap: 4 }}>
          {NAV_LINKS.map(({ href, label, icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActive ? "active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span className="hide-mobile">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="animate-pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--hb-text-muted)",
              fontWeight: 500,
            }}
          >
            Mock Mode
          </span>
        </div>
      </div>
    </header>
  );
}
