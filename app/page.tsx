"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, ValidationError } from "@formspree/react";
import { deleteFile, saveFile } from "../lib/db";
import { readSongs, type Song, writeSongs } from "../lib/songs";
import { saveSongAnalysis, type SongAnalysis } from "../lib/analysis";

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

const LET_HER_GO = { slug: "let-her-go", name: "Let Her Go", artist: "Passenger", key: "G", bpm: 76 };

export default function Home() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>(() => readSongs());
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [mobileNoticeOpen, setMobileNoticeOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const tourFileRef = useRef<HTMLInputElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackState, submitFeedback] = useForm("maqadgga");

  useEffect(() => {
    try {
      const toured = localStorage.getItem("jam-toured");
      if (!toured) setTourModalOpen(true);
    } catch {}
  }, []);

  const handleStartTour = async () => {
    setTourLoading(true);
    try {
      const existing = readSongs();
      const found = existing.find((s) => s.name === LET_HER_GO.name);
      if (found) {
        router.push(`/jam/${found.id}?tour=true`);
        return;
      }
      const id = crypto.randomUUID();
      try {
        const res = await fetch(`/demos/analysis/${LET_HER_GO.slug}.json`);
        if (res.ok) {
          const analysis = await res.json() as SongAnalysis;
          saveSongAnalysis({ ...analysis, songId: id });
        }
      } catch {}
      const song: Song = { id, fileId: id, name: LET_HER_GO.name, key: LET_HER_GO.key, bpm: LET_HER_GO.bpm, analysisStatus: "ready" };
      writeSongs([song, ...existing]);
      setSongs([song, ...existing]);
      try {
        const res = await fetch(`/demos/${LET_HER_GO.slug}.mp3`);
        if (res.ok) {
          const blob = await res.blob();
          await saveFile(id, new File([blob], `${LET_HER_GO.name}.mp3`, { type: "audio/mpeg" }));
        }
      } catch {}
      router.push(`/jam/${id}?tour=true`);
    } catch {
      setTourLoading(false);
    }
  };

  const handleSkipTour = () => {
    try { localStorage.setItem("jam-toured", "true"); } catch {}
    setTourModalOpen(false);
  };

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
    const updatedSongs = [pendingSong, ...readSongs()];

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
      {/* Tour welcome modal — shown to new users */}
      {tourModalOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center pb-8 px-4 sm:items-center sm:pb-0"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border px-6 py-7 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            style={{
              background: "rgba(10,8,15,0.97)",
              borderColor: "rgba(255,255,255,0.12)",
              fontFamily: "'Lora', serif",
            }}
          >
            <div
              className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ fontFamily: "'Courier Prime', monospace", color: "rgba(190,160,230,0.5)" }}
            >
              30 seconds
            </div>
            <h2
              className="mb-3 text-[22px] font-semibold leading-snug text-white"
            >
              See how JAM works
            </h2>
            <p
              className="mb-7 text-[14px] leading-relaxed"
              style={{ fontStyle: "italic", color: "rgba(190,160,230,0.72)" }}
            >
              JAM reads the chords in any song and shows you the theory on a live fretboard. Want a quick look?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartTour}
                disabled={tourLoading}
                className="w-full rounded-xl py-3 text-[13px] font-bold uppercase tracking-[0.12em] text-white transition"
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  border: "1.5px solid rgba(255,255,255,0.75)",
                  background: tourLoading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                  boxShadow: "0 0 18px rgba(255,255,255,0.12)",
                }}
              >
                {tourLoading ? "Loading…" : "Show me →"}
              </button>
              <button
                type="button"
                onClick={handleSkipTour}
                className="w-full py-2 text-[11px] uppercase tracking-[0.14em] transition"
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  color: "rgba(190,160,230,0.38)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                I&apos;ll explore on my own
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile desktop notice — only shown on small screens */}
      {mobileNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-6 min-[900px]:hidden">
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e12]/95 px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            <p
              className="mb-1 text-[13px] font-bold uppercase tracking-[0.18em] text-white/50"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              Heads up
            </p>
            <p className="mb-4 text-[15px] leading-snug text-white/90" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              JAM is built for desktop. Mobile works, but for the full experience load it up on a bigger screen.
            </p>
            <button
              type="button"
              onClick={() => setMobileNoticeOpen(false)}
              className="w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/15"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        :root {
          --accent:  #C45A2A;
          --green:   #22c55e;
          --red:     #ef4444;
        }

        /* ── Demo button ── */
        .demo-btn-home {
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .demo-btn-home:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,1) !important;
          box-shadow: 0 0 32px rgba(255,255,255,0.5), 0 0 65px rgba(255,255,255,0.22), 0 8px 24px rgba(0,0,0,0.5) !important;
        }

        /* ── Upload card ── */
        .upload-card {
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .upload-card:hover {
          transform: translateY(-3px);
          border-color: rgba(235,200,150,0.9) !important;
          box-shadow: 0 22px 55px rgba(0,0,0,0.6), 0 0 45px rgba(120,60,200,0.35) !important;
        }

        /* ── Track rows ── */
        .track-row {
          transition: background 0.12s, border-color 0.12s;
        }
        .track-row:hover {
          background: rgba(120,60,200,0.06) !important;
          border-bottom-color: rgba(220,160,100,0.4) !important;
        }

        /* ── Settings button ── */
        .settings-btn {
          transition: background 0.15s;
        }
        .settings-btn:hover {
          background: rgba(120,60,200,0.22) !important;
        }

        /* ── Logo glow ── */
        .logo-glow {
          opacity: 0.18;
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
          box-shadow: 0 0 6px var(--accent), 0 0 14px rgba(120,60,200,0.7);
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
        className="relative h-screen overflow-hidden px-6 py-4 text-white"
        style={{ fontFamily: "'Lora', serif", background: "#0a080f" }}
      >

        {/* ── Atmospheric background ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="orb-1 absolute rounded-full" style={{ width: 1000, height: 1000, top: -400, left: -350, background: "radial-gradient(circle, rgba(120,60,200,0.28) 0%, rgba(90,30,160,0.10) 45%, transparent 70%)", filter: "blur(90px)" }} />
          <div className="orb-2 absolute rounded-full" style={{ width: 700, height: 700, bottom: -200, right: -180, background: "radial-gradient(circle, rgba(100,50,180,0.18) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(8,5,2,0.5) 75%, rgba(5,3,1,0.82) 100%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", opacity: 0.18, mixBlendMode: "overlay" }} />
        </div>

        <div className="relative mx-auto -mt-6 flex h-full w-full max-w-5xl flex-col items-center">

          {/* Song Demos button — desktop only */}
          <Link
            href="/demo"
            className="demo-btn-home fixed hidden min-[900px]:flex items-center gap-3 rounded-lg px-7 py-4"
            style={{
              top: "56px",
              right: "120px",
              transform: "translateY(-50%)",
              border: "2.5px solid rgba(255,255,255,0.78)",
              boxShadow: "0 0 22px rgba(255,255,255,0.28), 0 0 48px rgba(255,255,255,0.13), 0 6px 18px rgba(0,0,0,0.4)",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
              zIndex: 40,
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span
              className="font-bold"
              style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", fontSize: "15px" }}
            >
              Song Demos
            </span>
          </Link>

          <div className="relative -top-8">
            {/* Logo */}
            <div className="relative -mb-3 flex justify-center">
              <div
                className="logo-glow absolute inset-0 rounded-full blur-2xl"
                style={{ background: "rgba(120,60,200,0.18)" }}
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
                  fontFamily="'DM Serif Display', serif"
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
                  fontFamily="'DM Serif Display', serif"
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
                className="upload-card relative flex h-[182px] w-[275px] cursor-pointer flex-col items-center justify-center rounded py-5"
                style={{
                  background: "rgba(120,60,200,0.86)",
                  border: "1px solid rgba(235,200,150,0.75)",
                  boxShadow: "0 18px 50px rgba(0,0,0,0.6), 0 0 35px rgba(120,60,200,0.28)",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mb-4 h-12 w-12"
                  style={{ color: "#ffffff" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M5 20h14" />
                </svg>
                <span
                  className="text-[32px]"
                  style={{ fontFamily: "'Lora', serif", fontStyle: "italic", fontWeight: 700, letterSpacing: "0.02em", color: "#ffffff" }}
                >
                  Upload Track
                </span>
              </label>
            </div>
          </div>

          {/* Song Demos button — mobile only */}
          <div className="mb-2 -mt-3 flex w-full justify-center min-[900px]:hidden">
            <Link
              href="/demo"
              className="demo-btn-home flex items-center justify-center gap-2.5 rounded-lg py-2.5"
              style={{
                width: "275px",
                border: "2.5px solid rgba(255,255,255,0.78)",
                boxShadow: "0 0 18px rgba(255,255,255,0.25), 0 0 40px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.4)",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span
                className="font-bold"
                style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", fontSize: "13px" }}
              >
                Song Demos
              </span>
            </Link>
          </div>

          {/* Track list panel */}
          <div
            className="flex min-h-0 w-full flex-1 px-2 pt-1"
          >
            <div className="flex min-h-0 w-full flex-col">
              {/* Panel header */}
              <div
                className="mb-1 grid grid-cols-3 items-end pb-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.25)" }}
              >
                <div>
                  <h2
                    className="text-xl"
                    style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontStyle: "italic", letterSpacing: "0.06em", color: "#ffffff" }}
                  >
                    Recent Tracks
                  </h2>
                  {songs.length > 0 && (
                    <Link
                      href="/songs"
                      className="mt-1 block text-xs"
                      style={{ color: "rgba(190,160,230,0.35)", transition: "color 0.15s", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#C45A2A")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(190,160,230,0.35)")}
                    >
                      VIEW ALL →
                    </Link>
                  )}
                </div>

                <div />

                <div
                  className="mr-8 grid w-[176px] shrink-0 justify-self-end grid-cols-[88px_72px] gap-4 text-xs"
                  style={{ color: "#ffffff", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.12em" }}
                >
                  <span className="flex items-center justify-center text-center">KEY</span>
                  <span className="flex items-center justify-center text-center">BPM</span>
                </div>
              </div>

              {/* Track rows */}
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-1">
                {songs.map((track, index) => {
                  const isReady   = track.analysisStatus === "ready";
                  const isError   = track.analysisStatus === "error";
                  const isPending = !isReady && !isError;

                  return (
                    <div key={track.id} className="relative">
                      <Link
                        href={getSongHref(track)}
                        className="track-row flex items-center justify-between px-2 py-3"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.12)",
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
                              background: "rgba(120,60,200,0.14)",
                              color: "#f0e4d0",
                              boxShadow: "0 0 0 1px rgba(120,60,200,0.28)",
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


                          <span className="text-sm md:text-base" style={{ color: "#ffffff", fontFamily: "'Lora', serif" }}>
                            {track.name}
                          </span>
                        </div>

                        <div
                          className="mr-8 grid w-[176px] shrink-0 grid-cols-[88px_72px] gap-4 text-sm"
                          style={{ color: isPending ? "rgba(255,255,255,0.2)" : "#ffffff", fontFamily: "'Courier Prime', monospace" }}
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
                  <p className="py-8 text-center text-sm" style={{ color: "rgba(190,160,230,0.3)", fontStyle: "italic" }}>
                    Upload a track to start your library.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-right button group */}
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
            {/* How it works */}
            <button
                type="button"
                onClick={() => setTourModalOpen(true)}
                className="flex items-center justify-center rounded-full border border-white/30 bg-black/70 backdrop-blur-sm transition-all hover:text-white hover:border-white/60"
                style={{ width: 32, height: 32, fontFamily: "'Rajdhani', sans-serif", boxShadow: "0 0 10px rgba(255,255,255,0.25), 0 0 22px rgba(255,255,255,0.10)", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}
                aria-label="How it works"
                title="How it works"
            >
                ?
            </button>

            {/* Feedback */}
            <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-white/30 bg-black/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 transition-all hover:text-white hover:border-white/60 backdrop-blur-sm"
                style={{ fontFamily: "'Rajdhani', sans-serif", boxShadow: "0 0 10px rgba(255,255,255,0.25), 0 0 22px rgba(255,255,255,0.10)" }}
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Share feedback
            </button>
        </div>

        {/* Feedback modal */}
        {feedbackOpen && (
            <div
                className="fixed inset-0 z-[60] flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
                onClick={(e) => { if (e.target === e.currentTarget) setFeedbackOpen(false); }}
            >
                <div
                    className="w-full max-w-[480px] mx-4 rounded-2xl border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                    style={{ background: "#111111", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    {feedbackState.succeeded ? (
                        <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
                            <div className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Thanks!</div>
                            <p className="text-[13px] text-white/55">Your feedback helps make JAM better.</p>
                            <button
                                type="button"
                                onClick={() => setFeedbackOpen(false)}
                                className="mt-2 rounded-lg px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition"
                                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={submitFeedback} className="flex flex-col px-6 py-6 gap-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-[16px] font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.06em" }}>Got thoughts? We&apos;re listening.</div>
                                    <div className="mt-0.5 text-[11px] text-white/40">Feature requests, bugs, ideas — all welcome.</div>
                                </div>
                                <button type="button" onClick={() => setFeedbackOpen(false)} className="text-white/30 hover:text-white/70 transition text-lg leading-none ml-4">✕</button>
                            </div>
                            <div className="flex flex-col gap-1">
                                <textarea
                                    autoFocus
                                    id="message"
                                    name="message"
                                    placeholder="Tell us what's on your mind…"
                                    rows={5}
                                    required
                                    className="w-full resize-none rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/25 transition"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                />
                                <ValidationError field="message" errors={feedbackState.errors} className="text-[11px] text-red-400" />
                            </div>
                            <button
                                type="submit"
                                disabled={feedbackState.submitting}
                                className="rounded-lg py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40"
                                style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}
                            >
                                {feedbackState.submitting ? "Sending…" : "Send Feedback"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        )}

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
              { label: "Adjust BPM",  onClick: handleAdjustBpm  },
              { label: "Change Key",  onClick: handleChangeKey   },
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
      </main>
    </>
  );
}
