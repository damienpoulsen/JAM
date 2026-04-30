"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, ValidationError } from "@formspree/react";
import { deleteFile, getFile, saveFile } from "../lib/db";
import { readSongs, type Song, writeSongs } from "../lib/songs";
import { saveSongAnalysis, type SongAnalysis } from "../lib/analysis";

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

const LET_HER_GO = { slug: "let-her-go", name: "Let Her Go", artist: "Passenger", key: "G", bpm: 76 };

export default function Home() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>(() => readSongs());
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [mobileNoticeOpen, setMobileNoticeOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const tourFileRef = useRef<HTMLInputElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackState, submitFeedback] = useForm("maqadgga");

  // Inline audio preview state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    try {
      const toured = localStorage.getItem("jam-toured");
      if (!toured) setTourModalOpen(true);
    } catch {}
  }, []);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (audioBlobUrl.current) URL.revokeObjectURL(audioBlobUrl.current);
    };
  }, []);

  // Loads the file from IndexedDB and plays it inline — no navigation
  const handlePlay = async (song: Song, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioBlobUrl.current) {
      URL.revokeObjectURL(audioBlobUrl.current);
      audioBlobUrl.current = null;
    }

    if (playingId === song.id) {
      setPlayingId(null);
      return;
    }

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
    const isVideo = file.type.startsWith("video/");
    const cleanName = file.name.replace(/\.(mp3|mp4)$/i, "").replace(/_/g, " ").trim();
    const pendingSong: Song = {
      id,
      fileId: id,
      name: cleanName,
      key: "Unknown",
      bpm: "--",
      analysisStatus: "pending",
      hasVideo: isVideo || undefined,
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
      {/* Tour welcome modal */}
      {tourModalOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center px-3"
          style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
          onClick={handleSkipTour}
        >
          <div
            className="relative rounded-3xl overflow-y-auto w-[94vw]"
            style={{
              maxWidth: "min(82vw, 1000px)",
              maxHeight: "90vh",
              background: "rgba(14,10,22,0.98)",
              border: "1px solid rgba(120,60,200,0.3)",
              boxShadow: "0 0 80px rgba(100,40,200,0.3), 0 40px 100px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile-only desktop nudge — sits at the very top of the modal */}
            <div className="min-[900px]:hidden flex items-center gap-3 rounded-t-3xl px-5 py-3" style={{ background: "rgba(234,179,8,0.10)", borderBottom: "1px solid rgba(234,179,8,0.18)" }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="rgba(234,179,8,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(234,179,8,0.85)", letterSpacing: "0.06em", margin: 0, lineHeight: 1.4 }}>
                <strong>JAM is built for desktop.</strong> Mobile works, but for the full experience open it on a computer.
              </p>
            </div>

            <input
              ref={tourFileRef}
              type="file"
              accept=".mp3,.mp4"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="px-6 py-8 sm:px-12 sm:py-10">
              <div className="flex items-center justify-center gap-4 mb-7">
                <div style={{ height: 1, width: 56, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 56, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>
              <div className="text-center mb-4">
                <h1 style={{ fontFamily: "'Lora', serif", fontSize: "clamp(26px, 5vw, 50px)", fontWeight: 800, lineHeight: 1.15, color: "rgba(255,255,255,0.97)", margin: 0 }}>Upload any song.</h1>
                <h1 style={{ fontFamily: "'Lora', serif", fontSize: "clamp(26px, 5vw, 50px)", fontWeight: 800, lineHeight: 1.15, background: "linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: 0 }}>See what works.</h1>
              </div>
              <p className="text-center mx-auto mb-8" style={{ fontFamily: "'Lora', serif", fontSize: "clamp(13px, 1.4vw, 15px)", lineHeight: 1.65, color: "rgba(255,255,255,0.42)", maxWidth: 540, fontStyle: "italic" }}>
                JAM analyzes your songs and shows live chord changes, scales, and target notes on a real-time fretboard.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", borderTop: "2px solid rgba(120,60,200,0.5)" }}>
                  <div className="rounded-xl flex flex-col items-center justify-center gap-2" style={{ height: 118, background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="rgba(140,80,220,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>DROP YOUR SONG HERE</span>
                    <div className="rounded px-3 py-1" style={{ background: "rgba(120,60,200,0.22)", border: "1px solid rgba(120,60,200,0.38)" }}>
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(200,160,255,0.75)", letterSpacing: "0.08em" }}>Choose a file</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: "rgba(120,60,200,0.32)", color: "rgba(200,160,255,0.9)", fontFamily: "'Courier Prime', monospace" }}>1</span>
                      <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Upload Your Songs</span>
                    </div>
                    <p style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.55, paddingLeft: 28, fontStyle: "italic" }}>Upload your own songs using any MP3 or MP4 file.</p>
                  </div>
                </div>
                <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", borderTop: "2px solid rgba(120,60,200,0.5)" }}>
                  <div className="rounded-xl overflow-hidden flex flex-col justify-between" style={{ height: 118, background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 10px 8px" }}>
                    <div className="flex gap-1.5 items-center">
                      {[{ label: "Am", bg: "rgba(140,100,30,0.75)", playhead: true }, { label: "F", bg: "rgba(35,90,60,0.75)", playhead: false }, { label: "C", bg: "rgba(35,70,110,0.75)", playhead: false }, { label: "G", bg: "rgba(35,90,60,0.75)", playhead: false }].map((chord) => (
                        <div key={chord.label} className="relative flex-1 rounded flex items-center justify-center" style={{ background: chord.bg, height: 30 }}>
                          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700, color: "white" }}>{chord.label}</span>
                          {chord.playhead && <div className="absolute top-0 left-[38%] w-[2px] h-full" style={{ background: "rgba(200,160,255,0.95)" }} />}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-end gap-px" style={{ height: 36 }}>
                      {[8,12,18,22,20,16,10,7,9,15,21,23,19,13,8,6,10,17,22,24,20,14,9,7,11,18,23,22,17,11,8,12,19,23,21,15].map((h, i) => (
                        <div key={i} style={{ flex: 1, height: h, background: "rgba(120,60,200,0.45)", borderRadius: 1 }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: "rgba(120,60,200,0.32)", color: "rgba(200,160,255,0.9)", fontFamily: "'Courier Prime', monospace" }}>2</span>
                      <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Live Chord Tracking</span>
                    </div>
                    <p style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.55, paddingLeft: 28, fontStyle: "italic" }}>Follow every chord change in real time.</p>
                  </div>
                </div>
                <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", borderTop: "2px solid rgba(120,60,200,0.5)" }}>
                  <div className="rounded-xl relative overflow-hidden" style={{ height: 118, background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {/* 5 fret lines — left edge slightly thicker as nut */}
                    {[0,1,2,3,4].map((i) => (<div key={i} style={{ position: "absolute", left: `${4 + i * 17}%`, top: "6%", bottom: "6%", width: i === 0 ? 2 : 1, background: i === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.14)" }} />))}
                    {/* 6 strings — thin at top (high e), thicker at bottom (low E) */}
                    {[1,1,1,1.5,1.5,2].map((h, i) => (<div key={i} style={{ position: "absolute", top: `${7 + i * 17.2}%`, left: "4%", right: "27%", height: h, background: `rgba(255,255,255,${0.15 + i * 0.03})` }} />))}
                    {/* Am pentatonic box 1 — high e at top, low E at bottom */}
                    {/* roots: high e fret5 (top), D string fret7 (3rd from bottom), low E fret5 (bottom) */}
                    {[
                      { top: "7%",    left: "12.5%", color: "#ef4444" },
                      { top: "7%",    left: "63.5%", color: "#22c55e" },
                      { top: "24.2%", left: "12.5%", color: "#22c55e" },
                      { top: "24.2%", left: "63.5%", color: "#a855f7" },
                      { top: "41.4%", left: "12.5%", color: "#22c55e" },
                      { top: "41.4%", left: "46.5%", color: "#a855f7" },
                      { top: "58.6%", left: "12.5%", color: "#a855f7" },
                      { top: "58.6%", left: "46.5%", color: "#ef4444" },
                      { top: "75.8%", left: "12.5%", color: "#a855f7" },
                      { top: "75.8%", left: "46.5%", color: "#22c55e" },
                      { top: "93%",   left: "12.5%", color: "#ef4444" },
                      { top: "93%",   left: "63.5%", color: "#22c55e" },
                    ].map((dot, i) => (
                      <div key={i} style={{ position: "absolute", top: dot.top, left: dot.left, width: 10, height: 10, borderRadius: "50%", background: dot.color, transform: "translate(-50%,-50%)", boxShadow: `0 0 6px ${dot.color}88` }} />
                    ))}
                    {/* Legend — right column, vertically centered, outside fretboard */}
                    <div style={{ position: "absolute", right: "2%", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 5 }}>
                      {[{ color: "#ef4444", label: "Root" }, { color: "#22c55e", label: "Chord" }, { color: "#a855f7", label: "Scale" }].map((item) => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, color: "rgba(255,255,255,0.45)" }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: "rgba(120,60,200,0.32)", color: "rgba(200,160,255,0.9)", fontFamily: "'Courier Prime', monospace" }}>3</span>
                      <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Theory Overlays</span>
                    </div>
                    <p style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.55, paddingLeft: 28, fontStyle: "italic" }}>See scales, chord tones, and target notes instantly, so you can finally play with your favorite music.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
                <button type="button" onClick={handleStartTour} disabled={tourLoading} className="tour-primary-btn flex items-center justify-center gap-2 rounded-2xl py-4 px-8 text-white font-bold" style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, letterSpacing: "0.07em", background: tourLoading ? "rgba(120,60,200,0.45)" : "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", boxShadow: tourLoading ? "none" : "0 0 32px rgba(120,60,200,0.55), 0 8px 22px rgba(0,0,0,0.4)", minWidth: 220, opacity: tourLoading ? 0.7 : 1 }}>
                  {tourLoading ? "Loading…" : "Try Interactive Demo →"}
                </button>
                <button type="button" onClick={() => tourFileRef.current?.click()} className="tour-secondary-btn flex items-center justify-center gap-2 rounded-2xl py-4 px-8 text-white font-bold" style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, letterSpacing: "0.07em", background: "rgba(255,255,255,0.055)", border: "1.5px solid rgba(255,255,255,0.2)", minWidth: 200 }}>
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
                  Upload My Song
                </button>
              </div>
              <div className="text-center mb-8">
                <button type="button" onClick={handleSkipTour} style={{ background: "none", border: "none", fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(255,255,255,0.28)", letterSpacing: "0.07em", textDecoration: "underline", cursor: "pointer" }}>
                  Skip for now
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {[
                  { icon: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(160,100,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, title: "Real-time", body: "See everything update as the song plays." },
                  { icon: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(160,100,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="4" rx="1" /><rect x="2" y="10" width="20" height="4" rx="1" /><rect x="2" y="17" width="20" height="4" rx="1" /></svg>, title: "Stack & Customize", body: "Add layers and highlight what matters." },
                  { icon: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(160,100,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>, title: "Theory in Context", body: "Finally understand theory and have it all applied to the music you care about." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">{item.icon}</div>
                    <div>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.82)", marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.32)", lineHeight: 1.55, fontStyle: "italic" }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile desktop notice */}
      {mobileNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-6 min-[900px]:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e12]/95 px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-md">
            <p className="mb-1 text-[13px] font-bold uppercase tracking-[0.18em] text-white/50" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Heads up</p>
            <p className="mb-4 text-[15px] leading-snug text-white/90" style={{ fontFamily: "'Rajdhani', sans-serif" }}>JAM is built for desktop. Mobile works, but for the full experience load it up on a bigger screen.</p>
            <button type="button" onClick={() => setMobileNoticeOpen(false)} className="w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/15" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Got it</button>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .demo-btn-home {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .demo-btn-home:hover {
          transform: translateY(-2px);
          border-color: rgba(160,80,255,1) !important;
          box-shadow: 0 0 28px rgba(130,50,240,0.55), 0 0 55px rgba(130,50,240,0.25), 0 8px 24px rgba(0,0,0,0.5) !important;
        }

        .upload-card, .library-card {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .upload-card:hover, .library-card:hover {
          transform: translateY(-2px);
          border-color: rgba(160,100,255,0.7) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 28px rgba(120,60,200,0.28) !important;
        }

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

        .logo-glow { opacity: 0.18; }

        .tour-primary-btn {
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .tour-primary-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(124,58,237,0.75), 0 0 80px rgba(124,58,237,0.3), 0 12px 28px rgba(0,0,0,0.5) !important;
        }

        .tour-secondary-btn {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .tour-secondary-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.7) !important;
          box-shadow: 0 0 22px rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.45) !important;
        }
      `}</style>

      <main
        className="relative h-screen overflow-hidden text-white"
        style={{ fontFamily: "'Lora', serif", background: "#070610" }}
      >
        {/* Atmospheric background — curved purple streaks top-left and bottom-right */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {/* Top-left main bloom */}
          <div className="absolute" style={{ width: 1100, height: 620, top: -290, left: -430, background: "radial-gradient(ellipse at 36% 40%, rgba(142,28,255,0.88) 0%, rgba(112,20,235,0.52) 28%, rgba(88,15,200,0.24) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
          {/* Top-left streak accent */}
          <div className="absolute" style={{ width: 680, height: 270, top: -110, left: -210, background: "radial-gradient(ellipse at 42% 50%, rgba(175,65,255,0.68) 0%, rgba(135,38,235,0.32) 45%, transparent 72%)", filter: "blur(58px)", transform: "rotate(-40deg)" }} />
          {/* Bottom-right main bloom */}
          <div className="absolute" style={{ width: 1100, height: 620, bottom: -290, right: -430, background: "radial-gradient(ellipse at 64% 60%, rgba(142,28,255,0.88) 0%, rgba(112,20,235,0.52) 28%, rgba(88,15,200,0.24) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
          {/* Bottom-right streak accent */}
          <div className="absolute" style={{ width: 680, height: 270, bottom: -110, right: -210, background: "radial-gradient(ellipse at 58% 50%, rgba(175,65,255,0.68) 0%, rgba(135,38,235,0.32) 45%, transparent 72%)", filter: "blur(58px)", transform: "rotate(-40deg)" }} />
        </div>

        {/* Song Demos — desktop top-right */}
        <Link
          href="/demo"
          className="demo-btn-home fixed hidden min-[900px]:flex items-center gap-2.5 rounded-lg px-7 py-3.5"
          style={{
            top: 30,
            right: 36,
            border: "1.5px solid rgba(130,60,220,0.65)",
            boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 0 28px rgba(110,40,210,0.25), 0 6px 20px rgba(0,0,0,0.5)",
            background: "rgba(10,6,22,0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 40,
          }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", fontSize: 14, fontWeight: 700, color: "white" }}>
            Song Demos
          </span>
        </Link>

        {/* Main content column */}
        <div className="relative mx-auto flex h-full w-full max-w-4xl flex-col items-center px-5 pt-1 pb-20">

          {/* JAM logo */}
          <div className="relative flex justify-center" style={{ marginTop: -19 }}>
            <div className="logo-glow absolute inset-0 rounded-full blur-3xl" style={{ background: "rgba(110,40,220,0.38)" }} />
            <svg
              viewBox="0 0 600 300"
              xmlns="http://www.w3.org/2000/svg"
              className="relative h-auto w-[460px] md:w-[620px]"
              aria-label="JAM"
            >
              <defs>
                <filter id="jam-glow-outer" x="-60%" y="-100%" width="220%" height="300%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="38" />
                </filter>
                <filter id="jam-glow-mid" x="-35%" y="-60%" width="170%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
                </filter>
                <filter id="jam-glow-tight" x="-20%" y="-35%" width="140%" height="170%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
                </filter>
              </defs>
              {/* purple outer halo */}
              <text x="300" y="220" fontFamily="'DM Serif Display', serif" fontSize={200} fill="rgba(120,48,245,0.55)" textAnchor="middle" letterSpacing={16} filter="url(#jam-glow-outer)">JAM</text>
              {/* white mid glow */}
              <text x="300" y="220" fontFamily="'DM Serif Display', serif" fontSize={200} fill="rgba(255,255,255,0.38)" textAnchor="middle" letterSpacing={16} filter="url(#jam-glow-mid)">JAM</text>
              {/* tight white glow */}
              <text x="300" y="220" fontFamily="'DM Serif Display', serif" fontSize={200} fill="rgba(255,255,255,0.55)" textAnchor="middle" letterSpacing={16} filter="url(#jam-glow-tight)">JAM</text>
              {/* main crisp text */}
              <text x="300" y="220" fontFamily="'DM Serif Display', serif" fontSize={200} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
            </svg>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.44em",
              color: "rgba(165,118,248,0.95)",
              WebkitTextStroke: "0.4px rgba(165,118,248,0.85)",
              marginTop: -40,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            SEE THE MUSIC
          </p>

          {/* Upload + Library buttons */}
          <div className="flex w-full gap-4" style={{ marginTop: 19 }}>
            <input type="file" accept=".mp3,.mp4" id="fileUpload" className="hidden" onChange={handleUpload} />
            <label
              htmlFor="fileUpload"
              className="upload-card cursor-pointer flex flex-1 items-center gap-6 rounded-2xl px-7"
              style={{
                height: 139,
                background: "rgba(10,6,22,0.97)",
                border: "1.5px solid rgba(125,55,210,0.6)",
                boxShadow: "0 6px 32px rgba(0,0,0,0.65), 0 0 24px rgba(110,40,210,0.18)",
              }}
            >
              <div style={{
                width: 60, height: 60,
                borderRadius: 16,
                background: "rgba(115,45,210,0.28)",
                border: "1.5px solid rgba(140,70,225,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="rgba(185,135,255,0.97)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 21, color: "#ffffff" }}>Upload Track</div>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "rgba(155,110,240,0.62)", letterSpacing: "0.08em", marginTop: 6 }}>MP3, MP4</div>
              </div>
            </label>

            <Link
              href="/library"
              className="library-card flex flex-1 items-center gap-6 rounded-2xl px-7"
              style={{
                height: 139,
                background: "rgba(10,6,22,0.97)",
                border: "1.5px solid rgba(125,55,210,0.6)",
                boxShadow: "0 6px 32px rgba(0,0,0,0.65), 0 0 24px rgba(110,40,210,0.18)",
                textDecoration: "none",
              }}
            >
              <div style={{
                width: 60, height: 60,
                borderRadius: 16,
                background: "rgba(115,45,210,0.28)",
                border: "1.5px solid rgba(140,70,225,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="rgba(185,135,255,0.97)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 21, color: "#ffffff" }}>Song Library</div>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "rgba(155,110,240,0.62)", letterSpacing: "0.08em", marginTop: 6 }}>Community tracks</div>
              </div>
            </Link>
          </div>

          {/* Song Demos — mobile only */}
          <div className="mt-3 flex w-full justify-center min-[900px]:hidden">
            <Link
              href="/demo"
              className="demo-btn-home flex items-center justify-center gap-2.5 rounded-lg py-2.5"
              style={{
                width: "clamp(320px, 60vw, 620px)",
                border: "1.5px solid rgba(130,60,220,0.65)",
                boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 0 28px rgba(110,40,210,0.25), 0 4px 16px rgba(0,0,0,0.45)",
                background: "rgba(10,6,22,0.85)",
                backdropFilter: "blur(8px)",
              }}
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="white" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", fontSize: 13, fontWeight: 700, color: "white" }}>Song Demos</span>
            </Link>
          </div>

          {/* Recent Tracks — mobile: single nav card; desktop: full list */}
          <Link
            href="/songs"
            className="min-[900px]:hidden flex items-center justify-between rounded-2xl px-6 py-5 mt-5"
            style={{
              background: "rgba(22,18,34,0.92)",
              border: "1px solid rgba(118,52,208,0.48)",
              textDecoration: "none",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 42, height: 42, background: "rgba(120,60,200,0.18)", border: "1px solid rgba(120,60,200,0.32)" }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(185,135,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 17, color: "#ffffff" }}>My Tracks</div>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.6)", letterSpacing: "0.1em", marginTop: 2 }}>
                  {songs.length} {songs.length === 1 ? "TRACK" : "TRACKS"}
                </div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(165,118,248,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="hidden min-[900px]:flex min-h-0 flex-1 flex-col overflow-hidden" style={{ borderRadius: "16px 16px 0 0", marginTop: 39, marginLeft: -38, marginRight: -38, width: "calc(100% + 76px)" }}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 pt-4 pb-3"
            >
              <div className="flex items-center gap-5">
                <h2 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 23, color: "#ffffff", margin: 0 }}>
                  Recent Tracks
                </h2>
                {songs.length > 0 && (
                  <Link
                    href="/songs"
                    style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.14em", fontWeight: 700, color: "#b400ff", textDecoration: "none", marginTop: 5, marginLeft: 6 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#d040ff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#b400ff")}
                  >
                    VIEW ALL →
                  </Link>
                )}
              </div>
              {/* KEY / BPM column headers — offset right to align with row values + three-dot */}
              <div
                className="flex items-center"
                style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#ffffff", marginRight: 44 }}
              >
                <span style={{ width: 72, textAlign: "center" }}>KEY</span>
                <span style={{ width: 60, textAlign: "center" }}>BPM</span>
              </div>
            </div>

            {/* Track rows */}
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" style={{ background: "rgba(22,18,34,0.92)", border: "1px solid rgba(118,52,208,0.48)", borderRadius: 12 }}>
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
                      {/* Circular play button — calls getFile(fileId) and plays audio inline */}
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

                      {/* Music note thumbnail placeholder */}
                      <div
                        className="shrink-0 flex items-center justify-center rounded-lg"
                        style={{
                          width: 40,
                          height: 40,
                          background: "rgba(120,60,200,0.1)",
                          border: "1px solid rgba(120,60,200,0.18)",
                        }}
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

                      {/* Key + BPM values */}
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

                      {/* Three-dot menu button — replaces the old left-side gear button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPosition({
                            top: rect.bottom + 6,
                            right: window.innerWidth - rect.right,
                          });
                          setOpenMenuIndex(openMenuIndex === index ? null : index);
                        }}
                        className="threedot-btn shrink-0 flex flex-col items-center justify-center gap-[3.5px] rounded-md"
                        style={{
                          width: 28,
                          height: 28,
                          color: "rgba(255,255,255,0.32)",
                          background: "none",
                          border: "none",
                        }}
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
                  Upload a track to start your library.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom-right buttons */}
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTourModalOpen(true)}
            className="demo-btn-home flex items-center justify-center rounded-full backdrop-blur-sm"
            style={{ width: 36, height: 36, fontFamily: "'Rajdhani', sans-serif", border: "1.5px solid rgba(130,60,220,0.65)", background: "rgba(10,6,22,0.85)", boxShadow: "0 0 14px rgba(110,40,210,0.4), 0 0 28px rgba(110,40,210,0.18)", fontSize: 15, fontWeight: 700, color: "white" }}
            aria-label="How it works"
            title="How it works"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="demo-btn-home flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm"
            style={{ fontFamily: "'Rajdhani', sans-serif", border: "1.5px solid rgba(130,60,220,0.65)", background: "rgba(10,6,22,0.85)", color: "white", boxShadow: "0 0 14px rgba(110,40,210,0.4), 0 0 28px rgba(110,40,210,0.18)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
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
                  <button type="button" onClick={() => setFeedbackOpen(false)} className="mt-2 rounded-lg px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition" style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}>Close</button>
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
                  <button type="submit" disabled={feedbackState.submitting} className="rounded-lg py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40" style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}>
                    {feedbackState.submitting ? "Sending…" : "Send Feedback"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Context menu backdrop */}
        {openMenuIndex !== null && menuPosition && (
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => { setOpenMenuIndex(null); setMenuPosition(null); }}
          />
        )}

        {/* Context menu — anchored below/right of the three-dot button */}
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
      </main>
    </>
  );
}
