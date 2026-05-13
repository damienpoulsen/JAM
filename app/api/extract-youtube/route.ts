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
  : "yt-dlp";

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  aac: "audio/aac",
};

function runYtDlp(url: string, outTemplate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP, [
      // Select audio-only stream directly — no post-processing, no ffmpeg required.
      // Prefer m4a (AAC) for broad browser/Safari compatibility; fall back to best audio.
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "-o", outTemplate,
      "--no-playlist",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      else resolve();
    });
  });
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
  // %(ext)s in the template lets yt-dlp append the actual format extension.
  const outTemplate = `${outBase}.%(ext)s`;

  let outPath: string | null = null;
  try {
    await runYtDlp(url, outTemplate);

    // Locate the file yt-dlp wrote (it appends the real extension).
    const entries = await readdir(tmpdir());
    const filename = entries.find(
      (f) => f.startsWith(`jam-yt-${uuid}`) && !f.endsWith(".part") && !f.endsWith(".ytdl"),
    );
    if (!filename) throw new Error("yt-dlp did not produce an output file");

    outPath = join(tmpdir(), filename);
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
    const message = err instanceof Error ? err.message : "Failed to extract audio";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up the output file and any leftover temp files for this uuid.
    const entries = await readdir(tmpdir()).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((f) => f.startsWith(`jam-yt-${uuid}`))
        .map((f) => unlink(join(tmpdir(), f)).catch(() => {})),
    );
  }
}
