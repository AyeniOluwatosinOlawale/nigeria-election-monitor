-- =============================================================================
-- Clear all seed/estimated data — OCR-only mode
-- =============================================================================
-- Run in Supabase SQL Editor to remove all pre-seeded results.
-- ng_elections definitions (table of election IDs) are preserved.
-- Data will only be populated via OCR from INEC IREV result sheets.
-- =============================================================================

TRUNCATE ng_election_pu_results;
TRUNCATE ng_election_lga_results;
TRUNCATE ng_election_state_results;
