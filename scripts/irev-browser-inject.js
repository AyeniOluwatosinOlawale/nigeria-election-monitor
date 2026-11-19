/**
 * irev-browser-inject.js
 *
 * Run this script in the browser DevTools console while on
 * https://inecelectionresults.ng/elections/types
 *
 * It crawls the INEC IREV API for all 4 election types, walks the
 * state → LGA → ward → polling unit hierarchy, collects result sheet
 * image URLs, and POSTs them to your election monitor's /api/queue-irev
 * endpoint in batches.
 *
 * HOW TO USE:
 *   1. Open https://inecelectionresults.ng/elections/types in Chrome/Firefox
 *   2. Open DevTools (F12) → Console
 *   3. Paste this entire script and press Enter
 *   4. Watch the progress logs — it may take 30-60 min to crawl all 4 elections
 *
 * CONFIGURATION — update these before running:
 */

const CONFIG = {
  // Your election monitor endpoint
  queueEndpoint: "https://election-monitor-eight.vercel.app/api/queue-irev",

  // Shared secret set in IREV_QUEUE_SECRET Vercel env var
  queueSecret: "cabd9d55e8bbcb5d86b2a81b5e61d3601c95b523c2007adc3348d934daace8a8",

  // INEC IREV API base (resolves from browser here, not externally)
  apiBase: "https://lv001-r.inecelectionresults.ng/api/v1",

  // How many PU queue entries to POST at once
  batchSize: 100,

  // ms between API calls to be polite to INEC servers
  delay: 400,

  // Which elections to crawl — set to null to crawl all 4
  // Options: "presidential", "senate", "house_reps", "gubernatorial"
  onlyElections: null,
};

// ─── INEC election IDs ────────────────────────────────────────────────────────

const ELECTIONS = [
  { id: "63f8f25b594e164f8146a213", type: "presidential",   monitorId: "presidential_2023",  label: "Presidential 2023" },
  { id: "5f129a04df41d910dcdc1d52", type: "senate",         monitorId: "senate_2023",         label: "Senate 2023" },
  { id: "5f129a04df41d910dcdc1d53", type: "house_reps",     monitorId: "house_reps_2023",     label: "House of Reps 2023" },
  { id: "5f129a04df41d910dcdc1d51", type: "gubernatorial",  monitorId: "gubernatorial_2023",  label: "Gubernatorial 2023" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function irevGet(path) {
  const res = await fetch(`${CONFIG.apiBase}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`IREV ${path} → ${res.status}`);
  return res.json();
}

// Extract S3 image URL from a PU result object
function extractImageUrl(puResult) {
  // IREV stores result sheets in one of two S3 buckets
  const doc = puResult?.document_url
    ?? puResult?.documentUrl
    ?? puResult?.result_sheet_url
    ?? puResult?.resultSheetUrl
    ?? null;
  return doc;
}

// Two-letter state code from INEC state name
const STATE_CODE_MAP = {
  "Abia": "AB", "Adamawa": "AD", "Akwa Ibom": "AK", "Anambra": "AN",
  "Bauchi": "BA", "Bayelsa": "BY", "Benue": "BE", "Borno": "BO",
  "Cross River": "CR", "Delta": "DL", "Ebonyi": "EB", "Edo": "ED",
  "Ekiti": "EK", "Enugu": "EN", "FCT": "FC", "FCT Abuja": "FC",
  "Gombe": "GO", "Imo": "IM", "Jigawa": "JI", "Kaduna": "KD",
  "Kano": "KN", "Katsina": "KT", "Kebbi": "KB", "Kogi": "KO",
  "Kwara": "KW", "Lagos": "LA", "Nasarawa": "NA", "Niger": "NI",
  "Ogun": "OG", "Ondo": "ON", "Osun": "OS", "Oyo": "OY",
  "Plateau": "PL", "Rivers": "RV", "Sokoto": "SO", "Taraba": "TA",
  "Yobe": "YO", "Zamfara": "ZA",
};

function stateCode(stateName) {
  if (!stateName) return "XX";
  const clean = stateName.trim().replace(/\s+state$/i, "");
  return STATE_CODE_MAP[clean] ?? STATE_CODE_MAP[clean.split(" ")[0]] ?? "XX";
}

// ─── Batch poster ─────────────────────────────────────────────────────────────

let totalQueued = 0;

async function postBatch(entries) {
  if (entries.length === 0) return;
  try {
    const res = await fetch(CONFIG.queueEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-queue-secret": CONFIG.queueSecret,
      },
      body: JSON.stringify(entries),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[queue] POST failed ${res.status}: ${txt.slice(0, 200)}`);
      return;
    }
    const data = await res.json();
    totalQueued += data.queued ?? 0;
    console.log(`[queue] +${data.queued} queued (total: ${totalQueued})`);
  } catch (e) {
    console.warn("[queue] fetch error:", e.message);
  }
}

// ─── Crawlers ─────────────────────────────────────────────────────────────────

async function crawlElection(election) {
  if (CONFIG.onlyElections && !CONFIG.onlyElections.includes(election.type)) return;
  console.log(`\n=== ${election.label} ===`);

  let states;
  try {
    const data = await irevGet(`/elections/${election.id}/state_results`);
    states = data?.data ?? data?.states ?? data ?? [];
  } catch (e) {
    console.warn(`  [${election.type}] states fetch failed:`, e.message);
    return;
  }

  if (!Array.isArray(states) || states.length === 0) {
    console.warn(`  [${election.type}] no states returned`);
    return;
  }

  for (const state of states) {
    const stateName = state.name ?? state.state;
    const stateId   = state._id ?? state.id;
    const sc        = stateCode(stateName);
    console.log(`  [${sc}] ${stateName}`);
    await sleep(CONFIG.delay);

    let lgas;
    try {
      const d = await irevGet(`/elections/${election.id}/lga_results?state=${stateId}`);
      lgas = d?.data ?? d?.lgas ?? d ?? [];
    } catch (e) {
      console.warn(`    LGAs failed for ${stateName}:`, e.message);
      continue;
    }

    for (const lga of lgas) {
      const lgaName = lga.name ?? lga.lga;
      const lgaId   = lga._id ?? lga.id;
      await sleep(CONFIG.delay);

      let wards;
      try {
        const d = await irevGet(`/elections/${election.id}/ward_results?lga=${lgaId}`);
        wards = d?.data ?? d?.wards ?? d ?? [];
      } catch (e) {
        console.warn(`      wards failed for ${lgaName}:`, e.message);
        continue;
      }

      for (const ward of wards) {
        const wardName = ward.name ?? ward.ward;
        const wardId   = ward._id ?? ward.id;
        await sleep(CONFIG.delay);

        let pus;
        try {
          const d = await irevGet(`/elections/${election.id}/pus?ward=${wardId}`);
          pus = d?.data ?? d?.polling_units ?? d ?? [];
        } catch (e) {
          console.warn(`        PUs failed for ${wardName}:`, e.message);
          continue;
        }

        const batch = [];
        for (const pu of pus) {
          const imageUrl = extractImageUrl(pu);
          if (!imageUrl) continue;

          batch.push({
            image_url:   imageUrl,
            election_id: election.monitorId,
            state_code:  sc,
            lga_name:    lgaName,
            ward_name:   wardName,
            pu_code:     pu.pu_code ?? pu.code ?? pu._id,
            pu_name:     pu.name ?? pu.pu_name,
          });

          if (batch.length >= CONFIG.batchSize) {
            await postBatch(batch.splice(0));
          }
        }
        if (batch.length > 0) await postBatch(batch);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("INEC IREV scraper started");
  console.log(`Target: ${CONFIG.queueEndpoint}`);
  console.log("─".repeat(60));

  for (const election of ELECTIONS) {
    try {
      await crawlElection(election);
    } catch (e) {
      console.error(`[${election.type}] fatal:`, e.message);
    }
  }

  console.log("─".repeat(60));
  console.log(`Done. Total PU result sheets queued: ${totalQueued}`);
})();
