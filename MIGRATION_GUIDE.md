# Database Migration Guide - No Conflicts

This guide ensures your database schema matches exactly what the code expects.

---

## Step 1: Run Migrations in Correct Order

Run these SQL files **in order** in your Supabase SQL Editor:

### 1️⃣ Create Email Configuration Table (if not exists)
```bash
File: create-email-config-table.sql
```
Creates the `email_configurations` table for storing user email settings.

### 2️⃣ Add Timestamp Columns (if not exists)
```bash
File: migration-add-timestamp-columns.sql
```
Adds:
- `last_reminder_sent_at` (timestamptz)
- `snooze_expires_at` (timestamptz)
- Indexes for performance

### 3️⃣ Add Overdue Reminder Tracking
```bash
File: migration-add-overdue-reminder-tracking.sql
```
Adds:
- `overdue_reminder_sent` (boolean)
- Index for overdue reminders
- Trigger to reset flag when deadline changes

### 4️⃣ Add Recurring Overdue Reminders
```bash
File: migration-add-recurring-overdue-reminders.sql
```
Adds:
- `overdue_reminder_count` (integer, default 0)
- Index for counting reminders
- View `jobs_with_reminder_status` for easy querying
- Updates trigger to reset count when deadline changes

---

## Step 2: Verify Schema

Run the verification script:
```bash
File: VERIFY_DATABASE_SCHEMA.sql
```

This will check:
- ✓ All required columns exist
- ✓ All indexes exist
- ✓ All triggers/functions exist
- ✓ Data types match code expectations
- ✓ No data conflicts

---

## Expected Final Schema

### `jobs` Table

| Column | Type | Default | Nullable | Used By |
|--------|------|---------|----------|---------|
| **id** | integer/bigint | auto | NO | Primary key |
| **job_number** | text | - | NO | Frontend + Backend |
| **client_name** | text | - | NO | Frontend + Backend |
| **forwarding_date** | date | - | YES | Frontend |
| **production_deadline** | date | - | NO | Frontend + Backend (reminder logic) |
| **status** | text | 'Pending' | NO | Frontend + Backend |
| **reminder_sent** | boolean | false | NO | Backend (due tomorrow tracking) |
| **last_reminder_date** | date | null | YES | Legacy (keep for compatibility) |
| **last_reminder_sent_at** | timestamptz | null | YES | Backend (precise reminder tracking) |
| **overdue_reminder_sent** | boolean | false | NO | Backend (backward compatibility) |
| **overdue_reminder_count** | integer | 0 | NO | Backend (recurring reminders: 0-3) |
| **snoozed_until** | date | null | YES | Legacy (keep for compatibility) |
| **snooze_expires_at** | timestamptz | null | YES | Backend (precise snooze tracking) |
| **user_id** | uuid | - | YES | RLS (if enabled) |
| **created_at** | timestamptz | now() | NO | Audit trail |

### `email_configurations` Table

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| **id** | bigserial | auto | NO |
| **user_id** | uuid | - | NO |
| **to_email** | text | - | NO |
| **from_email** | text | - | NO |
| **from_password** | text | - | NO |
| **configured** | boolean | false | NO |
| **created_at** | timestamp | now() | NO |
| **updated_at** | timestamp | now() | NO |

---

## Code-to-Database Mapping

### Backend Functions (Snake Case → Database)

**auto-reminder-check.js** reads directly:
```javascript
job.job_number              → jobs.job_number
job.client_name             → jobs.client_name
job.production_deadline     → jobs.production_deadline
job.reminder_sent           → jobs.reminder_sent
job.overdue_reminder_count  → jobs.overdue_reminder_count
job.snooze_expires_at       → jobs.snooze_expires_at
```

**check-missed-reminders.js** maps snake_case → camelCase:
```javascript
// Database (snake_case)     → Frontend (camelCase)
job.job_number              → jobNumber
job.client_name             → clientName
job.production_deadline     → productionDeadline
job.reminder_sent           → reminderSent
job.overdue_reminder_count  → overdueReminderCount
job.snooze_expires_at       → snoozeExpiresAt
```

### Frontend (Camel Case)

**JobCard.tsx** expects:
```typescript
interface Job {
  id: number;
  jobNumber: string;
  clientName: string;
  forwardingDate: string;
  productionDeadline: string;
  status: string;
  reminderSent: boolean;
  snoozedUntil: string | null;
  snoozeExpiresAt: string | null;
  lastReminderDate: string | null;
  lastReminderSentAt: string | null;
  createdAt: string;
}
```

---

## Critical Points to Prevent Conflicts

### ✅ DO:
1. **Always use snake_case in SQL queries** (database convention)
2. **Map to camelCase before sending to frontend** (JavaScript convention)
3. **Use `overdue_reminder_count` for milestone tracking** (0-3)
4. **Use `snooze_expires_at` for precise snooze timing** (not `snoozed_until`)
5. **Use `last_reminder_sent_at` for precise tracking** (not `last_reminder_date`)

### ❌ DON'T:
1. **Don't delete legacy columns** (`last_reminder_date`, `snoozed_until`, `overdue_reminder_sent`)
   - Keep for backward compatibility
   - Frontend might reference them

2. **Don't modify column names** without updating:
   - Backend SQL queries
   - Data mapper functions
   - Frontend interfaces

3. **Don't change data types** without testing:
   - `boolean` columns must stay boolean
   - `integer` columns must stay integer
   - `timestamptz` columns must stay timestamptz

---

## Testing Checklist

After running migrations:

- [ ] Run `VERIFY_DATABASE_SCHEMA.sql` - all checks pass
- [ ] Create test job via frontend - saves correctly
- [ ] Update job deadline - trigger resets `overdue_reminder_count`
- [ ] Check `jobs_with_reminder_status` view - shows correct status
- [ ] Backend function can read all fields without errors
- [ ] Frontend displays all job data correctly

---

## Common Issues & Solutions

### Issue: "Column does not exist" error
**Solution:** Run the migration that adds that column

### Issue: "Type mismatch" error
**Solution:** Check migration file for correct data type

### Issue: Frontend shows "undefined" for field
**Solution:** Check data mapper function includes that field

### Issue: Reminder count not incrementing
**Solution:** Verify `overdue_reminder_count` column exists and is INTEGER type

### Issue: Trigger not resetting count when deadline changes
**Solution:** Run `migration-add-recurring-overdue-reminders.sql` to update trigger

---

## Rollback Plan

If you need to undo changes:

```sql
-- Remove recurring reminder column
ALTER TABLE jobs DROP COLUMN IF EXISTS overdue_reminder_count;

-- Remove first overdue reminder column
ALTER TABLE jobs DROP COLUMN IF EXISTS overdue_reminder_sent;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_reset_overdue_reminder ON jobs;
DROP FUNCTION IF EXISTS reset_overdue_reminder_on_deadline_change();

-- Drop view
DROP VIEW IF EXISTS jobs_with_reminder_status;
```

---

## Summary

✅ **Database uses snake_case** (jobs.job_number, jobs.overdue_reminder_count)
✅ **Backend reads snake_case** (auto-reminder-check.js uses job.job_number)
✅ **Mapper converts to camelCase** (check-missed-reminders.js maps to jobNumber)
✅ **Frontend uses camelCase** (JobCard.tsx uses job.jobNumber)

**No conflicts when you follow this flow!**

---

Need help? Check:
1. Run `VERIFY_DATABASE_SCHEMA.sql` to diagnose issues
2. Check Netlify function logs for "undefined" errors
3. Verify Supabase table editor shows all columns
