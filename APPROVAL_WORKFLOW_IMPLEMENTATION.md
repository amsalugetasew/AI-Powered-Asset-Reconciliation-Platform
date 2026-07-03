# Approval Workflow Implementation

## Overview
Comprehensive approval workflow system for reconciliation records with group-based approval by category.

**Implementation Date**: July 3, 2026  
**Status**: ⏳ In Progress - Database migration and frontend needed

---

## Features Implemented

### 1. ✅ Database Model Updates
**File**: `backend/models.py`

**New Fields in ReconciliationRecord**:
- `approval_status` - VARCHAR(50), default 'pending'
  - Values: 'pending', 'reconciled', 'not_reconciled'
- `approved_by` - Foreign key to User table
- `approved_at` - DateTime timestamp

**Migration Script Created**:
- `backend/migrations/versions/add_approval_status_20260703_001.py`
- Adds approval columns
- Creates foreign key constraint
- Creates index on approval_status

### 2. ✅ Backend API Endpoints

#### GET `/api/reconciliation/records/approval-summary/<reconciliation_id>`
**Purpose**: Get counts of records by category and approval status

**Response**:
```json
{
  "reconciliation_id": 123,
  "summary": {
    "Exact Match": {
      "total": 100,
      "pending": 50,
      "reconciled": 40,
      "not_reconciled": 10
    },
    "AI Match": { ... },
    "Manual Review": { ... },
    "Unmatched": { ... }
  }
}
```

#### POST `/api/reconciliation/records/approve-group`
**Purpose**: Approve all records in a category

**Request**:
```json
{
  "reconciliation_id": 123,
  "category": "Exact Match",
  "approval_decision": "reconciled"
}
```

**Features**:
- Manager/Admin only (RBAC protected)
- Approves all records in category at once
- Updates approval_status, approved_by, approved_at
- Logs to audit trail
- Handles "Unmatched" as combined category

### 3. ✅ Approval Page Frontend
**File**: `frontend/src/pages/ApprovalPage.jsx`

**Features**:
- Manager/Admin only access
- Shows 4 category cards:
  - Exact Match (green)
  - AI Match (purple)
  - Manual Review (yellow)
  - Unmatched (red)
- Each card shows:
  - Total records count
  - Pending/Reconciled/Not Reconciled counts
  - Sample records table (first 5)
  - Approval action buttons
- Two approval options per category:
  - "Mark as Reconciled" (green button)
  - "Mark as Not Reconciled" (red button)

### 4. ✅ Results Page Updates
**File**: `frontend/src/pages/Results.jsx`

**Changes**:
- Added "Approve Records" button (Manager+ only)
- Added `approval_status` column to table
- Column shows: Pending, Reconciled, or Not Reconciled badge
- Clicking "Approve Records" navigates to `/approval/:id`

### 5. ✅ Route Configuration
**File**: `frontend/src/App.jsx`

**New Route**:
```jsx
<Route path="approval/:id" element={
  <RoleProtectedRoute requiredRole="manager">
    <ApprovalPage />
  </RoleProtectedRoute>
} />
```

---

## Workflow

### User Flow

1. **Officer uploads and processes files**
   - Reconciliation completes
   - Records stored with `approval_status = 'pending'`

2. **Officer views results**
   - Sees "Approval Status" column showing "Pending"
   - Cannot see "Approve Records" button (Officer role)

3. **Manager/Admin views results**
   - Sees "Approval Status" column showing "Pending"
   - Sees "Approve Records" button
   - Clicks "Approve Records"

4. **Approval Page**
   - Shows 4 category cards
   - Each card shows:
     - Statistics (total, pending, approved counts)
     - Sample records
     - Approval buttons

5. **Manager approves a category**
   - Clicks "Mark as Reconciled" for "Exact Match"
   - All Exact Match records updated:
     - `approval_status` = 'reconciled'
     - `approved_by` = manager's user ID
     - `approved_at` = current timestamp
   - Action logged to audit trail

6. **Back to Results Page**
   - "Approval Status" column now shows "Reconciled" for approved records
   - "Pending" for not yet approved

---

## Database Schema

### Before
```sql
CREATE TABLE reconciliation_records (
    id INTEGER PRIMARY KEY,
    reconciliation_id INTEGER,
    match_category VARCHAR(100),
    ...
);
```

### After
```sql
CREATE TABLE reconciliation_records (
    id INTEGER PRIMARY KEY,
    reconciliation_id INTEGER,
    match_category VARCHAR(100),
    approval_status VARCHAR(50) DEFAULT 'pending',
    approved_by INTEGER,
    approved_at DATETIME,
    ...
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX ix_reconciliation_records_approval_status 
ON reconciliation_records(approval_status);
```

---

## Approval Status Values

| Status | Description | Set By | When |
|--------|-------------|--------|------|
| `pending` | Not yet reviewed | System | Initial record creation |
| `reconciled` | Approved as correctly matched | Manager/Admin | Approval action |
| `not_reconciled` | Marked as incorrect match | Manager/Admin | Approval action |

---

## API Endpoints Summary

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/reconciliation/records/<id>` | All | Now includes `approval_status` in response |
| GET | `/api/reconciliation/records/approval-summary/<id>` | All | Get approval statistics |
| POST | `/api/reconciliation/records/approve-group` | Manager+ | Approve category group |
| POST | `/api/reconciliation/<id>/approve` | Manager+ | DEPRECATED - use approve-group |

---

## Frontend Components

### ApprovalPage.jsx
**Path**: `frontend/src/pages/ApprovalPage.jsx`

**Key Functions**:
- `fetchData()` - Loads reconciliation, summary, and records
- `handleApprove(category, decision)` - Approves a category group
- `getApprovalStatusBadge(status)` - Returns colored badge
- `getCategoryColor(color)` - Returns category styling

**UI Elements**:
- Category cards with border-left color coding
- Statistics dashboard (total, pending, reconciled, not reconciled)
- Records table showing first 5 records
- Approval action buttons
- Loading states
- Success/error toasts

### Results.jsx Updates
**New Elements**:
- "Approve Records" button (Manager+ only)
- `approval_status` column in visible columns list
- Import `ManagerOnly`, `useAuth` from RoleGuard

---

## Deployment Steps

### 1. Run Database Migration
```bash
cd backend
flask db upgrade
```

### 2. Verify Migration
```bash
flask db current
# Should show: add_approval_status_20260703_001
```

### 3. Check Database
```sql
-- Verify new columns exist
DESCRIBE reconciliation_records;

-- Check default values
SELECT id, approval_status, approved_by, approved_at 
FROM reconciliation_records 
LIMIT 5;
```

### 4. Test Approval Workflow
1. Login as Manager/Admin
2. Navigate to completed reconciliation
3. Click "Approve Records"
4. Approve each category
5. Verify records updated
6. Check audit trail

---

## Security

### RBAC Protection
- Approval page: Manager+ only
- Approve endpoint: Manager+ only (`@require_role('manager')`)
- Audit logging: All approval actions logged

### Validation
- Reconciliation must exist
- Category must be valid
- Decision must be 'reconciled' or 'not_reconciled'
- Cannot approve non-existent records

### Audit Trail
Every approval action logs:
- User ID (who approved)
- Operation type: 'APPROVE_RECORD_GROUP'
- Resource: reconciliation_records
- Details: category, decision, count

---

## Testing Checklist

### Backend
- [ ] Run migration successfully
- [ ] Verify columns added to database
- [ ] Test approval-summary endpoint
- [ ] Test approve-group endpoint with valid data
- [ ] Test approve-group with invalid category
- [ ] Test approve-group with invalid decision
- [ ] Test RBAC protection (Officer cannot approve)
- [ ] Verify audit log entries created

### Frontend
- [ ] Approval page loads for Manager/Admin
- [ ] Approval page blocked for Officers
- [ ] Category cards display correctly
- [ ] Statistics show accurate counts
- [ ] Records table shows sample data
- [ ] "Mark as Reconciled" button works
- [ ] "Mark as Not Reconciled" button works
- [ ] Success toast appears
- [ ] Data refreshes after approval
- [ ] Approval status column shows in Results
- [ ] "Approve Records" button visible to Manager/Admin
- [ ] "Approve Records" button hidden from Officers

---

## Known Limitations

1. **Bulk Approval Only**: Cannot approve individual records, only entire categories
   - Future: Add checkbox selection for individual approval

2. **No Undo**: Once approved, must manually update database to revert
   - Future: Add "Reset Approval" button

3. **No Approval Comments**: Cannot add notes/reasons for decisions
   - Future: Add optional comment field

4. **No Partial Approval**: All-or-nothing per category
   - Future: Add filtering before approval

---

## Future Enhancements

### Phase 2
1. **Individual Record Approval**
   - Checkboxes on records table
   - Bulk select/deselect
   - Approve selected records

2. **Approval Workflow States**
   - Draft → Pending → Approved → Finalized
   - Multi-stage approval

3. **Approval Comments**
   - Add reason/note field
   - Store approval justification

4. **Approval History**
   - View approval timeline
   - See who approved when
   - Rollback capability

5. **Email Notifications**
   - Notify officer when approved
   - Notify manager when ready for approval

6. **Conditional Approval**
   - Filter records before approval
   - Approve only high-confidence matches
   - Set approval thresholds

---

## Files Modified/Created

### Backend
- ✅ `backend/models.py` - Added approval fields
- ✅ `backend/routes/reconciliation_routes.py` - Added approval endpoints
- ✅ `backend/migrations/versions/add_approval_status_20260703_001.py` - Migration script

### Frontend
- ✅ `frontend/src/pages/ApprovalPage.jsx` - New approval page
- ✅ `frontend/src/pages/Results.jsx` - Added approve button and column
- ✅ `frontend/src/App.jsx` - Added approval route

### Documentation
- ✅ `APPROVAL_WORKFLOW_IMPLEMENTATION.md` - This file

---

## Summary

✅ **Implemented Features**:
1. Database schema with approval status tracking
2. Group-based approval by category
3. Approval summary API
4. Dedicated approval page for Managers/Admins
5. Visual category cards with statistics
6. Approval status column in results table
7. RBAC protection
8. Audit trail logging

⏳ **Pending**:
1. Run database migration
2. Test frontend approval workflow
3. Verify approval status displays correctly

The approval workflow provides managers with a centralized interface to review and approve reconciliation results by category, with full audit trail and RBAC protection.
