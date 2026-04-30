import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function runYtDlp(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "5",
      "-o", outPath,
      "--no-playlist",
      url,
    ]);
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

  const outPath = join(tmpdir(), `jam-yt-${randomUUID()}.mp3`);

  try {
    await runYtDlp(url, outPath);
    const audioBuffer = await readFile(outPath);
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="track.mp3"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract audio";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await unlink(outPath).catch(() => {});
  }
}
