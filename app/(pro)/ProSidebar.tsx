"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    label: "Home", href: "/",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    label: "My Library", href: "/songs",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  {
    label: "Discover", href: "/library",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  },
];

const PRO_NAV = [
  {
    label: "Chord Book", href: "/chord-book",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  },
  {
    label: "Mashup Lab", href: "/mashup",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/><path d="m15 18 6-6-6-6"/></svg>,
  },
];

const BOTTOM_NAV = [
  {
    label: "Settings", href: "/settings",
    icon: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

function NavLink({ label, href, icon, active, showProBadge }: { label: string; href: string; icon: React.ReactNode; active: boolean; showProBadge?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 10px", borderRadius: 7,
        background: active ? "rgba(125,55,210,0.22)" : "transparent",
        color: active ? "rgba(215,185,255,0.95)" : "rgba(185,155,240,0.55)",
        fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.06em",
        textDecoration: "none",
        border: active ? "1px solid rgba(125,55,210,0.35)" : "1px solid transparent",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>{icon}</span>
      {label}
      {showProBadge && !active && (
        <span style={{ marginLeft: "auto", fontFamily: "'Courier Prime', monospace", fontSize: 7, letterSpacing: "0.14em", color: "rgba(185,135,255,0.8)", background: "rgba(115,45,210,0.28)", border: "1px solid rgba(140,70,225,0.4)", borderRadius: 3, padding: "1px 5px" }}>
          PRO
        </span>
      )}
    </Link>
  );
}

export default function ProSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden min-[900px]:flex flex-col flex-shrink-0"
      style={{ width: 200, borderRight: "1px solid rgba(125,55,210,0.15)", background: "rgba(5,4,14,0.97)", zIndex: 20 }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 18px 16px" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, letterSpacing: 5, color: "#ffffff", textShadow: "0 0 18px rgba(142,28,255,0.6)" }}>
            JAM
          </span>
        </Link>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(125,55,210,0.12)", margin: "0 16px 10px" }} />

      {/* Nav */}
      <nav className="flex flex-col" style={{ padding: "0 8px", gap: 1, flex: 1 }}>
        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(165,118,248,0.35)", padding: "8px 10px 4px" }}>
          JAM
        </div>
        {NAV.map(({ label, href, icon }) => (
          <NavLink key={href} label={label} href={href} icon={icon} active={pathname === href} />
        ))}

        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(165,118,248,0.35)", padding: "14px 10px 4px" }}>
          PRO FEATURES
        </div>
        {PRO_NAV.map(({ label, href, icon }) => (
          <NavLink key={href} label={label} href={href} icon={icon} active={pathname === href} showProBadge />
        ))}
      </nav>

      {/* Bottom — account + settings */}
      <div style={{ padding: "0 8px 20px", borderTop: "1px solid rgba(125,55,210,0.12)", paddingTop: 12 }}>
        {BOTTOM_NAV.map(({ label, href, icon }) => (
          <NavLink key={href} label={label} href={href} icon={icon} active={pathname === href} />
        ))}

        {/* Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 10px 0", marginTop: 4, cursor: "pointer" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, rgba(142,28,255,0.7), rgba(88,15,200,0.9))", border: "1px solid rgba(140,70,225,0.5)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(215,185,255,0.9)" }}>
            D
          </div>
          <div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(215,185,255,0.8)", letterSpacing: "0.04em", lineHeight: 1.2 }}>Damie</div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, color: "rgba(165,118,248,0.45)", letterSpacing: "0.1em" }}>PRO</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
