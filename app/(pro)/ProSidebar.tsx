"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Home", href: "/" },
  { label: "My Library", href: "/songs" },
  { label: "Discover", href: "/library" },
];

const PRO_NAV = [
  { label: "Chord Book", href: "/chord-book" },
  { label: "Mashup Lab", href: "/mashup" },
];

export default function ProSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden min-[900px]:flex flex-col flex-shrink-0 relative z-20"
      style={{ width: 220, borderRight: "1px solid rgba(125,55,210,0.18)", background: "rgba(5,4,14,0.98)" }}
    >
      <div style={{ padding: "28px 24px 20px" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontWeight: 400, letterSpacing: 6, color: "#ffffff", textShadow: "0 0 18px rgba(142,28,255,0.7)" }}>
            JAM
          </span>
        </Link>
      </div>

      <nav className="flex flex-col" style={{ padding: "0 12px", gap: 2 }}>
        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.4)", padding: "6px 12px 4px" }}>
          NAV
        </div>
        {NAV.map(({ label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: active ? "rgba(125,55,210,0.22)" : "transparent",
                color: active ? "rgba(210,175,255,0.95)" : "rgba(185,155,240,0.6)",
                fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.06em",
                textDecoration: "none",
                border: active ? "1px solid rgba(125,55,210,0.35)" : "1px solid transparent",
              }}
            >
              {label}
            </Link>
          );
        })}

        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.4)", padding: "14px 12px 4px" }}>
          PRO
        </div>
        {PRO_NAV.map(({ label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: active ? "rgba(125,55,210,0.22)" : "transparent",
                color: active ? "rgba(210,175,255,0.95)" : "rgba(185,155,240,0.6)",
                fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.06em",
                textDecoration: "none",
                border: active ? "1px solid rgba(125,55,210,0.35)" : "1px solid transparent",
              }}
            >
              {label}
              {!active && (
                <span style={{ marginLeft: "auto", fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.14em", color: "rgba(185,135,255,0.7)", background: "rgba(115,45,210,0.25)", border: "1px solid rgba(140,70,225,0.4)", borderRadius: 4, padding: "1px 5px" }}>
                  PRO
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
