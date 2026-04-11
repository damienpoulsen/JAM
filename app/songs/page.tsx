"use client";

import { deleteFile } from "../../lib/db";
import Link from "next/link";
import { useState } from "react";
import { readSongs, type Song, writeSongs } from "../../lib/songs";

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


export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>(() => readSongs());
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const getSongHref = (song: Song) =>
    song.analysisStatus === "ready" || song.analysisStatus === "error"
      ? `/jam/${song.id}`
      : `/jam/${song.id}/prepare`;

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
    <div className="min-h-screen bg-[#0b0b17] px-8 py-6 text-white">
      <h1 className="mb-6 text-3xl">All Songs</h1>

      <div className="grid grid-cols-3 gap-6">
        {songs.map((song, index) => {
          const handleDelete = async () => {
            const songToDelete = songs[index];
            const updated = songs.filter((_, currentIndex) => currentIndex !== index);
            setSongs(updated);
            writeSongs(updated);
            setOpenMenuIndex(null);

            if (songToDelete?.fileId) {
              await deleteFile(songToDelete.fileId);
            }
          };

          return (
            <div key={song.id} className="relative">
              <Link href={getSongHref(song)}>
                <div className="relative cursor-pointer rounded-xl bg-[#2a2a35] p-4 transition hover:scale-[1.02]">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenMenuIndex(openMenuIndex === index ? null : index);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-[#1a1a22] px-2 py-1 text-xs hover:bg-[#333]"
                    aria-label={`Open settings for ${song.name}`}
                  >
                    Set
                  </button>

                  <div className="mb-2 ml-6 text-lg font-semibold">{song.name}</div>

                  <div className="ml-6 text-sm text-gray-400">
                    {song.key} - {song.analysisStatus === "ready" || song.analysisStatus === "error" ? `${formatTrackBpm(song.bpm)} BPM` : "Loading..."}
                  </div>
                </div>
              </Link>

              {openMenuIndex === index && (
                <div className="absolute left-10 top-1/2 z-50 w-[180px] -translate-y-1/2 rounded-xl border border-white/10 bg-[#1a1a22] p-2 shadow-xl">
                  <div className="mb-2 px-2 text-xs text-gray-400">Song Settings</div>

                  <button
                    type="button"
                    onClick={handleRenameSong}
                    className="w-full rounded px-2 py-2 text-left text-sm hover:bg-white/10"
                  >
                    Rename Song
                  </button>

                  <button
                    type="button"
                    onClick={handleAdjustBpm}
                    className="w-full rounded px-2 py-2 text-left text-sm hover:bg-white/10"
                  >
                    Adjust BPM
                  </button>

                  <button
                    type="button"
                    onClick={handleChangeKey}
                    className="w-full rounded px-2 py-2 text-left text-sm hover:bg-white/10"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
