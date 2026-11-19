import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file        = formData.get("file") as File | null;
    const electionId  = formData.get("election_id") as string | null;
    const stateCode   = formData.get("state_code") as string | null;
    const lgaName     = formData.get("lga_name") as string | null;
    const wardName    = formData.get("ward_name") as string | null;
    const puCode      = formData.get("pu_code") as string | null;
    const submittedBy = formData.get("submitted_by") as string | null;

    if (!file)       return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!electionId) return NextResponse.json({ error: "election_id required" }, { status: 400 });
    if (!stateCode)  return NextResponse.json({ error: "state_code required" }, { status: 400 });

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP or GIF allowed" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
    }

    // Build storage path: election_id/state_code/timestamp-filename
    const ext = file.name.split(".").pop() ?? "jpg";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${electionId}/${stateCode}/${Date.now()}-${safeName}`;

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from("result-sheets")
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (uploadErr) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // Create OCR queue entry
    const { data: job, error: queueErr } = await supabase
      .from("ocr_queue")
      .insert({
        storage_path: storagePath,
        file_name:    file.name,
        election_id:  electionId,
        state_code:   stateCode,
        lga_name:     lgaName || null,
        ward_name:    wardName || null,
        pu_code:      puCode || null,
        submitted_by: submittedBy || null,
        status:       "pending",
      })
      .select("id")
      .single();

    if (queueErr) {
      return NextResponse.json({ error: `Queue insert failed: ${queueErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, job_id: job.id, storage_path: storagePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
