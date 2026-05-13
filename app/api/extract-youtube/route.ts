import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const YT_DLP = process.platform === "win32"
  ? "C:\\Users\\damie\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe"
  : "/opt/venv/bin/yt-dlp";

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  aac: "audio/aac",
};

function friendlyError(raw: string): string {
  if (/sign in|Please sign in|cookies/i.test(raw))
    return "This video is restricted and can't be downloaded. Try a different song.";
  if (/private video/i.test(raw))
    return "This video is private.";
  if (/video unavailable|not available/i.test(raw))
    return "This video is unavailable.";
  if (/age.restrict|age-restrict/i.test(raw))
    return "This video is age-restricted and can't be downloaded.";
  if (/copyright/i.test(raw))
    return "This video can't be downloaded due to copyright restrictions.";
  return "Couldn't extract audio from this YouTube video. Try a different link.";
}

async function getCookiesPath(): Promise<string | null> {
  // Render Secret Files land at /etc/secrets/<filename>
  const renderPath = "/etc/secrets/yt-cookies.txt";
  try {
    await readFile(renderPath);
    return renderPath;
  } catch {}
  // Fallback: YOUTUBE_COOKIES env var written to a temp file
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return null;
  const path = join(tmpdir(), "yt-cookies.txt");
  await writeFile(path, cookies, "utf8");
  return path;
}

// With cookies: use web (fully authenticated). Without: tv_embedded is most permissive.
const CLIENTS_WITH_COOKIES = ["web", "ios"];
const CLIENTS_NO_COOKIES    = ["tv_embedded", "ios", "mweb"];

function runYtDlpWithClient(
  url: string,
  outTemplate: string,
  cookiesPath: string | null,
  client: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--extractor-args", `youtube:player_client=${client}`,
      "--no-warnings",
      "-o", outTemplate,
      "--no-playlist",
    ];
    if (cookiesPath) args.push("--cookies", cookiesPath);
    args.push(url);

    const child = spawn(YT_DLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[yt-dlp:${client}] ${text}`);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr));
      else resolve(stderr);
    });
  });
}

async function runYtDlp(url: string, outTemplate: string, cookiesPath: string | null): Promise<void> {
  let lastStderr = "";
  const clients = cookiesPath ? CLIENTS_WITH_COOKIES : CLIENTS_NO_COOKIES;
  for (const client of clients) {
    try {
      await runYtDlpWithClient(url, outTemplate, cookiesPath, client);
      return;
    } catch (err) {
      lastStderr = err instanceof Error ? err.message : String(err);
      // Don't retry if the video is genuinely unavailable/private — only retry auth errors.
      if (!/sign in|Please sign in|cookies|bot/i.test(lastStderr)) break;
    }
  }
  throw new Error(friendlyError(lastStderr));
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

  const uuid = randomUUID();
  const outBase = join(tmpdir(), `jam-yt-${uuid}`);
  const outTemplate = `${outBase}.%(ext)s`;
  const cookiesPath = await getCookiesPath().catch(() => null);

  try {
    await runYtDlp(url, outTemplate, cookiesPath);

    const entries = await readdir(tmpdir());
    const filename = entries.find(
      (f) => f.startsWith(`jam-yt-${uuid}`) && !f.endsWith(".part") && !f.endsWith(".ytdl"),
    );
    if (!filename) throw new Error("Couldn't extract audio from this YouTube video. Try a different link.");

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't extract audio from this YouTube video. Try a different link.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    const entries = await readdir(tmpdir()).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((f) => f.startsWith(`jam-yt-${uuid}`))
        .map((f) => unlink(join(tmpdir(), f)).catch(() => {})),
    );
  }
}
