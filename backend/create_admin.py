"""
Create First Admin User Script

Run this script to create the first admin user in the system.
This is typically run once after initial deployment.

Usage:
    python backend/create_admin.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, User
from getpass import getpass


def create_admin_user():
    """Create an admin user interactively"""
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*60)
        print("CREATE FIRST ADMIN USER")
        print("="*60 + "\n")
        
        # Get user input
        print("Please provide details for the admin user:\n")
        
        username = input("Username: ").strip()
        if not username:
            print("❌ Username cannot be empty!")
            return False
        
        # Check if username already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"\n⚠️  User '{username}' already exists!")
            update = input("Do you want to update this user to admin role? (yes/no): ").strip().lower()
            
            if update == 'yes':
                old_role = existing_user.role
                existing_user.role = 'admin'
                db.session.commit()
                print(f"\n✅ User '{username}' updated from '{old_role}' to 'admin' role!")
                print(f"   User ID: {existing_user.id}")
                print(f"   Email: {existing_user.email}")
                return True
            else:
                print("Operation cancelled.")
                return False
        
        email = input("Email: ").strip()
        if not email:
            print("❌ Email cannot be empty!")
            return False
        
        # Check if email already exists
        if User.query.filter_by(email=email).first():
            print(f"❌ Email '{email}' is already registered!")
            return False
        
        password = getpass("Password (hidden): ")
        if not password:
            print("❌ Password cannot be empty!")
            return False
        
        password_confirm = getpass("Confirm Password (hidden): ")
        if password != password_confirm:
            print("❌ Passwords do not match!")
            return False
        
        # Create admin user
        try:
            admin_user = User(
                username=username,
                email=email,
                role='admin'
            )
            admin_user.set_password(password)
            
            db.session.add(admin_user)
            db.session.commit()
            
            print("\n" + "="*60)
            print("✅ ADMIN USER CREATED SUCCESSFULLY!")
            print("="*60)
            print(f"\nUser Details:")
            print(f"  ID:       {admin_user.id}")
            print(f"  Username: {admin_user.username}")
            print(f"  Email:    {admin_user.email}")
            print(f"  Role:     {admin_user.role}")
            print(f"  Created:  {admin_user.created_at}")
            print("\nYou can now login with these credentials.")
            print("="*60 + "\n")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error creating admin user: {str(e)}")
            return False


def promote_user_to_admin():
    """Promote an existing user to admin role"""
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*60)
        print("PROMOTE EXISTING USER TO ADMIN")
        print("="*60 + "\n")
        
        # List all users
        users = User.query.all()
        if not users:
            print("❌ No users found in the database!")
            return False
        
        print("Existing users:")
        print("-" * 60)
        for user in users:
            print(f"  ID: {user.id:3d} | Username: {user.username:20s} | Role: {user.role:10s}")
        print("-" * 60 + "\n")
        
        user_id = input("Enter user ID to promote to admin: ").strip()
        
        try:
            user_id = int(user_id)
            user = User.query.get(user_id)
            
            if not user:
                print(f"❌ User with ID {user_id} not found!")
                return False
            
            old_role = user.role
            
            if old_role == 'admin':
                print(f"ℹ️  User '{user.username}' is already an admin!")
                return True
            
            # Confirm promotion
            print(f"\nPromote user '{user.username}' from '{old_role}' to 'admin'?")
            confirm = input("Type 'yes' to confirm: ").strip().lower()
            
            if confirm != 'yes':
                print("Operation cancelled.")
                return False
            
            # Update role
            user.role = 'admin'
            db.session.commit()
            
            print("\n" + "="*60)
            print("✅ USER PROMOTED TO ADMIN!")
            print("="*60)
            print(f"\nUser Details:")
            print(f"  ID:       {user.id}")
            print(f"  Username: {user.username}")
            print(f"  Email:    {user.email}")
            print(f"  Old Role: {old_role}")
            print(f"  New Role: {user.role}")
            print("="*60 + "\n")
            
            return True
            
        except ValueError:
            print("❌ Invalid user ID! Please enter a number.")
            return False
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error promoting user: {str(e)}")
            return False


def main():
    """Main menu"""
    print("\n" + "="*60)
    print("ADMIN USER MANAGEMENT")
    print("="*60)
    print("\nOptions:")
    print("  1. Create new admin user")
    print("  2. Promote existing user to admin")
    print("  3. Exit")
    print()
    
    choice = input("Select option (1-3): ").strip()
    
    if choice == '1':
        create_admin_user()
    elif choice == '2':
        promote_user_to_admin()
    elif choice == '3':
        print("Exiting...")
    else:
        print("❌ Invalid option!")


if __name__ == '__main__':
    main()
