import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ songs: [] });
  }

  // Split into words so "john mayer" matches artist:"John Mayer" or song:"John Mayer Blues"
  // Each word is OR-ed across both song_name and artist fields.
  const words = q.split(/\s+/).filter((w) => w.length >= 1);
  const conditions = words.flatMap((word) => [
    `song_name.ilike.%${word}%`,
    `artist.ilike.%${word}%`,
  ]);

  const { data, error } = await supabase
    .from("community_songs")
    .select("id, song_name, artist, youtube_url, key, bpm, analysis_json, created_at, play_count")
    .or(conditions.join(","))
    .order("play_count", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Supabase search error:", error);
    return NextResponse.json({ songs: [] }, { status: 500 });
  }

  return NextResponse.json({ songs: data ?? [] });
}
