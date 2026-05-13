"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CURRENT_ANALYSIS_VERSION, saveSongAnalysis, type SongAnalysis } from "../../lib/analysis";
import { type CommunityLong } from "../../lib/supabase";
import { readSongs, writeSongs } from "../../lib/songs";

// ─── Utilities ────────────────────────────────────────────────────────────────

function ytThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function fmtPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CARD_GRADS = [
  "linear-gradient(145deg,#1e0845 0%,#3d1070 100%)",
  "linear-gradient(145deg,#06101e 0%,#102050 100%)",
  "linear-gradient(145deg,#150828 0%,#4a1080 100%)",
  "linear-gradient(145deg,#0a0820 0%,#280a55 100%)",
  "linear-gradient(145deg,#1a0530 0%,#550d8a 100%)",
];
function cardGrad(id: string) { return CARD_GRADS[id.charCodeAt(0) % CARD_GRADS.length]; }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [popular, setPopular] = useState<CommunityLong[]>([]);
  const [recent, setRecent] = useState<CommunityLong[]>([]);
  const [searchResults, setSearchResults] = useState<CommunityLong[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<"popular" | "recent">("popular");
  const [showAddModal, setShowAddModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchLists = () => {
    setPageLoading(true);
    Promise.all([
      fetch("/api/community/popular").then((r) => r.json()).catch(() => ({ songs: [] })),
      fetch("/api/community/recent").then((r) => r.json()).catch(() => ({ songs: [] })),
    ]).then(([p, r]) => {
      setPopular((p as { songs: CommunityLong[] }).songs ?? []);
      setRecent((r as { songs: CommunityLong[] }).songs ?? []);
    }).finally(() => setPageLoading(false));
  };

  // Load popular + recent on mount
  useEffect(() => { fetchLists(); }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); setHasSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch(`/api/community/search?q=${encodeURIComponent(q)}`);
        const data = await res.json() as { songs: CommunityLong[] };
        setSearchResults(data.songs ?? []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleLoad = (song: CommunityLong) => {
    if (loadingId) return;
    setLoadingId(song.id);
    const id = crypto.randomUUID();
    const a = song.analysis_json as Omit<SongAnalysis, "songId">;
    saveSongAnalysis({
      songId: id,
      bpm: typeof a.bpm === "number" ? a.bpm : null,
      beatStartTime: typeof a.beatStartTime === "number" ? a.beatStartTime : null,
      detectedKey: typeof a.detectedKey === "string" ? a.detectedKey : null,
      chordEvents: Array.isArray(a.chordEvents) ? a.chordEvents : [],
      source: "ai",
      version: CURRENT_ANALYSIS_VERSION,
    });
    writeSongs([...readSongs(), {
      id, fileId: id,
      name: song.artist ? `${song.song_name} — ${song.artist}` : song.song_name,
      key: song.key ?? "Unknown",
      bpm: song.bpm ?? 0,
      analysisStatus: "ready" as const,
      youtubeUrl: song.youtube_url ?? undefined,
    }]);
    fetch("/api/community/play", {
      method: "POST",
      body: JSON.stringify({ id: song.id }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
    router.push(`/jam/${id}/prepare`);
  };

  const scrollToSection = (section: "popular" | "recent") => {
    setActiveNav(section);
    const ref = section === "popular" ? popularRef : recentRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isSearching = query.trim().length > 0;

  // ─── Card renderers (inlined to avoid nested component issues) ─────────────

  const renderTopCard = (song: CommunityLong, rank: number) => {
    const thumb = ytThumb(song.youtube_url);
    const isLoading = loadingId === song.id;
    return (
      <button
        key={song.id}
        onClick={() => handleLoad(song)}
        disabled={!!loadingId}
        className="top-card"
        style={{
          width: 170, minWidth: 170, borderRadius: 14,
          background: "rgba(12,8,28,0.95)",
          border: "1px solid rgba(118,52,208,0.3)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          overflow: "hidden", cursor: loadingId ? "wait" : "pointer",
          textAlign: "left", padding: 0, flexShrink: 0,
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: "relative", height: 120, background: cardGrad(song.id), overflow: "hidden" }}>
          {thumb && (
            <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {/* Rank badge */}
          <div style={{
            position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: "50%",
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, color: "white",
          }}>
            {rank}
          </div>
          {/* Play overlay */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(to top, rgba(0,0,0,0.58) 0%, transparent 60%)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)",
              border: "1.5px solid rgba(255,255,255,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isLoading ? (
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg viewBox="0 0 24 24" width={14} height={14} fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </div>
          </div>
        </div>
        {/* Info */}
        <div style={{ padding: "10px 12px 12px" }}>
          <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {song.song_name}
          </div>
          {song.artist && (
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.7)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {song.artist}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg viewBox="0 0 24 24" width={10} height={10} fill="rgba(165,118,248,0.65)">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(165,118,248,0.6)", letterSpacing: "0.04em" }}>
              {fmtPlays(song.play_count)} plays
            </span>
          </div>
        </div>
      </button>
    );
  };

  const renderGridCard = (song: CommunityLong) => {
    const thumb = ytThumb(song.youtube_url);
    const isLoading = loadingId === song.id;
    return (
      <button
        key={song.id}
        onClick={() => handleLoad(song)}
        disabled={!!loadingId}
        className="grid-card"
        style={{
          borderRadius: 14, background: "rgba(10,6,22,0.92)",
          border: "1px solid rgba(118,52,208,0.28)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          overflow: "hidden", cursor: loadingId ? "wait" : "pointer",
          textAlign: "left", padding: 0,
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: "relative", height: 130, background: cardGrad(song.id), overflow: "hidden" }}>
          {thumb && (
            <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {/* Play overlay */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.14)", backdropFilter: "blur(4px)",
              border: "1.5px solid rgba(255,255,255,0.24)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isLoading ? (
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </div>
          </div>
        </div>
        {/* Info */}
        <div style={{ padding: "11px 13px 13px" }}>
          <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {song.song_name}
          </div>
          {song.artist && (
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.7)", marginBottom: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {song.artist}
            </div>
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}>
            {song.key && (
              <span style={{ padding: "2px 7px", borderRadius: 4, background: "rgba(115,45,210,0.2)", border: "1px solid rgba(140,70,225,0.3)", fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(185,145,255,0.9)" }}>
                {song.key}
              </span>
            )}
            {song.bpm > 0 && (
              <span style={{ padding: "2px 7px", borderRadius: 4, background: "rgba(115,45,210,0.2)", border: "1px solid rgba(140,70,225,0.3)", fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(185,145,255,0.9)" }}>
                {Math.round(song.bpm)} BPM
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(165,118,248,0.38)", letterSpacing: "0.06em" }}>
            Added {timeAgo(song.created_at)}
          </div>
        </div>
      </button>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
        .top-card { transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s; }
        .top-card:not(:disabled):hover { transform: translateY(-4px); border-color: rgba(160,100,255,0.65) !important; box-shadow: 0 14px 40px rgba(0,0,0,0.65), 0 0 28px rgba(120,50,220,0.28) !important; }
        .grid-card { transition: transform 0.14s, border-color 0.14s; }
        .grid-card:not(:disabled):hover { transform: translateY(-2px); border-color: rgba(160,100,255,0.55) !important; }
        .nav-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .nav-btn:hover { background: rgba(120,50,200,0.18) !important; }
        .nav-btn.active { background: rgba(130,60,220,0.22) !important; border-color: rgba(155,90,255,0.5) !important; color: rgba(210,180,255,0.95) !important; }
        .search-input:focus { outline: none; border-color: rgba(160,100,255,0.7) !important; box-shadow: 0 0 0 3px rgba(130,60,240,0.13) !important; }
        .scrollbar-hide { scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.28s ease forwards; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Lora', serif", background: "#070610", color: "white", position: "relative" }}>

        {/* Atmospheric glows */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 650, height: 380, top: -190, left: -220, background: "radial-gradient(ellipse, rgba(125,18,240,0.52) 0%, rgba(95,12,210,0.26) 42%, transparent 72%)", filter: "blur(78px)" }} />
          <div style={{ position: "absolute", width: 650, height: 380, bottom: -190, right: -220, background: "radial-gradient(ellipse, rgba(125,18,240,0.42) 0%, rgba(95,12,210,0.2) 42%, transparent 72%)", filter: "blur(78px)" }} />
        </div>

        {/* ─── Left Sidebar ──────────────────────────────────────────────────── */}
        <aside style={{
          position: "relative", zIndex: 10, width: 210, flexShrink: 0,
          background: "rgba(7,5,18,0.94)", borderRight: "1px solid rgba(118,52,208,0.18)",
          display: "flex", flexDirection: "column", padding: "24px 0 20px",
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", padding: "0 20px 24px", display: "block" }}>
            <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 30, color: "white", lineHeight: 1 }}>JAM</div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.28em", color: "rgba(160,118,248,0.58)", marginTop: 3 }}>SEE THE MUSIC</div>
          </Link>

          <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.28), transparent)", margin: "0 16px 16px" }} />

          {/* Nav */}
          <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "0 10px" }}>
            {([
              {
                id: "popular" as const, label: "Popular",
                icon: <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>,
              },
              {
                id: "recent" as const, label: "Recently Added",
                icon: <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
              },
            ]).map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`nav-btn${activeNav === item.id ? " active" : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, background: "transparent", border: "1px solid transparent",
                  cursor: "pointer", color: "rgba(160,118,248,0.52)",
                  fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.1em", textAlign: "left", width: "100%",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(120,60,200,0.28), transparent)", margin: "12px 16px" }} />

          {/* Add YouTube button */}
          <div style={{ padding: "0 10px" }}>
            <button
              onClick={() => setShowAddModal(true)}
              className="nav-btn"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, background: "transparent", border: "1px solid rgba(120,60,200,0.35)",
                cursor: "pointer", color: "rgba(185,145,255,0.75)",
                fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.1em", width: "100%",
              }}
            >
              <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
              Add YouTube
            </button>
          </div>
        </aside>

        {/* ─── Main Content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 5 }}>

          {/* Sticky header + search */}
          <div style={{
            padding: "18px 28px 16px", flexShrink: 0,
            background: "rgba(7,6,16,0.9)", backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(118,52,208,0.14)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 24, color: "white", margin: 0, lineHeight: 1.1 }}>
                  Community Songs
                </h1>
                <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.16em", color: "rgba(160,118,248,0.5)", margin: "4px 0 0" }}>
                  EXPLORE SONGS ADDED BY THE JAM COMMUNITY
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={fetchLists}
                  title="Refresh"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, borderRadius: 9,
                    background: "rgba(10,6,22,0.9)", border: "1.5px solid rgba(118,52,208,0.45)",
                    cursor: "pointer", color: "rgba(160,118,248,0.7)",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                  </svg>
                </button>
                <Link
                  href="/songs"
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                    borderRadius: 10, background: "rgba(10,6,22,0.9)",
                    border: "1.5px solid rgba(130,60,220,0.58)",
                    boxShadow: "0 0 12px rgba(110,40,210,0.38), 0 4px 16px rgba(0,0,0,0.4)",
                    fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700,
                    letterSpacing: "0.1em", color: "white", textDecoration: "none",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                >
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Song Demos
                </Link>
              </div>
            </div>

            {/* Search bar */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="rgba(155,110,240,0.58)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                className="search-input"
                style={{
                  width: "100%", paddingLeft: 42, paddingRight: query ? 40 : 16,
                  paddingTop: 11, paddingBottom: 11,
                  borderRadius: 12, background: "rgba(13,8,30,0.95)",
                  border: "1.5px solid rgba(125,55,210,0.42)", color: "white",
                  fontFamily: "'Lora', serif", fontSize: 15,
                  transition: "border-color 0.18s, box-shadow 0.18s", boxSizing: "border-box",
                }}
                placeholder="Search songs or artists…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); searchInputRef.current?.focus(); }}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(160,118,248,0.5)", padding: 4, display: "flex",
                  }}
                >
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="scrollbar-hide" style={{ flex: 1, overflowY: "auto", padding: "28px 28px 48px" }}>

            {pageLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.22em", color: "rgba(160,118,248,0.48)" }}>LOADING…</div>
              </div>

            ) : isSearching ? (
              /* ─── Search Results ─── */
              <div className="fade-up">
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
                  <h2 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 18, color: "white", margin: 0 }}>
                    {searchLoading ? "Searching…" : `"${query.trim()}"`}
                  </h2>
                  {!searchLoading && hasSearched && (
                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: "rgba(160,118,248,0.48)", letterSpacing: "0.12em" }}>
                      {searchResults.length} FOUND
                    </span>
                  )}
                </div>

                {searchLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, letterSpacing: "0.22em", color: "rgba(160,118,248,0.48)" }}>SEARCHING…</div>
                  </div>
                ) : !searchLoading && hasSearched && searchResults.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 220, gap: 12 }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 17, color: "rgba(255,255,255,0.32)", fontStyle: "italic" }}>No songs found</div>
                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(160,118,248,0.38)" }}>BE THE FIRST TO CONTRIBUTE THIS ONE</div>
                    <button
                      onClick={() => setShowAddModal(true)}
                      style={{
                        marginTop: 6, padding: "8px 16px", borderRadius: 8,
                        background: "rgba(10,6,22,0.9)", border: "1.5px solid rgba(130,60,220,0.55)",
                        color: "rgba(185,145,255,0.85)", fontFamily: "'Courier Prime', monospace",
                        fontSize: 11, letterSpacing: "0.12em", cursor: "pointer", fontWeight: 700,
                      }}
                    >
                      + ADD YOUTUBE LINK
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 14 }}>
                    {searchResults.map(renderGridCard)}
                  </div>
                )}
              </div>

            ) : (
              /* ─── Default: Popular + Recent ─── */
              <>
                {/* Top Songs */}
                <div ref={popularRef} style={{ marginBottom: 44 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <h2 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 20, color: "white", margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
                      Top Songs
                      <span style={{ fontSize: 19 }}>🔥</span>
                    </h2>
                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(160,118,248,0.5)" }}>
                      MOST PLAYED
                    </span>
                  </div>

                  {popular.length === 0 ? (
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(255,255,255,0.28)", fontStyle: "italic", padding: "16px 0" }}>
                      No songs yet — be the first to add one!
                    </div>
                  ) : (
                    <div className="scrollbar-hide" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
                      {popular.map((song, i) => renderTopCard(song, i + 1))}
                    </div>
                  )}
                </div>

                {/* Recently Added */}
                <div ref={recentRef} style={{ marginBottom: 44 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <h2 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 20, color: "white", margin: 0 }}>
                      Recently Added
                    </h2>
                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(160,118,248,0.5)" }}>
                      LATEST CONTRIBUTIONS
                    </span>
                  </div>

                  {recent.length === 0 ? (
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(255,255,255,0.28)", fontStyle: "italic", padding: "16px 0" }}>
                      No songs yet — add a YouTube link to get started!
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 14 }}>
                      {recent.map(renderGridCard)}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        </div>
      </div>

    </>
  );
}
