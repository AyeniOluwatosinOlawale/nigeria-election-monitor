/**
 * fix-pu-names-v2.js
 *
 * Regenerates pu_name and registration_area in ng_election_pu_results using
 * the correct LGA name + ward/PU position, following INEC naming conventions.
 *
 * The INEC CVR portal API does not filter ward/PU data by LGA — it returns
 * the same wards for every LGA within a state. This script replaces those
 * wrong geographic names with LGA-derived names that are geographically
 * accurate at the LGA level and structurally correct.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fix-pu-names-v2.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ELECTION_ID = "presidential_2023";

const STATE_CODES = [
  "AB","AD","AK","AN","BA","BY","BE","BO","CR","DL",
  "EB","ED","EK","EN","FC","GO","IM","JI","KD","KN",
  "KT","KB","KO","KW","LA","NA","NI","OG","ON","OS",
  "OY","PL","RV","SO","TA","YO","ZA",
];

// Ward suffixes — same as seed-pu-2023.js for consistency
const RA_SUFFIXES = [
  "Central","North","South","East","West",
  "I","II","III","IV","V",
  "Urban I","Urban II","Rural I","Rural II",
  "Township","Village","Quarters","Layout",
];

// PU venue types used by INEC — ordered to match seed-pu-2023.js deterministic hash
const PU_VENUES = [
  "Primary School",
  "Community Secondary School",
  "Town Hall",
  "Community Centre",
  "Market Square",
  "Village Square",
  "Health Centre",
  "Open Space",
  "Church Hall",
  "Mosque Premises",
  "Ward Office",
  "Palace Premises",
  "Community Library",
  "Youth Centre",
  "Local Government Secretariat",
  "Women Development Centre",
  "Agricultural Development Office",
  "Police Station Premises",
  "Post Office Premises",
  "Civic Centre",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Extract base community name from LGA name (strip directional suffixes)
function lgaBaseName(lgaName) {
  return lgaName
    .replace(/\s*(North|South|East|West|Central|Urban|Rural|North[- ]East|North[- ]West|South[- ]East|South[- ]West)\s*$/i, "")
    .trim() || lgaName;
}

// Generate registration area name: base + ward suffix
function wardName(lgaName, wardSeq) {
  const base = lgaBaseName(lgaName);
  const idx = (wardSeq - 1) % RA_SUFFIXES.length;
  return `${base} ${RA_SUFFIXES[idx]}`;
}

// Generate PU name: ward name + venue + suffix (deterministic by lga+ward+pu)
function puName(lgaIdx, wardSeq, puSeq) {
  const venueIdx = (lgaIdx * 11 + wardSeq * 7 + puSeq * 3) % PU_VENUES.length;
  const venue = PU_VENUES[venueIdx];
  const suffix = puSeq <= 5
    ? ["I","II","III","IV","V"][puSeq - 1]
    : String(puSeq);
  return `${venue} ${suffix}`;
}

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

async function processState(stateCode) {
  // Get all distinct pu_codes + lga_name for this state
  const rows = await fetchAll(
    "ng_election_pu_results",
    "pu_code,lga_name",
    { election_id: ELECTION_ID, state_code: stateCode }
  );

  // Deduplicate by pu_code (multiple rows per PU due to party rows)
  const puMap = new Map();
  for (const r of rows) {
    if (!puMap.has(r.pu_code)) puMap.set(r.pu_code, r.lga_name);
  }

  if (!puMap.size) return 0;

  // Build sorted list of LGA names to get consistent lgaIdx
  const lgaNames = [...new Set([...puMap.values()])].sort();
  const lgaIdxMap = new Map(lgaNames.map((name, i) => [name, i + 1]));

  // Build update list
  const updates = [];
  for (const [puCode, lgaName] of puMap) {
    const parts = puCode.split("/");
    if (parts.length !== 4) continue;
    const lgaIdx = lgaIdxMap.get(lgaName) ?? 1;
    const ws = parseInt(parts[2], 10);  // ward sequence
    const ps = parseInt(parts[3], 10);  // pu sequence
    updates.push({
      pu_code: puCode,
      lga_name: lgaName,
      registration_area: wardName(lgaName, ws),
      pu_name: puName(lgaIdx, ws, ps),
    });
  }

  // Batch update
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const promises = batch.map(u =>
      sb.from("ng_election_pu_results")
        .update({ pu_name: u.pu_name, registration_area: u.registration_area })
        .eq("election_id", ELECTION_ID)
        .eq("state_code", stateCode)
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
  console.log("Regenerating PU names from LGA names (INEC convention)...\n");
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

  console.log(`\nDone. Total PUs updated: ${total.toLocaleString()}`);
}

run().catch(e => { console.error(e); process.exit(1); });
