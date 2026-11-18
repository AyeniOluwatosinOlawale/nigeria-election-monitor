import type { Party, NigeriaState, SenatorialDistrict, Zone } from "./types";

export const PARTIES: Party[] = [
  { code: "APC", name: "All Progressives Congress", color: "#1E40AF", shortName: "APC" },
  { code: "PDP", name: "Peoples Democratic Party", color: "#DC2626", shortName: "PDP" },
  { code: "LP", name: "Labour Party", color: "#16A34A", shortName: "LP" },
  { code: "NNPP", name: "New Nigeria Peoples Party", color: "#D97706", shortName: "NNPP" },
  { code: "ADC", name: "African Democratic Congress", color: "#7C3AED", shortName: "ADC" },
  { code: "SDP", name: "Social Democratic Party", color: "#0891B2", shortName: "SDP" },
  { code: "APGA", name: "All Progressives Grand Alliance", color: "#F59E0B", shortName: "APGA" },
  { code: "YPP", name: "Young Progressives Party", color: "#EC4899", shortName: "YPP" },
  { code: "AA", name: "Action Alliance", color: "#F97316", shortName: "AA" },
  { code: "ZLP", name: "Zenith Labour Party", color: "#84CC16", shortName: "ZLP" },
  { code: "BOOT", name: "Boot Party", color: "#06B6D4", shortName: "BOOT" },
  { code: "NRM", name: "National Rescue Movement", color: "#8B5CF6", shortName: "NRM" },
  { code: "PRP", name: "Peoples Redemption Party", color: "#059669", shortName: "PRP" },
  { code: "OTHERS", name: "Other Parties", color: "#9CA3AF", shortName: "Others" },
];

export const PARTY_MAP: Record<string, Party> = Object.fromEntries(
  PARTIES.map((p) => [p.code, p])
);

export const STATES: NigeriaState[] = [
  // North West (7)
  { code: "SO", name: "Sokoto", zone: "NW", capital: "Sokoto", lgas: 23, registeredVoters: 2100000 },
  { code: "KB", name: "Kebbi", zone: "NW", capital: "Birnin Kebbi", lgas: 21, registeredVoters: 1900000 },
  { code: "ZA", name: "Zamfara", zone: "NW", capital: "Gusau", lgas: 14, registeredVoters: 1800000 },
  { code: "KT", name: "Katsina", zone: "NW", capital: "Katsina", lgas: 34, registeredVoters: 3200000 },
  { code: "KN", name: "Kano", zone: "NW", capital: "Kano", lgas: 44, registeredVoters: 5800000 },
  { code: "JI", name: "Jigawa", zone: "NW", capital: "Dutse", lgas: 27, registeredVoters: 2200000 },
  { code: "KD", name: "Kaduna", zone: "NW", capital: "Kaduna", lgas: 23, registeredVoters: 3900000 },
  // North East (6)
  { code: "BO", name: "Borno", zone: "NE", capital: "Maiduguri", lgas: 27, registeredVoters: 2400000 },
  { code: "YO", name: "Yobe", zone: "NE", capital: "Damaturu", lgas: 17, registeredVoters: 1300000 },
  { code: "AD", name: "Adamawa", zone: "NE", capital: "Yola", lgas: 21, registeredVoters: 1900000 },
  { code: "GO", name: "Gombe", zone: "NE", capital: "Gombe", lgas: 11, registeredVoters: 1200000 },
  { code: "BA", name: "Bauchi", zone: "NE", capital: "Bauchi", lgas: 20, registeredVoters: 2300000 },
  { code: "TA", name: "Taraba", zone: "NE", capital: "Jalingo", lgas: 16, registeredVoters: 1500000 },
  // North Central (7)
  { code: "NI", name: "Niger", zone: "NC", capital: "Minna", lgas: 25, registeredVoters: 2500000 },
  { code: "KW", name: "Kwara", zone: "NC", capital: "Ilorin", lgas: 16, registeredVoters: 1700000 },
  { code: "FC", name: "FCT", zone: "NC", capital: "Abuja", lgas: 6, registeredVoters: 1900000 },
  { code: "KO", name: "Kogi", zone: "NC", capital: "Lokoja", lgas: 21, registeredVoters: 2000000 },
  { code: "NA", name: "Nasarawa", zone: "NC", capital: "Lafia", lgas: 13, registeredVoters: 1300000 },
  { code: "PL", name: "Plateau", zone: "NC", capital: "Jos", lgas: 17, registeredVoters: 2200000 },
  { code: "BE", name: "Benue", zone: "NC", capital: "Makurdi", lgas: 23, registeredVoters: 2500000 },
  // South West (6)
  { code: "LA", name: "Lagos", zone: "SW", capital: "Lagos", lgas: 20, registeredVoters: 7600000 },
  { code: "OG", name: "Ogun", zone: "SW", capital: "Abeokuta", lgas: 20, registeredVoters: 2300000 },
  { code: "OY", name: "Oyo", zone: "SW", capital: "Ibadan", lgas: 33, registeredVoters: 3200000 },
  { code: "OS", name: "Osun", zone: "SW", capital: "Osogbo", lgas: 30, registeredVoters: 1900000 },
  { code: "ON", name: "Ondo", zone: "SW", capital: "Akure", lgas: 18, registeredVoters: 1800000 },
  { code: "EK", name: "Ekiti", zone: "SW", capital: "Ado Ekiti", lgas: 16, registeredVoters: 1000000 },
  // South South (6)
  { code: "RV", name: "Rivers", zone: "SS", capital: "Port Harcourt", lgas: 23, registeredVoters: 3300000 },
  { code: "DL", name: "Delta", zone: "SS", capital: "Asaba", lgas: 25, registeredVoters: 2700000 },
  { code: "ED", name: "Edo", zone: "SS", capital: "Benin City", lgas: 18, registeredVoters: 2200000 },
  { code: "BY", name: "Bayelsa", zone: "SS", capital: "Yenagoa", lgas: 8, registeredVoters: 950000 },
  { code: "CR", name: "Cross River", zone: "SS", capital: "Calabar", lgas: 18, registeredVoters: 1700000 },
  { code: "AK", name: "Akwa Ibom", zone: "SS", capital: "Uyo", lgas: 31, registeredVoters: 2400000 },
  // South East (5)
  { code: "AN", name: "Anambra", zone: "SE", capital: "Awka", lgas: 21, registeredVoters: 2300000 },
  { code: "IM", name: "Imo", zone: "SE", capital: "Owerri", lgas: 27, registeredVoters: 2100000 },
  { code: "EN", name: "Enugu", zone: "SE", capital: "Enugu", lgas: 17, registeredVoters: 1900000 },
  { code: "AB", name: "Abia", zone: "SE", capital: "Umuahia", lgas: 17, registeredVoters: 1500000 },
  { code: "EB", name: "Ebonyi", zone: "SE", capital: "Abakaliki", lgas: 13, registeredVoters: 1300000 },
];

export const STATE_MAP: Record<string, NigeriaState> = Object.fromEntries(
  STATES.map((s) => [s.code, s])
);

export const ZONE_NAMES: Record<Zone, string> = {
  NW: "North West",
  NE: "North East",
  NC: "North Central",
  SW: "South West",
  SS: "South South",
  SE: "South East",
};

export const ZONE_COLORS: Record<Zone, string> = {
  NW: "#1D4ED8",
  NE: "#7C3AED",
  NC: "#059669",
  SW: "#D97706",
  SS: "#DC2626",
  SE: "#0891B2",
};

// Grid positions for Nigeria state cartogram (col 0-8, row 0-5)
export const STATE_GRID = [
  // Row 0 — Far North
  { code: "SO", col: 1, row: 0 }, { code: "KB", col: 2, row: 0 },
  { code: "ZA", col: 3, row: 0 }, { code: "KT", col: 4, row: 0 },
  { code: "KN", col: 5, row: 0 }, { code: "JI", col: 6, row: 0 },
  { code: "YO", col: 7, row: 0 }, { code: "BO", col: 8, row: 0 },
  // Row 1 — North scattered
  { code: "NI", col: 2, row: 1 }, { code: "KD", col: 4, row: 1 },
  { code: "BA", col: 6, row: 1 }, { code: "GO", col: 7, row: 1 },
  { code: "AD", col: 8, row: 1 },
  // Row 2 — Middle belt
  { code: "KW", col: 1, row: 2 }, { code: "FC", col: 3, row: 2 },
  { code: "NA", col: 4, row: 2 }, { code: "PL", col: 5, row: 2 },
  { code: "BE", col: 6, row: 2 }, { code: "TA", col: 7, row: 2 },
  // Row 3 — South transition
  { code: "LA", col: 0, row: 3 }, { code: "OG", col: 1, row: 3 },
  { code: "OY", col: 2, row: 3 }, { code: "KO", col: 3, row: 3 },
  { code: "DL", col: 5, row: 3 }, { code: "EN", col: 6, row: 3 },
  { code: "CR", col: 7, row: 3 },
  // Row 4 — South
  { code: "OS", col: 1, row: 4 }, { code: "EK", col: 2, row: 4 },
  { code: "ED", col: 3, row: 4 }, { code: "AN", col: 5, row: 4 },
  { code: "EB", col: 6, row: 4 }, { code: "AK", col: 7, row: 4 },
  // Row 5 — Coastal south
  { code: "ON", col: 2, row: 5 }, { code: "BY", col: 3, row: 5 },
  { code: "RV", col: 4, row: 5 }, { code: "IM", col: 5, row: 5 },
  { code: "AB", col: 6, row: 5 },
];

// Senatorial districts: 3 per state (North/Central/South or East/West/Central), 1 for FCT = 109
// Naming follows typical INEC patterns
const SENATE_SUFFIXES: Record<string, [string, string, string]> = {
  SO: ["North", "East", "South"],
  KB: ["North", "Central", "South"],
  ZA: ["North", "Central", "South"],
  KT: ["North", "Central", "South"],
  KN: ["North", "Central", "South"],
  JI: ["North", "Central", "South"],
  KD: ["North", "Central", "South"],
  BO: ["North", "Central", "South"],
  YO: ["North", "East", "West"],
  AD: ["North", "Central", "South"],
  GO: ["North", "Central", "South"],
  BA: ["North", "Central", "South"],
  TA: ["North", "Central", "South"],
  NI: ["North", "East", "South"],
  KW: ["North", "Central", "South"],
  KO: ["East", "Central", "West"],
  NA: ["East", "North", "West"],
  PL: ["North", "South", "Riyom"],
  BE: ["North", "Central", "South"],
  LA: ["East", "Central", "West"],
  OG: ["East", "Central", "West"],
  OY: ["North", "Central", "South"],
  OS: ["East", "Central", "West"],
  ON: ["North", "Central", "South"],
  EK: ["North", "Central", "South"],
  RV: ["East", "South-East", "West"],
  DL: ["North", "Central", "South"],
  ED: ["North", "Central", "South"],
  BY: ["East", "Ogbia", "West"],
  CR: ["North", "Central", "South"],
  AK: ["East", "North", "West"],
  AN: ["North", "Central", "South"],
  IM: ["East", "North", "West"],
  EN: ["East", "North", "West"],
  AB: ["North", "Central", "South"],
  EB: ["North", "Central", "South"],
};

export const SENATORIAL_DISTRICTS: SenatorialDistrict[] = [];

for (const state of STATES) {
  if (state.code === "FC") {
    // FCT has only 1 senator
    SENATORIAL_DISTRICTS.push({
      id: `FC-1`,
      name: "FCT",
      stateCode: "FC",
    });
  } else {
    const suffixes = SENATE_SUFFIXES[state.code] || ["North", "Central", "South"];
    for (let i = 0; i < 3; i++) {
      SENATORIAL_DISTRICTS.push({
        id: `${state.code}-${i + 1}`,
        name: `${state.name} ${suffixes[i]}`,
        stateCode: state.code,
      });
    }
  }
}

// Federal constituencies per state (total 360)
export const CONSTITUENCY_COUNT: Record<string, number> = {
  SO: 5, KB: 5, ZA: 4, KT: 9, KN: 15, JI: 6, KD: 9,
  BO: 8, YO: 4, AD: 6, GO: 3, BA: 7, TA: 4,
  NI: 8, KW: 5, FC: 2, KO: 7, NA: 4, PL: 5, BE: 7,
  LA: 20, OG: 5, OY: 9, OS: 6, ON: 5, EK: 4,
  RV: 9, DL: 7, ED: 5, BY: 2, CR: 5, AK: 9,
  AN: 7, IM: 8, EN: 5, AB: 4, EB: 4,
};

export const TOTAL_REGISTERED_VOTERS = STATES.reduce(
  (sum, s) => sum + (s.registeredVoters ?? 0),
  0
);
