-- Migration: Add timestamp columns for better reminder and snooze handling
-- Run this in your Supabase SQL Editor

-- Add new columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snooze_expires_at TIMESTAMPTZ;

-- Add index on snooze_expires_at for performance
CREATE INDEX IF NOT EXISTS idx_jobs_snooze_expires_at
ON jobs(snooze_expires_at)
WHERE snooze_expires_at IS NOT NULL;

-- Add index on last_reminder_sent_at for querying
CREATE INDEX IF NOT EXISTS idx_jobs_last_reminder_sent_at
ON jobs(last_reminder_sent_at);

-- Add index on reminder_sent for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_reminder_sent
ON jobs(reminder_sent);

-- Migrate existing snoozed_until to snooze_expires_at timestamps
-- If snoozed_until is already a timestamp, use it directly
-- If it's a date string, convert to 9:00 AM PKT (4:00 AM UTC)
UPDATE jobs
SET snooze_expires_at =
  CASE
    -- If snoozed_until is already a full timestamp, use it
    WHEN snoozed_until::text LIKE '%:%' THEN snoozed_until::timestamptz
    -- If it's just a date, add 4:00 AM UTC (9:00 AM PKT)
    ELSE (snoozed_until::date + interval '4 hours')::timestamptz
  END
WHERE snoozed_until IS NOT NULL
AND snooze_expires_at IS NULL;

-- Migrate existing last_reminder_date to last_reminder_sent_at
-- Similar logic: handle both date and timestamp formats
UPDATE jobs
SET last_reminder_sent_at =
  CASE
    -- If last_reminder_date is already a timestamp, use it
    WHEN last_reminder_date::text LIKE '%:%' THEN last_reminder_date::timestamptz
    -- If it's just a date, add 4:00 AM UTC (9:00 AM PKT)
    ELSE (last_reminder_date::date + interval '4 hours')::timestamptz
  END
WHERE last_reminder_date IS NOT NULL
AND last_reminder_sent_at IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN jobs.last_reminder_sent_at IS 'Exact timestamp when the last reminder email was sent';
COMMENT ON COLUMN jobs.snooze_expires_at IS 'Exact timestamp when the snooze period expires and reminder should be sent';

-- Note: Keep snoozed_until and last_reminder_date for backward compatibility
-- They can be removed in a future migration after confirming everything works
