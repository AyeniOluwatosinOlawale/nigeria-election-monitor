/**
 * scrape-inec-ras.js
 * Scrapes all Registration Areas from INEC CVR portal and upserts into Supabase.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/scrape-inec-ras.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BASE = "https://cvr.inecnigeria.org/PublicApi";
const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": "https://cvr.inecnigeria.org/pu",
};

const STATE_IDS = [
  { id: 1, code: "AB", name: "ABIA" },
  { id: 2, code: "AD", name: "ADAMAWA" },
  { id: 3, code: "AK", name: "AKWA IBOM" },
  { id: 4, code: "AN", name: "ANAMBRA" },
  { id: 5, code: "BA", name: "BAUCHI" },
  { id: 6, code: "BY", name: "BAYELSA" },
  { id: 7, code: "BE", name: "BENUE" },
  { id: 8, code: "BO", name: "BORNO" },
  { id: 9, code: "CR", name: "CROSS RIVER" },
  { id: 10, code: "DE", name: "DELTA" },
  { id: 11, code: "EB", name: "EBONYI" },
  { id: 12, code: "ED", name: "EDO" },
  { id: 13, code: "EK", name: "EKITI" },
  { id: 14, code: "EN", name: "ENUGU" },
  { id: 15, code: "FC", name: "FCT" },
  { id: 16, code: "GO", name: "GOMBE" },
  { id: 17, code: "IM", name: "IMO" },
  { id: 18, code: "JI", name: "JIGAWA" },
  { id: 19, code: "KD", name: "KADUNA" },
  { id: 20, code: "KN", name: "KANO" },
  { id: 21, code: "KT", name: "KATSINA" },
  { id: 22, code: "KB", name: "KEBBI" },
  { id: 23, code: "KO", name: "KOGI" },
  { id: 24, code: "KW", name: "KWARA" },
  { id: 25, code: "LA", name: "LAGOS" },
  { id: 26, code: "NA", name: "NASARAWA" },
  { id: 27, code: "NI", name: "NIGER" },
  { id: 28, code: "OG", name: "OGUN" },
  { id: 29, code: "ON", name: "ONDO" },
  { id: 30, code: "OS", name: "OSUN" },
  { id: 31, code: "OY", name: "OYO" },
  { id: 32, code: "PL", name: "PLATEAU" },
  { id: 33, code: "RI", name: "RIVERS" },
  { id: 34, code: "SO", name: "SOKOTO" },
  { id: 35, code: "TA", name: "TARABA" },
  { id: 36, code: "YO", name: "YOBE" },
  { id: 37, code: "ZA", name: "ZAMFARA" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Response is an array of objects: [{"0":"--","selected":"0","243":"01 - ADO EKITI",...}]
// Merge all objects in the array into one, then filter out meta keys
function parseOptions(json) {
  const merged = Array.isArray(json)
    ? Object.assign({}, ...json)
    : json;
  return Object.entries(merged)
    .filter(([k]) => k !== "0" && k !== "selected" && !isNaN(Number(k)))
    .map(([id, label]) => ({ id: Number(id), label: String(label) }));
}

async function getLGAs(stateId) {
  const url = `${BASE}/lgas/1/Search?data%5BSearch%5D%5Bstate_id%5D=${stateId}`;
  const json = await fetchJson(url);
  return parseOptions(json);
}

async function getRAs(stateId, lgaId) {
  const url = `${BASE}/wards/1/Search?data%5BSearch%5D%5Bstate_id%5D=${stateId}&data%5BSearch%5D%5Blocal_government_id%5D=${lgaId}`;
  const json = await fetchJson(url);
  return parseOptions(json);
}


async function run() {
  const allRows = [];

  for (const state of STATE_IDS) {
    console.log(`\n[${state.code}] ${state.name}`);
    let lgas;
    try {
      lgas = await getLGAs(state.id);
    } catch (e) {
      console.warn(`  LGA fetch failed: ${e.message}`);
      continue;
    }
    console.log(`  ${lgas.length} LGAs`);

    for (const lga of lgas) {
      await sleep(120); // be polite to INEC servers
      const lgaName = lga.label.replace(/^\d+\s*-\s*/, "").trim();
      let ras;
      try {
        ras = await getRAs(state.id, lga.id);
      } catch (e) {
        console.warn(`    RA fetch failed for ${lgaName}: ${e.message}`);
        continue;
      }
      for (const ra of ras) {
        const raNum = String(ra.id); // numeric ID from INEC
        const raName = ra.label.replace(/^\d+\s*-\s*/, "").trim();
        const wardSeq = ra.label.match(/^(\d+)/)?.[1] ?? raNum;
        allRows.push({
          state_code: state.code,
          state_inec_id: state.id,
          lga_name: lgaName,
          lga_inec_id: lga.id,
          lga_label: lga.label,
          ra_inec_id: ra.id,
          ra_label: ra.label,
          ra_name: raName,
          ward_seq: String(wardSeq).padStart(2, "0"),
        });
      }
      process.stdout.write(`  ${lgaName}: ${ras.length} RAs\n`);
    }
  }

  console.log(`\nTotal registration areas scraped: ${allRows.length}`);

  // Upsert into new table
  const BATCH = 200;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const { error } = await supabase
      .from("ng_inec_registration_areas")
      .upsert(allRows.slice(i, i + BATCH), {
        onConflict: "state_code,lga_inec_id,ra_inec_id",
      });
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
      process.exit(1);
    }
  }

  console.log("Done. All registration areas saved to ng_inec_registration_areas.");
}

run().catch((e) => { console.error(e); process.exit(1); });
