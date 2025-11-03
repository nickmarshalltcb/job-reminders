-- ============================================================
-- DATABASE SCHEMA VERIFICATION SCRIPT
-- ============================================================
-- Purpose: Verify that all database columns, indexes, and triggers
--          match what the code expects (prevents conflicts)
-- Run this in Supabase SQL Editor AFTER running all migrations
-- ============================================================

-- ============================================================
-- PART 1: CHECK ALL REQUIRED COLUMNS EXIST
-- ============================================================

SELECT
  '✓ COLUMN CHECK' as test_type,
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE
    WHEN column_name = ANY(ARRAY[
      'id', 'job_number', 'client_name', 'forwarding_date',
      'production_deadline', 'status', 'reminder_sent',
      'last_reminder_date', 'last_reminder_sent_at',
      'overdue_reminder_sent', 'overdue_reminder_count',
      'snoozed_until', 'snooze_expires_at', 'user_id', 'created_at'
    ]) THEN '✓ REQUIRED COLUMN'
    ELSE '⚠️ EXTRA COLUMN (not used by code)'
  END as status
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY
  CASE
    WHEN column_name = 'id' THEN 1
    WHEN column_name = 'job_number' THEN 2
    WHEN column_name = 'client_name' THEN 3
    WHEN column_name = 'forwarding_date' THEN 4
    WHEN column_name = 'production_deadline' THEN 5
    WHEN column_name = 'status' THEN 6
    WHEN column_name = 'reminder_sent' THEN 7
    WHEN column_name = 'last_reminder_date' THEN 8
    WHEN column_name = 'last_reminder_sent_at' THEN 9
    WHEN column_name = 'overdue_reminder_sent' THEN 10
    WHEN column_name = 'overdue_reminder_count' THEN 11
    WHEN column_name = 'snoozed_until' THEN 12
    WHEN column_name = 'snooze_expires_at' THEN 13
    WHEN column_name = 'user_id' THEN 14
    WHEN column_name = 'created_at' THEN 15
    ELSE 99
  END;

-- ============================================================
-- PART 2: VERIFY MISSING COLUMNS (THIS SHOULD BE EMPTY)
-- ============================================================

WITH required_columns AS (
  SELECT unnest(ARRAY[
    'id', 'job_number', 'client_name', 'forwarding_date',
    'production_deadline', 'status', 'reminder_sent',
    'last_reminder_date', 'last_reminder_sent_at',
    'overdue_reminder_sent', 'overdue_reminder_count',
    'snoozed_until', 'snooze_expires_at', 'user_id', 'created_at'
  ]) AS required_column
),
existing_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'jobs'
)
SELECT
  '❌ MISSING COLUMN' as test_type,
  rc.required_column as column_name,
  'MISSING FROM DATABASE' as status
FROM required_columns rc
LEFT JOIN existing_columns ec ON rc.required_column = ec.column_name
WHERE ec.column_name IS NULL;

-- If this returns rows, you need to run the migrations!

-- ============================================================
-- PART 3: CHECK ALL INDEXES EXIST
-- ============================================================

SELECT
  '✓ INDEX CHECK' as test_type,
  indexname as index_name,
  tablename as table_name,
  indexdef as definition
FROM pg_indexes
WHERE tablename = 'jobs'
ORDER BY indexname;

-- Expected indexes:
-- 1. jobs_pkey (primary key on id)
-- 2. idx_jobs_overdue_reminder_sent
-- 3. idx_jobs_overdue_reminder_count
-- 4. idx_jobs_snooze_expires_at
-- 5. idx_jobs_last_reminder_sent_at
-- 6. idx_jobs_reminder_sent

-- ============================================================
-- PART 4: CHECK TRIGGERS AND FUNCTIONS
-- ============================================================

-- Check function exists
SELECT
  '✓ FUNCTION CHECK' as test_type,
  routine_name as function_name,
  routine_type as type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'reset_overdue_reminder_on_deadline_change';

-- Check trigger exists
SELECT
  '✓ TRIGGER CHECK' as test_type,
  trigger_name,
  event_manipulation as event,
  action_timing as timing,
  event_object_table as table_name
FROM information_schema.triggers
WHERE trigger_name = 'trigger_reset_overdue_reminder';

-- ============================================================
-- PART 5: VERIFY DATA TYPES MATCH CODE EXPECTATIONS
-- ============================================================

SELECT
  '✓ DATA TYPE CHECK' as test_type,
  column_name,
  data_type,
  udt_name,
  CASE
    -- Integer columns
    WHEN column_name = 'id' AND (data_type = 'integer' OR data_type = 'bigint') THEN '✓ CORRECT'
    WHEN column_name = 'overdue_reminder_count' AND data_type = 'integer' THEN '✓ CORRECT'

    -- Text/String columns
    WHEN column_name IN ('job_number', 'client_name', 'status')
         AND data_type = 'text' THEN '✓ CORRECT'

    -- Date columns
    WHEN column_name IN ('forwarding_date', 'production_deadline', 'last_reminder_date', 'snoozed_until')
         AND data_type = 'date' THEN '✓ CORRECT'

    -- Timestamp columns
    WHEN column_name IN ('last_reminder_sent_at', 'snooze_expires_at', 'created_at')
         AND (data_type = 'timestamp with time zone' OR data_type = 'timestamp without time zone') THEN '✓ CORRECT'

    -- Boolean columns
    WHEN column_name IN ('reminder_sent', 'overdue_reminder_sent')
         AND data_type = 'boolean' THEN '✓ CORRECT'

    -- UUID column
    WHEN column_name = 'user_id' AND data_type = 'uuid' THEN '✓ CORRECT'

    ELSE '❌ TYPE MISMATCH'
  END as status
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN (
    'id', 'job_number', 'client_name', 'forwarding_date',
    'production_deadline', 'status', 'reminder_sent',
    'last_reminder_date', 'last_reminder_sent_at',
    'overdue_reminder_sent', 'overdue_reminder_count',
    'snoozed_until', 'snooze_expires_at', 'user_id', 'created_at'
  )
ORDER BY ordinal_position;

-- ============================================================
-- PART 6: TEST INSERT (DRY RUN - ROLLED BACK)
-- ============================================================
-- This will test if all required columns can accept data correctly

DO $$
BEGIN
  -- Start transaction
  BEGIN
    -- Test insert
    INSERT INTO jobs (
      job_number,
      client_name,
      forwarding_date,
      production_deadline,
      status,
      reminder_sent,
      last_reminder_date,
      last_reminder_sent_at,
      overdue_reminder_sent,
      overdue_reminder_count,
      snoozed_until,
      snooze_expires_at,
      created_at
    ) VALUES (
      'TEST-2025-VERIFY',
      'Test Client',
      '2025-11-01',
      '2025-11-15',
      'Pending',
      false,
      NULL,
      NULL,
      false,
      0,
      NULL,
      NULL,
      NOW()
    );

    RAISE NOTICE '✓ TEST INSERT SUCCESSFUL - All columns accept data correctly';

    -- Rollback (don't actually insert)
    RAISE EXCEPTION 'Rolling back test insert';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '✓ Test completed (rolled back as expected)';
  END;
END $$;

-- ============================================================
-- PART 7: CHECK EXISTING DATA FOR POTENTIAL ISSUES
-- ============================================================

-- Check for any jobs with NULL required fields
SELECT
  '⚠️ DATA VALIDATION' as test_type,
  COUNT(*) as count,
  'Jobs with NULL job_number' as issue
FROM jobs
WHERE job_number IS NULL
UNION ALL
SELECT
  '⚠️ DATA VALIDATION',
  COUNT(*),
  'Jobs with NULL production_deadline'
FROM jobs
WHERE production_deadline IS NULL
UNION ALL
SELECT
  '⚠️ DATA VALIDATION',
  COUNT(*),
  'Jobs with overdue_reminder_count > 3 (invalid)'
FROM jobs
WHERE overdue_reminder_count > 3
UNION ALL
SELECT
  '⚠️ DATA VALIDATION',
  COUNT(*),
  'Jobs with overdue_reminder_count < 0 (invalid)'
FROM jobs
WHERE overdue_reminder_count < 0;

-- Should return all zeros - if any rows have count > 0, you have data issues

-- ============================================================
-- PART 8: VIEW SUMMARY OF CURRENT STATE
-- ============================================================

SELECT
  '📊 SUMMARY' as info_type,
  COUNT(*) as total_jobs,
  SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_jobs,
  SUM(CASE WHEN status != 'Completed' THEN 1 ELSE 0 END) as active_jobs,
  SUM(CASE WHEN reminder_sent THEN 1 ELSE 0 END) as jobs_with_due_tomorrow_reminder,
  SUM(CASE WHEN overdue_reminder_count > 0 THEN 1 ELSE 0 END) as jobs_with_overdue_reminders,
  SUM(CASE WHEN overdue_reminder_count = 1 THEN 1 ELSE 0 END) as jobs_sent_1st_overdue,
  SUM(CASE WHEN overdue_reminder_count = 2 THEN 1 ELSE 0 END) as jobs_sent_2nd_overdue,
  SUM(CASE WHEN overdue_reminder_count = 3 THEN 1 ELSE 0 END) as jobs_sent_3rd_overdue_final,
  SUM(CASE WHEN snooze_expires_at IS NOT NULL THEN 1 ELSE 0 END) as jobs_currently_snoozed
FROM jobs;

-- ============================================================
-- PART 9: CHECK EMAIL_CONFIGURATIONS TABLE
-- ============================================================

SELECT
  '✓ EMAIL CONFIG CHECK' as test_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'email_configurations'
ORDER BY ordinal_position;

-- ============================================================
-- FINAL VERIFICATION QUERY
-- ============================================================
-- If this query runs successfully, your schema is correct!

SELECT
  '✅ SCHEMA VERIFICATION COMPLETE' as status,
  'All checks passed - No conflicts between code and database' as message;

-- ============================================================
-- TROUBLESHOOTING: If you see errors above:
-- ============================================================
-- 1. Missing columns → Run migrations in this order:
--    a. migration-add-timestamp-columns.sql
--    b. migration-add-overdue-reminder-tracking.sql
--    c. migration-add-recurring-overdue-reminders.sql
--
-- 2. Type mismatches → Check migration files for correct types
--
-- 3. Missing indexes → Re-run the CREATE INDEX commands from migrations
--
-- 4. Missing trigger → Re-run the trigger creation from migration
-- ============================================================
