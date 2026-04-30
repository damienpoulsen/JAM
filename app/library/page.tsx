"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type SongAnalysis, CURRENT_ANALYSIS_VERSION, saveSongAnalysis } from "../../lib/analysis";
import { type CommunityLong } from "../../lib/supabase";
import { readSongs, writeSongs } from "../../lib/songs";

export default function LibraryPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityLong[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch(`/api/community/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.songs ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleLoad = (song: CommunityLong) => {
    if (loadingId) return;
    setLoadingId(song.id);

    const id = crypto.randomUUID();
    const analysis = song.analysis_json as Omit<SongAnalysis, "songId">;

    saveSongAnalysis({
      songId: id,
      bpm: typeof analysis.bpm === "number" ? analysis.bpm : null,
      beatStartTime: typeof analysis.beatStartTime === "number" ? analysis.beatStartTime : null,
      detectedKey: typeof analysis.detectedKey === "string" ? analysis.detectedKey : null,
      chordEvents: Array.isArray(analysis.chordEvents) ? analysis.chordEvents : [],
      source: "ai",
      version: CURRENT_ANALYSIS_VERSION,
    });

    const songs = readSongs();
    writeSongs([
      ...songs,
      {
        id,
        fileId: id,
        name: song.artist ? `${song.song_name} — ${song.artist}` : song.song_name,
        key: song.key ?? "Unknown",
        bpm: song.bpm ?? 0,
        analysisStatus: "ready" as const,
        youtubeUrl: song.youtube_url ?? undefined,
      },
    ]);

    fetch("/api/community/play", { method: "POST", body: JSON.stringify({ id: song.id }), headers: { "Content-Type": "application/json" } }).catch(() => {});

    router.push(`/jam/${id}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
        .song-card { transition: background 0.14s, border-color 0.14s, transform 0.14s; }
        .song-card:hover { background: rgba(120,60,200,0.1) !important; border-color: rgba(160,100,255,0.55) !important; transform: translateY(-1px); }
        .back-link { transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
        .back-link:hover { transform: translateY(-2px); border-color: rgba(160,80,255,1) !important; box-shadow: 0 0 28px rgba(130,50,240,0.55), 0 0 55px rgba(130,50,240,0.25), 0 8px 24px rgba(0,0,0,0.5) !important; }
        .search-input:focus { outline: none; border-color: rgba(160,100,255,0.7) !important; box-shadow: 0 0 0 2px rgba(130,60,240,0.18) !important; }
      `}</style>

      <div className="relative h-screen overflow-hidden text-white" style={{ fontFamily: "'Lora', serif", background: "#070610" }}>

        {/* Atmospheric background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute" style={{ width: 900, height: 500, top: -250, left: -350, background: "radial-gradient(ellipse at 36% 40%, rgba(142,28,255,0.7) 0%, rgba(112,20,235,0.4) 28%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
          <div className="absolute" style={{ width: 900, height: 500, bottom: -250, right: -350, background: "radial-gradient(ellipse at 64% 60%, rgba(142,28,255,0.7) 0%, rgba(112,20,235,0.4) 28%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)", transform: "rotate(-25deg)" }} />
        </div>

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
                Song Library
              </h1>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.6)", letterSpacing: "0.14em", marginTop: 7 }}>
                COMMUNITY TRACKS
              </p>
            </div>
            <Link
              href="/"
              className="back-link flex items-center gap-2 rounded-lg px-5 py-2.5 mt-1"
              style={{ border: "1.5px solid rgba(130,60,220,0.65)", boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 0 28px rgba(110,40,210,0.25), 0 6px 20px rgba(0,0,0,0.5)", background: "rgba(10,6,22,0.85)", backdropFilter: "blur(10px)", fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "white", textDecoration: "none", flexShrink: 0 }}
            >
              ← HOME
            </Link>
          </div>

          {/* Search input */}
          <div className="relative mb-6">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(155,110,240,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <input
              className="search-input w-full rounded-xl pl-11 pr-4 py-3.5"
              style={{ background: "rgba(10,6,22,0.95)", border: "1.5px solid rgba(125,55,210,0.5)", color: "white", fontFamily: "'Lora', serif", fontSize: 16, transition: "border-color 0.18s, box-shadow 0.18s" }}
              placeholder="Search by song name or artist…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, letterSpacing: "0.18em", color: "rgba(165,118,248,0.55)" }}>SEARCHING…</div>
              </div>
            )}

            {!loading && hasSearched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div style={{ fontFamily: "'Lora', serif", fontSize: 18, color: "rgba(255,255,255,0.35)" }}>No songs found</div>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.14em", color: "rgba(165,118,248,0.4)" }}>Be the first to upload and contribute this one</div>
              </div>
            )}

            {!loading && !hasSearched && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div style={{ color: "rgba(155,110,240,0.3)" }}>
                  <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 18, color: "rgba(255,255,255,0.3)" }}>Search for a song to jam to</div>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.14em", color: "rgba(165,118,248,0.35)" }}>COMMUNITY ANALYSIS · INSTANT LOAD</div>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="flex flex-col gap-3">
                {results.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleLoad(song)}
                    disabled={loadingId === song.id}
                    className="song-card w-full text-left rounded-xl px-5 py-4 flex items-center gap-5"
                    style={{ background: "rgba(10,6,22,0.85)", border: "1px solid rgba(118,52,208,0.35)", cursor: loadingId === song.id ? "wait" : "pointer" }}
                  >
                    {/* Music icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(115,45,210,0.22)", border: "1px solid rgba(140,70,225,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="rgba(185,135,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {song.song_name}
                      </div>
                      {song.artist && (
                        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.65)", letterSpacing: "0.08em", marginTop: 3 }}>
                          {song.artist}
                        </div>
                      )}
                    </div>

                    {/* Key + BPM */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {song.key && (
                        <div className="text-center">
                          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: "rgba(185,145,255,0.9)" }}>{song.key}</div>
                          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.45)", marginTop: 1 }}>KEY</div>
                        </div>
                      )}
                      {song.bpm > 0 && (
                        <div className="text-center">
                          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: "rgba(185,145,255,0.9)" }}>{Math.round(song.bpm)}</div>
                          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(165,118,248,0.45)", marginTop: 1 }}>BPM</div>
                        </div>
                      )}
                      {song.youtube_url && (
                        <div style={{ color: "rgba(165,118,248,0.5)" }} title="YouTube audio available">
                          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                            <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2 .3 4.1.3 4.1s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.5 12 21.5 12 21.5s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.1v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z" />
                          </svg>
                        </div>
                      )}
                      {/* Load indicator */}
                      {loadingId === song.id ? (
                        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.14em", color: "rgba(165,118,248,0.7)" }}>LOADING…</div>
                      ) : (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="rgba(155,110,240,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
