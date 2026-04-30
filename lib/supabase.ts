import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);

export type CommunityLong = {
  id: string;
  song_name: string;
  artist: string;
  youtube_url: string | null;
  key: string;
  bpm: number;
  analysis_json: unknown;
  created_at: string;
  play_count: number;
};
