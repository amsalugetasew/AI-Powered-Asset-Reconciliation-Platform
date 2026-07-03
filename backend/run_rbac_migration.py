#!/usr/bin/env python3
"""
Manual migration script to add RBAC support to the database.
This adds the role field to users table and creates the audit_logs table.

Usage:
    python run_rbac_migration.py
"""

import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_db_config():
    """Parse database URL from environment"""
    db_url = os.getenv('DATABASE_URL', 'mysql+pymysql://root:root@localhost:3306/finance')
    
    # Parse the URL: mysql+pymysql://user:password@host:port/database
    parts = db_url.replace('mysql+pymysql://', '').split('@')
    user_pass = parts[0].split(':')
    host_db = parts[1].split('/')
    host_port = host_db[0].split(':')
    
    return {
        'user': user_pass[0],
        'password': user_pass[1] if len(user_pass) > 1 else '',
        'host': host_port[0],
        'port': int(host_port[1]) if len(host_port) > 1 else 3306,
        'database': host_db[1]
    }

def run_migration():
    """Execute the RBAC migration"""
    print("="*60)
    print("RBAC Migration Script")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Get database configuration
    db_config = get_db_config()
    print(f"Connecting to database: {db_config['database']} at {db_config['host']}")
    print()
    
    # Connect to database
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        print("Step 1: Checking if migration is needed...")
        
        # Check if role column already exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = %s
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'role'
        """, (db_config['database'],))
        role_exists = cursor.fetchone()[0] > 0
        
        if role_exists:
            print("  ⚠ Role column already exists in users table")
        else:
            print("  ✓ Role column not found, will be created")
        
        # Check if audit_logs table exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = %s
            AND TABLE_NAME = 'audit_logs'
        """, (db_config['database'],))
        audit_logs_exists = cursor.fetchone()[0] > 0
        
        if audit_logs_exists:
            print("  ⚠ audit_logs table already exists")
        else:
            print("  ✓ audit_logs table not found, will be created")
        
        print()
        
        # Step 2: Add role column to users table
        if not role_exists:
            print("Step 2: Adding role column to users table...")
            
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN role ENUM('officer', 'manager', 'admin') 
                NOT NULL DEFAULT 'officer'
            """)
            
            print("  ✓ Role column added successfully")
            print("  ✓ All existing users set to 'officer' role by default")
        else:
            print("Step 2: Skipping role column (already exists)")
        
        print()
        
        # Step 3: Create audit_logs table
        if not audit_logs_exists:
            print("Step 3: Creating audit_logs table...")
            
            cursor.execute("""
                CREATE TABLE audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    operation_type VARCHAR(50) NOT NULL,
                    resource_type VARCHAR(50) NOT NULL,
                    resource_id INT NULL,
                    details JSON NULL,
                    ip_address VARCHAR(45) NULL,
                    timestamp DATETIME NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_audit_user_id (user_id),
                    INDEX idx_audit_timestamp (timestamp),
                    INDEX idx_audit_resource (resource_type, resource_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            print("  ✓ audit_logs table created successfully")
            print("  ✓ Indexes created for optimal query performance")
        else:
            print("Step 3: Skipping audit_logs table (already exists)")
        
        print()
        
        # Commit changes
        connection.commit()
        
        print("="*60)
        print("✅ Migration completed successfully!")
        print("="*60)
        print()
        
        # Display current user roles
        print("Current users and their roles:")
        cursor.execute("SELECT id, username, email, role FROM users")
        users = cursor.fetchall()
        
        if users:
            print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Role':<10}")
            print("-"*70)
            for user in users:
                print(f"{user[0]:<5} {user[1]:<20} {user[2]:<30} {user[3]:<10}")
        else:
            print("  No users found in database")
        
        print()
        print("Next steps:")
        print("1. Create the first admin user using: python create_admin.py")
        print("2. Restart the Flask application")
        print("3. Test login with updated JWT tokens")
        
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
        print()
        print("="*60)
        print("❌ Migration failed!")
        print("="*60)
        print(f"Error: {str(e)}")
        print()
        if 'connection' not in locals():
            print("Could not connect to database. Please check:")
            print("1. MySQL is running")
            print("2. Database credentials in .env are correct")
            print("3. Database exists")
        else:
            print("The database has been rolled back to its previous state.")
        return False
    
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()
    
    return True

if __name__ == '__main__':
    import sys
    success = run_migration()
    sys.exit(0 if success else 1)
