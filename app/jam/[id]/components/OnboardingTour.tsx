"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveFile } from "../../../../lib/db";
import { readSongs, type Song, writeSongs } from "../../../../lib/songs";

interface Props {
  active: boolean;
  onRequestPlay?: () => void;
}

const STEPS = [
  {
    target: "chords",
    title: "The chords change with the song",
    body: "As the song plays, the current chord updates in real time. Follow the harmony without memorizing a chart.",
  },
  {
    target: "fretboard",
    title: "Your live theory guide",
    body: "Every highlighted dot is a note you can play right now. The board reshapes itself with each chord change.",
  },
  {
    target: "layers-btn",
    title: "Switch your theory view",
    body: "This is where you control what appears on the fretboard — scales, chord tones, triads, arpeggios, and more.",
  },
  {
    target: "overlay-rows",
    title: "Stack theory layers",
    body: "Add a second or third layer on top — like chord tones over a pentatonic scale — for deeper context as you play.",
  },
];

function dismiss() {
  try { localStorage.setItem("jam-toured", "true"); } catch {}
}

export default function OnboardingTour({ active, onRequestPlay }: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFinale = step >= STEPS.length;

  const findRect = () => {
    const target = STEPS[step]?.target;
    if (!target) return;
    const els = document.querySelectorAll(`[data-tour="${target}"]`);
    let found: DOMRect | null = null;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { found = r; break; }
    }
    setRect(found);
  };

  useEffect(() => {
    if (!active || done || isFinale) {
      setRect(null);
      return;
    }

    findRect();
    window.addEventListener("resize", findRect);
    window.addEventListener("scroll", findRect, true);
    return () => {
      window.removeEventListener("resize", findRect);
      window.removeEventListener("scroll", findRect, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, step, isFinale]);

  // Step 3: auto-open the layers dropdown (desktop) or mobile settings sheet, then re-find the rect
  useEffect(() => {
    if (!active || done || step !== 3) return;

    const isMobile = window.innerWidth < 900;

    if (isMobile) {
      // On mobile: click the hamburger settings button to open the sheet
      const mobileBtn = document.querySelector<HTMLButtonElement>('[data-tour="layers-btn"]');
      if (mobileBtn) mobileBtn.click();
    } else {
      // On desktop: click the layers button to open the dropdown
      const layersBtn = document.querySelector<HTMLButtonElement>('[data-tour="layers-btn"] button');
      if (layersBtn) layersBtn.click();

      // After dropdown renders, expand Custom Layers
      const t1 = window.setTimeout(() => {
        const expandBtn = document.querySelector<HTMLButtonElement>('[data-tour-action="expand-custom-layers"]');
        if (expandBtn) expandBtn.click();
      }, 150);
      window.setTimeout(() => findRect(), 320);
      return () => window.clearTimeout(t1);
    }

    // Re-find the overlay-rows rect after sheet/dropdown renders
    const t2 = window.setTimeout(() => findRect(), 350);
    return () => window.clearTimeout(t2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, step]);

  // Auto-request play on step 1 so chords are moving
  useEffect(() => {
    if (active && step === 0 && !done) {
      const t = window.setTimeout(() => onRequestPlay?.(), 600);
      return () => window.clearTimeout(t);
    }
  }, [active, done, step, onRequestPlay]);

  if (!active || done) return null;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setStep(STEPS.length); // finale
    }
  };

  const handleSkip = () => {
    dismiss();
    setDone(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dismiss();
    setUploadLoading(true);
    const id = crypto.randomUUID();
    const cleanName = file.name.replace(/\.mp3$/i, "").replace(/_/g, " ").trim();
    const song: Song = { id, fileId: id, name: cleanName, key: "Unknown", bpm: "--", analysisStatus: "pending" };
    writeSongs([song, ...readSongs()]);
    try { await saveFile(id, file); } catch {}
    window.location.href = `/jam/${id}/prepare`;
  };

  const cardStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    background: "rgba(10,8,15,0.97)",
    border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 18,
    backdropFilter: "blur(16px)",
    padding: "20px 22px",
    color: "white",
    fontFamily: "'Lora', serif",
    boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
  };

  // Card is anchored to bottom on mobile; near element on desktop
  const cardPosition: React.CSSProperties = (() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    if (isMobile || isFinale) {
      return { bottom: 20, left: 14, right: 14 };
    }
    // Desktop: position below highlight if there's space, else above
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow > 200) {
        return { top: rect.bottom + 16, left: Math.max(16, rect.left), maxWidth: 360 };
      }
      return { bottom: window.innerHeight - rect.top + 16, left: Math.max(16, rect.left), maxWidth: 360 };
    }
    return { bottom: 20, right: 20, maxWidth: 360 };
  })();

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');`}</style>

      {/* Dark overlay (spotlight effect comes from highlight ring's box-shadow) */}
      {!isFinale && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9996,
            pointerEvents: "none",
            background: "rgba(0,0,0,0.01)",
          }}
        />
      )}

      {/* Finale: full centered backdrop */}
      {isFinale && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9996,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
          }}
          onClick={handleSkip}
        />
      )}

      {/* Spotlight highlight ring */}
      {!isFinale && rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 9997,
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.8)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px rgba(255,255,255,0.15)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Card */}
      {!isFinale && (
        <div style={{ ...cardStyle, ...cardPosition }}>
          {/* Top row: step dots + skip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === step ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    background: i === step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)",
                    transition: "all 0.2s",
                  }}
                />
              ))}
              <span
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 10,
                  color: "rgba(190,160,230,0.5)",
                  letterSpacing: "0.12em",
                  marginLeft: 4,
                }}
              >
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              style={{
                background: "none",
                border: "none",
                color: "rgba(190,160,230,0.45)",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                letterSpacing: "0.1em",
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              SKIP
            </button>
          </div>

          {/* Title */}
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 7, lineHeight: 1.3, color: "rgba(255,255,255,0.95)" }}>
            {STEPS[step].title}
          </div>

          {/* Body */}
          <div style={{ fontSize: 14, fontStyle: "italic", color: "rgba(190,160,230,0.75)", lineHeight: 1.55, marginBottom: 18 }}>
            {STEPS[step].body}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={handleNext}
            style={{
              display: "block",
              width: "100%",
              padding: "11px 0",
              borderRadius: 10,
              border: "1.5px solid rgba(255,255,255,0.65)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontFamily: "'Courier Prime', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.12em",
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.65)";
            }}
          >
            {step < STEPS.length - 1 ? "NEXT →" : "SEE WHAT'S NEXT →"}
          </button>
        </div>
      )}

      {/* Finale card — centered */}
      {isFinale && (
        <div
          style={{
            ...cardStyle,
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(92vw, 380px)",
            zIndex: 9999,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 10,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.01em",
            }}
          >
            You&apos;re all set.
          </div>
          <div
            style={{
              fontSize: 14,
              fontStyle: "italic",
              color: "rgba(190,160,230,0.72)",
              lineHeight: 1.6,
              marginBottom: 26,
            }}
          >
            That&apos;s the core of JAM — live chords, live theory, your music.
            Upload your own track or explore more songs.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Upload a track */}
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3"
                style={{ display: "none" }}
                onChange={handleUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 0",
                  borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.75)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.11em",
                  cursor: "pointer",
                }}
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" />
                </svg>
                {uploadLoading ? "LOADING..." : "UPLOAD YOUR TRACK"}
              </button>
            </>

            {/* Demo songs */}
            <Link
              href="/demo"
              onClick={dismiss}
              style={{
                display: "block",
                padding: "12px 0",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "rgba(190,160,230,0.8)",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.11em",
                textDecoration: "none",
              }}
            >
              BROWSE DEMO SONGS
            </Link>

            {/* Keep playing */}
            <button
              type="button"
              onClick={handleSkip}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 11,
                letterSpacing: "0.1em",
                cursor: "pointer",
                padding: "6px 0",
              }}
            >
              Keep playing →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
