import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";

async function runExtraction(inputPath: string, outputPath: string): Promise<void> {
    const scriptPath = join(process.cwd(), "scripts", "analyze_song.py");
    const args = [
        scriptPath,
        "--song-id", "stems-only",
        "--audio-path", inputPath,
        "--extract-stems",
        "--output", outputPath,
    ];

    const commands = [["python", args], ["py", args]] as const;
    let lastError: Error | null = null;

    for (const [command, commandArgs] of commands) {
        try {
            await new Promise<void>((resolve, reject) => {
                const child = spawn(command, commandArgs, {
                    cwd: process.cwd(),
                    stdio: ["ignore", "pipe", "pipe"],
                });

                let stderr = "";
                child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
                child.on("error", reject);
                child.on("close", (code) => {
                    if (code !== 0) reject(new Error(stderr || `exited with code ${code}`));
                    else resolve();
                });
            });
            return;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error("Failed to run stem extractor");
}

export async function POST(request: Request) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        return Response.json({ error: "Missing audio file" }, { status: 400 });
    }

    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".mp3";
    const inputPath = join(tmpdir(), `jam-stems-in-${randomUUID()}${ext}`);
    const outputPath = join(tmpdir(), `jam-stems-out-${randomUUID()}.wav`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(inputPath, new Uint8Array(arrayBuffer));

        await runExtraction(inputPath, outputPath);

        const wavData = await readFile(outputPath);
        return new Response(wavData, {
            headers: { "Content-Type": "audio/wav" },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Stem extraction failed";
        return Response.json({ error: message }, { status: 500 });
    } finally {
        await Promise.all([
            unlink(inputPath).catch(() => undefined),
            unlink(outputPath).catch(() => undefined),
        ]);
    }
}
