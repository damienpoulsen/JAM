import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const YT_DLP = process.platform === "win32"
  ? "C:\\Users\\damie\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe"
  : "/opt/venv/bin/yt-dlp";

const ANALYSIS_SVC = (process.env.ANALYSIS_API_URL ?? "http://localhost:8001").replace(/\/$/, "");

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

async function getCookiesPath(uuid: string): Promise<string | null> {
  const tmpPath = join(tmpdir(), `yt-cookies-${uuid}.txt`);
  const renderPath = "/etc/secrets/yt-cookies.txt";
  try {
    await readFile(renderPath);
    await copyFile(renderPath, tmpPath);
    return tmpPath;
  } catch {}
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return null;
  await writeFile(tmpPath, cookies, "utf8");
  return tmpPath;
}

// yt-dlp: uses bgutil PO-token plugin automatically on Linux (Docker/Render).
// On Windows local dev, pulls cookies from Firefox since bgutil isn't running.
// If YOUTUBE_COOKIES env var is set, writes them to a temp file and passes via --cookies.
function runYtDlp(url: string, outTemplate: string, cookiesPath: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    // web client uses cookies for auth; android_vr bypasses bot detection without cookies
    const playerClients = cookiesPath ? "web,android,android_vr" : "android_vr,android,web";
    const args = [
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--no-warnings",
      "-o", outTemplate,
      "--no-playlist",
      "--extractor-args", `youtube:player_client=${playerClients}`,
    ];
    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    } else if (process.platform === "win32") {
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

// pytubefix fallback — completely different library running inside the Python analysis service.
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

  const uuid = randomUUID();
  const outBase = join(tmpdir(), `jam-yt-${uuid}`);
  const outTemplate = `${outBase}.%(ext)s`;
  const cookiesPath = await getCookiesPath(uuid).catch(() => null);
  process.stderr.write(`[extract-youtube] cookiesPath=${cookiesPath ?? "none"}\n`);

  // --- Try yt-dlp first ---
  let ytdlpError = "";
  try {
    await runYtDlp(url, outTemplate, cookiesPath);

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
    process.stderr.write(`[extract-youtube] yt-dlp failed, trying pytubefix. Error: ${ytdlpError}\n`);
  } finally {
    const entries = await readdir(tmpdir()).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((f) => f.startsWith(`jam-yt-${uuid}`) || f === `yt-cookies-${uuid}.txt`)
        .map((f) => unlink(join(tmpdir(), f)).catch(() => {})),
    );
  }

  // --- Fallback 1: pytubefix via analysis service ---
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
