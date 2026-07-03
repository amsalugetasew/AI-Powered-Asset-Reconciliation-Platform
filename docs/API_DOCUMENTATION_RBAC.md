# API Documentation - Role-Based Access Control

Complete API documentation for RBAC endpoints in the AssetReconcile AI system.

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Admin Endpoints](#admin-endpoints)
3. [Reconciliation Endpoints](#reconciliation-endpoints)
4. [Authorization & Errors](#authorization--errors)
5. [Role Hierarchy](#role-hierarchy)

---

## Base URL

```
http://localhost:3001/api
```

---

## Authentication Endpoints

### POST /auth/register

Register a new user account. New users are automatically assigned the 'officer' role.

**Authorization:** None (public endpoint)

**Request Body:**
```json
{
  "username": "string (required, 3-50 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**JWT Token Claims:**
```json
{
  "sub": "1",
  "role": "officer",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Errors:**
- `400`: Missing required fields
- `400`: Username already exists
- `400`: Email already exists

---

### POST /auth/login

Authenticate user and receive access token.

**Authorization:** None (public endpoint)

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400`: Missing username or password
- `401`: Invalid username or password

---

### GET /auth/me

Get current user profile information.

**Authorization:** Bearer token required

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "officer",
    "created_at": "2026-07-02T10:30:00Z"
  }
}
```

**Errors:**
- `401`: Missing or invalid token
- `404`: User not found

---

## Admin Endpoints

All admin endpoints require the **admin** role.

### GET /admin/users

List all users in the system.

**Authorization:** Admin role required

**Request Headers:**
```
Authorization: Bearer {admin_token}
```

**Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin_user",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2026-07-01T10:00:00Z"
    },
    {
      "id": 2,
      "username": "manager_user",
      "email": "manager@example.com",
      "role": "manager",
      "created_at": "2026-07-02T10:00:00Z"
    }
  ],
  "total": 2
}
```

**Errors:**
- `401`: Missing or invalid token
- `403`: Insufficient permissions (not admin)

---

### POST /admin/users

Create a new user with specified role.

**Authorization:** Admin role required

**Request Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "string (required, 3-50 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)",
  "role": "string (required: officer|manager|admin)"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 3,
    "username": "new_manager",
    "email": "manager@test.com",
    "role": "manager",
    "created_at": "2026-07-02T11:00:00Z"
  }
}
```

**Audit Log Created:**
```json
{
  "user_id": 1,
  "operation_type": "CREATE_USER",
  "resource_type": "user",
  "resource_id": 3,
  "details": {
    "created_username": "new_manager",
    "created_role": "manager"
  }
}
```

**Errors:**
- `400`: Missing required fields
- `400`: Invalid role (must be officer/manager/admin)
- `400`: Username already exists
- `400`: Email already exists
- `401`: Missing or invalid token
- `403`: Insufficient permissions

---

### PUT /admin/users/:id/role

Update a user's role.

**Authorization:** Admin role required

**Request Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**URL Parameters:**
- `id` (integer): User ID to update

**Request Body:**
```json
{
  "role": "string (required: officer|manager|admin)"
}
```

**Response (200):**
```json
{
  "message": "Role updated successfully",
  "user": {
    "id": 2,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "manager",
    "created_at": "2026-07-02T10:30:00Z"
  }
}
```

**Audit Log Created:**
```json
{
  "user_id": 1,
  "operation_type": "UPDATE_ROLE",
  "resource_type": "user",
  "resource_id": 2,
  "details": {
    "target_username": "john_doe",
    "old_role": "officer",
    "new_role": "manager"
  }
}
```

**Security Restrictions:**
- Admins cannot change their own role (privilege escalation prevention)

**Errors:**
- `400`: Missing role field
- `400`: Invalid role value
- `400`: Cannot modify your own role
- `404`: User not found
- `401`: Missing or invalid token
- `403`: Insufficient permissions

---

### DELETE /admin/users/:id

Delete a user from the system.

**Authorization:** Admin role required

**Request Headers:**
```
Authorization: Bearer {admin_token}
```

**URL Parameters:**
- `id` (integer): User ID to delete

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "deleted_user": {
    "id": 2,
    "username": "john_doe",
    "role": "officer"
  }
}
```

**Cascade Effects:**
- All reconciliations owned by the user are deleted
- User's audit log entries are preserved (user_id becomes orphaned)

**Audit Log Created:**
```json
{
  "user_id": 1,
  "operation_type": "DELETE_USER",
  "resource_type": "user",
  "resource_id": 2,
  "details": {
    "deleted_username": "john_doe",
    "deleted_role": "officer"
  }
}
```

**Security Restrictions:**
- Admins cannot delete their own account

**Errors:**
- `400`: Cannot delete your own account
- `404`: User not found
- `401`: Missing or invalid token
- `403`: Insufficient permissions

---

### GET /admin/audit-logs

Retrieve audit logs of privileged operations.

**Authorization:** Admin role required

**Request Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `limit` (integer, optional): Maximum logs to return (default: 1000, max: 10000)
- `offset` (integer, optional): Number of logs to skip (default: 0)

**Example Request:**
```
GET /api/admin/audit-logs?limit=100&offset=0
```

**Response (200):**
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
        "created_username": "new_manager",
        "created_role": "manager"
      },
      "ip_address": "127.0.0.1",
      "timestamp": "2026-07-02T11:00:00Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0,
  "has_more": false
}
```

**Operation Types:**
- `CREATE_USER`: User created
- `UPDATE_ROLE`: User role changed
- `DELETE_USER`: User deleted
- `APPROVE_EXCEPTION`: Exception approved
- `FINALIZE_RECONCILIATION`: Reconciliation finalized
- `UPDATE_CONFIG`: System configuration changed

**Errors:**
- `401`: Missing or invalid token
- `403`: Insufficient permissions

---

## Reconciliation Endpoints

Endpoints for managing asset reconciliation processes.

### GET /reconciliation/list

List reconciliations based on user role.

**Authorization:** Bearer token required

**Role-Based Filtering:**
- **Officer**: Returns only own reconciliations
- **Manager**: Returns all reconciliations system-wide
- **Admin**: Returns all reconciliations system-wide

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "reconciliations": [
    {
      "id": 1,
      "user_id": 2,
      "customer_file": "customer_20260702.xlsx",
      "internal_file": "internal_20260702.xlsx",
      "status": "completed",
      "created_at": "2026-07-02T10:00:00Z",
      "completed_at": "2026-07-02T10:15:00Z",
      "statistics": {
        "total_customer_records": 1000,
        "total_internal_records": 1000,
        "rule_matched": 800,
        "ai_matched": 150,
        "manual_review": 50,
        "customer_unmatched": 0,
        "internal_unmatched": 0,
        "customer_duplicates": 0,
        "internal_duplicates": 0
      },
      "report_path": "/path/to/report.xlsx"
    }
  ],
  "scope": "own",
  "role": "officer"
}
```

**Response Fields:**
- `scope`: "own" (officer) or "all" (manager/admin)
- `role`: Current user's role

**Errors:**
- `401`: Missing or invalid token

---

### GET /reconciliation/:id

Get detailed information about a specific reconciliation.

**Authorization:** Bearer token required

**Role-Based Access:**
- **Officer**: Can only view own reconciliations (403 for others')
- **Manager**: Can view any reconciliation
- **Admin**: Can view any reconciliation

**URL Parameters:**
- `id` (integer): Reconciliation ID

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "reconciliation": {
    "id": 1,
    "user_id": 2,
    "customer_file": "customer_20260702.xlsx",
    "internal_file": "internal_20260702.xlsx",
    "status": "completed",
    "created_at": "2026-07-02T10:00:00Z",
    "completed_at": "2026-07-02T10:15:00Z",
    "statistics": {
      "total_customer_records": 1000,
      "total_internal_records": 1000,
      "rule_matched": 800,
      "ai_matched": 150,
      "manual_review": 50,
      "customer_unmatched": 0,
      "internal_unmatched": 0
    },
    "report_path": "/path/to/report.xlsx"
  }
}
```

**Errors:**
- `401`: Missing or invalid token
- `403`: Access denied (officer viewing another's reconciliation)
- `404`: Reconciliation not found

---

### GET /reconciliation/download/:id

Download the Excel report for a reconciliation.

**Authorization:** Bearer token required

**Role-Based Access:**
- **Officer**: Can only download own reports (403 for others')
- **Manager**: Can download any report
- **Admin**: Can download any report

**URL Parameters:**
- `id` (integer): Reconciliation ID

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="reconciliation_report_{id}.xlsx"`
- Body: Excel file binary data

**Errors:**
- `401`: Missing or invalid token
- `403`: Access denied (officer downloading another's report)
- `404`: Reconciliation or report not found

---

### GET /reconciliation/analytics

Get analytics data based on user role.

**Authorization:** Bearer token required

**Role-Based Data:**
- **Officer**: Analytics for own reconciliations only
- **Manager**: System-wide analytics
- **Admin**: System-wide analytics

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "total_reconciliations": 50,
  "total_customer_records": 50000,
  "total_internal_records": 50000,
  "total_rule_matched": 40000,
  "total_ai_matched": 7500,
  "total_manual_review": 2500,
  "average_match_rate": 95.0,
  "scope": "all",
  "role": "manager"
}
```

**Response Fields:**
- `scope`: "own" (officer) or "all" (manager/admin)
- `role`: Current user's role

**Errors:**
- `401`: Missing or invalid token

---

### POST /reconciliation/:id/approve

Approve an exception in a reconciliation (Manager+ only).

**Authorization:** Manager or Admin role required

**URL Parameters:**
- `id` (integer): Reconciliation ID

**Request Headers:**
```
Authorization: Bearer {manager_token}
```

**Response (200):**
```json
{
  "message": "Exception approved successfully",
  "reconciliation_id": 1,
  "approved_by": "manager_user"
}
```

**Audit Log Created:**
```json
{
  "user_id": 3,
  "operation_type": "APPROVE_EXCEPTION",
  "resource_type": "reconciliation",
  "resource_id": 1,
  "details": {
    "reconciliation_user_id": 2,
    "total_records": 1000
  }
}
```

**Errors:**
- `400`: Reconciliation not completed yet
- `401`: Missing or invalid token
- `403`: Insufficient permissions (officer role)
- `404`: Reconciliation not found

---

### POST /reconciliation/:id/finalize

Finalize a reconciliation (Manager+ only).

**Authorization:** Manager or Admin role required

**URL Parameters:**
- `id` (integer): Reconciliation ID

**Request Headers:**
```
Authorization: Bearer {manager_token}
```

**Response (200):**
```json
{
  "message": "Reconciliation finalized successfully",
  "reconciliation_id": 1,
  "finalized_by": "manager_user"
}
```

**Audit Log Created:**
```json
{
  "user_id": 3,
  "operation_type": "FINALIZE_RECONCILIATION",
  "resource_type": "reconciliation",
  "resource_id": 1,
  "details": {
    "reconciliation_user_id": 2,
    "total_records": 1000,
    "match_statistics": {
      "rule_matched": 800,
      "ai_matched": 150,
      "manual_review": 50
    }
  }
}
```

**Errors:**
- `400`: Reconciliation not completed yet
- `401`: Missing or invalid token
- `403`: Insufficient permissions (officer role)
- `404`: Reconciliation not found

---

## Authorization & Errors

### Authorization Header Format

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Common Error Responses

#### 401 Unauthorized

**Missing Token:**
```json
{
  "error": "Authorization required",
  "message": "Request does not contain a valid token."
}
```

**Invalid Token:**
```json
{
  "error": "Invalid token",
  "message": "Your token is invalid. Please login again."
}
```

**Expired Token:**
```json
{
  "error": "Token expired",
  "message": "Your session has expired. Please login again."
}
```

**Missing Role Claim:**
```json
{
  "error": "Invalid token: missing role information",
  "message": "Your token does not contain role information. Please login again."
}
```

#### 403 Forbidden

**Insufficient Permissions:**
```json
{
  "error": "Insufficient permissions",
  "message": "This operation requires manager role or higher.",
  "your_role": "officer",
  "required_role": "manager"
}
```

**Access Denied (Data):**
```json
{
  "error": "Access denied",
  "message": "You can only view your own reconciliations."
}
```

**Self-Modification Attempt:**
```json
{
  "error": "Cannot modify your own role",
  "message": "For security reasons, you cannot change your own role. Another admin must do this."
}
```

---

## Role Hierarchy

Roles follow a hierarchical structure:

```
Admin (Level 3)
  ├─ Full system access
  ├─ User management
  ├─ System configuration
  └─ All manager permissions

Manager (Level 2)
  ├─ System-wide data visibility
  ├─ Approve exceptions
  ├─ Finalize reconciliations
  ├─ View audit trail
  └─ All officer permissions

Officer (Level 1)
  ├─ Upload files
  ├─ View own reconciliations
  ├─ Download own reports
  └─ View own analytics
```

### Permission Matrix

| Operation | Officer | Manager | Admin |
|-----------|---------|---------|-------|
| Register/Login | ✅ | ✅ | ✅ |
| Upload Files | ✅ | ✅ | ✅ |
| View Own Data | ✅ | ✅ | ✅ |
| View All Data | ❌ | ✅ | ✅ |
| Download Own Reports | ✅ | ✅ | ✅ |
| Download Any Report | ❌ | ✅ | ✅ |
| Approve Exceptions | ❌ | ✅ | ✅ |
| Finalize Reconciliations | ❌ | ✅ | ✅ |
| View Audit Logs | ❌ | ✅ | ✅ |
| Create Users | ❌ | ❌ | ✅ |
| Update User Roles | ❌ | ❌ | ✅ |
| Delete Users | ❌ | ❌ | ✅ |

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production:

- Authentication endpoints: 5 requests/minute
- Admin endpoints: 100 requests/minute
- Regular endpoints: 1000 requests/minute

---

## Versioning

Current API version: `v1`

Future versions will be accessible via URL prefix:
```
/api/v2/...
```

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Store tokens securely** (httpOnly cookies or secure storage)
3. **Implement token refresh** mechanism
4. **Set appropriate token expiration** (recommended: 24 hours)
5. **Validate all input** on both client and server
6. **Log all privileged operations** (already implemented)
7. **Monitor audit logs** for suspicious activity
8. **Implement rate limiting** to prevent abuse
9. **Use strong passwords** (enforce password policy)
10. **Regularly rotate JWT secret keys**

---

## Support

For questions or issues:
- **Testing Guide**: `API_TESTING_RBAC.md`
- **Quick Start**: `RBAC_QUICK_START.md`
- **Technical Design**: `.kiro/specs/rbac-security/design.md`

---

**Last Updated:** July 2, 2026  
**API Version:** 1.0  
**Status:** Production Ready
