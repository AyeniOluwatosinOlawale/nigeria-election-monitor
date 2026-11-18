-- ─── OCR Queue ───────────────────────────────────────────────────────────────
-- Run this in Supabase SQL editor after setup.sql

-- 1. Queue table
CREATE TABLE IF NOT EXISTS ocr_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path    TEXT        NOT NULL,       -- e.g. result-sheets/LA/Ikeja/abc123.jpg
  file_name       TEXT,
  state_code      TEXT,
  lga_name        TEXT,
  ward_name       TEXT,
  pu_code         TEXT,
  election_id     TEXT,                       -- e.g. presidential_2027
  submitted_by    TEXT,                       -- volunteer name / phone
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | done | failed | flagged
  result          JSONB,                      -- Claude extracted JSON
  error           TEXT,
  over_voted      BOOLEAN     DEFAULT false,
  retry_count     INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status_created
  ON ocr_queue (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ocr_queue_state
  ON ocr_queue (state_code, status);

-- 3. Realtime
ALTER TABLE ocr_queue REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ocr_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ocr_queue;
  END IF;
END $$;

-- 4. Atomic job claim function (FOR UPDATE SKIP LOCKED prevents double-processing)
CREATE OR REPLACE FUNCTION claim_ocr_jobs(batch_size INTEGER DEFAULT 10)
RETURNS SETOF ocr_queue
LANGUAGE sql
AS $$
  UPDATE ocr_queue
  SET status = 'processing', started_at = NOW()
  WHERE id IN (
    SELECT id FROM ocr_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- 5. Storage bucket (run once — idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'result-sheets',
  'result-sheets',
  false,
  20971520,   -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS: anyone authenticated can upload; only service role can read
CREATE POLICY "volunteers can upload result sheets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'result-sheets');

CREATE POLICY "service role can read result sheets"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'result-sheets');

-- Allow anon uploads too (volunteers may not be logged in)
CREATE POLICY "anon can upload result sheets"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'result-sheets');
