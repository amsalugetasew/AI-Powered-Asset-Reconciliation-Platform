# RBAC API Testing Guide

This guide provides examples for testing the Role-Based Access Control (RBAC) features.

## Prerequisites

- Backend server running on `http://localhost:3001` (or your configured port)
- At least one admin user created (use `python backend/create_admin.py`)
- Tool for API testing: curl, Postman, or similar

## Base URL

```
http://localhost:3001/api
```

---

## 1. Authentication

### 1.1 Register New User (Default: Officer Role)

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_officer",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "john_officer",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Key Points:**
- New users automatically get `officer` role
- JWT token includes role claim
- Save the `access_token` for subsequent requests

### 1.2 Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_officer",
    "password": "SecurePass123"
  }'
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "john_officer",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.3 Get Current User Profile

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "user": {
    "id": 1,
    "username": "john_officer",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00"
  }
}
```

---

## 2. Admin Endpoints (Admin Only)

**Authentication Required:** Admin role  
**Authorization Header:** `Bearer ADMIN_ACCESS_TOKEN`

### 2.1 List All Users

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin_user",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2026-07-01T10:00:00"
    },
    {
      "id": 2,
      "username": "john_officer",
      "email": "john@example.com",
      "role": "officer",
      "created_at": "2026-07-02T10:30:00"
    }
  ],
  "total": 2
}
```

### 2.2 Create User with Specific Role

```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jane_manager",
    "email": "jane@example.com",
    "password": "ManagerPass456",
    "role": "manager"
  }'
```

**Expected Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 3,
    "username": "jane_manager",
    "email": "jane@example.com",
    "role": "manager",
    "created_at": "2026-07-02T11:00:00"
  }
}
```

**Valid Roles:** `officer`, `manager`, `admin`

### 2.3 Update User Role

```bash
curl -X PUT http://localhost:3001/api/admin/users/2/role \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "manager"
  }'
```

**Expected Response:**
```json
{
  "message": "Role updated successfully",
  "user": {
    "id": 2,
    "username": "john_officer",
    "email": "john@example.com",
    "role": "manager",
    "created_at": "2026-07-02T10:30:00"
  }
}
```

**Security Note:** Admins cannot change their own role (privilege escalation prevention)

### 2.4 Delete User

```bash
curl -X DELETE http://localhost:3001/api/admin/users/2 \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "message": "User deleted successfully",
  "deleted_user": {
    "id": 2,
    "username": "john_officer",
    "role": "officer"
  }
}
```

**Security Note:** Admins cannot delete their own account

### 2.5 View Audit Logs

```bash
# Get last 100 audit logs
curl -X GET "http://localhost:3001/api/admin/audit-logs?limit=100&offset=0" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "user_id": 1,
      "username": "admin_user",
      "operation_type": "CREATE_USER",
      "resource_type": "user",
      "resource_id": 3,
      "details": {
        "created_username": "jane_manager",
        "created_role": "manager"
      },
      "ip_address": "127.0.0.1",
      "timestamp": "2026-07-02T11:00:00"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0,
  "has_more": false
}
```

---

## 3. Reconciliation Endpoints (Role-Based Access)

### 3.1 List Reconciliations (Role-Based Filtering)

**Officer:** Sees only their own reconciliations  
**Manager/Admin:** Sees all reconciliations

```bash
curl -X GET http://localhost:3001/api/reconciliation/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Officer Response:**
```json
{
  "reconciliations": [
    {
      "id": 1,
      "user_id": 2,
      "status": "completed",
      "customer_file": "customer_20260702.xlsx",
      "internal_file": "internal_20260702.xlsx",
      "created_at": "2026-07-02T10:00:00"
    }
  ],
  "scope": "own",
  "role": "officer"
}
```

**Manager/Admin Response:**
```json
{
  "reconciliations": [
    {
      "id": 1,
      "user_id": 2,
      "status": "completed",
      ...
    },
    {
      "id": 2,
      "user_id": 3,
      "status": "processing",
      ...
    }
  ],
  "scope": "all",
  "role": "manager"
}
```

### 3.2 View Reconciliation Details

**Officer:** Can only view their own  
**Manager/Admin:** Can view any reconciliation

```bash
curl -X GET http://localhost:3001/api/reconciliation/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (authorized):**
```json
{
  "reconciliation": {
    "id": 1,
    "user_id": 2,
    "status": "completed",
    "statistics": {
      "total_customer_records": 1000,
      "rule_matched": 800,
      "ai_matched": 150,
      "manual_review": 50
    }
  }
}
```

**Error Response (officer viewing another's reconciliation):**
```json
{
  "error": "Access denied",
  "message": "You can only view your own reconciliations."
}
```

### 3.3 Download Report

**Officer:** Can only download their own reports  
**Manager/Admin:** Can download any report

```bash
curl -X GET http://localhost:3001/api/reconciliation/download/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --output report.xlsx
```

**Error Response (unauthorized):**
```json
{
  "error": "Access denied",
  "message": "You can only download your own reports."
}
```

### 3.4 Get Analytics (Role-Based Data)

**Officer:** Analytics for their reconciliations only  
**Manager/Admin:** System-wide analytics

```bash
curl -X GET http://localhost:3001/api/reconciliation/analytics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Officer Response:**
```json
{
  "total_reconciliations": 5,
  "total_customer_records": 5000,
  "total_rule_matched": 4000,
  "total_ai_matched": 750,
  "total_manual_review": 250,
  "average_match_rate": 95.0,
  "scope": "own",
  "role": "officer"
}
```

**Manager/Admin Response:**
```json
{
  "total_reconciliations": 50,
  "total_customer_records": 50000,
  "total_rule_matched": 40000,
  "total_ai_matched": 7500,
  "total_manual_review": 2500,
  "average_match_rate": 95.0,
  "scope": "all",
  "role": "manager"
}
```

---

## 4. Manager-Only Operations

**Authentication Required:** Manager or Admin role

### 4.1 Approve Exception

```bash
curl -X POST http://localhost:3001/api/reconciliation/1/approve \
  -H "Authorization: Bearer MANAGER_ACCESS_TOKEN"
```

**Success Response:**
```json
{
  "message": "Exception approved successfully",
  "reconciliation_id": 1,
  "approved_by": "jane_manager"
}
```

**Error Response (officer attempting):**
```json
{
  "error": "Insufficient permissions",
  "message": "This operation requires manager role or higher.",
  "your_role": "officer",
  "required_role": "manager"
}
```

### 4.2 Finalize Reconciliation

```bash
curl -X POST http://localhost:3001/api/reconciliation/1/finalize \
  -H "Authorization: Bearer MANAGER_ACCESS_TOKEN"
```

**Success Response:**
```json
{
  "message": "Reconciliation finalized successfully",
  "reconciliation_id": 1,
  "finalized_by": "jane_manager"
}
```

**Error Response (not completed):**
```json
{
  "error": "Cannot finalize",
  "message": "Only completed reconciliations can be finalized."
}
```

---

## 5. Error Responses

### 5.1 Missing Token

```json
{
  "error": "Authorization required",
  "message": "Request does not contain a valid token."
}
```

### 5.2 Invalid Token

```json
{
  "error": "Invalid token",
  "message": "Your token is invalid. Please login again."
}
```

### 5.3 Expired Token

```json
{
  "error": "Token expired",
  "message": "Your session has expired. Please login again."
}
```

### 5.4 Insufficient Permissions

```json
{
  "error": "Insufficient permissions",
  "message": "This operation requires admin role or higher.",
  "your_role": "officer",
  "required_role": "admin"
}
```

### 5.5 Missing Role in Token

```json
{
  "error": "Invalid token: missing role information",
  "message": "Your token does not contain role information. Please login again."
}
```

---

## 6. Testing Scenarios

### Scenario 1: Officer Workflow

1. **Register as officer** (default role)
2. **Upload files** and create reconciliation
3. **View own reconciliations** (should see only own)
4. **Attempt to view another user's reconciliation** (should get 403)
5. **View analytics** (should see only own data)
6. **Attempt manager operation** (approve/finalize) - should get 403

### Scenario 2: Manager Workflow

1. **Admin creates manager account** via `/api/admin/users`
2. **Login as manager**
3. **View all reconciliations** (system-wide)
4. **View system-wide analytics**
5. **Approve exceptions** for any reconciliation
6. **Finalize reconciliations**
7. **Attempt admin operation** (create user) - should get 403

### Scenario 3: Admin Workflow

1. **Create admin user** via `python backend/create_admin.py`
2. **Login as admin**
3. **List all users**
4. **Create new users** with different roles
5. **Update user roles**
6. **Delete users** (except self)
7. **View audit logs** of all operations
8. **View all reconciliations** system-wide
9. **Approve and finalize** reconciliations

### Scenario 4: Security Testing

1. **Officer attempts admin endpoint** - should get 403
2. **Admin attempts to delete self** - should get 400
3. **Admin attempts to change own role** - should get 400
4. **Officer attempts to view manager's reconciliation** - should get 403
5. **Expired token usage** - should get 401
6. **Invalid token usage** - should get 401

---

## 7. Postman Collection Variables

If using Postman, set these variables:

```
base_url: http://localhost:3001/api
officer_token: [paste officer JWT token]
manager_token: [paste manager JWT token]
admin_token: [paste admin JWT token]
```

Then use `{{base_url}}` and `{{admin_token}}` in your requests.

---

## 8. Quick Test Commands

```bash
# Create admin user
python backend/create_admin.py

# Login as admin and save token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  jq -r '.access_token')

# Create manager user
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","email":"manager@test.com","password":"pass123","role":"manager"}'

# View audit logs
curl -X GET "http://localhost:3001/api/admin/audit-logs?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

---

## 9. Common Issues and Solutions

### Issue: "Invalid token: missing role information"
**Solution:** User needs to login again to get updated JWT token with role claim. Old tokens don't have role information.

### Issue: Admin cannot perform operations
**Solution:** Verify the user's role is actually 'admin' in database. Use `python backend/create_admin.py` to promote user.

### Issue: 403 Forbidden on authorized operation
**Solution:** Check that JWT token is valid and not expired. Ensure role claim is present in token.

### Issue: Cannot create admin user
**Solution:** Ensure database migration has been run: `flask db upgrade`

---

## 10. Audit Trail Operations Logged

All privileged operations are automatically logged to the audit trail:

- `CREATE_USER` - Admin creates new user
- `UPDATE_ROLE` - Admin updates user role
- `DELETE_USER` - Admin deletes user
- `APPROVE_EXCEPTION` - Manager approves exception
- `FINALIZE_RECONCILIATION` - Manager finalizes reconciliation

Each log includes:
- User who performed the action
- Operation type
- Resource affected
- Detailed context (old/new values)
- IP address
- Timestamp

---

## Support

For issues or questions, refer to:
- RBAC Requirements: `.kiro/specs/rbac-security/requirements.md`
- Technical Design: `.kiro/specs/rbac-security/design.md`
- Implementation Tasks: `.kiro/specs/rbac-security/tasks.md`
