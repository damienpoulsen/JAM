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

  if (songIndex === -1) {
    return null;
  }

  const nextSong = {
    ...songs[songIndex],
    ...patch,
  };
  const updatedSongs = songs.map((song, index) => (index === songIndex ? nextSong : song));

  writeSongs(updatedSongs);
  return nextSong;
}

export default function PrepareJamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [songName, setSongName] = useState("Preparing track");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const runAnalysis = async () => {
      const song = readSongs().find((entry) => entry.id === id);

      if (!song) {
        setErrorMessage("This track could not be found.");
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
          key:
            song.key === "Unknown" && storedAnalysis.detectedKey
              ? storedAnalysis.detectedKey
              : song.key,
          bpm:
            typeof storedAnalysis.bpm === "number" && Number.isFinite(storedAnalysis.bpm)
              ? Number(storedAnalysis.bpm.toFixed(1))
              : song.bpm,
          analysisStatus: "ready",
        });
        router.replace(`/jam/${id}`);
        return;
      }

      updateStoredSong(id, { analysisStatus: "loading" });

      try {
        const file = await getFile(song.fileId);
        if (!file) {
          throw new Error("Audio file is unavailable for this track.");
        }

        const formData = new FormData();
        formData.append("songId", id);
        formData.append("file", file);
        formData.append("detectChords", "true");
        formData.append("skipBpm", "false");

        const analysisEndpoint = PUBLIC_ANALYSIS_API_URL
          ? `${PUBLIC_ANALYSIS_API_URL}/analyze`
          : "/api/analyze-song";

        const response = await fetch(analysisEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 503 || response.status === 429) {
            throw new Error("The server is busy right now. Wait a moment and try again.");
          }

          if (response.status >= 500) {
            throw new Error("Analysis is unavailable right now. Try again in a moment.");
          }

          let errorMessage = "Song analysis failed.";

          try {
            const errorPayload = (await response.json()) as { detail?: string; error?: string };
            errorMessage = errorPayload.detail || errorPayload.error || errorMessage;
          } catch {
            // keep fallback message
          }

          throw new Error(errorMessage);
        }

        const detectedAnalysis = (await response.json()) as SongAnalysis;
        saveSongAnalysis(detectedAnalysis);

        updateStoredSong(id, {
          key:
            song.key === "Unknown" && detectedAnalysis.detectedKey
              ? detectedAnalysis.detectedKey
              : song.key,
          bpm:
            typeof detectedAnalysis.bpm === "number" && Number.isFinite(detectedAnalysis.bpm)
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
  }, [id, router]);

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
      `}</style>

      <main
        className="relative flex h-screen overflow-hidden px-6 py-4 text-white"
        style={{ fontFamily: "'Lora', serif", background: "#0f0c08" }}
      >

        {/* ── Atmospheric background ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="orb-1 absolute rounded-full" style={{ width: 1000, height: 1000, top: -400, left: -350, background: "radial-gradient(circle, rgba(196,94,50,0.32) 0%, rgba(160,60,20,0.12) 45%, transparent 70%)", filter: "blur(90px)" }} />
          <div className="orb-2 absolute rounded-full" style={{ width: 700, height: 700, bottom: -200, right: -180, background: "radial-gradient(circle, rgba(184,120,40,0.22) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(8,5,2,0.55) 75%, rgba(5,3,1,0.85) 100%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", opacity: 0.18, mixBlendMode: "overlay" }} />
        </div>

        {/* ── Content ── */}
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center">
          <div
            className="w-full max-w-xl px-8 py-10 text-center"
            style={{
              borderTop: "1px solid rgba(220,170,110,0.2)",
              borderBottom: "1px solid rgba(220,170,110,0.2)",
            }}
          >
            {/* Logo */}
            <div className="relative mx-auto mb-6 flex justify-center">
              <svg
                viewBox="0 0 540 300"
                xmlns="http://www.w3.org/2000/svg"
                className="relative h-auto w-[220px]"
                aria-label="JAM"
              >
                <defs>
                  <filter id="p-jam-glow" x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="rgba(255,255,255,0.12)" textAnchor="middle" letterSpacing={16} filter="url(#p-jam-glow)">JAM</text>
                <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
              </svg>
            </div>

            <div
              className="mb-3 text-xs uppercase"
              style={{ letterSpacing: "0.3em", color: "rgba(196,94,50,0.75)", fontFamily: "'Playfair Display', serif" }}
            >
              Loading
            </div>

            <h1
              className="mb-3 text-2xl font-semibold"
              style={{ fontFamily: "'Playfair Display', serif", color: "#f5ede0", letterSpacing: "0.02em", fontWeight: 600 }}
            >
              {songName}
            </h1>

            {errorMessage ? (
              <>
                <p className="mx-auto mb-6 max-w-md text-sm" style={{ color: "rgba(220,180,140,0.55)" }}>
                  {errorMessage}
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      hasStartedRef.current = false;
                      updateStoredSong(id, { analysisStatus: "pending" });
                      void (async () => {
                        hasStartedRef.current = true;
                        const song = readSongs().find((entry) => entry.id === id);
                        if (!song) { setErrorMessage("This track could not be found."); return; }
                        updateStoredSong(id, { analysisStatus: "loading" });
                        try {
                          const file = await getFile(song.fileId);
                          if (!file) throw new Error("Audio file is unavailable for this track.");
                          const fd = new FormData();
                          fd.append("songId", id);
                          fd.append("file", file);
                          fd.append("detectChords", "true");
                          fd.append("skipBpm", "false");
                          const endpoint = PUBLIC_ANALYSIS_API_URL ? `${PUBLIC_ANALYSIS_API_URL}/analyze` : "/api/analyze-song";
                          const res = await fetch(endpoint, { method: "POST", body: fd });
                          if (!res.ok) {
                            if (res.status === 503 || res.status === 429) throw new Error("The server is busy right now. Wait a moment and try again.");
                            if (res.status >= 500) throw new Error("Analysis is unavailable right now. Try again in a moment.");
                            const errPayload = await res.json().catch(() => ({})) as { detail?: string; error?: string };
                            throw new Error(errPayload.detail || errPayload.error || "Song analysis failed.");
                          }
                          const detectedAnalysis = (await res.json()) as SongAnalysis;
                          saveSongAnalysis(detectedAnalysis);
                          updateStoredSong(id, {
                            key: song.key === "Unknown" && detectedAnalysis.detectedKey ? detectedAnalysis.detectedKey : song.key,
                            bpm: typeof detectedAnalysis.bpm === "number" && Number.isFinite(detectedAnalysis.bpm) ? Number(detectedAnalysis.bpm.toFixed(1)) : song.bpm,
                            analysisStatus: "ready",
                          });
                          router.replace(`/jam/${id}`);
                        } catch (err) {
                          updateStoredSong(id, { analysisStatus: "error" });
                          setErrorMessage(err instanceof Error ? err.message : "Failed to load this track.");
                        }
                      })();
                    }}
                    className="inline-flex rounded-lg px-5 py-3 text-sm font-medium text-white transition"
                    style={{
                      background: "rgba(196,94,50,0.22)",
                      border: "1px solid rgba(196,94,50,0.5)",
                      cursor: "pointer",
                      fontFamily: "'Lora', serif",
                    }}
                  >
                    Try Again
                  </button>
                  <Link
                    href={`/jam/${id}`}
                    className="inline-flex rounded-lg px-5 py-3 text-sm font-medium transition"
                    style={{
                      background: "rgba(196,94,50,0.08)",
                      border: "1px solid rgba(196,94,50,0.25)",
                      color: "rgba(220,180,140,0.65)",
                      fontFamily: "'Lora', serif",
                    }}
                  >
                    Open Jam Anyway
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mx-auto mb-8 max-w-md text-sm" style={{ color: "rgba(220,180,140,0.45)" }}>
                  Building BPM and chord data for your first session. This screen will jump into the jam
                  page as soon as it is ready.
                </p>

                <div className="mx-auto flex w-full max-w-[280px] items-center gap-3">
                  <div
                    className="h-[3px] flex-1 overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="bar-pulse h-full rounded-full"
                      style={{ background: "rgba(196,94,50,0.9)" }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: "rgba(220,180,140,0.45)" }}>Analyzing…</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
