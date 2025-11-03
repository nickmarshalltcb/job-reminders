-- Migration: Add overdue reminder tracking column
-- Purpose: Track if the 2-day overdue reminder has been sent
-- Run this in your Supabase SQL Editor

-- Add new column to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS overdue_reminder_sent BOOLEAN DEFAULT FALSE;

-- Add index for performance when filtering overdue jobs
CREATE INDEX IF NOT EXISTS idx_jobs_overdue_reminder_sent
ON jobs(overdue_reminder_sent)
WHERE overdue_reminder_sent = FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN jobs.overdue_reminder_sent IS 'Tracks if the 2-day overdue reminder has been sent (separate from 1-day-before reminder)';

-- Optional: Create a function to reset overdue flag when deadline is updated
-- This ensures that if a user extends the deadline, the overdue reminder can be sent again
CREATE OR REPLACE FUNCTION reset_overdue_reminder_on_deadline_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If production_deadline has changed, reset the overdue reminder flag
  IF OLD.production_deadline IS DISTINCT FROM NEW.production_deadline THEN
    NEW.overdue_reminder_sent = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically reset flag when deadline changes
DROP TRIGGER IF EXISTS trigger_reset_overdue_reminder ON jobs;
CREATE TRIGGER trigger_reset_overdue_reminder
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  WHEN (OLD.production_deadline IS DISTINCT FROM NEW.production_deadline)
  EXECUTE FUNCTION reset_overdue_reminder_on_deadline_change();

-- Verification query (run after migration to check)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jobs' AND column_name = 'overdue_reminder_sent';
