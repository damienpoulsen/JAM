"use client";

import Image from "next/image";
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

        const response = await fetch("/api/analyze-song", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Song analysis failed.");
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
    <main className="relative flex h-screen overflow-hidden bg-[#151313] px-6 py-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_24%),linear-gradient(180deg,rgba(35,32,32,0.96)_0%,rgba(18,16,16,0.98)_100%),repeating-radial-gradient(circle_at_center,rgba(255,255,255,0.025)_0_1px,transparent_1px_4px)] opacity-95" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center">
        <div className="w-full max-w-xl rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-8 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="relative mx-auto mb-6 flex justify-center">
            <div className="absolute inset-0 rounded-full bg-white/8 blur-3xl" />
            <Image
              src="/jam-logo-vibrant-1.png"
              alt="Jam logo"
              width={360}
              height={200}
              priority
              className="relative h-auto w-[280px]"
            />
          </div>

          <div className="mb-3 text-sm uppercase tracking-[0.3em] text-white/45">Loading</div>
          <h1 className="mb-3 text-3xl font-semibold text-white">{songName}</h1>

          {errorMessage ? (
            <>
              <p className="mx-auto mb-6 max-w-md text-sm text-white/65">{errorMessage}</p>
              <Link
                href={`/jam/${id}`}
                className="inline-flex rounded-xl border border-white/12 bg-white/8 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Open Jam Anyway
              </Link>
            </>
          ) : (
            <>
              <p className="mx-auto mb-8 max-w-md text-sm text-white/65">
                Building BPM and chord data for your first session. This screen will jump into the jam
                page as soon as it is ready.
              </p>

              <div className="mx-auto flex w-full max-w-[280px] items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-[#f5f5f4]" />
                </div>
                <span className="text-sm text-white/55">Analyzing…</span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
