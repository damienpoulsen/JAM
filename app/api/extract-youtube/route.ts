import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const YT_DLP = process.platform === "win32"
  ? "C:\\Users\\damie\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe"
  : "/opt/venv/bin/yt-dlp";

const ANALYSIS_SVC = (process.env.ANALYSIS_API_URL ?? "http://localhost:8001").replace(/\/$/, "");

// Piped instances to try in order. Piped proxies streams through their own servers,
// bypassing YouTube's datacenter IP blocks entirely.
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
];

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  aac: "audio/aac",
};

function friendlyError(raw: string): string {
  if (/sign in|Please sign in/i.test(raw))
    return "This video is restricted and can't be downloaded. Try a different song.";
  if (/private video/i.test(raw))
    return "This video is private.";
  if (/video unavailable|not available/i.test(raw))
    return "This video is unavailable.";
  if (/age.restrict/i.test(raw))
    return "This video is age-restricted and can't be downloaded.";
  if (/copyright/i.test(raw))
    return "This video can't be downloaded due to copyright restrictions.";
  return "Couldn't extract audio from this YouTube video. Try a different link.";
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Piped is a YouTube proxy — streams route through their servers, not ours.
// No API key needed. Tries multiple instances for resilience.
async function downloadViaPiped(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Could not extract video ID from URL");

  let lastErr = "";
  for (const instance of PIPED_INSTANCES) {
    try {
      const metaRes = await fetch(`${instance}/streams/${videoId}`, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!metaRes.ok) { lastErr = `${instance} metadata ${metaRes.status}`; continue; }

      const meta = await metaRes.json() as {
        audioStreams?: Array<{ url: string; mimeType: string; bitrate: number }>;
        error?: string;
      };
      if (meta.error) { lastErr = meta.error; continue; }

      const streams = meta.audioStreams ?? [];
      if (!streams.length) { lastErr = "no audio streams"; continue; }

      const best = streams.sort((a, b) => b.bitrate - a.bitrate)[0];
      process.stderr.write(`[extract-youtube] piped: using ${instance}, mimeType=${best.mimeType}\n`);

      const audioRes = await fetch(best.url, { signal: AbortSignal.timeout(60000) });
      if (!audioRes.ok) { lastErr = `audio fetch ${audioRes.status}`; continue; }

      const buffer = await audioRes.arrayBuffer();
      const contentType = best.mimeType?.split(";")[0] ?? "audio/webm";
      return { buffer, contentType };
    } catch (e) {
      lastErr = String(e);
    }
  }
  throw new Error(`All Piped instances failed: ${lastErr}`);
}

function runYtDlp(url: string, outTemplate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--no-warnings",
      "-o", outTemplate,
      "--no-playlist",
    ];
    if (process.platform === "win32") {
      args.push("--cookies-from-browser", "firefox");
    }
    args.push(url);

    const child = spawn(YT_DLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[yt-dlp] ${text}`);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr));
      else resolve();
    });
  });
}

async function downloadViaPytubefix(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const fd = new FormData();
  fd.append("url", url);
  const res = await fetch(`${ANALYSIS_SVC}/download-youtube`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? "pytubefix download failed");
  }
  const contentType = res.headers.get("content-type") ?? "audio/mp4";
  const buffer = await res.arrayBuffer();
  return { buffer, contentType };
}


export async function POST(req: NextRequest) {
  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { url } = body;
  if (!url || typeof url !== "string")
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  if (!url.includes("youtube.com/") && !url.includes("youtu.be/"))
    return NextResponse.json({ error: "Not a YouTube URL" }, { status: 400 });

  // --- Try Piped first (proxies streams through their servers, no Render IP block) ---
  try {
    const { buffer, contentType } = await downloadViaPiped(url);
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("mpeg") ? "mp3" : "m4a";
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="track.${ext}"` },
    });
  } catch (pipedErr) {
    process.stderr.write(`[extract-youtube] piped failed: ${pipedErr}\n`);
  }

  // --- Fallback: yt-dlp (works locally, blocked on Render) ---
  const uuid = randomUUID();
  const outBase = join(tmpdir(), `jam-yt-${uuid}`);
  const outTemplate = `${outBase}.%(ext)s`;
  let ytdlpError = "";
  try {
    await runYtDlp(url, outTemplate);
    const entries = await readdir(tmpdir());
    const filename = entries.find(
      (f) => f.startsWith(`jam-yt-${uuid}`) && !f.endsWith(".part") && !f.endsWith(".ytdl"),
    );
    if (filename) {
      const outPath = join(tmpdir(), filename);
      const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? "audio/mpeg";
      const audioBuffer = await readFile(outPath);
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="track.${ext}"`,
        },
      });
    }
  } catch (err) {
    ytdlpError = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[extract-youtube] yt-dlp failed: ${ytdlpError}\n`);
  } finally {
    const entries = await readdir(tmpdir()).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((f) => f.startsWith(`jam-yt-${uuid}`))
        .map((f) => unlink(join(tmpdir(), f)).catch(() => {})),
    );
  }

  // --- Last resort: pytubefix ---
  try {
    const { buffer, contentType } = await downloadViaPytubefix(url);
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("mpeg") ? "mp3" : "m4a";
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="track.${ext}"` },
    });
  } catch (pytErr) {
    process.stderr.write(`[extract-youtube] pytubefix failed: ${pytErr}\n`);
  }

  return NextResponse.json({ error: friendlyError(ytdlpError) }, { status: 500 });
}
