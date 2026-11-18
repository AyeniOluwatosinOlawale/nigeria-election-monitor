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
        {
          role: "system",
          content: OCR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${base64}`,
              },
            },
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

// ─── Core job processor ───────────────────────────────────────────────────────

async function processJob(job) {
  console.log(`[${job.id}] Processing: ${job.file_name ?? job.storage_path}`);

  try {
    // 1. Download image from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("result-sheets")
      .download(job.storage_path);

    if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const ext = job.storage_path.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mediaTypeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    const mediaType = mediaTypeMap[ext] ?? "image/jpeg";

    // 2. Call Claude via OpenRouter
    const rawText = await callOpenRouter(base64, mediaType);

    // 3. Parse response
    const result = parseClaudeResponse(rawText);

    // 4. Check over-voting (INEC rule)
    const totalVotes = (result.party_results ?? []).reduce((sum, r) => sum + (r.votes ?? 0), 0);
    const overVoted = typeof result.accredited_voters === "number" && totalVotes > result.accredited_voters;

    if (overVoted) {
      console.warn(`[${job.id}] FLAGGED — over-voted: ${totalVotes} > ${result.accredited_voters}`);
    }

    // 5. Write to election results table (if not over-voted)
    if (!overVoted && job.state_code && job.election_id && result.party_results?.length > 0) {
      await writeResultsToSupabase(job, result);
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

// ─── Write extracted results into the main results table ─────────────────────

async function writeResultsToSupabase(job, result) {
  const rows = (result.party_results ?? []).map((pr) => ({
    election_id: job.election_id,
    state_code: job.state_code,
    state_name: result.state ?? job.state_code,
    party_code: pr.party,
    votes: pr.votes ?? 0,
    accredited_voters: result.accredited_voters ?? 0,
    status: "collating",
    source: "ocr",
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("ng_election_state_results")
    .upsert(rows, { onConflict: "election_id,state_code,party_code" });

  if (error) {
    console.error(`[${job.id}] Failed to write results:`, error.message);
  } else {
    console.log(`[${job.id}] Wrote ${rows.length} party rows to ng_election_state_results`);
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
  console.log(`OCR Worker started`);
  console.log(`  Model:       ${OPENROUTER_MODEL}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Poll every:  ${POLL_INTERVAL_MS}ms`);

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
