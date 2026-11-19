/**
 * OCR Worker — processes the ocr_queue table using Claude Vision via OpenRouter.
 * Deploy on Railway as an always-on worker (not a web service).
 *
 * Required env vars:
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (can read storage + write DB)
 *   OPENROUTER_API_KEY        — your OpenRouter API key
 *   OPENROUTER_MODEL          — model to use (default: anthropic/claude-haiku-4-5)
 *   WORKER_CONCURRENCY        — max simultaneous Claude calls (default: 8)
 *   POLL_INTERVAL_MS          — ms between polls (default: 3000)
 *
 * IMPORTANT: Run supabase/ocr_rpc.sql in Supabase SQL Editor before deploying.
 * That file creates the upsert_ocr_state_result, upsert_ocr_lga_result, and
 * upsert_ocr_pu_result functions required for atomic vote accumulation.
 */

const { createClient } = require("@supabase/supabase-js");

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY       = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL         = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";
const CONCURRENCY              = parseInt(process.env.WORKER_CONCURRENCY ?? "8", 10);
const POLL_INTERVAL_MS         = parseInt(process.env.POLL_INTERVAL_MS ?? "3000", 10);
const MAX_RETRIES              = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENROUTER_API_KEY) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Nigeria geo lookups ──────────────────────────────────────────────────────

const STATE_ZONES = {
  AB: "SE", AN: "SE", EB: "SE", EN: "SE", IM: "SE",
  AK: "SS", BY: "SS", CR: "SS", DL: "SS", ED: "SS", RV: "SS",
  BE: "NC", FC: "NC", KO: "NC", KW: "NC", NA: "NC", NI: "NC", PL: "NC",
  EK: "SW", LA: "SW", OG: "SW", ON: "SW", OS: "SW", OY: "SW",
  AD: "NE", BA: "NE", BO: "NE", GO: "NE", TA: "NE", YO: "NE",
  JI: "NW", KD: "NW", KN: "NW", KT: "NW", KB: "NW", SO: "NW", ZA: "NW",
};

const STATE_NAMES = {
  AB: "Abia",        AD: "Adamawa",     AK: "Akwa Ibom",  AN: "Anambra",
  BA: "Bauchi",      BY: "Bayelsa",     BE: "Benue",      BO: "Borno",
  CR: "Cross River", DL: "Delta",       EB: "Ebonyi",     ED: "Edo",
  EK: "Ekiti",       EN: "Enugu",       FC: "FCT Abuja",  GO: "Gombe",
  IM: "Imo",         JI: "Jigawa",      KD: "Kaduna",     KN: "Kano",
  KT: "Katsina",     KB: "Kebbi",       KO: "Kogi",       KW: "Kwara",
  LA: "Lagos",       NA: "Nasarawa",    NI: "Niger",      OG: "Ogun",
  ON: "Ondo",        OS: "Osun",        OY: "Oyo",        PL: "Plateau",
  RV: "Rivers",      SO: "Sokoto",      TA: "Taraba",     YO: "Yobe",
  ZA: "Zamfara",
};

// ─── OCR prompt ───────────────────────────────────────────────────────────────

const OCR_SYSTEM_PROMPT = `You are an election result sheet OCR expert for Nigerian INEC elections.
Extract all party names and their vote counts from the result sheet image.

Return ONLY valid JSON in this exact shape:
{
  "party_results": [{"party": "APC", "votes": 1234}],
  "accredited_voters": 5000,
  "polling_unit": "WARD 01 PU 003 GOVERNMENT PRIMARY SCHOOL",
  "lga": "Ikeja",
  "state": "Lagos",
  "ward": "IKEJA WARD 01"
}

Rules:
- Use official party abbreviations (APC, PDP, LP, NNPP, ADC, APGA, etc.)
- votes must be integers
- Include ALL parties on the sheet, even those with 0 votes
- If a field is not visible, use null
- Never fabricate or infer data — only extract what is clearly visible`;

// ─── OpenRouter call ─────────────────────────────────────────────────────────

async function callOpenRouter(base64, mediaType) {
  // PDFs use the document content block; images use image_url
  const isPdf = mediaType === "application/pdf";
  const contentBlock = isPdf
    ? { type: "text", text: `data:application/pdf;base64,${base64}` }
    : { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://election-monitor-eight.vercel.app",
      "X-Title": "NMYE Election Monitor",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract all election result data from this INEC result sheet. Return only valid JSON.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseClaudeResponse(text) {
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("No JSON found in model response");
  return JSON.parse(jsonMatch[1]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Normalise a polling unit name into a stable short code for the pu_code column.
// Uses the job's pu_code if already set, otherwise derives from the OCR name.
function derivePuCode(job, ocrPuName) {
  if (job.pu_code) return job.pu_code;
  if (!ocrPuName) return null;
  return ocrPuName.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 100);
}

// ─── Write results using atomic RPC functions ─────────────────────────────────
//
// Each OCR job represents ONE polling unit's result sheet.
// We increment state/LGA totals atomically to avoid overwriting other PUs.
// PU results are upserted with last-write-wins (safe to re-process).

async function writeResultsToSupabase(job, result, overVoted) {
  const partyRows = result.party_results ?? [];
  if (partyRows.length === 0) return;

  const stateCode  = job.state_code;
  const stateName  = STATE_NAMES[stateCode] ?? result.state ?? stateCode;
  const zone       = STATE_ZONES[stateCode] ?? "NC";
  const lgaName    = job.lga_name ?? result.lga ?? null;
  const wardName   = job.ward_name ?? result.ward ?? null;
  const puName     = result.polling_unit ?? null;
  const puCode     = derivePuCode(job, puName);
  const accredited = result.accredited_voters ?? 0;

  // ── 1. State-level accumulation ───────────────────────────────────────────
  for (const pr of partyRows) {
    const { error } = await supabase.rpc("upsert_ocr_state_result", {
      p_election_id: job.election_id,
      p_state_code:  stateCode,
      p_state_name:  stateName,
      p_zone:        zone,
      p_party_code:  pr.party,
      p_votes:       pr.votes ?? 0,
      p_accredited:  accredited,
    });
    if (error) {
      console.error(`[${job.id}] state RPC error (${pr.party}):`, error.message);
      if (error.message.includes("does not exist")) {
        console.error("  → Run supabase/ocr_rpc.sql in Supabase SQL Editor first.");
      }
    }
  }

  // ── 2. LGA-level accumulation (requires LGA name) ─────────────────────────
  if (lgaName) {
    for (const pr of partyRows) {
      const { error } = await supabase.rpc("upsert_ocr_lga_result", {
        p_election_id: job.election_id,
        p_state_code:  stateCode,
        p_lga_name:    lgaName,
        p_party_code:  pr.party,
        p_votes:       pr.votes ?? 0,
        p_accredited:  accredited,
      });
      if (error) {
        console.error(`[${job.id}] LGA RPC error (${pr.party}):`, error.message);
      }
    }
  }

  // ── 3. PU-level upsert (requires both LGA name and PU code) ──────────────
  if (lgaName && puCode) {
    for (const pr of partyRows) {
      const { error } = await supabase.rpc("upsert_ocr_pu_result", {
        p_election_id: job.election_id,
        p_state_code:  stateCode,
        p_lga_name:    lgaName,
        p_pu_code:     puCode,
        p_pu_name:     puName ?? puCode,
        p_party_code:  pr.party,
        p_votes:       pr.votes ?? 0,
        p_accredited:  accredited,
        p_over_voted:  overVoted,
        p_reg_area:    wardName,
      });
      if (error) {
        console.error(`[${job.id}] PU RPC error (${pr.party}):`, error.message);
      }
    }
  }

  const levels = ["state", lgaName && "LGA", lgaName && puCode && "PU"].filter(Boolean).join(", ");
  console.log(`[${job.id}] Wrote ${partyRows.length} party rows at ${levels} level`);
}

// ─── Core job processor ───────────────────────────────────────────────────────

async function fetchImageAsBase64(job) {
  if (job.image_url) {
    // Direct S3 URL from INEC IREV
    const response = await fetch(job.image_url);
    if (!response.ok) throw new Error(`IREV image fetch failed: ${response.status} ${job.image_url}`);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    let mediaType = contentType.split(";")[0].trim();
    // Some servers return octet-stream for PDFs — detect by URL extension
    if (mediaType === "application/octet-stream" && job.image_url?.endsWith(".pdf")) {
      mediaType = "application/pdf";
    }
    return { base64, mediaType };
  }

  // Supabase Storage fallback
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("result-sheets")
    .download(job.storage_path);
  if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);
  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const ext = job.storage_path.split(".").pop()?.toLowerCase() ?? "jpeg";
  const mediaTypeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" };
  const mediaType = mediaTypeMap[ext] ?? "image/jpeg";
  return { base64, mediaType };
}

async function processJob(job) {
  const label = job.file_name ?? job.pu_code ?? job.image_url ?? job.storage_path;
  console.log(`[${job.id}] Processing: ${label}`);

  try {
    // 1. Download image (from IREV S3 or Supabase Storage)
    const { base64, mediaType } = await fetchImageAsBase64(job);

    // 2. Call Claude via OpenRouter
    const rawText = await callOpenRouter(base64, mediaType);

    // 3. Parse response
    const result = parseClaudeResponse(rawText);

    // 4. Check over-voting (INEC rule: total votes must not exceed accredited voters)
    const totalVotes = (result.party_results ?? []).reduce((sum, r) => sum + (r.votes ?? 0), 0);
    const overVoted = typeof result.accredited_voters === "number" && totalVotes > result.accredited_voters;

    if (overVoted) {
      console.warn(`[${job.id}] FLAGGED — over-voted: ${totalVotes} > ${result.accredited_voters}`);
    }

    // 5. Write to election results tables
    if (job.state_code && job.election_id && (result.party_results?.length ?? 0) > 0) {
      await writeResultsToSupabase(job, result, overVoted);
    }

    // 6. Mark done
    await supabase.from("ocr_queue").update({
      status: overVoted ? "flagged" : "done",
      result,
      over_voted: overVoted,
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    console.log(`[${job.id}] ${overVoted ? "FLAGGED" : "Done"} — ${totalVotes} total votes`);

  } catch (err) {
    console.error(`[${job.id}] Error:`, err.message);

    const shouldRetry = job.retry_count < MAX_RETRIES;

    await supabase.from("ocr_queue").update({
      status: shouldRetry ? "pending" : "failed",
      error: err.message,
      retry_count: job.retry_count + 1,
      started_at: null,
      completed_at: shouldRetry ? null : new Date().toISOString(),
    }).eq("id", job.id);

    if (shouldRetry) {
      console.log(`[${job.id}] Will retry (attempt ${job.retry_count + 1}/${MAX_RETRIES})`);
    }
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

let activeJobs = 0;

async function poll() {
  const slots = CONCURRENCY - activeJobs;
  if (slots <= 0) return;

  const { data: jobs, error } = await supabase.rpc("claim_ocr_jobs", { batch_size: slots });

  if (error) {
    console.error("Poll error:", error.message);
    return;
  }

  if (!jobs || jobs.length === 0) return;

  console.log(`Claimed ${jobs.length} job(s) — active: ${activeJobs + jobs.length}/${CONCURRENCY}`);

  for (const job of jobs) {
    activeJobs++;
    processJob(job).finally(() => { activeJobs--; });
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("OCR Worker started");
  console.log(`  Model:       ${OPENROUTER_MODEL}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Poll every:  ${POLL_INTERVAL_MS}ms`);
  console.log("  Data source: INEC IREV result sheets via OCR only");

  // Reset jobs stuck in "processing" from a previous crashed worker
  const { count } = await supabase
    .from("ocr_queue")
    .update({ status: "pending", started_at: null })
    .eq("status", "processing")
    .select("*", { count: "exact", head: true });

  if (count > 0) console.log(`Reset ${count} stuck jobs back to "pending"`);

  while (true) {
    await poll();
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
