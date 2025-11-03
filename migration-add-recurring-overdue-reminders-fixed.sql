-- Migration: Add recurring overdue reminder tracking (FIXED VERSION)
-- Purpose: Track multiple overdue reminders (max 3: at 2, 5, and 8 days overdue)
-- Run this in your Supabase SQL Editor

-- Add new column to track how many overdue reminders have been sent
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS overdue_reminder_count INTEGER DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_jobs_overdue_reminder_count
ON jobs(overdue_reminder_count)
WHERE overdue_reminder_count < 3;

-- Migrate existing overdue_reminder_sent data to new count system
-- If overdue_reminder_sent = true, set count to 1 (first overdue reminder was sent)
UPDATE jobs
SET overdue_reminder_count = 1
WHERE overdue_reminder_sent = true AND overdue_reminder_count = 0;

-- Add comment to explain the column
COMMENT ON COLUMN jobs.overdue_reminder_count IS 'Number of overdue reminders sent (0-3): 0=none, 1=sent at 2 days, 2=sent at 5 days, 3=sent at 8 days (final)';

-- Update the trigger to also reset overdue_reminder_count when deadline changes
CREATE OR REPLACE FUNCTION reset_overdue_reminder_on_deadline_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If production_deadline has changed, reset both overdue reminder fields
  IF OLD.production_deadline IS DISTINCT FROM NEW.production_deadline THEN
    NEW.overdue_reminder_sent = FALSE;
    NEW.overdue_reminder_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (it already exists, this ensures it uses the updated function)
DROP TRIGGER IF EXISTS trigger_reset_overdue_reminder ON jobs;
CREATE TRIGGER trigger_reset_overdue_reminder
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  WHEN (OLD.production_deadline IS DISTINCT FROM NEW.production_deadline)
  EXECUTE FUNCTION reset_overdue_reminder_on_deadline_change();

-- Optional: Add a view to see reminder status easily
CREATE OR REPLACE VIEW jobs_with_reminder_status AS
SELECT
  job_number,
  client_name,
  production_deadline,
  status,
  reminder_sent,
  overdue_reminder_count,
  CASE
    WHEN overdue_reminder_count = 0 THEN 'No overdue reminders'
    WHEN overdue_reminder_count = 1 THEN '1st overdue reminder sent (2 days)'
    WHEN overdue_reminder_count = 2 THEN '2nd overdue reminder sent (5 days)'
    WHEN overdue_reminder_count = 3 THEN '3rd overdue reminder sent (8 days) - FINAL'
    ELSE 'Invalid count'
  END as reminder_status,
  CASE
    WHEN production_deadline < CURRENT_DATE THEN
      (CURRENT_DATE - production_deadline)::INTEGER
    ELSE 0
  END as days_overdue
FROM jobs
WHERE status != 'Completed'
ORDER BY production_deadline ASC;

-- Verification query (run after migration to check)
SELECT job_number, overdue_reminder_sent, overdue_reminder_count, production_deadline
FROM jobs
WHERE overdue_reminder_sent = true OR overdue_reminder_count > 0
LIMIT 10;
