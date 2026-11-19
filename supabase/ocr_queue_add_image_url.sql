-- Add image_url column to ocr_queue for direct INEC IREV S3 links
-- Run once in Supabase SQL Editor

ALTER TABLE ocr_queue
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Make storage_path nullable — not needed when image_url is provided
ALTER TABLE ocr_queue
  ALTER COLUMN storage_path DROP NOT NULL;

-- Index for jobs that came from IREV (have an image_url)
CREATE INDEX IF NOT EXISTS idx_ocr_queue_image_url
  ON ocr_queue (status)
  WHERE image_url IS NOT NULL;
