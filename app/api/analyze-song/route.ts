import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";

type ScriptAnalysis = {
    songId: string;
    bpm: number | null;
    beatStartTime: number | null;
    detectedKey: string | null;
    chordEvents: { time: number; chord: string }[];
    source: "manual" | "ai";
    version: number;
};

async function runAnalyzer(
    songId: string,
    audioPath: string,
    options: {
        detectChords: boolean;
        skipBpm?: boolean;
    }
): Promise<ScriptAnalysis> {
    const scriptPath = join(process.cwd(), "scripts", "analyze_song.py");
    const baseArgs = [scriptPath, "--song-id", songId, "--audio-path", audioPath];
    const args = [...baseArgs];

    if (options.detectChords) {
        args.push("--detect-chords");
    }

    if (options.skipBpm) {
        args.push("--skip-bpm");
    }

    const commands = [
        ["python", args],
        ["py", args],
    ] as const;

    let lastError: Error | null = null;

    for (const [command, commandArgs] of commands) {
        try {
            const result = await new Promise<ScriptAnalysis>((resolve, reject) => {
                const child = spawn(command, commandArgs, {
                    cwd: process.cwd(),
                    stdio: ["ignore", "pipe", "pipe"],
                });

                let stdout = "";
                let stderr = "";

                child.stdout.on("data", (chunk: Buffer | string) => {
                    stdout += chunk.toString();
                });

                child.stderr.on("data", (chunk: Buffer | string) => {
                    stderr += chunk.toString();
                });

                child.on("error", reject);

                child.on("close", (code) => {
                    if (code !== 0) {
                        reject(new Error(stderr || `${command} exited with code ${code}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(stdout) as ScriptAnalysis);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error("Failed to run song analysis");
}

export async function POST(request: Request) {
    const formData = await request.formData();
    const songId = formData.get("songId");
    const file = formData.get("file");
    const detectChords = formData.get("detectChords") === "true";
    const skipBpm = formData.get("skipBpm") === "true";

    if (typeof songId !== "string" || !songId.trim()) {
        return Response.json({ error: "Missing songId" }, { status: 400 });
    }

    if (!(file instanceof File)) {
        return Response.json({ error: "Missing audio file" }, { status: 400 });
    }

    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".mp3";
    const tempFilePath = join(tmpdir(), `jam-analysis-${randomUUID()}${extension}`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(tempFilePath, new Uint8Array(arrayBuffer));

        const analysis = await runAnalyzer(songId, tempFilePath, {
            detectChords,
            skipBpm,
        });
        return Response.json(analysis);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to analyze song";
        return Response.json({ error: message }, { status: 500 });
    } finally {
        await unlink(tempFilePath).catch(() => undefined);
    }
}
