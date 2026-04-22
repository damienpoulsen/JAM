"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { getFile } from "../../../../lib/db";
import {
  CURRENT_ANALYSIS_VERSION,
  readStoredSongAnalysis,
  saveSongAnalysis,
  type SongAnalysis,
} from "../../../../lib/analysis";
import { readSongs, type Song, writeSongs } from "../../../../lib/songs";

const PUBLIC_ANALYSIS_API_URL = process.env.NEXT_PUBLIC_ANALYSIS_API_URL?.replace(/\/$/, "") ?? "";

function updateStoredSong(songId: string, patch: Partial<Song>) {
  const songs = readSongs();
  const songIndex = songs.findIndex((song) => song.id === songId);
  if (songIndex === -1) return null;
  const nextSong = { ...songs[songIndex], ...patch };
  const updatedSongs = songs.map((song, index) => (index === songIndex ? nextSong : song));
  writeSongs(updatedSongs);
  return nextSong;
}

type Phase = "checking" | "choose" | "analyzing";
type StemMode = "hpss" | "demucs";

export default function PrepareJamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hasAnalyzedRef = useRef(false);
  const [songName, setSongName] = useState("Preparing track");
  const [errorMessage, setErrorMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("checking");
  const [stemMode, setStemMode] = useState<StemMode>("demucs");

  // Phase 1: check cache / song existence — runs once on mount
  useEffect(() => {
    const song = readSongs().find((entry) => entry.id === id);

    if (!song) {
      setErrorMessage("This track could not be found.");
      setPhase("analyzing"); // skip to analyzing phase to show error
      return;
    }

    setSongName(song.name || "Preparing track");

    if (song.analysisStatus === "ready") {
      router.replace(`/jam/${id}`);
      return;
    }

    const storedAnalysis = readStoredSongAnalysis(id);
    const hasFreshStoredAnalysis =
      Boolean(storedAnalysis) &&
      storedAnalysis!.version >= CURRENT_ANALYSIS_VERSION &&
      storedAnalysis!.beatStartTime !== null &&
      (storedAnalysis!.chordEvents.length > 0 ||
        storedAnalysis!.bpm !== null ||
        storedAnalysis!.detectedKey !== null);

    if (hasFreshStoredAnalysis && storedAnalysis) {
      updateStoredSong(id, {
        key: song.key === "Unknown" && storedAnalysis.detectedKey ? storedAnalysis.detectedKey : song.key,
        bpm: typeof storedAnalysis.bpm === "number" && Number.isFinite(storedAnalysis.bpm)
          ? Number(storedAnalysis.bpm.toFixed(1))
          : song.bpm,
        analysisStatus: "ready",
      });
      router.replace(`/jam/${id}`);
      return;
    }

    // No cache — show the quality-choice screen
    setPhase("choose");
  }, [id, router]);

  // Phase 2: run analysis once the user has chosen a mode
  useEffect(() => {
    if (phase !== "analyzing" || hasAnalyzedRef.current) return;
    hasAnalyzedRef.current = true;

    const runAnalysis = async () => {
      const song = readSongs().find((entry) => entry.id === id);
      if (!song) { setErrorMessage("This track could not be found."); return; }

      updateStoredSong(id, { analysisStatus: "loading" });

      try {
        const file = await getFile(song.fileId);
        if (!file) throw new Error("Audio file is unavailable for this track.");

        const formData = new FormData();
        formData.append("songId", id);
        formData.append("file", file);
        formData.append("detectChords", "true");
        formData.append("skipBpm", "false");
        formData.append("stemMode", stemMode);

        const analysisEndpoint = PUBLIC_ANALYSIS_API_URL
          ? `${PUBLIC_ANALYSIS_API_URL}/analyze`
          : "/api/analyze-song";

        const response = await fetch(analysisEndpoint, { method: "POST", body: formData });

        if (!response.ok) {
          if (response.status === 503 || response.status === 429) throw new Error("The server is busy right now. Wait a moment and try again.");
          if (response.status >= 500) throw new Error("Analysis is unavailable right now. Try again in a moment.");
          const errPayload = await response.json().catch(() => ({})) as { detail?: string; error?: string };
          throw new Error(errPayload.detail || errPayload.error || "Song analysis failed.");
        }

        const detectedAnalysis = (await response.json()) as SongAnalysis;
        saveSongAnalysis(detectedAnalysis);

        updateStoredSong(id, {
          key: song.key === "Unknown" && detectedAnalysis.detectedKey ? detectedAnalysis.detectedKey : song.key,
          bpm: typeof detectedAnalysis.bpm === "number" && Number.isFinite(detectedAnalysis.bpm)
            ? Number(detectedAnalysis.bpm.toFixed(1))
            : song.bpm,
          analysisStatus: "ready",
        });

        router.replace(`/jam/${id}`);
      } catch (error) {
        updateStoredSong(id, { analysisStatus: "error" });
        setErrorMessage(error instanceof Error ? error.message : "Failed to load this track.");
      }
    };

    void runAnalysis();
  }, [id, router, phase, stemMode]);

  const startAnalysis = (mode: StemMode) => {
    setStemMode(mode);
    setPhase("analyzing");
  };

  const handleRetry = () => {
    setErrorMessage("");
    hasAnalyzedRef.current = false;
    updateStoredSong(id, { analysisStatus: "pending" });
    setPhase("choose");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .bar-pulse {
          animation: bar-pulse 1.8s ease-in-out infinite;
        }
        @keyframes bar-pulse {
          0%,100% { opacity: 1; width: 40%; }
          50%      { opacity: 0.6; width: 70%; }
        }

        .mode-card {
          transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s, background 0.18s;
          cursor: pointer;
        }
        .mode-card:hover {
          transform: translateY(-3px);
        }
      `}</style>

      <main
        className="relative flex h-screen overflow-hidden px-6 py-4 text-white"
        style={{ fontFamily: "'Lora', serif", background: "#0a080f" }}
      >
        {/* ── Atmospheric background ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="orb-1 absolute rounded-full" style={{ width: 1000, height: 1000, top: -400, left: -350, background: "radial-gradient(circle, rgba(120,60,200,0.28) 0%, rgba(90,30,160,0.10) 45%, transparent 70%)", filter: "blur(90px)" }} />
          <div className="orb-2 absolute rounded-full" style={{ width: 700, height: 700, bottom: -200, right: -180, background: "radial-gradient(circle, rgba(100,50,180,0.18) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(8,5,2,0.5) 75%, rgba(5,3,1,0.82) 100%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", opacity: 0.18, mixBlendMode: "overlay" }} />
        </div>

        {/* ── Content ── */}
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center">

          {phase === "choose" ? (
            /* ── Quality choice screen ── */
            <div className="w-full max-w-2xl px-4 text-center">
              {/* Logo */}
              <div className="relative mx-auto mb-5 flex justify-center">
                <svg viewBox="0 0 540 300" xmlns="http://www.w3.org/2000/svg" className="relative h-auto w-[180px]" aria-label="JAM">
                  <defs>
                    <filter id="p-jam-glow" x="-20%" y="-30%" width="140%" height="160%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="rgba(255,255,255,0.12)" textAnchor="middle" letterSpacing={16} filter="url(#p-jam-glow)">JAM</text>
                  <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
                </svg>
              </div>

              <div className="mb-1 text-xs uppercase" style={{ letterSpacing: "0.3em", color: "rgba(120,60,200,0.75)", fontFamily: "'Playfair Display', serif" }}>
                Chord Detection Quality
              </div>
              <h1 className="mb-1 text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: "#f5ede0", letterSpacing: "0.02em" }}>
                {songName}
              </h1>
              <p className="mb-8 text-sm" style={{ color: "rgba(190,160,230,0.45)", fontStyle: "italic" }}>
                How thoroughly should JAM isolate harmonics before detecting chords?
              </p>

              {/* Mode cards */}
              <div className="flex gap-4">
                {/* Fast — HPSS */}
                <button
                  type="button"
                  onClick={() => startAnalysis("hpss")}
                  className="mode-card flex-1 rounded-xl px-6 py-7 text-left"
                  style={{
                    background: "rgba(120,60,200,0.08)",
                    border: "1px solid rgba(120,60,200,0.35)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(120,60,200,0.75)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.45), 0 0 28px rgba(120,60,200,0.2)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(120,60,200,0.14)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(120,60,200,0.35)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(120,60,200,0.08)";
                  }}
                >
                  <div className="mb-3 text-2xl">⚡</div>
                  <div className="mb-1 text-lg font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: "#f5ede0" }}>
                    Fast
                  </div>
                  <div className="mb-4 text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(120,60,200,0.8)", fontFamily: "'Courier Prime', monospace" }}>
                    ~30 seconds
                  </div>
                  <ul className="space-y-1.5 text-sm text-left" style={{ color: "rgba(190,160,230,0.6)" }}>
                    <li>Removes drum transients</li>
                    <li>Vocals remain in signal</li>
                    <li>Good for instrumental tracks</li>
                  </ul>
                </button>

                {/* Accurate — Demucs */}
                <button
                  type="button"
                  onClick={() => startAnalysis("demucs")}
                  className="mode-card flex-1 rounded-xl px-6 py-7 text-left"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.28)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.65)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.5), 0 0 35px rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.28)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                >
                  <div className="mb-3 text-2xl">✦</div>
                  <div className="mb-1 text-lg font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: "#f5ede0" }}>
                    Accurate
                  </div>
                  <div className="mb-0.5 text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(220,200,160,0.75)", fontFamily: "'Courier Prime', monospace" }}>
                    ~2–4 minutes
                  </div>
                  <div className="mb-4 text-xs" style={{ color: "rgba(190,160,230,0.35)", fontFamily: "'Courier Prime', monospace" }}>
                    first run downloads ~320 MB model
                  </div>
                  <ul className="space-y-1.5 text-sm text-left" style={{ color: "rgba(190,160,230,0.6)" }}>
                    <li>Removes drums <span style={{ color: "rgba(190,160,230,0.35)" }}>&amp;</span> vocals</li>
                    <li>Isolates bass + instruments</li>
                    <li>Best for vocal-heavy tracks</li>
                  </ul>
                </button>
              </div>
            </div>

          ) : (
            /* ── Loading / error screen ── */
            <div
              className="w-full max-w-xl px-8 py-10 text-center"
              style={{
                borderTop: "1px solid rgba(220,170,110,0.2)",
                borderBottom: "1px solid rgba(220,170,110,0.2)",
              }}
            >
              {/* Logo */}
              <div className="relative mx-auto mb-6 flex justify-center">
                <svg viewBox="0 0 540 300" xmlns="http://www.w3.org/2000/svg" className="relative h-auto w-[220px]" aria-label="JAM">
                  <defs>
                    <filter id="p-jam-glow2" x="-20%" y="-30%" width="140%" height="160%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="rgba(255,255,255,0.12)" textAnchor="middle" letterSpacing={16} filter="url(#p-jam-glow2)">JAM</text>
                  <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
                </svg>
              </div>

              <div className="mb-3 text-xs uppercase" style={{ letterSpacing: "0.3em", color: "rgba(120,60,200,0.75)", fontFamily: "'Playfair Display', serif" }}>
                {errorMessage ? "Error" : "Loading"}
              </div>

              <h1 className="mb-3 text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: "#f5ede0", letterSpacing: "0.02em", fontWeight: 600 }}>
                {songName}
              </h1>

              {errorMessage ? (
                <>
                  <p className="mx-auto mb-6 max-w-md text-sm" style={{ color: "rgba(190,160,230,0.55)" }}>
                    {errorMessage}
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex rounded-lg px-5 py-3 text-sm font-medium text-white transition"
                      style={{ background: "rgba(120,60,200,0.22)", border: "1px solid rgba(120,60,200,0.5)", cursor: "pointer", fontFamily: "'Lora', serif" }}
                    >
                      Try Again
                    </button>
                    <Link
                      href={`/jam/${id}`}
                      className="inline-flex rounded-lg px-5 py-3 text-sm font-medium transition"
                      style={{ background: "rgba(120,60,200,0.08)", border: "1px solid rgba(120,60,200,0.25)", color: "rgba(190,160,230,0.65)", fontFamily: "'Lora', serif" }}
                    >
                      Open Jam Anyway
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mx-auto mb-3 max-w-md text-sm" style={{ color: "rgba(190,160,230,0.45)" }}>
                    {stemMode === "demucs"
                      ? "Separating stems and building chord data. This takes a few minutes — worth the wait."
                      : "Building BPM and chord data for your first session."}
                  </p>
                  <p className="mx-auto mb-8 text-xs" style={{ color: "rgba(190,160,230,0.28)", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.08em" }}>
                    {stemMode === "demucs" ? "MODE: ACCURATE (Demucs)" : "MODE: FAST (HPSS)"}
                  </p>

                  <div className="mx-auto flex w-full max-w-[280px] items-center gap-3">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="bar-pulse h-full rounded-full" style={{ background: "rgba(120,60,200,0.9)" }} />
                    </div>
                    <span className="text-xs" style={{ color: "rgba(190,160,230,0.45)" }}>Analyzing…</span>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
