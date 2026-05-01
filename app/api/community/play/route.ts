import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ ok: false });

  await supabase.rpc("increment_play_count", { song_id: id });
  return NextResponse.json({ ok: true });
}
