# RBAC Quick Start Guide

Get up and running with Role-Based Access Control in 5 minutes!

---

## 🚀 Step 1: Create Your First Admin User

```bash
# Navigate to backend folder
cd backend

# Run the admin creation script
python create_admin.py

# Follow the prompts:
# Username: admin
# Email: admin@example.com
# Password: [your secure password]
```

**Output:**
```
============================================================
✅ ADMIN USER CREATED SUCCESSFULLY!
============================================================

User Details:
  ID:       1
  Username: admin
  Email:    admin@example.com
  Role:     admin
  Created:  2026-07-02 10:30:00

You can now login with these credentials.
============================================================
```

---

## 🧪 Step 2: Test Backend APIs

### 2.1 Login as Admin

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

**Save the `access_token` from the response!**

### 2.2 View All Users

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2.3 Create a Manager User

```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager1",
    "email": "manager@test.com",
    "password": "Manager123!",
    "role": "manager"
  }'
```

### 2.4 Create an Officer User

```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "officer1",
    "email": "officer@test.com",
    "password": "Officer123!",
    "role": "officer"
  }'
```

### 2.5 View Audit Logs

```bash
curl -X GET "http://localhost:3001/api/admin/audit-logs?limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🎨 Step 3: Test Frontend Role Features

### 3.1 Login to Frontend

1. Open your browser to `http://localhost:5173`
2. Login with admin credentials
3. Check the user profile - you should see your role

### 3.2 Use Role-Based Components

Update any component to test role features:

```jsx
// Example: Update Dashboard.jsx
import { useAuth } from '../context/AuthContext'
import { ManagerOnly, AdminOnly, RoleBadge } from '../components/RoleGuard'

function Dashboard() {
  const { user, userRole, hasRole } = useAuth()
  
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <RoleBadge role={userRole} />
      </div>
      
      <p className="mb-4">Welcome, {user?.username}!</p>
      
      {/* Show for everyone */}
      <div className="mb-4">
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Upload Files
        </button>
      </div>
      
      {/* Show only for managers and admins */}
      <ManagerOnly>
        <div className="mb-4 p-4 bg-green-50 rounded">
          <h3 className="font-bold text-green-800 mb-2">Manager Actions</h3>
          <button className="bg-green-600 text-white px-4 py-2 rounded mr-2">
            Approve Exception
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded">
            Finalize Reconciliation
          </button>
        </div>
      </ManagerOnly>
      
      {/* Show only for admins */}
      <AdminOnly>
        <div className="p-4 bg-red-50 rounded">
          <h3 className="font-bold text-red-800 mb-2">Admin Actions</h3>
          <button className="bg-red-600 text-white px-4 py-2 rounded mr-2">
            Manage Users
          </button>
          <button className="bg-red-600 text-white px-4 py-2 rounded">
            View Audit Logs
          </button>
        </div>
      </AdminOnly>
      
      {/* Conditional rendering using hasRole */}
      {hasRole('manager') && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            You have access to system-wide analytics.
          </p>
        </div>
      )}
    </div>
  )
}

export default Dashboard
```

### 3.3 Test Role Switching

1. **Login as Admin** - You should see:
   - Upload Files button
   - Manager Actions section
   - Admin Actions section
   - System-wide access message

2. **Logout and Login as Manager** - You should see:
   - Upload Files button
   - Manager Actions section
   - ❌ No Admin Actions section
   - System-wide access message

3. **Logout and Login as Officer** - You should see:
   - Upload Files button
   - ❌ No Manager Actions section
   - ❌ No Admin Actions section
   - ❌ No system-wide access message

---

## 🔍 Step 4: Test Role-Based Reconciliation Access

### 4.1 Create Reconciliations

1. **Login as Officer** and upload some files
2. **Note the reconciliation IDs** created

### 4.2 Test Access Control

**As Officer (user_id = 2):**
```bash
# Login as officer
OFFICER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"officer1","password":"Officer123!"}' | \
  jq -r '.access_token')

# List reconciliations (should see only own)
curl -X GET http://localhost:3001/api/reconciliation/list \
  -H "Authorization: Bearer $OFFICER_TOKEN"

# Try to view another user's reconciliation (should get 403)
curl -X GET http://localhost:3001/api/reconciliation/1 \
  -H "Authorization: Bearer $OFFICER_TOKEN"

# Try to approve exception (should get 403)
curl -X POST http://localhost:3001/api/reconciliation/1/approve \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

**As Manager (user_id = 3):**
```bash
# Login as manager
MANAGER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"Manager123!"}' | \
  jq -r '.access_token')

# List reconciliations (should see ALL reconciliations)
curl -X GET http://localhost:3001/api/reconciliation/list \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# View any reconciliation (should work)
curl -X GET http://localhost:3001/api/reconciliation/1 \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Approve exception (should work)
curl -X POST http://localhost:3001/api/reconciliation/1/approve \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Finalize reconciliation (should work)
curl -X POST http://localhost:3001/api/reconciliation/1/finalize \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

### 4.3 Test Analytics Scope

**Officer Analytics (own data only):**
```bash
curl -X GET http://localhost:3001/api/reconciliation/analytics \
  -H "Authorization: Bearer $OFFICER_TOKEN"
# Response should include: "scope": "own", "role": "officer"
```

**Manager Analytics (system-wide):**
```bash
curl -X GET http://localhost:3001/api/reconciliation/analytics \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# Response should include: "scope": "all", "role": "manager"
```

---

## 🛡️ Step 5: Test Security Features

### 5.1 Test Privilege Escalation Prevention

```bash
# Admin tries to change own role (should fail)
curl -X PUT http://localhost:3001/api/admin/users/1/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "officer"}'

# Expected: 400 Bad Request
# Error: "Cannot modify your own role"
```

### 5.2 Test Self-Deletion Prevention

```bash
# Admin tries to delete own account (should fail)
curl -X DELETE http://localhost:3001/api/admin/users/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 400 Bad Request
# Error: "Cannot delete your own account"
```

### 5.3 Test Role Validation

```bash
# Try to create user with invalid role (should fail)
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test",
    "email": "test@test.com",
    "password": "Test123!",
    "role": "superadmin"
  }'

# Expected: 400 Bad Request
# Error: "Invalid role. Must be one of: officer, manager, admin"
```

---

## 📊 Step 6: View Audit Trail

All privileged operations are automatically logged!

```bash
# Get last 20 audit log entries
curl -X GET "http://localhost:3001/api/admin/audit-logs?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# You should see logs for:
# - CREATE_USER operations
# - UPDATE_ROLE operations
# - APPROVE_EXCEPTION operations
# - FINALIZE_RECONCILIATION operations
```

**Example Audit Log Entry:**
```json
{
  "id": 1,
  "user_id": 1,
  "username": "admin",
  "operation_type": "CREATE_USER",
  "resource_type": "user",
  "resource_id": 2,
  "details": {
    "created_username": "manager1",
    "created_role": "manager"
  },
  "ip_address": "127.0.0.1",
  "timestamp": "2026-07-02T10:45:00"
}
```

---

## ✅ Verification Checklist

After completing the steps above, verify:

### Backend ✅
- [ ] Admin user created successfully
- [ ] Can login and receive JWT token with role claim
- [ ] Can create users with different roles
- [ ] Can update user roles
- [ ] Cannot modify own role
- [ ] Cannot delete own account
- [ ] Officer sees only own reconciliations
- [ ] Manager sees all reconciliations
- [ ] Manager can approve/finalize
- [ ] Officer cannot approve/finalize (403)
- [ ] Audit logs are being created
- [ ] Analytics scope changes based on role

### Frontend ✅
- [ ] Role displays in UI (badge or text)
- [ ] `useAuth()` hook provides role utilities
- [ ] `ManagerOnly` component hides content from officers
- [ ] `AdminOnly` component hides content from non-admins
- [ ] `hasRole()` function works correctly
- [ ] Role persists on page refresh
- [ ] Role clears on logout

---

## 🐛 Troubleshooting

### Issue: "Invalid token: missing role information"
**Solution:** Old tokens don't have role claim. Login again to get new token with role.

### Issue: Admin operations return 403
**Solution:** 
1. Check user role in database: `SELECT * FROM users WHERE id = 1;`
2. If not admin, run: `python backend/create_admin.py` and choose option 2 to promote

### Issue: Frontend role not displaying
**Solution:**
1. Check browser console for errors
2. Verify JWT token contains role claim (decode at jwt.io)
3. Clear localStorage and login again

### Issue: Role badge colors not showing
**Solution:** Ensure Tailwind CSS is configured and includes color classes in your build.

---

## 🎯 What's Next?

Now that RBAC is working, you can:

1. **Continue with Phase 6:** Update navigation menu and create admin pages
2. **Add role-based features** to existing pages
3. **Customize role permissions** as needed
4. **Write tests** for RBAC functionality
5. **Deploy to production** following Phase 8 tasks

---

## 📚 Additional Resources

- **API Testing Guide:** `API_TESTING_RBAC.md`
- **Implementation Summary:** `RBAC_IMPLEMENTATION_SUMMARY.md`
- **Technical Design:** `.kiro/specs/rbac-security/design.md`
- **All Tasks:** `.kiro/specs/rbac-security/tasks.md`

---

**Happy Testing! 🎉**

If you encounter any issues, refer to the troubleshooting section or check the detailed documentation.
