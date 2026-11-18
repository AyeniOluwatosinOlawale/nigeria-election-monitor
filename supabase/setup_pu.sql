-- =============================================================================
-- Polling Unit results table
-- Run once in Supabase SQL Editor after setup.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS ng_election_pu_results (
  id                BIGSERIAL PRIMARY KEY,
  election_id       TEXT NOT NULL REFERENCES ng_elections(id) ON DELETE CASCADE,
  state_code        TEXT NOT NULL,
  lga_name          TEXT NOT NULL,
  pu_code           TEXT NOT NULL,
  pu_name           TEXT NOT NULL,
  party_code        TEXT NOT NULL,
  votes             INTEGER NOT NULL DEFAULT 0,
  accredited_voters INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('declared','collating','pending')),
  over_voted        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, state_code, lga_name, pu_code, party_code)
);

ALTER TABLE ng_election_pu_results REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS idx_pu_results_election_lga
  ON ng_election_pu_results (election_id, state_code, lga_name);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ng_election_pu_results;
