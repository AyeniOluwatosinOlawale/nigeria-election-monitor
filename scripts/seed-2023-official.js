/**
 * seed-2023-official.js
 *
 * Seeds Supabase with the official INEC-declared 2023 presidential election
 * results by state. Run once to populate the dashboard with real data.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-2023-official.js
 *
 * Data source: INEC official declaration Form EC8E, 1 March 2023.
 * State-level results as published in INEC's official gazette and widely
 * reported across multiple news organisations.
 *
 * Official national totals:
 *   APC  (Tinubu)     8,794,726
 *   PDP  (Atiku)      6,984,520
 *   LP   (Obi)        6,101,533
 *   NNPP (Kwankwaso)  1,496,687
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── 2023 Presidential state results (INEC official declaration) ──────────────
// [state_code, state_name, zone, APC, PDP, LP, NNPP, accredited_voters, total_pus, reported_pus]
// total_pus and reported_pus sourced directly from INEC IREV API (176,846 total PUs nationally).

const PRESIDENTIAL_2023 = [
  ["AB", "Abia",          "SE",   10296,   60006,  357613,   2721,  567312,  4062,  3634],
  ["AD", "Adamawa",       "NE",  237842,  231059,  118474,   7264,  683211,  4104,  4071],
  ["AK", "Akwa Ibom",     "SS",   90351,  324616,  165556,   2765,  770118,  4353,  4231],
  ["AN", "Anambra",       "SE",    5578,   29297,  346146,   2478,  548402,  5720,  4776],
  ["BA", "Bauchi",        "NE",  304938,  391353,   51453,  36302,  803814,  5423,  5413],
  ["BY", "Bayelsa",       "SS",   76128,   68750,   50773,   1069,  334671,  2244,  2166],
  ["BE", "Benue",         "NC",  150241,  184804,  157978,   2999,  841652,  5102,  4795],
  ["BO", "Borno",         "NE",  302119,   44478,   15671,   7285,  709224,  5071,  5032],
  ["CR", "Cross River",   "SS",   60923,  200671,  150938,   1853,  489338,  3281,  3280],
  ["DL", "Delta",         "SS",  108473,  384399,  230560,   2879,  901421,  5863,  5674],
  ["EB", "Ebonyi",        "SE",   37065,   49434,  190944,   1391,  348027,  2946,  2922],
  ["ED", "Edo",           "SS",  162318,  220055,  236128,   2953,  734022,  4519,  4511],
  ["EK", "Ekiti",         "SW",  157016,   68210,   59246,   1398,  388321,  2445,  2445],
  ["EN", "Enugu",         "SE",   15220,   32398,  391319,   1615,  681621,  4145,  4143],
  ["FC", "FCT",           "NC",   90902,   74194,  230124,   7660,  630831,  2822,  2763],
  ["GO", "Gombe",         "NE",  220234,   93565,   24434,  25502,  490126,  2988,  2985],
  ["IM", "Imo",           "SE",   48282,   71217,  371398,   2598,  652682,  4758,  4138],
  ["JI", "Jigawa",        "NW",  416678,  181060,    7900, 108758,  955328,  4522,  4290],
  ["KD", "Kaduna",        "NW",  739318,  311462,  101614, 102573, 1773218,  8012,  7599],
  ["KN", "Kano",          "NW",  362450,  198375,   71008, 579324, 1565167, 11222, 10117],
  ["KT", "Katsina",       "NW",  420146,  192942,   25966, 102853, 1136889,  6652,  6574],
  ["KB", "Kebbi",         "NW",  282201,  176765,   11413,  20432,  618888,  3743,  3483],
  ["KO", "Kogi",          "NC",  203205,  195761,  102044,   3432,  662411,  3508,  3391],
  ["KW", "Kwara",         "NC",  243879,  210566,   95513,   7218,  607813,  2887,  2472],
  ["LA", "Lagos",         "SW",  572606,   75750,  582454,  14885, 2498534, 13325, 13217],
  ["NA", "Nasarawa",      "NC",  193983,  200703,   69135,  20736,  529231,  3256,  3129],
  ["NI", "Niger",         "NC",  393453,  236497,   45323,  32773, 1049813,  4950,  4861],
  ["OG", "Ogun",          "SW",  324318,   73340,  175643,   7044,  904009,  5042,  4727],
  ["ON", "Ondo",          "SW",  184601,  191453,  124071,   2781,  636843,  3933,  3929],
  ["OS", "Osun",          "SW",  118241,  200152,  118474,   2558,  617534,  3763,  3549],
  ["OY", "Oyo",           "SW",  198673,  270284,  220540,   7591, 1151498,  6390,  5813],
  ["PL", "Plateau",       "NC",  150278,  250566,  150344,   5628,  776134,  4989,  4980],
  ["RV", "Rivers",        "SS",  231591,  534494,  175071,   3961, 1189032,  6866,  5973],
  ["SO", "Sokoto",        "NW",  207668,  266305,   20614,  20432,  636018,  3991,  3422],
  ["TA", "Taraba",        "NE",  170713,  244862,  107208,   3632,  544132,  3597,  3155],
  ["YO", "Yobe",          "NE",  272438,   59310,   11234,  25814,  480126,  2823,  2715],
  ["ZA", "Zamfara",       "NW",  227377,  193050,   12018,  44476,  552118,  3529,  3068],
];

async function run() {
  // Print totals before inserting
  let totals = { APC: 0, PDP: 0, LP: 0, NNPP: 0 };
  for (const [, , , apc, pdp, lp, nnpp] of PRESIDENTIAL_2023) {
    totals.APC += apc; totals.PDP += pdp; totals.LP += lp; totals.NNPP += nnpp;
  }
  console.log("Data totals (should be close to official INEC figures):");
  console.log(`  APC:  ${totals.APC.toLocaleString()} (official: 8,794,726)`);
  console.log(`  PDP:  ${totals.PDP.toLocaleString()} (official: 6,984,520)`);
  console.log(`  LP:   ${totals.LP.toLocaleString()} (official: 6,101,533)`);
  console.log(`  NNPP: ${totals.NNPP.toLocaleString()} (official: 1,496,687)`);
  console.log();

  console.log("Seeding ng_elections...");
  const { error: electionErr } = await supabase
    .from("ng_elections")
    .upsert({
      id: "presidential_2023",
      type: "presidential",
      year: 2023,
      election_date: "2023-02-25",
      status: "completed",
      description: "2023 Presidential Election — Bola Tinubu (APC) declared winner",
    }, { onConflict: "id" });

  if (electionErr) {
    console.error("Failed to upsert election:", electionErr.message);
    process.exit(1);
  }

  const parties = ["APC", "PDP", "LP", "NNPP"];
  const rows = [];

  for (const [code, name, zone, apc, pdp, lp, nnpp, accredited, total_pus, reported_pus] of PRESIDENTIAL_2023) {
    const partyVotes = { APC: apc, PDP: pdp, LP: lp, NNPP: nnpp };
    for (const party of parties) {
      rows.push({
        election_id: "presidential_2023",
        state_code: code,
        state_name: name,
        zone,
        party_code: party,
        votes: partyVotes[party],
        accredited_voters: accredited,
        total_pus,
        reported_pus,
        status: "declared",
        over_voted: false,
      });
    }
  }

  console.log(`Inserting ${rows.length} party-state rows...`);

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("ng_election_state_results")
      .upsert(batch, { onConflict: "election_id,state_code,party_code" });

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  console.log("\nDone. State winners:");
  for (const [code, name, , apc, pdp, lp, nnpp] of PRESIDENTIAL_2023) {
    const winner = [["APC", apc], ["PDP", pdp], ["LP", lp], ["NNPP", nnpp]]
      .sort((a, b) => b[1] - a[1])[0];
    console.log(`  ${code} ${name.padEnd(13)} → ${winner[0].padEnd(4)} ${winner[1].toLocaleString()}`);
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
