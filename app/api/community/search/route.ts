import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ songs: [] });
  }

  const { data, error } = await supabase
    .from("community_songs")
    .select("id, song_name, artist, youtube_url, key, bpm, analysis_json, created_at, play_count")
    .or(`song_name.ilike.%${q}%,artist.ilike.%${q}%`)
    .order("play_count", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Supabase search error:", error);
    return NextResponse.json({ songs: [] }, { status: 500 });
  }

  return NextResponse.json({ songs: data ?? [] });
}
