# User Guide - Role-Based Access Control

Welcome to the AssetReconcile AI RBAC User Guide! This guide explains how roles work and what each role can do.

---

## Table of Contents

1. [Understanding Roles](#understanding-roles)
2. [Officer Role](#officer-role)
3. [Manager Role](#manager-role)
4. [Admin Role](#admin-role)
5. [Getting Started](#getting-started)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Understanding Roles

AssetReconcile AI uses a **three-tier role system** to control what users can see and do:

```
🔴 Admin      → Full system control
    ↓
🟢 Manager    → Oversight and approvals
    ↓
🔵 Officer    → Day-to-day operations
```

### Key Concepts

- **Role Hierarchy**: Higher roles include all permissions of lower roles
- **Data Visibility**: Officers see only their own data; Managers/Admins see everything
- **Privilege Escalation**: Users cannot change their own role (security protection)
- **Audit Trail**: All privileged operations are logged automatically

---

## Officer Role

**Badge:** 🔵 Blue

**Description:** Officers perform day-to-day asset reconciliation tasks.

### What Officers Can Do

✅ **Upload Files**
- Upload customer and internal asset files
- Create new reconciliation jobs
- Track upload status

✅ **View Own Reconciliations**
- See all reconciliations you created
- View detailed results and statistics
- Track match rates and exceptions

✅ **Download Own Reports**
- Download Excel reports for your reconciliations
- Export data for further analysis

✅ **View Own Analytics**
- See performance metrics for your work
- Track your reconciliation history
- Monitor match rates

### What Officers Cannot Do

❌ **View Others' Data**: Cannot see reconciliations created by other users  
❌ **Approve Exceptions**: Cannot approve reconciliation exceptions  
❌ **Finalize**: Cannot mark reconciliations as finalized  
❌ **View Audit Logs**: Cannot access system audit trail  
❌ **Manage Users**: Cannot create, edit, or delete users

### Officer Dashboard

When you login as an Officer, you'll see:

```
Navigation Menu:
├─ Dashboard          ← Your reconciliations
├─ Reconciliation     ← Upload new files
└─ Reports            ← Your analytics
```

**Actions on Completed Reconciliations:**
- 📊 View Results
- 📥 Download Report
- 💾 Record to Database

---

## Manager Role

**Badge:** 🟢 Green

**Description:** Managers oversee operations, approve exceptions, and have system-wide visibility.

### What Managers Can Do

✅ **Everything Officers Can Do** +

✅ **View All Reconciliations**
- See reconciliations from all users system-wide
- Monitor team performance
- Track overall progress

✅ **Download Any Report**
- Access reports created by any user
- Support team members
- Perform quality checks

✅ **Approve Exceptions**
- Review and approve reconciliation exceptions
- Make judgment calls on discrepancies
- Document approval reasons

✅ **Finalize Reconciliations**
- Mark reconciliations as officially complete
- Lock in final results
- Trigger downstream processes

✅ **View Audit Trail**
- See all privileged operations
- Monitor user activities
- Track system changes

✅ **System-Wide Analytics**
- View metrics across all reconciliations
- Analyze team performance
- Generate management reports

### What Managers Cannot Do

❌ **Create Users**: Cannot add new system users  
❌ **Change User Roles**: Cannot promote/demote users  
❌ **Delete Users**: Cannot remove users from system

### Manager Dashboard

When you login as a Manager, you'll see:

```
Navigation Menu:
├─ Dashboard          ← All reconciliations
├─ Reconciliation     ← Upload new files
├─ Reports            ← System-wide analytics
└─ Audit Trail        ← Operation logs
```

**Additional Actions on Completed Reconciliations:**
- ✅ Approve Exception  (Green button)
- 🏁 Finalize           (Indigo button)

---

## Admin Role

**Badge:** 🔴 Red

**Description:** Administrators have full system control and user management capabilities.

### What Admins Can Do

✅ **Everything Managers Can Do** +

✅ **Create Users**
- Add new users to the system
- Assign initial roles
- Set up user accounts

✅ **Manage User Roles**
- Promote users (Officer → Manager → Admin)
- Demote users as needed
- Adjust permissions

✅ **Delete Users**
- Remove users from the system
- Clean up inactive accounts
- Manage user lifecycle

✅ **View Full Audit Trail**
- Access complete system logs
- Monitor all activities
- Investigate security incidents

✅ **System Configuration**
- Manage system settings
- Configure integrations
- Update system parameters

### Security Restrictions

For security, Admins **cannot**:
- ❌ Change their own role (prevents privilege escalation)
- ❌ Delete their own account (prevents accidental lockout)

### Admin Dashboard

When you login as an Admin, you'll see:

```
Navigation Menu:
├─ Dashboard          ← All reconciliations
├─ Reconciliation     ← Upload new files
├─ Reports            ← System-wide analytics
├─ Audit Trail        ← Operation logs
└─ User Management    ← Manage users
```

---

## Getting Started

### First-Time Login

1. **Navigate** to the login page
2. **Enter** your username and password
3. **Check** your role badge (shown next to your name)
4. **Explore** the menu items available to your role

### Checking Your Role

Your role is displayed in two places:

1. **Sidebar**: Badge next to your username
2. **User Menu**: Dropdown in top-right corner

**Role Badge Colors:**
- 🔵 Blue = Officer
- 🟢 Green = Manager
- 🔴 Red = Admin

### Requesting Role Changes

If you need a different role:

1. Contact your system administrator
2. Explain why you need the role change
3. Wait for admin approval
4. Logout and login again after change

**Note:** You'll need to login again to receive a new token with updated role.

---

## Common Tasks

### For Officers

#### Upload Files for Reconciliation

1. Click **Reconciliation** in the menu
2. Click **Choose Customer File**
3. Select your customer asset file (.xlsx)
4. Click **Choose Internal File**
5. Select your internal asset file (.xlsx)
6. Click **Start Reconciliation**
7. Wait for processing to complete

#### View Reconciliation Results

1. Go to **Dashboard**
2. Find your reconciliation in the list
3. Click **View Results** button
4. Review matched, unmatched, and duplicate records

#### Download Report

1. Go to **Dashboard**
2. Find completed reconciliation
3. Click **Download** button
4. Report saves as Excel file

### For Managers

#### Approve an Exception

1. Go to **Dashboard**
2. Find completed reconciliation
3. Scroll to action buttons
4. Click **Approve Exception** (green button)
5. Confirm in the notification

#### Finalize a Reconciliation

1. Go to **Dashboard**
2. Find completed reconciliation
3. Click **Finalize** (indigo button)
4. Reconciliation is marked as officially complete

#### View Audit Trail

1. Click **Audit Trail** in menu
2. Review logged operations
3. Click on a log to expand details
4. Use filters to find specific operations

### For Admins

#### Create a New User

1. Click **User Management** in menu
2. Click **Create User** button
3. Enter username, email, password
4. Select role (Officer/Manager/Admin)
5. Click **Create User**

#### Change a User's Role

1. Go to **User Management**
2. Find the user in the table
3. Click the role dropdown
4. Select new role (Officer/Manager/Admin)
5. Change is saved automatically

#### Delete a User

1. Go to **User Management**
2. Find the user in the table
3. Click **Delete** button
4. Confirm deletion in modal
5. User is removed from system

**Warning:** Deleting a user also deletes all their reconciliations!

---

## Troubleshooting

### "Access Denied" Message

**Problem:** You see "You don't have permission to access this page"

**Solution:**
1. Check your role badge
2. Verify the page requires your role level
3. Contact admin if you need a role upgrade

### "Invalid Token" Error

**Problem:** You're logged out unexpectedly

**Solution:**
1. Your session expired (tokens last 24 hours)
2. Login again to get a new token
3. Consider enabling "Remember Me" if available

### "Missing Role Information" Error

**Problem:** Token doesn't contain role data

**Solution:**
1. This happens with old tokens from before RBAC
2. Logout completely
3. Login again to get updated token
4. Clear browser cache if problem persists

### Can't See Other Users' Data

**Problem:** Menu items or data are missing

**Solution:**
1. This is normal for Officer role
2. Officers can only see their own data
3. Request Manager role if you need wider access

### Can't Change Own Role

**Problem:** Cannot update your own role as admin

**Solution:**
1. This is a security feature (privilege escalation prevention)
2. Another admin must change your role
3. This is by design and cannot be overridden

### Can't Delete Own Account

**Problem:** Cannot delete your own admin account

**Solution:**
1. This prevents accidental lockout
2. Another admin must delete your account
3. Transfer admin responsibilities first

---

## FAQ

### How do I know what role I have?

Check the colored badge next to your username in the sidebar:
- 🔵 Blue = Officer
- 🟢 Green = Manager
- 🔴 Red = Admin

### Can I have multiple roles?

No. Each user has exactly one role. However, higher roles include all permissions of lower roles.

### How do I request a role change?

Contact your system administrator and explain why you need the role change.

### Will I lose my data if my role changes?

No. Your reconciliations, reports, and historical data remain intact when your role changes.

### Do I need to logout after a role change?

Yes. You must logout and login again to receive a new token with the updated role.

### Can I see audit logs of my own actions?

- **Officer**: No
- **Manager**: Yes, view all audit logs at `/audit`
- **Admin**: Yes, full access to audit trail

### What happens to reconciliations when a user is deleted?

All reconciliations created by that user are permanently deleted. Consider reassignment or export before deletion.

### Can deleted users be recovered?

No. User deletion is permanent. Always confirm before deleting.

### How long are audit logs kept?

Audit logs are kept indefinitely by default. Admins can implement retention policies as needed.

### Can Officers approve their own reconciliations?

No. Only Managers and Admins can approve exceptions and finalize reconciliations.

### What's the difference between "Approve" and "Finalize"?

- **Approve**: Manager reviews and approves exceptions/discrepancies
- **Finalize**: Manager officially completes the reconciliation process

### Can I export the audit trail?

Currently not implemented in UI. Admins can export from database directly if needed.

### Are there limits on user creation?

No built-in limits. Admins can create as many users as needed.

### Can usernames be changed?

Not currently supported. Create a new user instead.

### Can emails be changed?

Not currently supported through UI. Contact system administrator.

### What happens if I forget my password?

Contact your system administrator to reset it (password reset flow not yet implemented).

---

## Security Best Practices

### For All Users

✅ **Use Strong Passwords**
- Minimum 8 characters
- Mix of letters, numbers, symbols
- Avoid common words

✅ **Logout When Done**
- Especially on shared computers
- Click your name → Logout

✅ **Report Suspicious Activity**
- Notify admin immediately
- Check audit logs if you're manager+

### For Managers

✅ **Review Audit Logs Regularly**
- Check for unusual patterns
- Monitor user activities
- Report concerns to admin

✅ **Approve Thoughtfully**
- Review exceptions carefully
- Document approval reasons
- Don't approve blindly

### For Admins

✅ **Follow Principle of Least Privilege**
- Give users minimum required role
- Review roles periodically
- Revoke access when no longer needed

✅ **Monitor User Activity**
- Check audit trail regularly
- Watch for privilege escalation attempts
- Investigate anomalies

✅ **Backup Before Major Changes**
- Export data before bulk deletions
- Test role changes on non-production first
- Keep admin user list updated

---

## Getting Help

### Support Channels

📧 **Email**: support@assetreconcile.ai  
📚 **Documentation**: `/docs` folder  
🐛 **Bug Reports**: Contact your administrator  
💡 **Feature Requests**: Submit via admin

### Additional Resources

- **API Documentation**: `docs/API_DOCUMENTATION_RBAC.md`
- **Quick Start Guide**: `RBAC_QUICK_START.md`
- **Testing Guide**: `API_TESTING_RBAC.md`
- **Technical Design**: `.kiro/specs/rbac-security/design.md`

---

## Change Log

### Version 1.0 (July 2026)
- Initial RBAC implementation
- Three-tier role system
- User management interface
- Audit trail viewer
- Role-based navigation

---

**Last Updated:** July 2, 2026  
**Version:** 1.0  
**Status:** Production Ready

---

**Remember:** Your role determines what you can see and do. If you need different access, contact your system administrator!
