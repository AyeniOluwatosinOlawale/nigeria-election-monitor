export type ElectionType = "presidential" | "gubernatorial" | "senate" | "house_reps";
export type Zone = "NW" | "NE" | "NC" | "SW" | "SS" | "SE";
export type ResultStatus = "declared" | "collating" | "pending";

export interface Party {
  code: string;
  name: string;
  color: string;
  shortName?: string;
}

export interface NigeriaState {
  code: string;
  name: string;
  zone: Zone;
  capital: string;
  lgas: number;
  registeredVoters?: number;
}

export interface SenatorialDistrict {
  id: string;
  name: string;
  stateCode: string;
}

export interface FederalConstituency {
  id: string;
  name: string;
  stateCode: string;
}

export interface PartyResult {
  partyCode: string;
  votes: number;
  percentage?: number;
}

export interface PollingUnitResult {
  puCode: string;
  puName: string;
  wardName: string;
  lgaName: string;
  stateCode: string;
  accreditedVoters: number;
  results: PartyResult[];
  status: ResultStatus;
  reportedAt?: string;
  imageUrl?: string;
}

export interface AggregateResult {
  level: "national" | "state" | "lga" | "ward";
  id: string;
  name: string;
  stateCode?: string;
  totalPUs: number;
  reportedPUs: number;
  accreditedVoters: number;
  results: PartyResult[];
  status: ResultStatus;
  leadingParty?: string;
  margin?: number;
  /** true when total votes cast exceeds accredited voters — INEC rule violation */
  overVoted?: boolean;
}

export interface ElectionResult {
  electionType: ElectionType;
  national?: AggregateResult;
  byState: Record<string, AggregateResult>;
  byLGA?: Record<string, AggregateResult>;
  bySenatorialDistrict?: Record<string, AggregateResult>;
  byConstituency?: Record<string, AggregateResult>;
  lastUpdated: string;
}
