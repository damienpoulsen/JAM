"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readSongs, type Song } from "../../lib/songs";

const NAV = [
  {
    label: "Home", href: "/",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    label: "My Library", href: "/songs",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  {
    label: "Discover", href: "/library",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  },
];

const MODES = [
  {
    label: "JAM Mode", href: "/songs",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    pro: false,
  },
  {
    label: "Studio Mode", href: "/songs",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    pro: true,
  },
  {
    label: "Chord Book", href: "/chord-book",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    pro: true,
  },
  {
    label: "Mashup Lab", href: "/mashup",
    icon: <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/><path d="m15 18 6-6-6-6"/></svg>,
    pro: true,
  },
];

function NavLink({ label, href, icon, active, pro }: { label: string; href: string; icon: React.ReactNode; active: boolean; pro?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8,
        background: active ? "rgba(125,55,210,0.25)" : "transparent",
        color: active ? "rgba(220,190,255,0.95)" : "rgba(200,175,255,0.75)",
        fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.05em",
        textDecoration: "none",
        border: active ? "1px solid rgba(125,55,210,0.4)" : "1px solid transparent",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {pro && !active && (
        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 7, letterSpacing: "0.14em", color: "rgba(185,135,255,0.85)", background: "rgba(115,45,210,0.3)", border: "1px solid rgba(140,70,225,0.45)", borderRadius: 3, padding: "2px 5px", flexShrink: 0 }}>
          PRO
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(185,145,255,0.65)", padding: "14px 12px 6px", fontWeight: 700 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(125,55,210,0.15)", margin: "6px 12px" }} />;
}

export default function ProSidebar() {
  const pathname = usePathname();
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);

  useEffect(() => {
    const songs = readSongs().filter((s) => s.analysisStatus === "ready").slice(0, 3);
    setRecentSongs(songs);
  }, []);

  return (
    <aside
      className="hidden min-[900px]:flex flex-col flex-shrink-0"
      style={{ width: 210, borderRight: "1px solid rgba(125,55,210,0.15)", background: "rgba(5,4,14,0.97)", zIndex: 20 }}
    >
      {/* Logo + settings */}
      <div style={{ padding: "20px 14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, fontWeight: 400, letterSpacing: 5, color: "#ffffff", textShadow: "0 0 18px rgba(142,28,255,0.6)" }}>
            JAM
          </span>
        </Link>
        <Link
          href="/settings"
          title="Settings"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "rgba(125,55,210,0.12)", border: "1px solid rgba(125,55,210,0.2)", color: "rgba(185,145,255,0.6)", textDecoration: "none", transition: "background 0.15s, color 0.15s" }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Link>
      </div>

      {/* New Session button */}
      <div style={{ padding: "0 10px 10px" }}>
        <Link
          href="/"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px", borderRadius: 9, textDecoration: "none",
            background: "rgba(125,55,210,0.3)", border: "1px solid rgba(155,80,255,0.45)",
            color: "rgba(225,200,255,0.9)", fontFamily: "'Courier Prime', monospace",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
            transition: "background 0.15s",
          }}
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14m-7-7h14"/></svg>
          New Session
        </Link>
      </div>

      <Divider />

      {/* Nav */}
      <nav className="flex flex-col" style={{ padding: "0 8px", flex: 1, overflowY: "auto" }}>
        <SectionLabel>NAVIGATE</SectionLabel>
        {NAV.map(({ label, href, icon }) => (
          <NavLink key={href} label={label} href={href} icon={icon} active={pathname === href} />
        ))}

        <SectionLabel>MODES</SectionLabel>
        {MODES.map(({ label, href, icon, pro }) => (
          <NavLink key={label} label={label} href={href} icon={icon} active={pathname === href && label !== "JAM Mode" && label !== "Studio Mode"} pro={pro} />
        ))}

        {/* Recent Sessions */}
        {recentSongs.length > 0 && (
          <>
            <SectionLabel>RECENT</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 4px" }}>
              {recentSongs.map((song) => (
                <Link
                  key={song.id}
                  href={`/jam/${song.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                    borderRadius: 8, textDecoration: "none", border: "1px solid transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(115,45,210,0.25)", border: "1px solid rgba(125,55,210,0.3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width={11} height={11} fill="rgba(185,145,255,0.7)"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 11, color: "rgba(200,175,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                      {song.name}
                    </div>
                    {song.key && song.key !== "Unknown" && (
                      <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(165,118,248,0.45)", letterSpacing: "0.08em" }}>
                        {song.key} {typeof song.bpm === "number" ? `· ${Math.round(song.bpm)} BPM` : ""}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>

      <Divider />

      {/* Upgrade CTA */}
      <div style={{ padding: "10px 10px 6px" }}>
        <button style={{
          width: "100%", padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
          background: "linear-gradient(135deg, rgba(115,45,210,0.45), rgba(160,60,255,0.3))",
          border: "1px solid rgba(155,80,255,0.5)",
          boxShadow: "0 0 20px rgba(130,50,240,0.2)",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(220,190,255,0.95)" }}>
            Upgrade to Pro
          </div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 11, color: "rgba(185,155,240,0.6)", fontStyle: "italic" }}>
            Studio, Chord Book & more
          </div>
        </button>
      </div>

      {/* Profile */}
      <div style={{ padding: "8px 12px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, rgba(160,60,255,0.85), rgba(88,15,200,0.95))", border: "1.5px solid rgba(160,80,255,0.5)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display', serif", fontSize: 14, color: "white" }}>
          D
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 13, color: "rgba(220,200,255,0.9)", lineHeight: 1.2 }}>Damie</div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(165,118,248,0.5)", letterSpacing: "0.12em", marginTop: 1 }}>PRO MEMBER</div>
        </div>
      </div>
    </aside>
  );
}
