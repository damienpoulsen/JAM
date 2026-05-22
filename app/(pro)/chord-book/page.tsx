"use client";

export default function ChordBookPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ padding: "0 40px" }}>
      <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>PRO FEATURE</span>
        </div>

        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400, color: "#ffffff", marginBottom: 16, letterSpacing: 2, textShadow: "0 0 40px rgba(142,28,255,0.4)" }}>
          Chord Book
        </h1>

        <p style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(185,155,240,0.6)", lineHeight: 1.75, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
          JAM analyzes every song in your library and sorts chord progressions into a searchable book. Hear how different artists use the same 1-4-5 or ii-V-I — clip by clip, song by song.
        </p>

        <div className="flex gap-3 mb-40" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Browse by Progression", desc: "Filter by 1-4-5, ii-V-I, 1-5-6-4 and more" },
            { label: "Audio Clips", desc: "Jump to the exact moment in any song" },
            { label: "Compare & Loop", desc: "A/B different songs on the same changes" },
            { label: "Auto-Tagged", desc: "Analyzed from your existing library" },
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
  );
}
