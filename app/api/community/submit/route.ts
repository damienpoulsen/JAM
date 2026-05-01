import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { song_name, artist, youtube_url, key, bpm, analysis_json } = body as Record<string, unknown>;

  if (!song_name || typeof song_name !== "string" || !song_name.trim()) {
    return NextResponse.json({ error: "song_name is required" }, { status: 400 });
  }
  if (!analysis_json) {
    return NextResponse.json({ error: "analysis_json is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("community_songs")
    .insert({
      song_name: String(song_name).trim(),
      artist: artist ? String(artist).trim() : null,
      youtube_url: youtube_url ? String(youtube_url).trim() : null,
      key: key ? String(key).trim() : null,
      bpm: typeof bpm === "number" ? bpm : null,
      analysis_json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
