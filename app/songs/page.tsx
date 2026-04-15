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
      song.id === songId ? { ...song, ...patch } : song
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
    if (!trimmedBpm) { updateSong(openSong.id, { bpm: "--" }); return; }
    const parsedBpm = Number(trimmedBpm);
    if (!Number.isFinite(parsedBpm) || parsedBpm <= 0) { window.alert("Enter a valid BPM number."); return; }
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .song-card {
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .song-card:hover {
          transform: scale(1.02);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.15) !important;
        }
        .settings-btn {
          transition: background 0.15s;
        }
        .settings-btn:hover {
          background: rgba(255,255,255,0.12) !important;
        }
      `}</style>

      <div
        className="min-h-screen bg-black px-8 py-8 text-white"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >

        {/* Side lines */}
        <div className="pointer-events-none fixed top-[144px] bottom-[144px] left-[10%] w-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="pointer-events-none fixed top-[144px] bottom-[144px] right-[10%] w-px" style={{ background: "rgba(255,255,255,0.07)" }} />

        <div className="relative mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-center relative">
            <h1
              className="text-5xl text-center"
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}
            >
              All Tracks
            </h1>
            <Link
              href="/"
              className="absolute right-0 text-sm"
              style={{ color: "rgba(255,255,255,0.35)", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              ← Back
            </Link>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song, index) => {
              const isPending = song.analysisStatus !== "ready" && song.analysisStatus !== "error";

              const handleDelete = async () => {
                const songToDelete = songs[index];
                const updated = songs.filter((_, i) => i !== index);
                setSongs(updated);
                writeSongs(updated);
                setOpenMenuIndex(null);
                if (songToDelete?.fileId) await deleteFile(songToDelete.fileId);
              };

              return (
                <div key={song.id} className="relative">
                  <Link href={getSongHref(song)}>
                    <div
                      className="song-card relative flex items-center gap-4 rounded-xl p-4 cursor-pointer"
                      style={{
                        background: "rgba(157,80,255,0.10)",
                        border: "none",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Settings button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuIndex(openMenuIndex === index ? null : index);
                        }}
                        className="settings-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: "rgba(157,80,255,0.15)",
                          color: "#ffffff",
                          boxShadow: "0 0 0 1px rgba(157,80,255,0.3)",
                        }}
                        aria-label={`Open settings for ${song.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </button>

                      {/* Song info */}
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-base font-semibold"
                          style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.03em", color: "#ffffff" }}
                        >
                          {song.name}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: isPending ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.55)" }}>
                          {isPending ? "Analyzing…" : `${song.key} · ${formatTrackBpm(song.bpm)} BPM`}
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Context menu */}
                  {openMenuIndex === index && (
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuIndex(null)} />
                  )}
                  {openMenuIndex === index && (
                    <div
                      className="absolute left-0 top-full z-50 mt-2 w-[180px] rounded-xl p-2"
                      style={{
                        background: "rgba(10,8,18,0.97)",
                        border: "1px solid rgba(157,80,255,0.25)",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                        backdropFilter: "blur(16px)",
                      }}
                    >
                      <div className="mb-2 px-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Song Settings</div>
                      {[
                        { label: "Rename Song", onClick: handleRenameSong },
                        { label: "Adjust BPM",  onClick: handleAdjustBpm  },
                        { label: "Change Key",  onClick: handleChangeKey   },
                      ].map(({ label, onClick }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={onClick}
                          className="w-full rounded px-2 py-2 text-left text-sm"
                          style={{ color: "#ffffff", background: "none", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(157,80,255,0.12)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="mt-1 w-full rounded px-2 py-2 text-left text-sm"
                        style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                      >
                        Delete Song
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {songs.length === 0 && (
              <div
                className="col-span-3 rounded-xl px-4 py-10 text-center text-sm"
                style={{ border: "1px dashed rgba(157,80,255,0.2)", color: "rgba(255,255,255,0.25)" }}
              >
                No tracks yet. Upload one from the home screen.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
