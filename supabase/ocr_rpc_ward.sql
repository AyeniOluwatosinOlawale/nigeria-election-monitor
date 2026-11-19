-- =============================================================================
-- Ward/Registration Area Results Table + RPC Function
-- Run once in Supabase SQL Editor after ocr_rpc.sql
-- =============================================================================

-- ─── Ward results table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ng_election_ward_results (
  id               BIGSERIAL    PRIMARY KEY,
  election_id      TEXT         NOT NULL REFERENCES ng_elections(id) ON DELETE CASCADE,
  state_code       TEXT         NOT NULL,
  lga_name         TEXT         NOT NULL,
  ward_name        TEXT         NOT NULL,
  party_code       TEXT         NOT NULL,
  votes            INTEGER      NOT NULL DEFAULT 0,
  accredited_voters INTEGER     NOT NULL DEFAULT 0,
  reported_pus     INTEGER      NOT NULL DEFAULT 0,
  status           TEXT         NOT NULL DEFAULT 'collating'
                   CHECK (status IN ('declared','collating','pending')),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (election_id, state_code, lga_name, ward_name, party_code)
);

CREATE INDEX IF NOT EXISTS idx_ward_results_election_state
  ON ng_election_ward_results (election_id, state_code);

CREATE INDEX IF NOT EXISTS idx_ward_results_election_lga
  ON ng_election_ward_results (election_id, state_code, lga_name);

-- Realtime
ALTER TABLE ng_election_ward_results REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ng_election_ward_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ng_election_ward_results;
  END IF;
END $$;

-- Public read
CREATE POLICY "public can read ward results"
  ON ng_election_ward_results FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE ng_election_ward_results ENABLE ROW LEVEL SECURITY;

-- ─── Ward-level atomic increment RPC ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ocr_ward_result(
  p_election_id TEXT,
  p_state_code  TEXT,
  p_lga_name    TEXT,
  p_ward_name   TEXT,
  p_party_code  TEXT,
  p_votes       INTEGER,
  p_accredited  INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ng_election_ward_results
    (election_id, state_code, lga_name, ward_name, party_code,
     votes, accredited_voters, reported_pus, status)
  VALUES
    (p_election_id, p_state_code, p_lga_name, p_ward_name, p_party_code,
     p_votes, p_accredited, 1, 'collating')
  ON CONFLICT (election_id, state_code, lga_name, ward_name, party_code)
  DO UPDATE SET
    votes             = ng_election_ward_results.votes + EXCLUDED.votes,
    accredited_voters = ng_election_ward_results.accredited_voters + EXCLUDED.accredited_voters,
    reported_pus      = ng_election_ward_results.reported_pus + 1,
    status            = 'collating',
    updated_at        = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ocr_ward_result TO anon, authenticated, service_role;
