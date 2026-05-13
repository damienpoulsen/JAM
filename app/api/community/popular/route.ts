import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("community_songs")
    .select("id, song_name, artist, youtube_url, key, bpm, analysis_json, created_at, play_count")
    .order("play_count", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Supabase popular error:", error);
    return NextResponse.json({ songs: [] });
  }

  return NextResponse.json({ songs: data ?? [] });
}
