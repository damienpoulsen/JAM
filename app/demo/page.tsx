"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent } from "react";
import { saveFile } from "../../lib/db";
import { saveSongAnalysis, type SongAnalysis } from "../../lib/analysis";
import { readSongs, type Song, writeSongs } from "../../lib/songs";

const DEMO_SONGS = [
  { slug: "riptide",                  name: "Riptide",                    artist: "Vance Joy",    key: "Am",  bpm: 100 },
  { slug: "hotel-california",         name: "Hotel California",           artist: "The Eagles",   key: "Bm",  bpm: 75  },
  { slug: "wonderwall",               name: "Wonderwall",                 artist: "Oasis",        key: "F#m", bpm: 87  },
  { slug: "mr-brightside",            name: "Mr. Brightside",             artist: "The Killers",  key: "C#",  bpm: 148 },
  { slug: "creep",                    name: "Creep",                      artist: "Radiohead",    key: "G",   bpm: 92  },
  { slug: "let-her-go",               name: "Let Her Go",                 artist: "Passenger",    key: "G",   bpm: 76  },
  { slug: "knockin-on-heavens-door",  name: "Knockin' on Heaven's Door",  artist: "Bob Dylan",    key: "G",   bpm: 72  },
  { slug: "photograph",               name: "Photograph",                 artist: "Ed Sheeran",   key: "E",   bpm: 108 },
] as const;

export default function DemoPage() {
  const router = useRouter();

  const handleDemoClick = async (demo: (typeof DEMO_SONGS)[number]) => {
    const existing = readSongs();
    const found = existing.find((s) => s.name === demo.name);
    if (found) {
      router.push(`/jam/${found.id}`);
      return;
    }

    const id = crypto.randomUUID();

    // Load pre-baked analysis and write to localStorage
    try {
      const res = await fetch(`/demos/analysis/${demo.slug}.json`);
      if (res.ok) {
        const analysis = await res.json() as SongAnalysis;
        saveSongAnalysis({ ...analysis, songId: id });
      }
    } catch { /* fall through — jam page will show whatever we have */ }

    const song: Song = {
      id,
      fileId: id,
      name: demo.name,
      key: demo.key,
      bpm: demo.bpm,
      analysisStatus: "ready",
    };
    writeSongs([song, ...existing]);

    try {
      const res = await fetch(`/demos/${demo.slug}.mp3`);
      if (res.ok) {
        const blob = await res.blob();
        await saveFile(id, new File([blob], `${demo.name}.mp3`, { type: "audio/mpeg" }));
      }
    } catch { /* audio unavailable */ }

    router.push(`/jam/${id}`);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = crypto.randomUUID();
    const cleanName = file.name.replace(/\.mp3$/i, "").replace(/_/g, " ").trim();
    const song: Song = { id, fileId: id, name: cleanName, key: "Unknown", bpm: "--", analysisStatus: "pending" };
    writeSongs([song, ...readSongs()]);
    e.target.value = "";
    try { await saveFile(id, file); } catch (err) { console.error("Failed to save file", err); }
    router.push(`/jam/${id}/prepare`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

        .demo-row {
          transition: background 0.12s, border-color 0.12s, transform 0.15s;
          cursor: pointer;
        }
        .demo-row:hover {
          background: rgba(255,255,255,0.04) !important;
          border-bottom-color: rgba(255,255,255,0.2) !important;
          transform: translateX(6px);
        }

        .own-music-btn {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .own-music-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 38px rgba(255,255,255,0.55), 0 0 75px rgba(255,255,255,0.28), 0 10px 28px rgba(0,0,0,0.5) !important;
        }
      `}</style>

      <main
        className="relative min-h-screen px-6 py-8 text-white"
        style={{ fontFamily: "'Lora', serif", background: "#0a080f" }}
      >
        {/* Atmospheric background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ width: 900, height: 900, top: -350, left: -300, position: "absolute", borderRadius: "50%", background: "radial-gradient(circle, rgba(120,60,200,0.18) 0%, transparent 70%)", filter: "blur(90px)" }} />
          <div style={{ width: 600, height: 600, bottom: -200, right: -150, position: "absolute", borderRadius: "50%", background: "radial-gradient(circle, rgba(100,50,180,0.12) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(8,5,2,0.5) 75%, rgba(5,3,1,0.82) 100%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", opacity: 0.15, mixBlendMode: "overlay" }} />
        </div>

        <div className="relative mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link
                href="/"
                className="mb-4 block text-xs tracking-widest"
                style={{ color: "rgba(190,160,230,0.4)", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.16em" }}
              >
                ← BACK TO JAM
              </Link>
              <h1
                className="text-4xl md:text-5xl"
                style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, letterSpacing: "0.02em" }}
              >
                Demo Songs
              </h1>
              <p className="mt-2 text-sm" style={{ color: "rgba(190,160,230,0.5)", fontStyle: "italic" }}>
                Click any track to experience JAM
              </p>
            </div>

            {/* Try with your own Music! */}
            <div className="sm:pt-8">
              <input type="file" accept=".mp3" id="ownUpload" className="hidden" onChange={handleUpload} />
              <label
                htmlFor="ownUpload"
                className="own-music-btn cursor-pointer flex items-center gap-3 rounded-lg px-5 py-3.5"
                style={{
                  border: "2.5px solid rgba(255,255,255,0.82)",
                  boxShadow: "0 0 22px rgba(255,255,255,0.28), 0 0 50px rgba(255,255,255,0.14), 0 6px 20px rgba(0,0,0,0.4)",
                  background: "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M5 20h14" />
                </svg>
                <span
                  className="font-bold"
                  style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", fontSize: "13px" }}
                >
                  Try with your own Music!
                </span>
              </label>
            </div>
          </div>

          {/* Song list */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {/* Column headers */}
            <div
              className="grid px-4 py-2 text-xs"
              style={{
                gridTemplateColumns: "2rem 1fr 1fr 5rem 4rem",
                color: "rgba(190,160,230,0.35)",
                fontFamily: "'Courier Prime', monospace",
                letterSpacing: "0.14em",
              }}
            >
              <span>#</span>
              <span>TITLE</span>
              <span>ARTIST</span>
              <span className="text-center">KEY</span>
              <span className="text-center">BPM</span>
            </div>

            {DEMO_SONGS.map((song, i) => (
              <button
                key={song.slug}
                type="button"
                onClick={() => handleDemoClick(song)}
                className="demo-row w-full grid items-center px-4 py-4 text-left"
                style={{
                  gridTemplateColumns: "2rem 1fr 1fr 5rem 4rem",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  background: "transparent",
                }}
              >
                <span style={{ color: "rgba(190,160,230,0.35)", fontFamily: "'Courier Prime', monospace", fontSize: "13px" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: "15px", fontFamily: "'Lora', serif" }}>
                  {song.name}
                </span>
                <span style={{ color: "rgba(190,160,230,0.6)", fontFamily: "'Lora', serif", fontSize: "14px", fontStyle: "italic" }}>
                  {song.artist}
                </span>
                <span className="text-center" style={{ color: "rgba(190,160,230,0.7)", fontFamily: "'Courier Prime', monospace", fontSize: "13px" }}>
                  {song.key}
                </span>
                <span className="text-center" style={{ color: "rgba(190,160,230,0.7)", fontFamily: "'Courier Prime', monospace", fontSize: "13px" }}>
                  {song.bpm}
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
