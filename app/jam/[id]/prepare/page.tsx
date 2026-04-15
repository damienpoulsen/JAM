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
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .bar-pulse {
          animation: bar-pulse 1.8s ease-in-out infinite;
        }
        @keyframes bar-pulse {
          0%,100% { opacity: 1; width: 40%; }
          50%      { opacity: 0.6; width: 70%; }
        }
      `}</style>

      <main
        className="relative flex h-screen overflow-hidden bg-black px-6 py-4 text-white "
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >

        {/* ── Content ── */}
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center">
          <div
            className="w-full max-w-xl rounded-[28px] px-8 py-10 text-center"
            style={{
              background: "rgba(18,14,28,0.82)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
              backdropFilter: "blur(20px)",
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
                <text x="270" y="210" fontFamily="'Chakra Petch', sans-serif" fontWeight={700} fontSize={190} fill="rgba(255,255,255,0.12)" textAnchor="middle" letterSpacing={16} filter="url(#p-jam-glow)">JAM</text>
                <text x="270" y="210" fontFamily="'Chakra Petch', sans-serif" fontWeight={700} fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
              </svg>
            </div>

            <div
              className="mb-3 text-xs uppercase"
              style={{ letterSpacing: "0.3em", color: "rgba(237,232,245,0.35)" }}
            >
              Loading
            </div>

            <h1
              className="mb-3 text-2xl font-semibold"
              style={{ fontFamily: "'Rajdhani', sans-serif", color: "#ede8f5", letterSpacing: "0.03em" }}
            >
              {songName}
            </h1>

            {errorMessage ? (
              <>
                <p className="mx-auto mb-6 max-w-md text-sm" style={{ color: "rgba(237,232,245,0.55)" }}>
                  {errorMessage}
                </p>
                <Link
                  href={`/jam/${id}`}
                  className="inline-flex rounded-xl px-5 py-3 text-sm font-medium text-white transition"
                  style={{
                    background: "rgba(157,80,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  Open Jam Anyway
                </Link>
              </>
            ) : (
              <>
                <p className="mx-auto mb-8 max-w-md text-sm" style={{ color: "rgba(237,232,245,0.45)" }}>
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
                      style={{ background: "rgba(157,80,255,0.8)" }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: "rgba(237,232,245,0.4)" }}>Analyzing…</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
