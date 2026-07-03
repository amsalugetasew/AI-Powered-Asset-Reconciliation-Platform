# Implementation Tasks - RBAC Security

## Task Status Legend
- 🔲 Not Started
- 🔄 In Progress
- ✅ Completed
- ⏸️ Blocked
- 🧪 Testing

---

## Phase 1: Database and Models (Priority: Critical)

### Task 1.1: Create Database Migration Script
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: None

**Description**: Create Alembic migration to add role support to the system.

**Acceptance Criteria**:
- [x] Migration file created in `backend/migrations/versions/`
- [x] Adds `role` column to `users` table (ENUM: officer, manager, admin)
- [x] Sets default value to 'officer'
- [x] Creates `audit_logs` table with all required columns
- [x] Creates indexes on `audit_logs` (user_id, timestamp)
- [x] Includes downgrade function for rollback

**Files to Create/Modify**:
- `backend/migrations/versions/add_rbac_support_<timestamp>.py`

**Testing**:
```bash
flask db upgrade
flask db downgrade
flask db upgrade  # Verify idempotency
```

---

### Task 1.2: Update User Model
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 1.1

**Description**: Add role field and audit log relationship to User model.

**Acceptance Criteria**:
- [x] `role` field added with Enum type
- [x] Default role set to 'officer'
- [x] `audit_logs` relationship added
- [x] `to_dict()` method updated to include role
- [x] Model validates role values

**Files to Modify**:
- `backend/models.py`

**Code Changes**:
```python
role = db.Column(db.Enum('officer', 'manager', 'admin'), 
                 default='officer', nullable=False)
audit_logs = db.relationship('AuditLog', backref='user', lazy=True)
```

---

### Task 1.3: Create AuditLog Model
**Status**: ✅ Completed  
**Effort**: 1.5 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 1.1

**Description**: Implement AuditLog model for tracking privileged operations.

**Acceptance Criteria**:
- [x] Model created with all required fields
- [x] Foreign key to User table
- [x] `to_dict()` method implemented
- [x] Timestamps auto-populate
- [x] JSON field for operation details

**Files to Create**:
- Add to `backend/models.py`

**Testing**:
```python
# Test audit log creation
log = AuditLog(user_id=1, operation_type='TEST', 
               resource_type='user', resource_id=1)
db.session.add(log)
db.session.commit()
```

---

## Phase 2: Backend RBAC Infrastructure (Priority: Critical)

### Task 2.1: Create RBAC Utility Module
**Status**: ✅ Completed  
**Effort**: 3 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 1.2

**Description**: Create role-based access control decorators and utility functions.

**Acceptance Criteria**:
- [x] `utils/rbac.py` file created
- [x] `ROLE_HIERARCHY` constant defined
- [x] `get_user_role()` function extracts role from JWT
- [x] `get_user_from_token()` function returns User object
- [x] `require_role(role)` decorator enforces permissions
- [x] `require_admin` and `require_manager` shortcuts created
- [x] Proper error messages for insufficient permissions

**Files to Create**:
- `backend/utils/rbac.py`

**Testing**:
```python
# Unit test role hierarchy
assert ROLE_HIERARCHY['admin'] > ROLE_HIERARCHY['manager']

# Test decorator
@require_role('manager')
def test_endpoint():
    return "success"
```

---

### Task 2.2: Create Audit Service
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 1.3

**Description**: Implement service for logging privileged operations.

**Acceptance Criteria**:
- [x] `services/audit_service.py` created
- [x] `log_operation()` static method implemented
- [x] Captures IP address from request context
- [x] `get_user_audit_logs()` method implemented
- [x] `get_all_audit_logs()` method implemented
- [x] `get_resource_audit_logs()` method implemented
- [x] Error handling for failed log writes

**Files to Create**:
- `backend/services/audit_service.py`

**Testing**:
```python
# Test audit logging
AuditService.log_operation(
    user_id=1,
    operation_type='CREATE_USER',
    resource_type='user',
    resource_id=2,
    details={'username': 'newuser'}
)
# Verify log created in database
```

---

### Task 2.3: Update JWT Token Generation (Register)
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Add role claim to JWT tokens generated during registration.

**Acceptance Criteria**:
- [x] `additional_claims` parameter added to `create_access_token()`
- [x] Role claim included in JWT payload
- [x] Default 'officer' role assigned to new users
- [x] Role included in API response
- [x] User model saved with role field

**Files to Modify**:
- `backend/routes/auth_routes.py` (register endpoint)

**Code Changes**:
```python
additional_claims = {'role': user.role}
access_token = create_access_token(
    identity=str(user.id),
    additional_claims=additional_claims
)
```

---

### Task 2.4: Update JWT Token Generation (Login)
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Add role claim to JWT tokens generated during login.

**Acceptance Criteria**:
- [x] Role claim included in login JWT token
- [x] Role included in login API response
- [x] Existing tokens remain valid (backward compatible)

**Files to Modify**:
- `backend/routes/auth_routes.py` (login endpoint)

---

### Task 2.5: Update User Profile Endpoint
**Status**: ✅ Completed  
**Effort**: 30 minutes  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Include role in /api/auth/me response.

**Acceptance Criteria**:
- [x] Role field included in user dictionary
- [x] Response matches updated schema

**Files to Modify**:
- `backend/routes/auth_routes.py` (/me endpoint)

---

## Phase 3: Admin API Endpoints (Priority: High)

### Task 3.1: Create Admin Blueprint
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1, Task 2.2

**Description**: Create new blueprint for admin-only endpoints.

**Acceptance Criteria**:
- [x] `routes/admin_routes.py` file created
- [x] Blueprint registered in `app.py`
- [x] URL prefix set to `/api/admin`
- [x] Required imports added

**Files to Create**:
- `backend/routes/admin_routes.py`

**Files to Modify**:
- `backend/app.py`

---

### Task 3.2: Implement List Users Endpoint
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 3.1

**Description**: Create GET /api/admin/users endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_admin`
- [x] Returns all users with roles
- [x] Proper error handling
- [x] JSON response format matches spec

**API**: `GET /api/admin/users`

---

### Task 3.3: Implement Create User Endpoint
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 3.1, Task 2.2

**Description**: Create POST /api/admin/users endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_admin`
- [x] Validates all input fields (username, email, password, role)
- [x] Validates role enum values
- [x] Checks for duplicate username/email
- [x] Creates user with specified role
- [x] Logs operation to audit trail
- [x] Returns created user details

**API**: `POST /api/admin/users`

---

### Task 3.4: Implement Update Role Endpoint
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 3.1, Task 2.2

**Description**: Create PUT /api/admin/users/:id/role endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_admin`
- [x] Prevents admin from changing own role
- [x] Validates new role value
- [x] Updates user role in database
- [x] Logs old and new role to audit trail
- [x] Returns updated user details
- [x] Proper error messages for self-modification

**API**: `PUT /api/admin/users/:id/role`

---

### Task 3.5: Implement Delete User Endpoint
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 3.1, Task 2.2

**Description**: Create DELETE /api/admin/users/:id endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_admin`
- [x] Prevents admin from deleting own account
- [x] Verifies user exists before deletion
- [x] Cascades to related reconciliations
- [x] Logs deletion to audit trail
- [x] Returns success message

**API**: `DELETE /api/admin/users/:id`

---

### Task 3.6: Implement Audit Logs Endpoint
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 3.1, Task 2.2

**Description**: Create GET /api/admin/audit-logs endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_admin`
- [x] Supports limit query parameter
- [x] Returns logs in descending timestamp order
- [x] Includes user information (username)
- [x] JSON response format matches spec

**API**: `GET /api/admin/audit-logs?limit=1000`

---

## Phase 4: Update Reconciliation Routes (Priority: High)

### Task 4.1: Add Role-Based Reconciliation Filtering
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Update list endpoint to filter by role.

**Acceptance Criteria**:
- [x] Officers see only their own reconciliations
- [x] Managers see all reconciliations
- [x] Admins see all reconciliations
- [x] Query optimization for large datasets
- [x] Response includes scope indicator

**Files to Modify**:
- `backend/routes/reconciliation_routes.py` (list endpoint)

---

### Task 4.2: Add Role Check to View Reconciliation
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Restrict Officers to viewing only their own reconciliations.

**Acceptance Criteria**:
- [x] Officers get 403 for other users' reconciliations
- [x] Managers/Admins can view any reconciliation
- [x] Clear error message for denied access

**Files to Modify**:
- `backend/routes/reconciliation_routes.py` (get endpoint)

---

### Task 4.3: Add Role Check to Download Report
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Restrict Officers to downloading only their own reports.

**Acceptance Criteria**:
- [x] Officers get 403 for other users' reports
- [x] Managers/Admins can download any report
- [x] Consistent with view reconciliation logic

**Files to Modify**:
- `backend/routes/reconciliation_routes.py` (download endpoint)

---

### Task 4.4: Implement Approve Exception Endpoint
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1, Task 2.2

**Description**: Create POST /api/reconciliation/:id/approve endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_role('manager')`
- [x] Validates reconciliation exists
- [x] Logs approval to audit trail
- [x] Returns success message
- [x] Officers get 403 error

**API**: `POST /api/reconciliation/:id/approve`

---

### Task 4.5: Implement Finalize Reconciliation Endpoint
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1, Task 2.2

**Description**: Create POST /api/reconciliation/:id/finalize endpoint.

**Acceptance Criteria**:
- [x] Endpoint protected with `@require_role('manager')`
- [x] Validates reconciliation is completed
- [x] Logs finalization to audit trail
- [x] Returns success message
- [x] Cannot finalize non-completed reconciliations

**API**: `POST /api/reconciliation/:id/finalize`

---

### Task 4.6: Update Analytics Endpoint with Role Filtering
**Status**: ✅ Completed  
**Effort**: 1.5 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Filter analytics data based on user role.

**Acceptance Criteria**:
- [x] Officers see analytics for their reconciliations only
- [x] Managers see system-wide analytics
- [x] Admins see system-wide analytics
- [x] Response indicates scope (own vs all)

**Files to Modify**:
- `backend/routes/reconciliation_routes.py` (analytics endpoint)

---

## Phase 5: Frontend Role Context (Priority: High)

### Task 5.1: Create RoleContext
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 2.3, Task 2.4

**Description**: Create React context for role management.

**Acceptance Criteria**:
- [x] Role management integrated into AuthContext
- [x] Decodes JWT token to extract role
- [x] Provides `useAuth()` hook with role utilities
- [x] Provides `hasRole()` helper function
- [x] Provides `isOfficer()`, `isManager()`, `isAdmin()` helpers
- [x] Updates role on login/register/token refresh
- [x] Clears role on logout

**Files to Create**:
- `frontend/src/context/RoleContext.jsx`

**Testing**:
```jsx
const { userRole, hasRole } = useRole()
expect(userRole).toBe('officer')
expect(hasRole('manager')).toBe(false)
```

---

### Task 5.2: Update AuthContext to Include Role
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.1

**Description**: Integrate role into existing AuthContext.

**Acceptance Criteria**:
- [x] Role extracted from API responses
- [x] Role stored in context state
- [x] Role updated on successful login/register
- [x] Role cleared on logout

**Files to Modify**:
- `frontend/src/context/AuthContext.jsx`

---

### Task 5.3: Create RoleGuard Component
**Status**: ✅ Completed  
**Effort**: 1.5 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.1

**Description**: Create component guards for conditional rendering.

**Acceptance Criteria**:
- [x] `RoleGuard.jsx` created
- [x] `RoleGuard` component with `requiredRole` prop
- [x] `OfficerOnly`, `ManagerOnly`, `AdminOnly` shortcuts
- [x] Supports fallback content
- [x] Renders children only if role sufficient

**Files to Create**:
- `frontend/src/components/RoleGuard.jsx`

**Usage Example**:
```jsx
<ManagerOnly>
  <button>Approve</button>
</ManagerOnly>
```

---

### Task 5.4: Install JWT Decode Library
**Status**: ✅ Completed (Not Needed)  
**Effort**: 15 minutes  
**Assignee**: Frontend Developer  
**Dependencies**: None

**Description**: Add jwt-decode library for token parsing.

**Note**: Implemented custom JWT decoding function in AuthContext instead of adding external dependency. This keeps the bundle size smaller and eliminates the need for an additional package.

**Commands**:
```bash
cd frontend
npm install jwt-decode
```

---

## Phase 6: Frontend UI Updates (Priority: Medium)

### Task 6.1: Update Navigation Menu
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.1, Task 5.3

**Description**: Make navigation menu role-based.

**Acceptance Criteria**:
- [x] Menu items filtered by role
- [x] Officers see: Dashboard, Upload, Analytics
- [x] Managers see: + Audit Trail
- [x] Admins see: + User Management
- [x] Role displayed next to username
- [x] Smooth UI transitions

**Files to Modify**:
- `frontend/src/components/Layout.jsx`

---

### Task 6.2: Add Role-Based Buttons to Dashboard
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.3, Task 4.4, Task 4.5

**Description**: Add Manager-only action buttons to reconciliation cards.

**Acceptance Criteria**:
- [x] "Approve Exception" button for Managers+
- [x] "Finalize" button for Managers+
- [x] Buttons hidden for Officers
- [x] API calls implemented for button actions
- [x] Success/error toast notifications
- [x] Integrated with existing Dashboard layout

**Files to Modify**:
- `frontend/src/pages/Dashboard.jsx`

---

### Task 6.3: Create User Management Page
**Status**: ✅ Completed  
**Effort**: 4 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 3.2, Task 3.3, Task 3.4, Task 3.5

**Description**: Build admin user management interface.

**Acceptance Criteria**:
- [x] `UserManagement.jsx` page created
- [x] Table displays all users with roles
- [x] Create user button and modal
- [x] Inline role dropdown for editing
- [x] Delete user button with confirmation
- [x] Prevent self-modification/deletion
- [x] Success/error notifications
- [x] Stats cards for role distribution

**Files to Create**:
- `frontend/src/pages/UserManagement.jsx`

**Components**:
- User list table
- Create user modal
- Delete confirmation dialog

---

### Task 6.4: Create Audit Trail Page
**Status**: ✅ Completed  
**Effort**: 3 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 3.6

**Description**: Build audit log viewing interface for Managers/Admins.

**Acceptance Criteria**:
- [x] `AuditTrail.jsx` page created
- [x] Table displays audit logs
- [x] Columns: timestamp, user, operation, resource, details
- [x] Expandable details column (JSON)
- [x] Filtering by operation type
- [x] Stats cards for log summary
- [x] Color-coded operation badges

**Files to Create**:
- `frontend/src/pages/AuditTrail.jsx`

---

### Task 6.5: Update App Routes
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: Frontend Developer  
**Dependencies**: Task 6.3, Task 6.4

**Description**: Add routes for new pages with role protection.

**Acceptance Criteria**:
- [x] `/users` route added (Admin only)
- [x] `/audit` route added (Manager+)
- [x] Role-based route guards implemented
- [x] Access denied page for insufficient permissions
- [x] Proper loading states

**Files to Modify**:
- `frontend/src/App.jsx`

---

### Task 6.6: Add Role Badge to User Profile
**Status**: ✅ Completed  
**Effort**: 30 minutes  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.1

**Description**: Display user role badge in UI.

**Acceptance Criteria**:
- [x] Role badge shown next to username in sidebar
- [x] Color-coded by role (Officer: blue, Manager: green, Admin: red)
- [x] Capitalized role text
- [x] Also shown in user dropdown menu

**Files to Modify**:
- `frontend/src/components/Layout.jsx`

---

## Phase 7: Testing (Priority: Medium)

### Task 7.1: Write Backend Unit Tests for RBAC
**Status**: 🔲 Not Started  
**Effort**: 3 hours  
**Assignee**: Backend Developer  
**Dependencies**: Task 2.1

**Description**: Create unit tests for RBAC utilities.

**Acceptance Criteria**:
- [ ] Test role hierarchy constants
- [ ] Test `get_user_role()` function
- [ ] Test `require_role()` decorator
- [ ] Test privilege escalation prevention
- [ ] Test error messages

**Files to Create**:
- `backend/tests/test_rbac.py`

---

### Task 7.2: Write Integration Tests for Admin Endpoints
**Status**: 🔲 Not Started  
**Effort**: 4 hours  
**Assignee**: Backend Developer  
**Dependencies**: Phase 3 tasks

**Description**: Test admin user management endpoints.

**Acceptance Criteria**:
- [ ] Test create user (success and failures)
- [ ] Test update role (success and failures)
- [ ] Test delete user (success and failures)
- [ ] Test list users
- [ ] Test audit log retrieval
- [ ] Test authorization (Officer tries admin endpoint)

**Files to Create**:
- `backend/tests/test_admin_routes.py`

---

### Task 7.3: Write Integration Tests for Role-Based Access
**Status**: 🔲 Not Started  
**Effort**: 3 hours  
**Assignee**: Backend Developer  
**Dependencies**: Phase 4 tasks

**Description**: Test role-based reconciliation access.

**Acceptance Criteria**:
- [ ] Test Officer can only see own reconciliations
- [ ] Test Manager can see all reconciliations
- [ ] Test Officer cannot approve/finalize
- [ ] Test Manager can approve/finalize
- [ ] Test analytics filtering by role

**Files to Create**:
- `backend/tests/test_reconciliation_rbac.py`

---

### Task 7.4: Write Frontend Unit Tests for Role Context
**Status**: 🔲 Not Started  
**Effort**: 2 hours  
**Assignee**: Frontend Developer  
**Dependencies**: Task 5.1, Task 5.3

**Description**: Test role context and guards.

**Acceptance Criteria**:
- [ ] Test `useRole()` hook
- [ ] Test `hasRole()` function
- [ ] Test role hierarchy
- [ ] Test `RoleGuard` component rendering
- [ ] Test role update on login

**Files to Create**:
- `frontend/src/__tests__/RoleContext.test.jsx`

---

### Task 7.5: Write E2E Tests for RBAC Flows
**Status**: 🔲 Not Started  
**Effort**: 4 hours  
**Assignee**: QA/Developer  
**Dependencies**: All implementation tasks

**Description**: End-to-end tests for complete role-based workflows.

**Acceptance Criteria**:
- [ ] Test Officer workflow (upload, view own data)
- [ ] Test Manager workflow (approve, finalize, analytics)
- [ ] Test Admin workflow (user management)
- [ ] Test role change impact (logout required)
- [ ] Test privilege escalation attempts

**Files to Create**:
- `tests/e2e/rbac_flows.spec.js`

---

## Phase 8: Documentation and Deployment (Priority: Low)

### Task 8.1: Create First Admin Script
**Status**: 🔲 Not Started  
**Effort**: 1 hour  
**Assignee**: Backend Developer  
**Dependencies**: Task 1.1

**Description**: Script to create first admin user.

**Acceptance Criteria**:
- [ ] `backend/create_admin.py` created
- [ ] Prompts for username, email, password
- [ ] Sets role to 'admin'
- [ ] Handles existing user gracefully
- [ ] Documentation in README

**Files to Create**:
- `backend/create_admin.py`

---

### Task 8.2: Update API Documentation
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Technical Writer/Developer  
**Dependencies**: All API tasks

**Description**: Document all new and updated endpoints.

**Acceptance Criteria**:
- [x] API documentation updated with role requirements
- [x] Request/response examples for all endpoints
- [x] Error codes documented
- [x] Authentication section updated
- [x] Role hierarchy explained
- [x] Permission matrix included

**Files Created**:
- `docs/API_DOCUMENTATION_RBAC.md` (650+ lines)

**Files to Create/Modify**:
- `docs/API.md`

---

### Task 8.3: Write User Guide for Role Management
**Status**: ✅ Completed  
**Effort**: 2 hours  
**Assignee**: Technical Writer  
**Dependencies**: Phase 6 tasks

**Description**: End-user documentation for RBAC features.

**Acceptance Criteria**:
- [x] Role descriptions and capabilities
- [x] How to request role changes
- [x] Step-by-step task guides
- [x] FAQ section
- [x] Troubleshooting section
- [x] Security best practices

**Files Created**:
- `docs/USER_GUIDE_RBAC.md` (600+ lines)

**Files to Create**:
- `docs/USER_GUIDE_RBAC.md`

---

### Task 8.4: Update Deployment Guide
**Status**: ✅ Completed  
**Effort**: 1 hour  
**Assignee**: DevOps/Developer  
**Dependencies**: Task 1.1, Task 8.1

**Description**: Add RBAC deployment steps to deployment documentation.

**Acceptance Criteria**:
- [x] Migration steps documented
- [x] First admin creation documented
- [x] Rollback procedure documented
- [x] Backward compatibility notes
- [x] Security checklist included
- [x] Troubleshooting section

**Files Created**:
- `docs/DEPLOYMENT_GUIDE_RBAC.md` (600+ lines)

**Files to Modify**:
- `docs/DEPLOYMENT.md`

---

### Task 8.5: Create Database Backup Before Migration
**Status**: 🔲 Not Started  
**Effort**: 30 minutes  
**Assignee**: DevOps  
**Dependencies**: None

**Description**: Backup production database before deploying RBAC.

**Acceptance Criteria**:
- [ ] Full database backup created
- [ ] Backup verified and restorable
- [ ] Backup stored in secure location
- [ ] Backup documented

---

### Task 8.6: Run Database Migration in Production
**Status**: 🔲 Not Started  
**Effort**: 1 hour  
**Assignee**: DevOps  
**Dependencies**: Task 8.5, All testing tasks

**Description**: Execute database migration in production environment.

**Acceptance Criteria**:
- [ ] Maintenance window scheduled
- [ ] Migration executed successfully
- [ ] All existing users have 'officer' role
- [ ] No data loss
- [ ] Application functioning correctly

**Commands**:
```bash
flask db upgrade
```

---

### Task 8.7: Create First Admin User in Production
**Status**: 🔲 Not Started  
**Effort**: 15 minutes  
**Assignee**: DevOps  
**Dependencies**: Task 8.6, Task 8.1

**Description**: Set up initial admin account after migration.

**Acceptance Criteria**:
- [ ] Admin user created
- [ ] Admin login verified
- [ ] User management tested
- [ ] Credentials securely stored

**Commands**:
```bash
python backend/create_admin.py
```

---

## Summary

**Total Tasks**: 55  
**Estimated Total Effort**: ~90 hours (11-12 developer days)

**Critical Path**:
1. Database migration → RBAC infrastructure → Admin endpoints → Frontend
2. Parallel tracks possible after Phase 2

**Risk Areas**:
- Token backward compatibility (mitigated with default 'officer' role)
- Production database migration (mitigated with backup)
- User experience during role transitions (requires re-login)

**Success Criteria**:
- All 55 tasks completed
- All tests passing
- Zero security vulnerabilities
- Production deployment successful
- User documentation complete
