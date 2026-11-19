-- =============================================================================
-- OCR Increment RPC Functions — run once in Supabase SQL Editor
-- =============================================================================
-- These functions allow the OCR worker to atomically accumulate vote totals
-- across multiple result sheets without overwriting previous contributions.
-- =============================================================================

-- ─── Extend PU results table if needed ───────────────────────────────────────

ALTER TABLE ng_election_pu_results
  ADD COLUMN IF NOT EXISTS registration_area TEXT;

-- ─── State-level atomic increment ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ocr_state_result(
  p_election_id TEXT,
  p_state_code  TEXT,
  p_state_name  TEXT,
  p_zone        TEXT,
  p_party_code  TEXT,
  p_votes       INTEGER,
  p_accredited  INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ng_election_state_results
    (election_id, state_code, state_name, zone, party_code,
     votes, accredited_voters, reported_pus, status)
  VALUES
    (p_election_id, p_state_code, p_state_name, p_zone, p_party_code,
     p_votes, p_accredited, 1, 'collating')
  ON CONFLICT (election_id, state_code, party_code)
  DO UPDATE SET
    votes             = ng_election_state_results.votes + EXCLUDED.votes,
    accredited_voters = ng_election_state_results.accredited_voters + EXCLUDED.accredited_voters,
    reported_pus      = ng_election_state_results.reported_pus + 1,
    status            = 'collating',
    updated_at        = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ocr_state_result TO anon, authenticated, service_role;

-- ─── LGA-level atomic increment ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ocr_lga_result(
  p_election_id TEXT,
  p_state_code  TEXT,
  p_lga_name    TEXT,
  p_party_code  TEXT,
  p_votes       INTEGER,
  p_accredited  INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ng_election_lga_results
    (election_id, state_code, lga_name, party_code,
     votes, accredited_voters, reported_pus, status)
  VALUES
    (p_election_id, p_state_code, p_lga_name, p_party_code,
     p_votes, p_accredited, 1, 'collating')
  ON CONFLICT (election_id, state_code, lga_name, party_code)
  DO UPDATE SET
    votes             = ng_election_lga_results.votes + EXCLUDED.votes,
    accredited_voters = ng_election_lga_results.accredited_voters + EXCLUDED.accredited_voters,
    reported_pus      = ng_election_lga_results.reported_pus + 1,
    status            = 'collating',
    updated_at        = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ocr_lga_result TO anon, authenticated, service_role;

-- ─── PU-level upsert (last write wins per PU) ────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_ocr_pu_result(
  p_election_id  TEXT,
  p_state_code   TEXT,
  p_lga_name     TEXT,
  p_pu_code      TEXT,
  p_pu_name      TEXT,
  p_party_code   TEXT,
  p_votes        INTEGER,
  p_accredited   INTEGER,
  p_over_voted   BOOLEAN,
  p_reg_area     TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ng_election_pu_results
    (election_id, state_code, lga_name, pu_code, pu_name,
     registration_area, party_code, votes, accredited_voters, status, over_voted)
  VALUES
    (p_election_id, p_state_code, p_lga_name, p_pu_code, p_pu_name,
     p_reg_area, p_party_code, p_votes, p_accredited, 'collating', p_over_voted)
  ON CONFLICT (election_id, state_code, lga_name, pu_code, party_code)
  DO UPDATE SET
    votes             = EXCLUDED.votes,
    accredited_voters = EXCLUDED.accredited_voters,
    pu_name           = EXCLUDED.pu_name,
    registration_area = EXCLUDED.registration_area,
    over_voted        = EXCLUDED.over_voted,
    status            = 'collating',
    updated_at        = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ocr_pu_result TO anon, authenticated, service_role;
