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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .song-card {
          transition: background 0.12s, border-color 0.12s;
        }
        .song-card:hover {
          background: rgba(196,94,50,0.06) !important;
          border-bottom-color: rgba(220,160,100,0.4) !important;
        }
        .settings-btn {
          transition: background 0.15s;
        }
        .settings-btn:hover {
          background: rgba(196,94,50,0.22) !important;
        }
      `}</style>

      <div
        className="relative min-h-screen px-8 py-8 text-white"
        style={{ fontFamily: "'Lora', serif", background: "#0f0c08" }}
      >

        {/* ── Atmospheric background ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="orb-1 absolute rounded-full" style={{ width: 1000, height: 1000, top: -400, left: -350, background: "radial-gradient(circle, rgba(196,94,50,0.28) 0%, rgba(160,60,20,0.10) 45%, transparent 70%)", filter: "blur(90px)" }} />
          <div className="orb-2 absolute rounded-full" style={{ width: 700, height: 700, bottom: -200, right: -180, background: "radial-gradient(circle, rgba(184,120,40,0.18) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(8,5,2,0.5) 75%, rgba(5,3,1,0.82) 100%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", opacity: 0.18, mixBlendMode: "overlay" }} />
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-10 flex items-end justify-between border-b pb-4" style={{ borderColor: "rgba(220,170,110,0.2)" }}>
            <h1
              className="text-5xl"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, letterSpacing: "0.04em" }}
            >
              All Tracks
            </h1>
            <Link
              href="/"
              className="text-sm mb-1"
              style={{ color: "rgba(220,180,140,0.45)", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#C45A2A")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(220,180,140,0.45)")}
            >
              ← Back
            </Link>
          </div>

          {/* Track list */}
          <div className="flex flex-col">
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
                      className="song-card relative flex items-center gap-4 px-2 py-4 cursor-pointer"
                      style={{
                        borderBottom: "1px solid rgba(196,94,50,0.12)",
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
                          background: "rgba(196,94,50,0.15)",
                          color: "#f0e4d0",
                          boxShadow: "0 0 0 1px rgba(196,94,50,0.3)",
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
                          style={{ fontFamily: "'Lora', serif", letterSpacing: "0.02em", color: "#f5ede0" }}
                        >
                          {song.name}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: isPending ? "rgba(220,180,140,0.25)" : "rgba(220,180,140,0.55)" }}>
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
                        background: "rgba(12,7,3,0.97)",
                        border: "1px solid rgba(196,94,50,0.28)",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                        backdropFilter: "blur(16px)",
                      }}
                    >
                      <div className="mb-2 px-2 text-xs" style={{ color: "rgba(220,180,140,0.45)", fontFamily: "'Lora', serif", letterSpacing: "0.08em" }}>Song Settings</div>
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
                          style={{ color: "#f5ede0", fontFamily: "'Lora', serif", background: "none", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(196,94,50,0.14)"; }}
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
              <p className="py-10 text-center text-sm" style={{ color: "rgba(220,180,140,0.3)", fontStyle: "italic" }}>
                No tracks yet. Upload one from the home screen.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
