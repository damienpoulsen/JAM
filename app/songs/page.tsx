"use client";

import { deleteFile, getFile } from "../../lib/db";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readSongs, type Song, writeSongs } from "../../lib/songs";

function formatTrackBpm(value: Song["bpm"]) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : "--";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "--") return "--";
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed) : trimmed;
  }
  return "--";
}

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>(() => readSongs());
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (audioBlobUrl.current) URL.revokeObjectURL(audioBlobUrl.current);
    };
  }, []);

  const getSongHref = (song: Song) =>
    song.analysisStatus === "ready" || song.analysisStatus === "error"
      ? `/jam/${song.id}`
      : `/jam/${song.id}/prepare`;

  const handlePlay = async (song: Song, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioBlobUrl.current) { URL.revokeObjectURL(audioBlobUrl.current); audioBlobUrl.current = null; }
    if (playingId === song.id) { setPlayingId(null); return; }
    try {
      const file = await getFile(song.fileId);
      if (!file) return;
      const url = URL.createObjectURL(file);
      audioBlobUrl.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(song.id);
    } catch (err) {
      console.error("Playback failed", err);
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

  const handleDelete = async () => {
    if (openMenuIndex === null) return;
    const songToDelete = songs[openMenuIndex];
    const updated = songs.filter((_, i) => i !== openMenuIndex);
    setSongs(updated);
    writeSongs(updated);
    setOpenMenuIndex(null);
    setMenuPosition(null);
    if (songToDelete?.fileId) await deleteFile(songToDelete.fileId);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .track-row {
          transition: background 0.12s;
        }
        .track-row:hover {
          background: rgba(120,60,200,0.055) !important;
        }
        .play-btn {
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
        }
        .play-btn:hover {
          background: rgba(120,60,200,0.22) !important;
          border-color: rgba(160,100,255,0.9) !important;
          transform: scale(1.08);
        }
        .threedot-btn {
          transition: color 0.12s, background 0.12s;
        }
        .threedot-btn:hover {
          color: rgba(255,255,255,0.85) !important;
          background: rgba(120,60,200,0.16) !important;
        }
        .back-link {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .back-link:hover {
          transform: translateY(-2px);
          border-color: rgba(160,80,255,1) !important;
          box-shadow: 0 0 28px rgba(130,50,240,0.55), 0 0 55px rgba(130,50,240,0.25), 0 8px 24px rgba(0,0,0,0.5) !important;
        }
      `}</style>

      <div
        className="relative h-screen overflow-hidden text-white"
        style={{ fontFamily: "'Lora', serif", background: "#070610" }}
      >

        <div className="relative mx-auto max-w-4xl px-5 py-10 h-full flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div style={{ height: 1, width: 32, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 32, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(28px, 5vw, 42px)", color: "#ffffff", margin: 0, lineHeight: 1.1 }}>
                All Songs
              </h1>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.6)", letterSpacing: "0.14em", marginTop: 7 }}>
                {songs.length} {songs.length === 1 ? "TRACK" : "TRACKS"}
              </p>
            </div>
            <Link
              href="/"
              className="back-link flex items-center gap-2 rounded-lg px-5 py-2.5 mt-1"
              style={{
                border: "1.5px solid rgba(130,60,220,0.65)",
                boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 0 28px rgba(110,40,210,0.25), 0 6px 20px rgba(0,0,0,0.5)",
                background: "rgba(10,6,22,0.85)",
                backdropFilter: "blur(10px)",
                fontFamily: "'Courier Prime', monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "white",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              ← HOME
            </Link>
          </div>

          {/* Track list container */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ background: "rgba(22,18,34,0.92)", border: "1px solid rgba(118,52,208,0.48)", borderRadius: 12 }}>

            {/* Column headers */}
            {songs.length > 0 && (
              <div
                className="flex items-center justify-between px-4 pt-3 pb-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(165,118,248,0.4)" }}>TITLE</span>
                <div
                  className="flex items-center"
                  style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(165,118,248,0.4)", marginRight: 44 }}
                >
                  <span style={{ width: 72, textAlign: "center" }}>KEY</span>
                  <span style={{ width: 60, textAlign: "center" }}>BPM</span>
                </div>
              </div>
            )}

            {/* Track rows — scrollable, fills remaining container height */}
            <div className="flex-1 overflow-y-auto min-h-0">
            {songs.map((track, index) => {
              const isReady = track.analysisStatus === "ready";
              const isError = track.analysisStatus === "error";
              const isPending = !isReady && !isError;
              const isPlaying = playingId === track.id;

              return (
                <div key={track.id} className="relative">
                  <Link
                    href={getSongHref(track)}
                    className="track-row flex items-center gap-3 px-4 py-3.5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {/* Play button */}
                    <button
                      type="button"
                      onClick={(e) => handlePlay(track, e)}
                      className="play-btn shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 38,
                        height: 38,
                        border: `1.5px solid ${isPlaying ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)"}`,
                        background: isPlaying ? "rgba(120,60,200,0.22)" : "transparent",
                        color: isPlaying ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                      }}
                      aria-label={isPlaying ? `Pause ${track.name}` : `Play ${track.name}`}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor">
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      )}
                    </button>

                    {/* Thumbnail */}
                    <div
                      className="shrink-0 flex items-center justify-center rounded-lg"
                      style={{ width: 40, height: 40, background: "rgba(120,60,200,0.1)", border: "1px solid rgba(120,60,200,0.18)" }}
                    >
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="rgba(148,100,240,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>

                    {/* Track name */}
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: "#ffffff", fontFamily: "'Lora', serif", fontSize: 15 }}
                    >
                      {track.name}
                    </span>

                    {/* Key + BPM */}
                    <div
                      className="shrink-0 flex"
                      style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 15,
                        color: isPending ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.82)",
                      }}
                    >
                      <span style={{ width: 72, textAlign: "center" }}>{isPending ? "···" : track.key}</span>
                      <span style={{ width: 60, textAlign: "center" }}>{isPending ? "···" : formatTrackBpm(track.bpm)}</span>
                    </div>

                    {/* Three-dot menu */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                        setOpenMenuIndex(openMenuIndex === index ? null : index);
                      }}
                      className="threedot-btn shrink-0 flex flex-col items-center justify-center gap-[3.5px] rounded-md"
                      style={{ width: 28, height: 28, color: "rgba(255,255,255,0.32)", background: "none", border: "none" }}
                      aria-label={`Options for ${track.name}`}
                    >
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{ display: "block", width: 3.5, height: 3.5, borderRadius: "50%", background: "currentColor" }} />
                      ))}
                    </button>
                  </Link>
                </div>
              );
            })}

            {songs.length === 0 && (
              <p className="py-10 text-center text-sm" style={{ color: "rgba(190,160,230,0.3)", fontStyle: "italic" }}>
                No tracks yet. Upload one from the home screen.
              </p>
            )}
            </div>
          </div>
        </div>

        {/* Context menu backdrop */}
        {openMenuIndex !== null && menuPosition && (
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => { setOpenMenuIndex(null); setMenuPosition(null); }}
          />
        )}

        {/* Context menu */}
        {openMenuIndex !== null && menuPosition && (
          <div
            className="fixed z-[9999] w-[180px] rounded-xl p-2"
            style={{
              top: menuPosition.top,
              right: menuPosition.right,
              background: "rgba(12,7,3,0.97)",
              border: "1px solid rgba(120,60,200,0.28)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="mb-2 px-2 text-xs" style={{ color: "rgba(190,160,230,0.45)", fontFamily: "'Lora', serif", letterSpacing: "0.08em" }}>
              Song Settings
            </div>
            {[
              { label: "Rename Song", onClick: handleRenameSong },
              { label: "Adjust BPM", onClick: handleAdjustBpm },
              { label: "Change Key", onClick: handleChangeKey },
            ].map(({ label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="w-full rounded px-2 py-2 text-left text-sm"
                style={{ color: "#f5ede0", fontFamily: "'Lora', serif", background: "none", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(120,60,200,0.14)"; }}
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
    </>
  );
}
