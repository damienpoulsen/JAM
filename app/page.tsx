"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { deleteFile, saveFile } from "../lib/db";
import { readSongs, type Song, writeSongs } from "../lib/songs";

function formatTrackBpm(value: Song["bpm"]) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : "--";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "--") {
      return "--";
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed) : trimmed;
  }

  return "--";
}

export default function Home() {
  const [songs, setSongs] = useState<Song[]>(() => readSongs());
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const id = crypto.randomUUID();
    const cleanName = file.name.replace(/\.mp3$/i, "").replace(/_/g, " ").trim();
    const pendingSong: Song = {
      id,
      fileId: id,
      name: cleanName,
      key: "Unknown",
      bpm: "--",
      analysisStatus: "pending",
    };
    const updatedSongs = [pendingSong, ...songs];

    setSongs(updatedSongs);
    writeSongs(updatedSongs);
    event.target.value = "";

    try {
      await saveFile(id, file);
    } catch (error) {
      console.error("Failed to save uploaded audio file", error);
    }
  };

  const getSongHref = (song: Song) =>
    song.analysisStatus === "ready" || song.analysisStatus === "error"
      ? `/jam/${song.id}`
      : `/jam/${song.id}/prepare`;

  const handleDelete = async () => {
    if (openMenuIndex === null) {
      return;
    }

    const songToDelete = songs[openMenuIndex];
    const updatedSongs = songs.filter((_, index) => index !== openMenuIndex);

    setSongs(updatedSongs);
    writeSongs(updatedSongs);
    setOpenMenuIndex(null);
    setMenuPosition(null);

    if (songToDelete?.fileId) {
      await deleteFile(songToDelete.fileId);
    }
  };

  const updateSong = (songId: string, patch: Partial<Song>) => {
    const updatedSongs = songs.map((song) =>
      song.id === songId
        ? {
            ...song,
            ...patch,
          }
        : song
    );

    setSongs(updatedSongs);
    writeSongs(updatedSongs);
    setOpenMenuIndex(null);
    setMenuPosition(null);
  };

  const getOpenSong = () => (openMenuIndex === null ? null : songs[openMenuIndex] ?? null);

  const handleRenameSong = () => {
    const openSong = getOpenSong();
    if (!openSong) return;

    const nextName = window.prompt("Rename song", openSong.name);
    if (nextName === null) return;

    const trimmedName = nextName.trim();
    if (!trimmedName) return;

    updateSong(openSong.id, { name: trimmedName });
  };

  const handleAdjustBpm = () => {
    const openSong = getOpenSong();
    if (!openSong) return;

    const nextBpm = window.prompt("Set BPM", openSong.bpm === "--" ? "" : String(openSong.bpm));
    if (nextBpm === null) return;

    const trimmedBpm = nextBpm.trim();
    if (!trimmedBpm) {
      updateSong(openSong.id, { bpm: "--" });
      return;
    }

    const parsedBpm = Number(trimmedBpm);
    if (!Number.isFinite(parsedBpm) || parsedBpm <= 0) {
      window.alert("Enter a valid BPM number.");
      return;
    }

    updateSong(openSong.id, { bpm: Math.round(parsedBpm) });
  };

  const handleChangeKey = () => {
    const openSong = getOpenSong();
    if (!openSong) return;

    const nextKey = window.prompt("Set key", openSong.key);
    if (nextKey === null) return;

    updateSong(openSong.id, { key: nextKey.trim() || "Unknown" });
  };

  return (
    <main className="relative h-screen overflow-hidden bg-black px-6 py-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,1)_100%),repeating-radial-gradient(circle_at_center,rgba(255,255,255,0.018)_0_1px,transparent_1px_4px)] opacity-95" />
      <div className="relative mx-auto -mt-6 flex h-full w-full max-w-5xl flex-col items-center">
        <div className="relative -top-8">
          <div className="relative -mb-3 flex justify-center">
            <div className="absolute inset-0 rounded-full bg-white/4 blur-2xl" />
            <Image
              src="/jam-logo-vibrant-1.png"
              alt="Jam logo"
              width={540}
              height={300}
              priority
              className="relative h-auto w-[420px] md:w-[560px]"
            />
          </div>

          <div className="mb-2 -mt-16 flex justify-center">
            <input
              type="file"
              accept=".mp3"
              id="fileUpload"
              className="hidden"
              onChange={handleUpload}
            />

            <label
              htmlFor="fileUpload"
              className="flex h-[182px] w-[275px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-white/26 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] py-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:scale-105 hover:border-white/40 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mb-4 h-12 w-12 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M5 20h14" />
              </svg>
              <span className="text-[26px] font-semibold">Upload Track</span>
            </label>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 rounded-[22px] border-2 border-white/26 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[0_22px_50px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="flex min-h-0 w-full flex-col">
          <div className="mb-4 grid grid-cols-3 items-center border-b border-white/8 pb-2">
            <div>
              <h2 className="text-xl">Recent Tracks</h2>
              <Link href="/songs" className="text-sm text-white/55 hover:text-white hover:underline">
                View All
              </Link>
            </div>

            <div />

            <div className="mr-8 grid w-[176px] shrink-0 justify-self-end grid-cols-[88px_72px] gap-4 text-sm text-white/55">
              <span className="flex items-center justify-center text-center">Key</span>
              <span className="flex items-center justify-center text-center">BPM</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {songs.map((track, index) => (
              <div key={track.id} className="relative">
                <Link
                  href={getSongHref(track)}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:scale-[1.01] hover:border-white/18 hover:bg-white/6"
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenuPosition({
                          top: rect.top + rect.height / 2,
                          left: rect.left,
                        });
                        setOpenMenuIndex(openMenuIndex === index ? null : index);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-[#342245] text-white shadow-[0_0_0_1px_rgba(76,50,107,0.28)] transition hover:bg-[#3e2953]"
                      aria-label={`Open settings for ${track.name}`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>

                    <span className="text-sm md:text-base">{track.name}</span>
                  </div>

                  <div className="mr-2 grid w-[176px] shrink-0 grid-cols-[88px_72px] gap-4 text-sm text-white/55">
                    <span className="flex items-center justify-center text-center">{track.key}</span>
                    <span className="flex items-center justify-center text-center">{track.analysisStatus === "ready" || track.analysisStatus === "error" ? formatTrackBpm(track.bpm) : "..."}</span>
                  </div>
                </Link>
              </div>
            ))}

            {songs.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-sm text-white/55">
                Upload a track to start your library.
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {openMenuIndex !== null && menuPosition && (
        <div
          className="fixed z-[9999] w-[180px] rounded-xl border border-white/10 bg-[#0f0f0f] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left - 200,
            transform: "translateY(-50%)",
          }}
        >
          <div className="mb-2 px-2 text-xs text-white/45">Song Settings</div>

          <button
            type="button"
            onClick={handleRenameSong}
            className="w-full rounded px-2 py-2 text-left text-sm text-white/78 hover:bg-white/10"
          >
            Rename Song
          </button>

          <button
            type="button"
            onClick={handleAdjustBpm}
            className="w-full rounded px-2 py-2 text-left text-sm text-white/78 hover:bg-white/10"
          >
            Adjust BPM
          </button>

          <button
            type="button"
            onClick={handleChangeKey}
            className="w-full rounded px-2 py-2 text-left text-sm text-white/78 hover:bg-white/10"
          >
            Change Key
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="mt-1 w-full rounded px-2 py-2 text-left text-sm text-red-500 hover:bg-red-500/20"
          >
            Delete Song
          </button>
        </div>
      )}
    </main>
  );
}
