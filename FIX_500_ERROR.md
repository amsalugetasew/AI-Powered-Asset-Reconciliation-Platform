# Fix 500 Error - Add Missing Database Columns

## Problem

You're getting a 500 error when processing reconciliation:
```
api/reconciliation/process/72:1 Failed to load resource: the server responded with a status of 500
```

This is because the database is missing the new `customer_duplicates` and `internal_duplicates` columns.

## Solution

### Step 1: Run the Migration Script

Open a terminal in the backend folder and run:

```bash
cd backend
python add_duplicate_columns.py
```

**Expected Output:**
```
======================================================================
DATABASE MIGRATION: Add Duplicate Columns
======================================================================

Current columns in reconciliations table:
  - id
  - user_id
  - customer_file
  - internal_file
  - status
  - created_at
  - completed_at
  - total_customer_records
  - total_internal_records
  - rule_matched
  - ai_matched
  - manual_review
  - customer_unmatched
  - internal_unmatched
  - report_path

Adding missing columns...
✓ Added customer_duplicates column
✓ Added internal_duplicates column

======================================================================
✓ MIGRATION COMPLETED SUCCESSFULLY!
======================================================================

NEXT STEPS:
1. Restart your Flask backend
2. Try processing a reconciliation again
```

### Step 2: Restart Backend

**Stop the backend** (Ctrl+C in the terminal where Flask is running)

**Start it again:**
```bash
python app.py
```

### Step 3: Try Processing Again

1. Go to your web interface
2. Upload files and click "Process"
3. The 500 error should be gone!

## What This Migration Does

The migration adds two new columns to the `reconciliations` table:

- `customer_duplicates` (INTEGER, DEFAULT 0)
- `internal_duplicates` (INTEGER, DEFAULT 0)

These columns store the count of duplicate records found during processing.

## If Migration Fails

### Error: "Table doesn't exist"

**Cause:** Database hasn't been initialized

**Solution:**
```bash
cd backend
python
>>> from app import app, db
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

Then run the migration again.

### Error: "Column already exists"

**Cause:** Columns were already added

**Solution:** No action needed! Just restart your backend.

### Error: "Permission denied"

**Cause:** Database file is locked or you don't have write permissions

**Solution:**
1. Stop the Flask backend
2. Make sure no other process is using the database
3. Run the migration again
4. Restart the backend

## Verify Migration Worked

After running the migration, you can verify it worked by:

### Option 1: Check Backend Startup

When you start the backend, you should see no errors related to database columns.

### Option 2: Run a Test Query

```bash
cd backend
python
>>> from app import app, db
>>> from models import Reconciliation
>>> with app.app_context():
...     r = Reconciliation.query.first()
...     if r:
...         print(f"Has customer_duplicates: {hasattr(r, 'customer_duplicates')}")
...         print(f"Has internal_duplicates: {hasattr(r, 'internal_duplicates')}")
>>> exit()
```

Should output:
```
Has customer_duplicates: True
Has internal_duplicates: True
```

### Option 3: Process a Reconciliation

Upload files and process - you should see:
- No 500 error
- Processing completes successfully
- Dashboard shows duplicate counts

## What Changed

### Before Migration:
```
Total = Matched + Unmatched (WRONG - doesn't account for duplicates!)
```

### After Migration:
```
Total Uploaded = Unique Records + Duplicates
Where:
  Unique Records = Matched + Unmatched
  Duplicates = 2nd, 3rd, etc. occurrences (standalone)
```

### Example:
```
143 records uploaded
├─ 133 unique records
│  ├─ 80 matched
│  └─ 53 unmatched
└─ 10 duplicates (2nd, 3rd occurrences)

Verification: 133 + 10 = 143 ✓
```

## Troubleshooting

### Still Getting 500 Error After Migration

1. **Check backend console** for the actual error message
2. **Verify migration ran successfully** (should see "✓ MIGRATION COMPLETED")
3. **Restart backend** completely (stop and start)
4. **Check database** has the new columns

### Dashboard Shows 0 Duplicates

If the migration ran but dashboard still shows 0 duplicates for old reconciliations:

**This is expected!** Only NEW reconciliations (processed after the migration) will have duplicate counts. Old reconciliations were saved without this data.

**Solution:** Process a new reconciliation and it will show correct duplicate counts.

### Can't Connect to Database

**Error:** `OperationalError: unable to open database file`

**Solution:**
1. Check `DATABASE_URL` in your `.env` file
2. Make sure the database file exists and is accessible
3. Check file permissions

## Summary

✅ Run `python add_duplicate_columns.py`  
✅ Restart backend  
✅ Try processing again  
✅ 500 error should be fixed!  

The system now correctly tracks and displays duplicate counts in both the dashboard and Excel reports.
