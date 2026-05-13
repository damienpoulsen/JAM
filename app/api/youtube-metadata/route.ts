import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const YT_DLP = process.platform === "win32"
  ? "C:\\Users\\damie\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe"
  : "yt-dlp";

function runYtDlpJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP, [
      "--dump-json",
      "--skip-download",
      "--no-playlist",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      else {
        try { resolve(JSON.parse(stdout) as Record<string, unknown>); }
        catch { reject(new Error("Failed to parse yt-dlp output")); }
      }
    });
  });
}

// Strips common noise suffixes like "(Official Video)", "[Lyrics]", "(Remastered)", etc.
function cleanSongTitle(title: string): string {
  return title
    .replace(/\s*\((?:official\s*(?:video|audio|music\s*video|lyric[s]?|mv)?|lyric[s]?|audio|hd|4k|remaster(?:ed)?|live|explicit|clean)[^)]*\)\s*$/gi, "")
    .replace(/\s*\[(?:official\s*(?:video|audio|music\s*video|lyric[s]?|mv)?|lyric[s]?|audio|hd|4k|remaster(?:ed)?|live|explicit|clean)[^\]]*\]\s*$/gi, "")
    .trim();
}

// Splits "Artist - Song Name" patterns (handles —, –, -)
function parseTitle(title: string): { song_name: string; artist: string | null } {
  const match = title.match(/^(.+?)\s*[—–\-]\s*(.+)$/);
  if (match) {
    const [, left, right] = match;
    return { artist: left.trim(), song_name: cleanSongTitle(right.trim()) };
  }
  return { song_name: cleanSongTitle(title), artist: null };
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!url.includes("youtube.com/") && !url.includes("youtu.be/")) {
    return NextResponse.json({ error: "Not a YouTube URL" }, { status: 400 });
  }

  try {
    const meta = await runYtDlpJson(url);

    // YouTube Music / label-uploaded videos often have structured artist + track fields
    if (meta.artist && meta.track) {
      return NextResponse.json({
        song_name: String(meta.track),
        artist: String(meta.artist),
      });
    }

    // Fall back to parsing the video title
    const title = String(meta.title ?? "Unknown Track");
    const parsed = parseTitle(title);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
