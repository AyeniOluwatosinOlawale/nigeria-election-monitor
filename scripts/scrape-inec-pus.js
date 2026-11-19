/**
 * scrape-inec-pus.js
 * Scrapes all Polling Unit names from INEC CVR portal and saves to Supabase.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/scrape-inec-pus.js
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

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseOptions(json) {
  const merged = Array.isArray(json) ? Object.assign({}, ...json) : json;
  return Object.entries(merged)
    .filter(([k]) => k !== "0" && k !== "selected" && !isNaN(Number(k)))
    .map(([id, label]) => ({ id: Number(id), label: String(label) }));
}

async function getLGAs(stateId) {
  const json = await fetchJson(`${BASE}/lgas/1/Search?data%5BSearch%5D%5Bstate_id%5D=${stateId}`);
  return parseOptions(json);
}

async function getRAs(stateId, lgaId) {
  const json = await fetchJson(`${BASE}/wards/1/Search?data%5BSearch%5D%5Bstate_id%5D=${stateId}&data%5BSearch%5D%5Blocal_government_id%5D=${lgaId}`);
  return parseOptions(json);
}

async function getPUs(stateId, lgaId, raId) {
  const json = await fetchJson(`${BASE}/pus/1/Search?data%5BSearch%5D%5Bstate_id%5D=${stateId}&data%5BSearch%5D%5Blocal_government_id%5D=${lgaId}&data%5BSearch%5D%5Bregistration_area_id%5D=${raId}`);
  return parseOptions(json);
}

const STATE_IDS = [
  {id:1,code:"AB"},{id:2,code:"AD"},{id:3,code:"AK"},{id:4,code:"AN"},
  {id:5,code:"BA"},{id:6,code:"BY"},{id:7,code:"BE"},{id:8,code:"BO"},
  {id:9,code:"CR"},{id:10,code:"DE"},{id:11,code:"EB"},{id:12,code:"ED"},
  {id:13,code:"EK"},{id:14,code:"EN"},{id:15,code:"FC"},{id:16,code:"GO"},
  {id:17,code:"IM"},{id:18,code:"JI"},{id:19,code:"KD"},{id:20,code:"KN"},
  {id:21,code:"KT"},{id:22,code:"KB"},{id:23,code:"KO"},{id:24,code:"KW"},
  {id:25,code:"LA"},{id:26,code:"NA"},{id:27,code:"NI"},{id:28,code:"OG"},
  {id:29,code:"ON"},{id:30,code:"OS"},{id:31,code:"OY"},{id:32,code:"PL"},
  {id:33,code:"RI"},{id:34,code:"SO"},{id:35,code:"TA"},{id:36,code:"YO"},
  {id:37,code:"ZA"},
];

async function run() {
  let totalPUs = 0;
  let batch = [];

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("ng_inec_polling_units")
      .upsert(batch, { onConflict: "state_code,lga_inec_id,ra_inec_id,pu_inec_id" });
    if (error) { console.error("Upsert error:", error.message); process.exit(1); }
    totalPUs += batch.length;
    batch = [];
  }

  for (const state of STATE_IDS) {
    console.log(`\n[${state.code}]`);
    const lgas = await getLGAs(state.id).catch(() => []);

    for (const lga of lgas) {
      const lgaName = lga.label.replace(/^\d+\s*-\s*/, "").trim();
      await sleep(100);
      const ras = await getRAs(state.id, lga.id).catch(() => []);

      for (const ra of ras) {
        const raName = ra.label.replace(/^\d+\s*-\s*/, "").trim();
        const wardSeq = (ra.label.match(/^(\d+)/) ?? ["","00"])[1].padStart(2,"0");
        await sleep(80);
        const pus = await getPUs(state.id, lga.id, ra.id).catch(() => []);

        for (const pu of pus) {
          const puSeq = (pu.label.match(/^(\d+)/) ?? ["","000"])[1].padStart(3,"0");
          const puName = pu.label.replace(/^\d+\s*-\s*/, "").trim();
          batch.push({
            state_code: state.code,
            state_inec_id: state.id,
            lga_name: lgaName,
            lga_inec_id: lga.id,
            ra_name: raName,
            ra_inec_id: ra.id,
            ward_seq: wardSeq,
            pu_inec_id: pu.id,
            pu_seq: puSeq,
            pu_name: puName,
            pu_label: pu.label,
          });
        }

        if (batch.length >= 500) await flush();
      }
      process.stdout.write(`  ${lgaName}: done\n`);
    }
    await flush();
  }

  await flush();
  console.log(`\nTotal PUs scraped: ${totalPUs}`);
  console.log("Done.");
}

run().catch((e) => { console.error(e); process.exit(1); });
