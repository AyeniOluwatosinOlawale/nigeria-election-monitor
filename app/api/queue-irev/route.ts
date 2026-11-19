import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface QueueEntry {
  image_url: string;
  election_id: string;
  state_code: string;
  lga_name?: string;
  ward_name?: string;
  pu_code?: string;
  pu_name?: string;
}

export async function POST(req: NextRequest) {
  // Simple shared secret to prevent abuse
  const secret = req.headers.get("x-queue-secret");
  if (secret !== process.env.IREV_QUEUE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries: QueueEntry[] = Array.isArray(body) ? body : [body as QueueEntry];

  if (entries.length === 0) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 });
  }
  if (entries.length > 500) {
    return NextResponse.json({ error: "Max 500 entries per request" }, { status: 400 });
  }

  const rows = entries.map((e) => ({
    image_url:   e.image_url,
    election_id: e.election_id,
    state_code:  e.state_code,
    lga_name:    e.lga_name   ?? null,
    ward_name:   e.ward_name  ?? null,
    pu_code:     e.pu_code    ?? null,
    file_name:   e.pu_name    ?? null,
    status:      "pending",
  }));

  const invalid = rows.filter((r) => !r.image_url || !r.election_id || !r.state_code);
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Each entry needs image_url, election_id, and state_code", invalid_count: invalid.length },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("ocr_queue")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[queue-irev] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queued: data?.length ?? 0 });
}
