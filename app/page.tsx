"use client";

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
    if (!file) return;

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
    if (openMenuIndex === null) return;

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
      song.id === songId ? { ...song, ...patch } : song
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

        :root {
          --accent:  #9d50ff;
          --green:   #22c55e;
          --red:     #ef4444;
        }

        /* ── Upload card — clean white ── */
        .upload-card {
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .upload-card:hover {
          transform: scale(1.04);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.15) !important;
        }

        /* ── Track rows ── */
        .track-row {
          transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .track-row:hover {
          transform: scale(1.02);
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.14) !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.15) !important;
        }

        /* ── Settings button ── */
        .settings-btn {
          transition: background 0.15s;
        }
        .settings-btn:hover {
          background: rgba(0,0,0,0.12) !important;
        }

        /* ── Logo breathe ── */
        .logo-glow {
          animation: logo-breathe 5s ease-in-out infinite;
        }
        @keyframes logo-breathe {
          0%,100% { opacity: 0.1; transform: scale(1); }
          50%      { opacity: 0.3; transform: scale(1.2); }
        }

        /* ── LEDs ── */
        .led-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .led-purple {
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent), 0 0 14px rgba(157,80,255,0.6);
          animation: led-blink 1.6s ease-in-out infinite;
        }
        .led-green {
          background: var(--green);
          box-shadow: 0 0 6px var(--green), 0 0 14px rgba(34,197,94,0.6);
        }
        .led-red {
          background: var(--red);
          box-shadow: 0 0 5px var(--red);
        }

        @keyframes led-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.2; }
        }
      `}</style>

      <main
        className="relative h-screen overflow-hidden bg-black px-6 py-4 text-white "
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >

        <div className="relative mx-auto -mt-6 flex h-full w-full max-w-5xl flex-col items-center">
          <div className="relative -top-8">
            {/* Logo */}
            <div className="relative -mb-3 flex justify-center">
              <div
                className="logo-glow absolute inset-0 rounded-full blur-2xl"
                style={{ background: "rgba(157, 80, 255, 0.12)" }}
              />
              <svg
                viewBox="0 0 540 300"
                xmlns="http://www.w3.org/2000/svg"
                className="relative h-auto w-[420px] md:w-[560px]"
                aria-label="JAM"
              >
                <defs>
                  <filter id="jam-glow" x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Glow bloom */}
                <text
                  x="270" y="210"
                  fontFamily="'Chakra Petch', sans-serif"
                  fontWeight={700}
                  fontSize={190}
                  fill="rgba(255,255,255,0.12)"
                  textAnchor="middle"
                  letterSpacing={16}
                  filter="url(#jam-glow)"
                >
                  JAM
                </text>

                {/* Main JAM text */}
                <text
                  x="270" y="210"
                  fontFamily="'Chakra Petch', sans-serif"
                  fontWeight={700}
                  fontSize={190}
                  fill="#ffffff"
                  textAnchor="middle"
                  letterSpacing={16}
                >
                  JAM
                </text>
              </svg>
            </div>

            {/* Upload card */}
            <div className="mb-2 -mt-[40px] flex justify-center">
              <input
                type="file"
                accept=".mp3"
                id="fileUpload"
                className="hidden"
                onChange={handleUpload}
              />

              <label
                htmlFor="fileUpload"
                className="upload-card flex h-[182px] w-[275px] cursor-pointer flex-col items-center justify-center rounded-2xl py-5"
                style={{
                  background: "rgba(18,14,28,0.85)",
                  border: "2px solid rgba(255,255,255,0.28)",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4), 0 0 18px rgba(255,255,255,0.18), 0 0 6px rgba(255,255,255,0.25)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mb-4 h-12 w-12"
                  style={{ color: "#ffffff" }}
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
                <span
                  className="text-[34px] font-semibold"
                  style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.04em", color: "#ede8f5" }}
                >
                  Upload Track
                </span>
              </label>
            </div>
          </div>

          {/* Track list panel */}
          <div
            className="flex min-h-0 w-full flex-1 rounded-[22px] p-4"
            style={{
              background: "rgba(18,14,28,0.8)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 22px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex min-h-0 w-full flex-col">
              {/* Panel header */}
              <div
                className="mb-4 grid grid-cols-3 items-center pb-2"
                style={{ borderBottom: "1px solid rgba(157,80,255,0.1)" }}
              >
                <div>
                  <h2
                    className="text-xl"
                    style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: "0.06em", color: "#ede8f5" }}
                  >
                    Recent Tracks
                  </h2>
                  <Link
                    href="/songs"
                    className="text-sm hover:underline"
                    style={{ color: "rgba(237,232,245,0.35)", transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#b07aff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,232,245,0.35)")}
                  >
                    View All
                  </Link>
                </div>

                <div />

                <div
                  className="mr-8 grid w-[176px] shrink-0 justify-self-end grid-cols-[88px_72px] gap-4 text-sm"
                  style={{ color: "#ffffff" }}
                >
                  <span className="flex items-center justify-center text-center">Key</span>
                  <span className="flex items-center justify-center text-center">BPM</span>
                </div>
              </div>

              {/* Track rows */}
              <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-2">
                {songs.map((track, index) => {
                  const isReady   = track.analysisStatus === "ready";
                  const isError   = track.analysisStatus === "error";
                  const isPending = !isReady && !isError;

                  return (
                    <div key={track.id} className="relative">
                      <Link
                        href={getSongHref(track)}
                        className="track-row flex items-center justify-between rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                        }}
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
                            className="settings-btn flex h-8 w-8 items-center justify-center rounded-md"
                            style={{
                              background: "rgba(157,80,255,0.12)",
                              color: "#ffffff",
                              boxShadow: "0 0 0 1px rgba(157,80,255,0.2)",
                            }}
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


                          <span className="text-sm md:text-base" style={{ color: "#ede8f5" }}>
                            {track.name}
                          </span>
                        </div>

                        <div
                          className="mr-2 grid w-[176px] shrink-0 grid-cols-[88px_72px] gap-4 text-sm"
                          style={{ color: isPending ? "rgba(255,255,255,0.2)" : "#ffffff" }}
                        >
                          <span className="flex items-center justify-center text-center">
                            {isPending ? "···" : track.key}
                          </span>
                          <span className="flex items-center justify-center text-center">
                            {isPending ? "···" : formatTrackBpm(track.bpm)}
                          </span>
                        </div>
                      </Link>
                    </div>
                  );
                })}

                {songs.length === 0 && (
                  <div
                    className="rounded-xl px-4 py-6 text-center text-sm"
                    style={{
                      border: "1px dashed rgba(157,80,255,0.15)",
                      color: "rgba(237,232,245,0.25)",
                    }}
                  >
                    Upload a track to start your library.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Context menu */}
        {openMenuIndex !== null && menuPosition && (
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => { setOpenMenuIndex(null); setMenuPosition(null); }}
          />
        )}
        {openMenuIndex !== null && menuPosition && (
          <div
            className="fixed z-[9999] w-[180px] rounded-xl p-2"
            style={{
              top: menuPosition.top,
              left: menuPosition.left - 200,
              transform: "translateY(-50%)",
              background: "rgba(18,14,28,0.95)",
              border: "1px solid rgba(157,80,255,0.2)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="mb-2 px-2 text-xs" style={{ color: "rgba(237,232,245,0.35)" }}>
              Song Settings
            </div>

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
                style={{ color: "#ede8f5", background: "none", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(157,80,255,0.1)"; }}
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
      </main>
    </>
  );
}
