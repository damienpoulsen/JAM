"use client";

import Link from "next/link";
import { use } from "react";

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ padding: "0 40px" }}>
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 400, color: "#ffffff", marginBottom: 16, letterSpacing: 2, textShadow: "0 0 40px rgba(142,28,255,0.4)" }}>
          Studio Mode
        </h1>

        <p style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(185,155,240,0.6)", lineHeight: 1.7, marginBottom: 12 }}>
          6-stem splitting, multi-track looping, and a full DAW-style layout — all in your browser.
        </p>
        <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.14em", color: "rgba(165,118,248,0.45)", marginBottom: 40 }}>
          COMING WITH PRO — JULY 2026
        </p>

        <div className="flex gap-3 w-full mb-12" style={{ justifyContent: "center" }}>
          {[
            { label: "6 Stems", desc: "Drums, bass, vocals, guitar, piano, other" },
            { label: "Pro Loops", desc: "Bar-accurate multi-track looping" },
            { label: "DAW Layout", desc: "FL Studio-style session view" },
          ].map(({ label, desc }) => (
            <div key={label} style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(125,55,210,0.25)", background: "rgba(10,6,22,0.8)", padding: "14px 12px" }}>
              <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(185,135,255,0.7)", marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 11, color: "rgba(185,155,240,0.45)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>

        <Link
          href={`/jam/${id}`}
          style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.12em", color: "rgba(185,155,240,0.55)", textDecoration: "none", borderBottom: "1px solid rgba(125,55,210,0.3)", paddingBottom: 2 }}
        >
          ← Back to JAM Mode
        </Link>
      </div>
    </div>
  );
}
