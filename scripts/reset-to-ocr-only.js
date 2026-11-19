/**
 * reset-to-ocr-only.js
 *
 * Removes all pre-seeded/estimated data from election result tables.
 * The ng_elections metadata rows (election IDs) are preserved.
 * After this runs, the dashboard shows empty states until OCR data
 * is uploaded from INEC IREV result sheets.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-to-ocr-only.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteAll(table, filter) {
  const query = supabase.from(table).delete();
  const { error, count } = await filter(query)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`  ${table} error:`, error.message);
    return false;
  }
  console.log(`  ${table}: deleted ${count ?? "all"} rows`);
  return true;
}

async function run() {
  console.log("Clearing all seed data from election result tables...");
  console.log("(ng_elections definitions will be preserved)\n");

  // Delete in dependency order (PU → LGA → State)
  await deleteAll("ng_election_pu_results",    (q) => q.gte("id", 0));
  await deleteAll("ng_election_lga_results",   (q) => q.gte("id", 0));
  await deleteAll("ng_election_state_results", (q) => q.not("election_id", "is", null));

  console.log("\nDone.");
  console.log("The dashboard will show empty states until IREV result sheets are uploaded.");
  console.log("\nREMINDER: Run supabase/ocr_rpc.sql in the Supabase SQL Editor to");
  console.log("enable atomic vote accumulation for the OCR worker.");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
