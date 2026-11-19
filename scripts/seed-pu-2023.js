/**
 * seed-pu-2023.js
 *
 * Generates polling-unit level data for the 2023 presidential election.
 * Uses realistic Nigerian PU naming conventions and distributes LGA votes
 * proportionally across PUs within each LGA.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-pu-2023.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Registration area name suffixes — mirrors real INEC ward naming patterns
const RA_SUFFIXES = [
  "Central", "North", "South", "East", "West",
  "I", "II", "III", "IV", "V",
  "Urban I", "Urban II", "Rural I", "Rural II",
  "Township", "Village", "Quarters", "Layout",
];

// Generate a registration area name from LGA name + ward index
function generateRegistrationArea(lgaName, wardIndex) {
  // Strip common suffixes to get the base community name
  const base = lgaName
    .replace(/\s*(LGA|Local Government Area|North|South|East|West|Central|Urban|Rural)\s*$/i, "")
    .trim();
  const suffix = RA_SUFFIXES[wardIndex % RA_SUFFIXES.length];
  return `${base} ${suffix}`;
}

// Realistic PU name templates used by INEC
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

function generatePUName(lgaIndex, ward, puIndex) {
  const venue = PU_VENUES[(lgaIndex * 11 + ward * 7 + puIndex * 3) % PU_VENUES.length];
  const suffix = puIndex === 0 ? "I" : puIndex === 1 ? "II" : puIndex === 2 ? "III" : `${puIndex + 1}`;
  return `Ward ${String(ward + 1).padStart(2, "0")} ${venue} ${suffix}`;
}

function generatePUCode(stateCode, lgaIndex, ward, puIndex) {
  return `${stateCode}/${String(lgaIndex + 1).padStart(3, "0")}/${String(ward + 1).padStart(2, "0")}/${String(puIndex + 1).padStart(3, "0")}`;
}

// Distribute N votes across K units with slight variation (±20%)
function distributeVotes(total, count) {
  if (count === 0) return [];
  if (count === 1) return [total];

  const base = Math.floor(total / count);
  const result = [];
  let remaining = total;

  for (let i = 0; i < count - 1; i++) {
    // Add up to ±20% variation
    const variation = Math.floor(base * 0.2);
    const v = Math.max(0, base + Math.floor((Math.random() * 2 - 1) * variation));
    result.push(v);
    remaining -= v;
  }
  result.push(Math.max(0, remaining));
  return result;
}

async function run() {
  console.log("Fetching LGA results for presidential_2023...");

  // Paginate to fetch all rows (Supabase default limit is 1000)
  const lgaRows = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ng_election_lga_results")
      .select("*")
      .eq("election_id", "presidential_2023")
      .order("state_code")
      .order("lga_name")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("Failed to fetch LGA results:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    lgaRows.push(...data);
    console.log(`  Fetched ${lgaRows.length} LGA rows so far...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total LGA rows fetched: ${lgaRows.length}`);

  // Group by state+LGA
  const lgaMap = {};
  for (const row of lgaRows) {
    const key = `${row.state_code}__${row.lga_name}`;
    if (!lgaMap[key]) lgaMap[key] = { meta: row, parties: {} };
    lgaMap[key].parties[row.party_code] = row.votes;
    lgaMap[key].totalPUs = row.total_pus;
    lgaMap[key].accredited = row.accredited_voters;
  }

  const lgaEntries = Object.entries(lgaMap);
  console.log(`Found ${lgaEntries.length} LGAs. Generating PU rows...`);

  const rows = [];
  const stateIndexes = {};

  for (const [key, lga] of lgaEntries) {
    const { state_code, lga_name } = lga.meta;

    if (!stateIndexes[state_code]) stateIndexes[state_code] = {};
    if (stateIndexes[state_code][lga_name] === undefined) {
      stateIndexes[state_code][lga_name] = Object.keys(stateIndexes[state_code]).length;
    }
    const lgaIndex = stateIndexes[state_code][lga_name];

    const totalPUs = Math.max(lga.totalPUs, 1);
    const parties = ["APC", "PDP", "LP", "NNPP"];

    // Distribute each party's LGA votes across PUs
    const partyDistributions = {};
    for (const party of parties) {
      partyDistributions[party] = distributeVotes(lga.parties[party] ?? 0, totalPUs);
    }

    // Distribute accredited voters across PUs
    const accreditedDist = distributeVotes(lga.accredited, totalPUs);

    // Generate PUs spread across wards (roughly 10 PUs per ward)
    const WARDS = Math.max(1, Math.ceil(totalPUs / 10));

    for (let puIdx = 0; puIdx < totalPUs; puIdx++) {
      const ward = Math.floor(puIdx / 10);
      const wardPuIdx = puIdx % 10;
      const puCode = generatePUCode(state_code, lgaIndex, ward, wardPuIdx);
      const puName = generatePUName(lgaIndex, ward, wardPuIdx);
      const registrationArea = generateRegistrationArea(lga_name, ward);
      const accredited = accreditedDist[puIdx] ?? 0;
      const totalVotes = parties.reduce((s, p) => s + (partyDistributions[p][puIdx] ?? 0), 0);
      const overVoted = totalVotes > accredited && accredited > 0;

      for (const party of parties) {
        rows.push({
          election_id: "presidential_2023",
          state_code,
          lga_name,
          registration_area: registrationArea,
          pu_code: puCode,
          pu_name: puName,
          party_code: party,
          votes: partyDistributions[party][puIdx] ?? 0,
          accredited_voters: accredited,
          status: "declared",
          over_voted: overVoted,
        });
      }
    }
  }

  console.log(`Generated ${rows.length} PU-party rows across ${lgaEntries.length} LGAs.`);
  console.log("Inserting in batches of 500...");

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    let attempts = 0;
    while (true) {
      attempts++;
      const { error: insertErr } = await supabase
        .from("ng_election_pu_results")
        .upsert(batch, { onConflict: "election_id,state_code,lga_name,pu_code,party_code" });

      if (!insertErr) break;

      if (attempts >= 5) {
        console.error(`Batch ${Math.floor(i / BATCH) + 1} failed after 5 attempts:`, insertErr.message);
        process.exit(1);
      }
      const wait = attempts * 2000;
      console.warn(`  Retry ${attempts} in ${wait}ms (batch ${Math.floor(i / BATCH) + 1}):`, insertErr.message);
      await new Promise((r) => setTimeout(r, wait));
    }

    if ((i / BATCH) % 20 === 0) {
      console.log(`  ${Math.min(i + BATCH, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
    }
  }

  console.log("\nDone. PU data seeded for presidential_2023.");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
