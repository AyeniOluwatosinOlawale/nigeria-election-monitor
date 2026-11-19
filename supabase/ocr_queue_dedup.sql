-- Unique index on image_url — prevents duplicate queue entries on re-scrape
-- Run once in Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocr_queue_image_url_unique
  ON ocr_queue (image_url)
  WHERE image_url IS NOT NULL;
