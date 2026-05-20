"use client";

import Link from "next/link";

export default function MashupPage() {
  return (
    <main className="relative flex h-screen overflow-hidden text-white" style={{ background: "#070610", fontFamily: "'Lora', serif" }}>
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute" style={{ width: 900, height: 500, top: -200, left: -300, background: "radial-gradient(ellipse at 36% 40%, rgba(142,28,255,0.6) 0%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)" }} />
        <div className="absolute" style={{ width: 900, height: 500, bottom: -200, right: -300, background: "radial-gradient(ellipse at 64% 60%, rgba(142,28,255,0.6) 0%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)" }} />
      </div>

      {/* Sidebar */}
      <aside className="hidden min-[900px]:flex flex-col flex-shrink-0 relative z-20" style={{ width: 220, borderRight: "1px solid rgba(125,55,210,0.18)", background: "rgba(5,4,14,0.98)" }}>
        <div style={{ padding: "28px 24px 20px" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontWeight: 400, letterSpacing: 6, color: "#ffffff", textShadow: "0 0 18px rgba(142,28,255,0.7)" }}>JAM</span>
          </Link>
        </div>
        <nav className="flex flex-col" style={{ padding: "0 12px", gap: 2 }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.4)", padding: "6px 12px 4px" }}>NAV</div>
          {[{ label: "Home", href: "/" }, { label: "My Library", href: "/songs" }, { label: "Discover", href: "/library" }].map(({ label, href }) => (
            <Link key={href} href={href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, color: "rgba(185,155,240,0.6)", fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.06em", textDecoration: "none", border: "1px solid transparent" }}>{label}</Link>
          ))}
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.4)", padding: "14px 12px 4px" }}>PRO</div>
          {[{ label: "Chord Book", href: "/chord-book" }, { label: "Mashup Lab", href: "/mashup" }].map(({ label, href }) => {
            const active = href === "/mashup";
            return (
              <Link key={href} href={href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: active ? "rgba(125,55,210,0.22)" : "transparent", color: active ? "rgba(210,175,255,0.95)" : "rgba(185,155,240,0.6)", fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.06em", textDecoration: "none", border: active ? "1px solid rgba(125,55,210,0.35)" : "1px solid transparent" }}>
                {label}
                {!active && <span style={{ marginLeft: "auto", fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.14em", color: "rgba(185,135,255,0.7)", background: "rgba(115,45,210,0.25)", border: "1px solid rgba(140,70,225,0.4)", borderRadius: 4, padding: "1px 5px" }}>PRO</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center" style={{ padding: "0 40px" }}>
        <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>PRO FEATURE</span>
          </div>

          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400, color: "#ffffff", marginBottom: 16, letterSpacing: 2, textShadow: "0 0 40px rgba(142,28,255,0.4)" }}>
            Mashup Lab
          </h1>

          <p style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(185,155,240,0.6)", lineHeight: 1.75, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
            Take the drums from one song and layer the chord progression from another. JAM handles the tempo-matching — you decide if you like it.
          </p>

          {/* Feature tiles */}
          <div className="flex gap-3 mb-40" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "Pick Your Drums", desc: "Stem-split any song in your library" },
              { label: "Pick Your Changes", desc: "Grab the chord progression from another" },
              { label: "Tempo Matching", desc: "JAM aligns the BPMs automatically" },
              { label: "New Sounds", desc: "Replace or layer drum sounds your way" },
            ].map(({ label, desc }) => (
              <div key={label} style={{ width: "calc(50% - 6px)", borderRadius: 12, border: "1px solid rgba(125,55,210,0.25)", background: "rgba(10,6,22,0.8)", padding: "16px 14px", textAlign: "left" }}>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(185,135,255,0.8)", marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(185,155,240,0.5)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.14em", color: "rgba(165,118,248,0.45)" }}>
            COMING WITH PRO — JULY 2026
          </div>
        </div>
      </div>
    </main>
  );
}
