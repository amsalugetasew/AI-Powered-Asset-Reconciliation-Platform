# Deployment Guide - RBAC Implementation

Complete guide for deploying the Role-Based Access Control (RBAC) system to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Migration](#database-migration)
3. [First Admin Setup](#first-admin-setup)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedure](#rollback-procedure)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Before You Begin

- [ ] **Backup Database**: Create full database backup
- [ ] **Test in Staging**: Verify RBAC works in staging environment
- [ ] **Review Audit System**: Ensure audit logging is working
- [ ] **Check Dependencies**: All required packages installed
- [ ] **Security Review**: JWT secret keys are properly configured
- [ ] **Communication**: Notify users of upcoming changes
- [ ] **Maintenance Window**: Schedule deployment during low-usage period

### Required Packages

**Backend:**
```txt
Flask>=2.3.0
Flask-SQLAlchemy>=3.0.0
Flask-JWT-Extended>=4.5.0
Flask-CORS>=4.0.0
Flask-Migrate>=4.0.0
psycopg2-binary>=2.9.0
python-dotenv>=1.0.0
```

**Frontend:**
```txt
react>=18.2.0
react-router-dom>=6.20.0
axios>=1.6.2
react-toastify>=9.1.3
```

### Environment Requirements

- **Python**: 3.9+
- **Node.js**: 18+
- **PostgreSQL**: 12+
- **Disk Space**: Minimum 1GB free
- **Memory**: Minimum 2GB RAM

---

## Database Migration

### Step 1: Create Database Backup

**PostgreSQL:**
```bash
# Create backup
pg_dump -U postgres -d assetreconcile > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql

# Test restore (optional, in test environment)
psql -U postgres -d assetreconcile_test < backup_20260702_100000.sql
```

**Backup Location:** Store in secure location with restricted access

### Step 2: Review Migration Script

```bash
cd backend

# Review the migration file
cat migrations/versions/rbac_20260702_001_add_rbac_support.py

# Check for syntax errors
python -m py_compile migrations/versions/rbac_20260702_001_add_rbac_support.py
```

**Migration Contents:**
- Adds `role` column to `users` table (ENUM: officer, manager, admin)
- Creates `audit_logs` table
- Sets default role to 'officer' for existing users
- Creates indexes on audit_logs

### Step 3: Run Migration

**Development/Staging First:**
```bash
cd backend

# Set environment
export FLASK_ENV=staging  # or development

# Check current migration state
flask db current

# View migration history
flask db history

# Dry run (review SQL that will be executed)
flask db upgrade --sql > migration_preview.sql
cat migration_preview.sql

# Execute migration
flask db upgrade

# Verify migration
flask db current
```

**Expected Output:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade -> rbac_20260702_001, add_rbac_support
```

### Step 4: Verify Migration

```bash
# Connect to database
psql -U postgres -d assetreconcile

# Check users table structure
\d users

# Check audit_logs table
\d audit_logs

# Verify existing users have role
SELECT id, username, role FROM users;

# Should show all users with 'officer' role
```

**Expected Schema:**
```sql
-- users table should have:
Column       | Type                              | Nullable | Default
-------------|-----------------------------------|----------|----------
id           | integer                           | not null | nextval(...)
username     | character varying(80)             | not null |
email        | character varying(120)            | not null |
password_hash| character varying(255)            | not null |
role         | user_role (officer/manager/admin) | not null | 'officer'
created_at   | timestamp                         | not null | now()
```

### Step 5: Rollback Test (Optional)

Test rollback in development environment:

```bash
# Rollback migration
flask db downgrade -1

# Verify rollback
flask db current

# Re-apply migration
flask db upgrade
```

---

## First Admin Setup

### Option 1: Using Admin Creation Script (Recommended)

```bash
cd backend

# Run interactive script
python create_admin.py

# Follow prompts:
# - Select option 1: "Create new admin user"
# - Enter username (e.g., "admin")
# - Enter email (e.g., "admin@company.com")
# - Enter password (hidden input)
# - Confirm password
```

**Output:**
```
============================================================
✅ ADMIN USER CREATED SUCCESSFULLY!
============================================================

User Details:
  ID:       1
  Username: admin
  Email:    admin@company.com
  Role:     admin
  Created:  2026-07-02 10:30:00

You can now login with these credentials.
============================================================
```

### Option 2: Promote Existing User

```bash
cd backend

# Run script and select option 2
python create_admin.py

# Select option 2: "Promote existing user to admin"
# Enter user ID to promote
# Confirm promotion
```

### Option 3: Direct Database Update (Emergency Only)

```sql
-- Connect to database
psql -U postgres -d assetreconcile

-- Update specific user to admin
UPDATE users SET role = 'admin' WHERE username = 'your_username';

-- Verify
SELECT id, username, role FROM users WHERE role = 'admin';
```

**Warning:** Only use direct SQL in emergencies. Always prefer the script methods.

### Verify Admin Access

```bash
# Test admin login via API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'

# Should return token with role: "admin"
```

---

## Environment Configuration

### Backend Environment Variables

**Production `.env` file:**
```env
# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=your-very-secure-secret-key-change-this

# JWT Configuration
JWT_SECRET_KEY=your-very-secure-jwt-secret-change-this
JWT_ACCESS_TOKEN_EXPIRES=86400  # 24 hours in seconds

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/assetreconcile

# CORS Configuration
CORS_ORIGINS=https://your-domain.com

# File Upload
UPLOAD_FOLDER=./uploads
MAX_FILE_SIZE=104857600  # 100MB in bytes

# AI/ML Configuration
GROQ_API_KEY=your-groq-api-key
AI_MATCH_THRESHOLD=0.20

# Batch Processing
BATCH_SIZE=10000
MAX_AI_RECORDS=1000
```

**Security Notes:**
- ✅ Use strong, unique secret keys (32+ characters)
- ✅ Never commit `.env` file to version control
- ✅ Rotate secret keys periodically (every 90 days)
- ✅ Use environment-specific keys (dev ≠ staging ≠ prod)

### Frontend Environment Variables

**Production `.env` file:**
```env
VITE_API_URL=https://api.your-domain.com
VITE_APP_ENV=production
```

---

## Deployment Steps

### Step-by-Step Production Deployment

#### 1. Prepare Deployment Package

```bash
# Backend
cd backend
pip freeze > requirements.txt

# Frontend
cd ../frontend
npm run build
```

#### 2. Database Migration

```bash
# In production environment
cd backend
export FLASK_ENV=production

# Backup first (critical!)
pg_dump -U postgres -d assetreconcile > backup_pre_rbac.sql

# Apply migration
flask db upgrade

# Verify
flask db current
SELECT id, username, role FROM users;
```

#### 3. Deploy Backend

```bash
# Copy files to production server
scp -r backend/ user@production-server:/var/www/assetreconcile/

# On production server
cd /var/www/assetreconcile/backend
pip install -r requirements.txt

# Restart application
sudo systemctl restart assetreconcile
```

#### 4. Deploy Frontend

```bash
# Build production frontend
cd frontend
npm run build

# Copy build to server
scp -r dist/ user@production-server:/var/www/assetreconcile/frontend/

# On production server (if using nginx)
sudo cp -r /var/www/assetreconcile/frontend/dist/* /usr/share/nginx/html/
sudo systemctl reload nginx
```

#### 5. Create First Admin

```bash
# On production server
cd /var/www/assetreconcile/backend
python create_admin.py

# Or promote existing user
python create_admin.py
# Select option 2
```

#### 6. Verify Deployment

```bash
# Test backend health
curl https://api.your-domain.com/api/health

# Test admin login
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Test admin endpoint
curl -X GET https://api.your-domain.com/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Post-Deployment Verification

### Checklist

- [ ] **Backend Running**: API health endpoint responds
- [ ] **Database Migration**: Tables created correctly
- [ ] **Admin User**: Can login with admin account
- [ ] **Admin Endpoints**: Can access `/api/admin/users`
- [ ] **Role Claims**: JWT tokens contain role field
- [ ] **Frontend**: UI loads without errors
- [ ] **Navigation**: Role-based menu items display correctly
- [ ] **Audit Logs**: Operations are being logged
- [ ] **Error Handling**: Permission errors show proper messages

### Verification Tests

#### Test 1: Officer Role
```bash
# Login as officer
TOKEN=$(curl -s -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"officer_user","password":"password"}' | \
  jq -r '.access_token')

# Should see only own reconciliations
curl https://api.your-domain.com/api/reconciliation/list \
  -H "Authorization: Bearer $TOKEN"

# Should get 403 trying admin endpoint
curl https://api.your-domain.com/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 Forbidden
```

#### Test 2: Manager Role
```bash
# Login as manager
TOKEN=$(curl -s -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager_user","password":"password"}' | \
  jq -r '.access_token')

# Should see all reconciliations
curl https://api.your-domain.com/api/reconciliation/list \
  -H "Authorization: Bearer $TOKEN"

# Should be able to approve
curl -X POST https://api.your-domain.com/api/reconciliation/1/approve \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK
```

#### Test 3: Admin Role
```bash
# Login as admin
TOKEN=$(curl -s -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | \
  jq -r '.access_token')

# Should access admin endpoints
curl https://api.your-domain.com/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
# Expected: List of users

# View audit logs
curl https://api.your-domain.com/api/admin/audit-logs \
  -H "Authorization: Bearer $TOKEN"
# Expected: List of operations
```

---

## Rollback Procedure

### When to Rollback

Rollback if:
- ❌ Migration fails
- ❌ Critical functionality broken
- ❌ Security vulnerability discovered
- ❌ Data corruption detected

### Rollback Steps

#### 1. Stop Application

```bash
sudo systemctl stop assetreconcile
sudo systemctl stop nginx
```

#### 2. Restore Database

```bash
# Drop current database
psql -U postgres -c "DROP DATABASE assetreconcile;"

# Recreate database
psql -U postgres -c "CREATE DATABASE assetreconcile;"

# Restore from backup
psql -U postgres -d assetreconcile < backup_pre_rbac.sql

# Verify restore
psql -U postgres -d assetreconcile -c "SELECT COUNT(*) FROM users;"
```

#### 3. Revert Code

```bash
# Restore previous backend version
cd /var/www/assetreconcile/backend
git checkout previous-stable-tag

# Restore previous frontend version
cd /var/www/assetreconcile/frontend
git checkout previous-stable-tag
npm run build
```

#### 4. Restart Application

```bash
sudo systemctl start assetreconcile
sudo systemctl start nginx
```

#### 5. Verify Rollback

```bash
# Test old endpoints still work
curl https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

---

## Troubleshooting

### Issue: Migration Fails

**Error:**
```
alembic.util.exc.CommandError: Can't locate revision identified by 'xyz'
```

**Solution:**
```bash
# Check migration history
flask db history

# Show current revision
flask db current

# If needed, stamp to specific revision
flask db stamp head
```

### Issue: Users Missing Role After Migration

**Error:** Users can't login, "missing role information"

**Solution:**
```sql
-- Check users
SELECT id, username, role FROM users WHERE role IS NULL;

-- Fix any NULL roles
UPDATE users SET role = 'officer' WHERE role IS NULL;
```

### Issue: Admin Creation Fails

**Error:** "User already exists" but no admin role

**Solution:**
```bash
# Use option 2 in create_admin.py to promote existing user
python create_admin.py
# Select option 2
# Enter user ID

# Or direct SQL:
psql -U postgres -d assetreconcile
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

### Issue: JWT Tokens Don't Include Role

**Error:** "Invalid token: missing role information"

**Solution:**
- Old tokens from before RBAC don't have role claim
- Users must logout and login again
- Consider invalidating all existing tokens

```sql
-- Force re-login by updating user password hashes (optional)
-- This invalidates all existing sessions
-- Users will need to reset passwords
```

### Issue: 403 Errors for All Users

**Error:** All users get "Insufficient permissions"

**Solution:**
```python
# Check RBAC decorator import
from utils.rbac import require_role, require_admin, require_manager

# Verify decorator order
@app.route('/endpoint')
@jwt_required()  # JWT must come before role check
@require_admin   # Role check comes after JWT
def endpoint():
    pass
```

### Issue: Audit Logs Not Creating

**Error:** No audit logs appear in database

**Solution:**
```python
# Check audit service is imported
from services.audit_service import AuditService

# Verify database connection
from models import db, AuditLog
with app.app_context():
    logs = AuditLog.query.all()
    print(f"Total logs: {len(logs)}")
```

---

## Monitoring & Maintenance

### What to Monitor

**Daily:**
- [ ] Audit log growth rate
- [ ] Failed authentication attempts
- [ ] 403 permission errors (spike = misconfiguration)

**Weekly:**
- [ ] Review audit logs for suspicious activity
- [ ] Check user role distribution
- [ ] Verify admin access is appropriate

**Monthly:**
- [ ] Rotate JWT secret keys
- [ ] Review and clean up inactive users
- [ ] Audit trail archival (if implemented)

### Maintenance Tasks

**Audit Log Cleanup (if needed):**
```sql
-- Archive old logs (optional)
CREATE TABLE audit_logs_archive AS 
SELECT * FROM audit_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Delete old logs (be careful!)
DELETE FROM audit_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';
```

**User Cleanup:**
```sql
-- Find inactive users (no login in 90 days)
SELECT id, username, role, created_at 
FROM users 
WHERE id NOT IN (
  SELECT DISTINCT user_id FROM reconciliations 
  WHERE created_at > NOW() - INTERVAL '90 days'
);
```

---

## Security Considerations

### Production Security Checklist

- [ ] **HTTPS**: All traffic encrypted
- [ ] **Firewall**: Only necessary ports open
- [ ] **Database**: No public access
- [ ] **Secrets**: Stored in environment variables, not code
- [ ] **JWT Keys**: Strong, unique, rotated regularly
- [ ] **Passwords**: Strong password policy enforced
- [ ] **Rate Limiting**: Implemented on sensitive endpoints
- [ ] **Logging**: All privileged operations logged
- [ ] **Backups**: Daily automated backups
- [ ] **Monitoring**: Alerts for suspicious activity

### Incident Response

**If Security Breach Suspected:**

1. **Immediate**: Disable affected accounts
2. **Rotate**: All JWT secret keys
3. **Investigate**: Check audit logs
4. **Notify**: Affected users
5. **Document**: Incident details
6. **Patch**: Security vulnerability
7. **Review**: Security procedures

---

## Support

For deployment issues:
- **Technical Documentation**: `docs/`
- **API Reference**: `docs/API_DOCUMENTATION_RBAC.md`
- **User Guide**: `docs/USER_GUIDE_RBAC.md`
- **Quick Start**: `RBAC_QUICK_START.md`

---

**Last Updated:** July 2, 2026  
**Version:** 1.0  
**Status:** Production Ready

---

**Remember:** Always backup before deploying! Test in staging first!
