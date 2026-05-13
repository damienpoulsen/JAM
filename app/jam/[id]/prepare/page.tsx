"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { getFile, saveFile } from "../../../../lib/db";
import {
  CURRENT_ANALYSIS_VERSION,
  readStoredSongAnalysis,
  saveSongAnalysis,
  type SongAnalysis,
} from "../../../../lib/analysis";
import { readSongs, type Song, writeSongs } from "../../../../lib/songs";

type ProgressPhase = { label: string; targetPct: number; durationMs: number };

const PHASES_HPSS: ProgressPhase[] = [
  { label: "Loading audio",        targetPct: 10, durationMs: 2000  },
  { label: "Separating harmonics", targetPct: 38, durationMs: 8000  },
  { label: "Detecting chords",     targetPct: 68, durationMs: 12000 },
  { label: "Analyzing rhythm",     targetPct: 88, durationMs: 6000  },
  { label: "Finalizing",           targetPct: 92, durationMs: 3000  },
];

const PHASES_DEMUCS: ProgressPhase[] = [
  { label: "Loading audio",        targetPct:  3, durationMs:  3000 },
  { label: "Loading stem model",   targetPct: 18, durationMs: 15000 },
  { label: "Separating stems",     targetPct: 55, durationMs: 80000 },
  { label: "Detecting chords",     targetPct: 75, durationMs: 30000 },
  { label: "Analyzing rhythm",     targetPct: 88, durationMs: 15000 },
  { label: "Finalizing",           targetPct: 92, durationMs: 10000 },
];

const PUBLIC_ANALYSIS_API_URL = process.env.NEXT_PUBLIC_ANALYSIS_API_URL?.replace(/\/$/, "") ?? "";

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataLen = samples.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(arrayBuffer);
  const writeStr = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return arrayBuffer;
}

async function extractAudioAsWav(videoFile: File): Promise<File> {
  const ctx = new AudioContext({ sampleRate: 22050 });
  try {
    const buf = await ctx.decodeAudioData(await videoFile.arrayBuffer());
    const wav = audioBufferToWav(buf);
    return new File([wav], videoFile.name.replace(/\.[^.]+$/, ".wav"), { type: "audio/wav" });
  } finally {
    await ctx.close();
  }
}

function updateStoredSong(songId: string, patch: Partial<Song>) {
  const songs = readSongs();
  const songIndex = songs.findIndex((song) => song.id === songId);
  if (songIndex === -1) return null;
  const nextSong = { ...songs[songIndex], ...patch };
  const updatedSongs = songs.map((song, index) => (index === songIndex ? nextSong : song));
  writeSongs(updatedSongs);
  return nextSong;
}

type Phase = "checking" | "fetching" | "choose" | "analyzing" | "done" | "error";
type StemMode = "hpss" | "demucs";

export default function PrepareJamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hasAnalyzedRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [songName, setSongName] = useState("Preparing track");
  const [errorMessage, setErrorMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("checking");
  const [stemMode, setStemMode] = useState<StemMode>("demucs");
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("Loading…");
  const completedAnalysisRef = useRef<SongAnalysis | null>(null);

  // Phase 1: check cache / song existence — runs once on mount
  useEffect(() => {
    const init = async () => {
      const song = readSongs().find((entry) => entry.id === id);

      if (!song) {
        setErrorMessage("This track could not be found.");
        setPhase("analyzing"); // skip to analyzing phase to show error
        return;
      }

      setSongName(song.name || "Preparing track");

      // For YouTube songs, verify the audio file actually exists before going to jam.
      // Community-loaded songs have analysis ready but no audio in IndexedDB yet.
      const audioMissing = async () => {
        if (!song.youtubeUrl) return false;
        const file = await getFile(song.fileId);
        return !file;
      };

      if (song.analysisStatus === "ready") {
        if (await audioMissing()) { setPhase("fetching"); return; }
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
        if (await audioMissing()) { setPhase("fetching"); return; }
        updateStoredSong(id, {
          key: song.key === "Unknown" && storedAnalysis.detectedKey ? storedAnalysis.detectedKey : song.key,
          bpm: typeof storedAnalysis.bpm === "number" && Number.isFinite(storedAnalysis.bpm)
            ? Number(storedAnalysis.bpm.toFixed(1))
            : song.bpm,
          analysisStatus: "ready",
        });
        router.replace(`/jam/${id}`);
        return;
      }

      // YouTube-sourced song — fetch audio first, then show quality choice
      if (song.youtubeUrl) {
        setPhase("fetching");
        return;
      }

      // No cache — show the quality-choice screen
      setPhase("choose");
    };

    void init();
  }, [id, router]);

  // Phase 1b: fetch audio from YouTube before showing quality choice
  useEffect(() => {
    if (phase !== "fetching") return;
    const song = readSongs().find((s) => s.id === id);
    if (!song?.youtubeUrl) { setPhase("choose"); return; }

    const fetchAudio = async () => {
      try {
        const res = await fetch("/api/extract-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: song.youtubeUrl }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Failed to fetch audio from YouTube");
        }
        const blob = await res.blob();
        const ext = blob.type.includes("mpeg") ? "mp3" : blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `track.${ext}`, { type: blob.type || "audio/mp4" });
        await saveFile(song.fileId, file);
        setSongName((prev) => prev === "YouTube Track" || prev === "Preparing track" ? (song.name || prev) : prev);
        // If analysis is already done (e.g. loaded from community), skip quality choice
        const refreshed = readSongs().find((s) => s.id === id);
        if (refreshed?.analysisStatus === "ready") {
          router.replace(`/jam/${id}`);
        } else {
          setPhase("choose");
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to fetch audio from YouTube.");
        setPhase("error");
      }
    };

    void fetchAudio();
  }, [phase, id]);

  // Phase 2: run analysis once the user has chosen a mode
  useEffect(() => {
    if (phase !== "analyzing" || hasAnalyzedRef.current) return;
    hasAnalyzedRef.current = true;

    const runAnalysis = async () => {
      const song = readSongs().find((entry) => entry.id === id);
      if (!song) { setErrorMessage("This track could not be found."); return; }

      updateStoredSong(id, { analysisStatus: "loading" });

      try {
        const rawFile = await getFile(song.fileId);
        if (!rawFile) throw new Error("Audio file is unavailable for this track.");

        const needsTranscode = rawFile.type.startsWith("video/") || rawFile.type === "audio/mp4" || rawFile.type === "audio/webm";
        const file = needsTranscode ? await extractAudioAsWav(rawFile) : rawFile;

        const formData = new FormData();
        formData.append("songId", id);
        formData.append("file", file);
        formData.append("detectChords", "true");
        formData.append("skipBpm", "false");
        formData.append("stemMode", stemMode);

        const analysisEndpoint = PUBLIC_ANALYSIS_API_URL
          ? `${PUBLIC_ANALYSIS_API_URL}/analyze`
          : "/api/analyze-song";

        const response = await fetch(analysisEndpoint, { method: "POST", body: formData });

        if (!response.ok) {
          if (response.status === 503 || response.status === 429) throw new Error("The server is busy right now. Wait a moment and try again.");
          if (response.status >= 500) throw new Error("Analysis is unavailable right now. Try again in a moment.");
          const errPayload = await response.json().catch(() => ({})) as { detail?: string; error?: string };
          throw new Error(errPayload.detail || errPayload.error || "Song analysis failed.");
        }

        const detectedAnalysis = (await response.json()) as SongAnalysis;
        saveSongAnalysis(detectedAnalysis);

        updateStoredSong(id, {
          key: song.key === "Unknown" && detectedAnalysis.detectedKey ? detectedAnalysis.detectedKey : song.key,
          bpm: typeof detectedAnalysis.bpm === "number" && Number.isFinite(detectedAnalysis.bpm)
            ? Number(detectedAnalysis.bpm.toFixed(1))
            : song.bpm,
          analysisStatus: "ready",
        });

        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setProgress(100);
        completedAnalysisRef.current = detectedAnalysis;
        setPhase("done");
      } catch (error) {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        updateStoredSong(id, { analysisStatus: "error" });
        setErrorMessage(error instanceof Error ? error.message : "Failed to load this track.");
      }
    };

    void runAnalysis();
  }, [id, router, phase, stemMode]);

  // Animate progress bar through known pipeline phases
  useEffect(() => {
    if (phase !== "analyzing") {
      setProgress(0);
      return;
    }

    const phases = stemMode === "demucs" ? PHASES_DEMUCS : PHASES_HPSS;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      let cumTime = 0;
      let pct = 0;
      let label = phases[0].label;

      for (let i = 0; i < phases.length; i++) {
        const prevPct = i === 0 ? 0 : phases[i - 1].targetPct;
        const dur = phases[i].durationMs;
        const phaseEnd = cumTime + dur;

        if (elapsed < phaseEnd) {
          const t = (elapsed - cumTime) / dur;
          const eased = 1 - Math.pow(1 - t, 2); // ease-out quad
          pct = prevPct + (phases[i].targetPct - prevPct) * eased;
          label = phases[i].label;
          break;
        }

        cumTime = phaseEnd;
        pct = phases[i].targetPct;
        label = phases[i].label;
      }

      setProgress(Math.min(pct, 92));
      setPhaseLabel(label);
    };

    tick();
    progressTimerRef.current = setInterval(tick, 150);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [phase, stemMode]);

  const startAnalysis = (mode: StemMode) => {
    setStemMode(mode);
    setPhase("analyzing");
  };

  const handleRetry = () => {
    setErrorMessage("");
    hasAnalyzedRef.current = false;
    updateStoredSong(id, { analysisStatus: "pending" });
    const song = readSongs().find((s) => s.id === id);
    setPhase(song?.youtubeUrl ? "fetching" : "choose");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .mode-card {
          transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s, background 0.18s;
          cursor: pointer;
        }
        .mode-card:hover {
          transform: translateY(-3px);
          border-color: rgba(160,100,255,0.7) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 28px rgba(120,60,200,0.28) !important;
        }

        .action-btn {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .action-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(160,80,255,1) !important;
          box-shadow: 0 0 28px rgba(130,50,240,0.55), 0 0 55px rgba(130,50,240,0.25), 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        .search-input:focus { outline: none; border-color: rgba(160,100,255,0.7) !important; }
      `}</style>

      <main
        className="relative flex h-screen overflow-hidden text-white"
        style={{ fontFamily: "'Lora', serif", background: "#070610" }}
      >
        {/* Atmospheric background — corner purple blooms */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute" style={{ width: 1100, height: 620, top: -290, left: -430, background: "radial-gradient(ellipse at 36% 40%, rgba(142,28,255,0.88) 0%, rgba(112,20,235,0.52) 28%, rgba(88,15,200,0.24) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
          <div className="absolute" style={{ width: 680, height: 270, top: -110, left: -210, background: "radial-gradient(ellipse at 42% 50%, rgba(175,65,255,0.68) 0%, rgba(135,38,235,0.32) 45%, transparent 72%)", filter: "blur(58px)", transform: "rotate(-40deg)" }} />
          <div className="absolute" style={{ width: 1100, height: 620, bottom: -290, right: -430, background: "radial-gradient(ellipse at 64% 60%, rgba(142,28,255,0.88) 0%, rgba(112,20,235,0.52) 28%, rgba(88,15,200,0.24) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
          <div className="absolute" style={{ width: 680, height: 270, bottom: -110, right: -210, background: "radial-gradient(ellipse at 58% 50%, rgba(175,65,255,0.68) 0%, rgba(135,38,235,0.32) 45%, transparent 72%)", filter: "blur(58px)", transform: "rotate(-40deg)" }} />
        </div>

        {/* ← HOME — fixed top-right */}
        <Link
          href="/"
          className="action-btn fixed flex items-center gap-2 rounded-lg px-5 py-2.5 z-50"
          style={{
            top: 28,
            right: 32,
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
          }}
        >
          ← HOME
        </Link>

        {/* ── Content ── */}
        <div className="relative mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6">

          {phase === "fetching" ? (
            /* ── Fetching YouTube audio ── */
            <div className="w-full max-w-md text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div style={{ height: 1, width: 48, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 48, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>
              <div style={{ color: "rgba(155,110,240,0.5)", display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <svg viewBox="0 0 24 24" width={40} height={40} fill="currentColor">
                  <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2 .3 4.1.3 4.1s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.5 12 21.5 12 21.5s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.1v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z" />
                </svg>
              </div>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(165,118,248,0.55)", marginBottom: 10 }}>FETCHING AUDIO</p>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(20px, 3.5vw, 28px)", color: "#ffffff", margin: "0 0 12px", lineHeight: 1.2 }}>
                Downloading from YouTube
              </h1>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(165,118,248,0.4)", fontStyle: "italic", lineHeight: 1.6 }}>
                This takes 20–60 seconds. We'll go straight to analysis when it's ready.
              </p>
            </div>

          ) : phase === "done" ? (
            /* ── Analysis complete / community prompt ── */
            <div className="w-full max-w-md text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div style={{ height: 1, width: 48, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 48, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(165,118,248,0.55)", marginBottom: 10 }}>ANALYSIS COMPLETE</p>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(20px, 3.5vw, 28px)", color: "#ffffff", margin: "0 0 8px", lineHeight: 1.2 }}>
                {songName}
              </h1>

              <>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(165,118,248,0.45)", fontStyle: "italic", marginBottom: 32, lineHeight: 1.6 }}>
                    Chord data, BPM, and key are ready.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.replace(`/jam/${id}`)}
                    className="action-btn w-full rounded-lg px-6 py-3"
                    style={{ background: "rgba(10,6,22,0.97)", border: "1.5px solid rgba(130,60,220,0.65)", boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 6px 20px rgba(0,0,0,0.5)", fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "white", cursor: "pointer" }}
                  >
                    OPEN JAM →
                  </button>
                </>
            </div>

          ) : phase === "choose" ? (
            /* ── Quality choice screen ── */
            <div className="w-full text-center">

              {/* JAM divider */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div style={{ height: 1, width: 48, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 48, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>

              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(165,118,248,0.55)", marginBottom: 10 }}>
                CHORD DETECTION QUALITY
              </p>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(22px, 4vw, 34px)", color: "#ffffff", margin: "0 0 8px", lineHeight: 1.15 }}>
                {songName}
              </h1>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 14, color: "rgba(165,118,248,0.45)", fontStyle: "italic", marginBottom: 36 }}>
                How thoroughly should JAM isolate harmonics before detecting chords?
              </p>

              {/* Mode cards */}
              <div className="flex gap-4">
                {/* Fast — HPSS */}
                <button
                  type="button"
                  onClick={() => startAnalysis("hpss")}
                  className="mode-card flex-1 rounded-2xl px-6 py-7 text-left"
                  style={{
                    background: "rgba(10,6,22,0.97)",
                    border: "1.5px solid rgba(125,55,210,0.55)",
                    boxShadow: "0 6px 32px rgba(0,0,0,0.65), 0 0 24px rgba(110,40,210,0.14)",
                  }}
                >
                  <div className="mb-4 flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "rgba(115,45,210,0.22)", border: "1.5px solid rgba(140,70,225,0.4)" }}>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(185,135,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 18, color: "#ffffff", marginBottom: 4 }}>
                    Fast
                  </div>
                  <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(165,118,248,0.7)", marginBottom: 16 }}>
                    ~30 SECONDS
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {["Removes drum transients", "Vocals remain in signal", "Good for instrumental tracks"].map(item => (
                      <li key={item} style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>{item}</li>
                    ))}
                  </ul>
                </button>

                {/* Accurate — Demucs */}
                <button
                  type="button"
                  onClick={() => startAnalysis("demucs")}
                  className="mode-card flex-1 rounded-2xl px-6 py-7 text-left"
                  style={{
                    background: "rgba(10,6,22,0.97)",
                    border: "1.5px solid rgba(125,55,210,0.55)",
                    boxShadow: "0 6px 32px rgba(0,0,0,0.65), 0 0 24px rgba(110,40,210,0.14)",
                  }}
                >
                  <div className="mb-4 flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "rgba(115,45,210,0.22)", border: "1.5px solid rgba(140,70,225,0.4)" }}>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(185,135,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 18, color: "#ffffff", marginBottom: 4 }}>
                    Accurate
                  </div>
                  <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(165,118,248,0.7)", marginBottom: 4 }}>
                    ~2–4 MINUTES
                  </div>
                  <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.3)", marginBottom: 12 }}>
                    first run downloads ~320 MB model
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {["Removes drums & vocals", "Isolates bass + instruments", "Best for vocal-heavy tracks"].map(item => (
                      <li key={item} style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>{item}</li>
                    ))}
                  </ul>
                </button>
              </div>
            </div>

          ) : (
            /* ── Loading / error screen ── */
            <div className="w-full max-w-md text-center">

              {/* JAM divider */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div style={{ height: 1, width: 48, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 48, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>

              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(165,118,248,0.55)", marginBottom: 10 }}>
                {errorMessage || phase === "error" ? "ERROR" : phase === "checking" ? "LOADING" : "ANALYZING"}
              </p>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(20px, 3.5vw, 30px)", color: "#ffffff", margin: "0 0 24px", lineHeight: 1.2 }}>
                {songName}
              </h1>

              {errorMessage ? (
                <>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 14, color: "rgba(165,118,248,0.55)", fontStyle: "italic", marginBottom: 28, lineHeight: 1.6 }}>
                    {errorMessage}
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="action-btn inline-flex items-center rounded-lg px-6 py-3 text-sm font-bold"
                      style={{
                        background: "rgba(10,6,22,0.97)",
                        border: "1.5px solid rgba(130,60,220,0.65)",
                        boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 6px 20px rgba(0,0,0,0.5)",
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: 13,
                        letterSpacing: "0.1em",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      TRY AGAIN
                    </button>
                    <Link
                      href={`/jam/${id}`}
                      style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.4)", letterSpacing: "0.1em", textDecoration: "underline" }}
                    >
                      Open Jam Anyway
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(165,118,248,0.4)", fontStyle: "italic", marginBottom: 8, lineHeight: 1.6 }}>
                    {stemMode === "demucs"
                      ? "Separating stems and building chord data. This takes a few minutes — worth the wait."
                      : "Building BPM and chord data for your first session."}
                  </p>
                  <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.25)", letterSpacing: "0.1em", marginBottom: 28 }}>
                    {stemMode === "demucs" ? "MODE: ACCURATE (DEMUCS)" : "MODE: FAST (HPSS)"}
                  </p>

                  <div className="mx-auto w-full max-w-[300px]">
                    <div className="flex justify-between items-center mb-2.5">
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.65)", letterSpacing: "0.08em" }}>
                        {phase === "checking" ? "Loading…" : phaseLabel}
                      </span>
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.35)", letterSpacing: "0.06em" }}>
                        {phase === "analyzing" ? `${Math.round(progress)}%` : ""}
                      </span>
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${phase === "checking" ? 0 : progress}%`,
                          background: "linear-gradient(90deg, rgba(100,35,200,0.9), rgba(165,75,255,0.95))",
                          transition: "width 0.2s ease-out",
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
