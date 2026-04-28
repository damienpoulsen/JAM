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
    if (found) { router.push(`/jam/${found.id}`); return; }

    const id = crypto.randomUUID();
    try {
      const res = await fetch(`/demos/analysis/${demo.slug}.json`);
      if (res.ok) {
        const analysis = await res.json() as SongAnalysis;
        saveSongAnalysis({ ...analysis, songId: id });
      }
    } catch {}

    const song: Song = { id, fileId: id, name: demo.name, key: demo.key, bpm: demo.bpm, analysisStatus: "ready" };
    writeSongs([song, ...existing]);

    try {
      const res = await fetch(`/demos/${demo.slug}.mp3`);
      if (res.ok) {
        const blob = await res.blob();
        await saveFile(id, new File([blob], `${demo.name}.mp3`, { type: "audio/mpeg" }));
      }
    } catch {}

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

        .track-row {
          transition: background 0.12s;
        }
        .track-row:hover {
          background: rgba(120,60,200,0.055) !important;
        }
        .nav-link {
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .nav-link:hover {
          transform: translateY(-2px);
          border-color: rgba(160,80,255,1) !important;
          box-shadow: 0 0 28px rgba(130,50,240,0.55), 0 0 55px rgba(130,50,240,0.25), 0 8px 24px rgba(0,0,0,0.5) !important;
        }
      `}</style>

      <div
        className="relative h-screen overflow-hidden text-white"
        style={{ fontFamily: "'Lora', serif", background: "#070610" }}
      >

        <div className="relative mx-auto max-w-4xl px-5 pt-10 pb-20 h-full flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div style={{ height: 1, width: 32, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.55))" }} />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", color: "rgba(160,120,220,0.7)" }}>JAM</span>
                <div style={{ height: 1, width: 32, background: "linear-gradient(to left, transparent, rgba(120,60,200,0.55))" }} />
              </div>
              <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: "clamp(28px, 5vw, 42px)", color: "#ffffff", margin: 0, lineHeight: 1.1 }}>
                Demo Tracks
              </h1>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.6)", letterSpacing: "0.14em", marginTop: 7 }}>
                CLICK ANY TO OPEN IN JAM
              </p>
            </div>

            <div className="flex items-center gap-3 mt-1 shrink-0">
              <input type="file" accept=".mp3" id="ownUpload" className="hidden" onChange={handleUpload} />
              <label
                htmlFor="ownUpload"
                className="nav-link cursor-pointer flex items-center gap-2 rounded-lg px-5 py-2.5"
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
                }}
              >
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" />
                </svg>
                UPLOAD
              </label>

              <Link
                href="/"
                className="nav-link flex items-center gap-2 rounded-lg px-5 py-2.5"
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
                }}
              >
                ← HOME
              </Link>
            </div>
          </div>

          {/* Track list container */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ background: "rgba(22,18,34,0.92)", border: "1px solid rgba(118,52,208,0.48)", borderRadius: 12 }}>

            {/* Column headers */}
            <div
              className="flex items-center px-4 pt-3 pb-2 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span style={{ width: 28, fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(165,118,248,0.4)" }}>#</span>
              <span style={{ width: 40, marginRight: 12, flexShrink: 0 }} />
              <span className="flex-1" style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(165,118,248,0.4)" }}>TITLE</span>
              <div
                className="flex items-center shrink-0"
                style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(165,118,248,0.4)" }}
              >
                <span style={{ width: 72, textAlign: "center" }}>KEY</span>
                <span style={{ width: 60, textAlign: "center" }}>BPM</span>
              </div>
            </div>

            {/* Scrollable rows */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {DEMO_SONGS.map((song, i) => (
                <button
                  key={song.slug}
                  type="button"
                  onClick={() => handleDemoClick(song)}
                  className="track-row w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {/* Index */}
                  <span style={{ width: 28, flexShrink: 0, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "rgba(165,118,248,0.35)", textAlign: "center" }}>
                    {i + 1}
                  </span>

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

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "#ffffff" }}>
                      {song.name}
                    </div>
                    <div className="truncate" style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(165,118,248,0.5)", fontStyle: "italic", marginTop: 2 }}>
                      {song.artist}
                    </div>
                  </div>

                  {/* Key + BPM */}
                  <div
                    className="shrink-0 flex"
                    style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, color: "rgba(255,255,255,0.82)" }}
                  >
                    <span style={{ width: 72, textAlign: "center" }}>{song.key}</span>
                    <span style={{ width: 60, textAlign: "center" }}>{song.bpm}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
