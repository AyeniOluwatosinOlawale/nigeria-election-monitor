/**
 * seed-pu-full.js
 *
 * Full reseed of ng_election_pu_results using all 274,760 real INEC PUs.
 * Replaces the synthetic 82k-PU seed with real INEC ward/PU structure.
 * Distributes 2023 presidential LGA vote totals proportionally across real PUs.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-pu-full.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Results-table state code → INEC table state code
const STATE_CODE_MAP = { DL: "DE", RV: "RI" };

const STATE_CODES = [
  "AB","AD","AK","AN","BA","BY","BE","BO","CR","DL",
  "EB","ED","EK","EN","FC","GO","IM","JI","KD","KN",
  "KT","KB","KO","KW","LA","NA","NI","OG","ON","OS",
  "OY","PL","RV","SO","TA","YO","ZA",
];

const ELECTION_ID = "presidential_2023";
const PARTIES = ["APC", "PDP", "LP", "NNPP"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAll(table, columns, filters = {}) {
  const PAGE = 1000;
  let rows = [], from = 0;
  while (true) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

// Distribute total votes across count units with ±20% variance
function distributeVotes(total, count) {
  if (count === 0) return [];
  if (count === 1) return [total];
  const base = Math.floor(total / count);
  const result = [];
  let remaining = total;
  for (let i = 0; i < count - 1; i++) {
    const variation = Math.floor(base * 0.2);
    const v = Math.max(0, base + Math.floor((Math.random() * 2 - 1) * variation));
    result.push(v);
    remaining -= v;
  }
  result.push(Math.max(0, remaining));
  return result;
}

async function processState(stateCode) {
  const inecCode = STATE_CODE_MAP[stateCode] ?? stateCode;

  // 1. Fetch LGA-level results (source of vote totals)
  const lgaResultRows = await fetchAll(
    "ng_election_lga_results",
    "lga_name,party_code,votes,accredited_voters",
    { election_id: ELECTION_ID, state_code: stateCode }
  );
  if (!lgaResultRows.length) {
    console.log("no LGA results");
    return 0;
  }

  // Build results LGA map: sorted alphabetically → positional index
  const lgaResultsMap = {};
  for (const row of lgaResultRows) {
    if (!lgaResultsMap[row.lga_name]) {
      lgaResultsMap[row.lga_name] = { parties: {}, accredited: row.accredited_voters ?? 0 };
    }
    lgaResultsMap[row.lga_name].parties[row.party_code] = row.votes ?? 0;
  }
  const resultLgaNames = Object.keys(lgaResultsMap).sort();

  // 2. Fetch all real INEC PUs for this state
  const inecPUs = await fetchAll(
    "ng_inec_polling_units",
    "lga_name,ward_seq,pu_seq,pu_name,ra_name",
    { state_code: inecCode }
  );
  if (!inecPUs.length) {
    console.log("no INEC PUs");
    return 0;
  }

  // Sort INEC LGA names alphabetically — same relative order as resultLgaNames
  const inecLgaNames = [...new Set(inecPUs.map(p => p.lga_name))].sort();

  if (inecLgaNames.length !== resultLgaNames.length) {
    process.stdout.write(`(INEC:${inecLgaNames.length} vs results:${resultLgaNames.length} LGAs) `);
  }

  // Group INEC PUs by lga_name
  const inecByLga = {};
  for (const pu of inecPUs) {
    if (!inecByLga[pu.lga_name]) inecByLga[pu.lga_name] = [];
    inecByLga[pu.lga_name].push(pu);
  }

  // 3. Delete existing PU rows for this state/election
  const { error: delError } = await sb
    .from("ng_election_pu_results")
    .delete()
    .eq("election_id", ELECTION_ID)
    .eq("state_code", stateCode);
  if (delError) throw new Error(`delete: ${delError.message}`);

  // 4. Build rows for all real PUs
  const allRows = [];

  for (let lgaIdx = 0; lgaIdx < inecLgaNames.length; lgaIdx++) {
    const inecLgaName = inecLgaNames[lgaIdx];
    const resultLgaName = resultLgaNames[lgaIdx]; // positional match — both alphabetical
    if (!resultLgaName) continue;

    const lgaData = lgaResultsMap[resultLgaName];
    const lgaPUs = inecByLga[inecLgaName] || [];
    if (!lgaPUs.length) continue;

    const lgaCode = String(lgaIdx + 1).padStart(3, "0");

    // Distribute votes and accredited across all real PUs in this LGA
    const partyDist = {};
    for (const party of PARTIES) {
      partyDist[party] = distributeVotes(lgaData.parties[party] ?? 0, lgaPUs.length);
    }
    const accreditedDist = distributeVotes(lgaData.accredited, lgaPUs.length);

    for (let puIdx = 0; puIdx < lgaPUs.length; puIdx++) {
      const pu = lgaPUs[puIdx];
      // PU code uses real INEC ward_seq + pu_seq, padded to match original format
      const wardSeq = String(pu.ward_seq).padStart(2, "0");
      const puSeqPadded = String(Number(pu.pu_seq)).padStart(3, "0");
      const puCode = `${stateCode}/${lgaCode}/${wardSeq}/${puSeqPadded}`;

      const accredited = accreditedDist[puIdx] ?? 0;
      const totalVotes = PARTIES.reduce((s, p) => s + (partyDist[p][puIdx] ?? 0), 0);
      const overVoted = totalVotes > accredited && accredited > 0;

      for (const party of PARTIES) {
        allRows.push({
          election_id: ELECTION_ID,
          state_code: stateCode,
          lga_name: resultLgaName,
          registration_area: pu.ra_name,
          pu_code: puCode,
          pu_name: pu.pu_name,
          party_code: party,
          votes: partyDist[party][puIdx] ?? 0,
          accredited_voters: accredited,
          status: "declared",
          over_voted: overVoted,
        });
      }
    }
  }

  if (!allRows.length) return 0;

  // 5. Insert in batches with retry
  const BATCH = 500;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    let attempts = 0;
    while (true) {
      attempts++;
      const { error } = await sb.from("ng_election_pu_results").insert(batch);
      if (!error) break;
      if (attempts >= 5) throw new Error(`insert batch failed: ${error.message}`);
      await sleep(attempts * 2000);
    }
  }

  return allRows.length / PARTIES.length; // return PU count not row count
}

async function run() {
  console.log("Full PU reseed from INEC data (274,760 PUs)...\n");
  let total = 0;

  for (const code of STATE_CODES) {
    process.stdout.write(`[${code}] `);
    try {
      const n = await processState(code);
      console.log(`${n} PUs`);
      total += n;
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
    }
    await sleep(300);
  }

  console.log(`\nDone. Total PUs: ${total.toLocaleString()}`);
}

run().catch(e => { console.error(e); process.exit(1); });
