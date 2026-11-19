/**
 * update-pu-names.js
 * Wires real INEC PU names + registration areas into ng_election_pu_results.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/update-pu-names.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Maps results-table state_code → inec-table state_code where they differ
const STATE_CODE_MAP = { DL: "DE", RV: "RI" };

const STATE_CODES = [
  "AB","AD","AK","AN","BA","BY","BE","BO","CR","DL",
  "EB","ED","EK","EN","FC","GO","IM","JI","KD","KN",
  "KT","KB","KO","KW","LA","NA","NI","OG","ON","OS",
  "OY","PL","RV","SO","TA","YO","ZA",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAll(table, columns, filters = {}) {
  const PAGE = 1000;
  let rows = [], from = 0;
  while (true) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function processState(stateCode) {
  // Some states use different codes between the two tables
  const inecCode = STATE_CODE_MAP[stateCode] ?? stateCode;

  // 1. Fetch INEC polling units for this state
  const inecPUs = await fetchAll(
    "ng_inec_polling_units",
    "lga_name,lga_inec_id,ward_seq,pu_seq,pu_name,ra_name",
    { state_code: inecCode }
  );
  if (!inecPUs.length) return 0;

  // 2. Build LGA position map: alphabetical lga_name order → lga_pos (1-based)
  // The seed script (seed-pu-2023.js) ordered LGAs by lga_name alphabetically,
  // so PU code LGA index 001 = first LGA alphabetically, 002 = second, etc.
  const lgaNames = [...new Set(inecPUs.map(p => p.lga_name))].sort();
  const lgaNamePosMap = new Map(lgaNames.map((name, i) => [name, i + 1]));

  // 3. Build a lookup: (lga_pos, ward_seq, pu_seq) → { pu_name, ra_name }
  const lookup = new Map();
  for (const p of inecPUs) {
    const lgaPos = lgaNamePosMap.get(p.lga_name);
    const key = `${lgaPos}/${p.ward_seq}/${Number(p.pu_seq)}`;
    lookup.set(key, { pu_name: p.pu_name, ra_name: p.ra_name });
  }

  // 4. Fetch distinct PU codes from election results
  const resultRows = await fetchAll(
    "ng_election_pu_results",
    "pu_code",
    { state_code: stateCode }
  );
  const distinctCodes = [...new Set(resultRows.map(r => r.pu_code))];

  // 5. For each PU code, look up the INEC match
  const updates = [];
  for (const puCode of distinctCodes) {
    const parts = puCode.split("/");
    if (parts.length !== 4) continue;
    const lgaPos = parseInt(parts[1], 10);
    const wardSeq = parts[2];           // e.g. "02"
    const puSeq   = parseInt(parts[3], 10);
    const key = `${lgaPos}/${wardSeq}/${puSeq}`;
    const match = lookup.get(key);
    if (match) {
      updates.push({ pu_code: puCode, state_code: stateCode, ...match });
    }
  }

  if (!updates.length) return 0;

  // 6. Batch update: one UPDATE per PU code (match on state_code + pu_code)
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    // Use upsert-style: update each row matching state_code+pu_code
    const promises = batch.map(u =>
      sb.from("ng_election_pu_results")
        .update({ pu_name: u.pu_name, registration_area: u.ra_name })
        .eq("state_code", u.state_code)
        .eq("pu_code", u.pu_code)
    );
    const results = await Promise.all(promises);
    for (const { error } of results) {
      if (error) console.warn("  update error:", error.message);
      else updated++;
    }
  }

  return updated;
}

async function run() {
  console.log("Updating PU names from INEC data...\n");
  let total = 0;

  for (const code of STATE_CODES) {
    process.stdout.write(`[${code}] `);
    try {
      const n = await processState(code);
      console.log(`${n} PUs updated`);
      total += n;
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
    }
    await sleep(200);
  }

  console.log(`\nDone. Total PUs updated: ${total}`);
}

run().catch(e => { console.error(e); process.exit(1); });
