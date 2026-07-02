"""
Database migration script to add customer_duplicates and internal_duplicates columns
Run this ONCE to update your database schema
"""
from app import app, db

def migrate():
    """Add duplicate columns to reconciliations table"""
    with app.app_context():
        try:
            # Check if columns already exist
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('reconciliations')]
            
            print("="*70)
            print("DATABASE MIGRATION: Add Duplicate Columns")
            print("="*70)
            print("\nCurrent columns in reconciliations table:")
            for col in columns:
                print(f"  - {col}")
            print()
            
            if 'customer_duplicates' in columns and 'internal_duplicates' in columns:
                print("✓ Both columns already exist, no migration needed!")
                return True
            
            print("Adding missing columns...")
            
            # Add columns using raw SQL
            with db.engine.begin() as conn:
                if 'customer_duplicates' not in columns:
                    try:
                        conn.execute(db.text(
                            "ALTER TABLE reconciliations ADD COLUMN customer_duplicates INTEGER DEFAULT 0"
                        ))
                        print("✓ Added customer_duplicates column")
                    except Exception as e:
                        print(f"⚠ Could not add customer_duplicates: {str(e)}")
                        return False
                else:
                    print("✓ customer_duplicates already exists")
                
                if 'internal_duplicates' not in columns:
                    try:
                        conn.execute(db.text(
                            "ALTER TABLE reconciliations ADD COLUMN internal_duplicates INTEGER DEFAULT 0"
                        ))
                        print("✓ Added internal_duplicates column")
                    except Exception as e:
                        print(f"⚠ Could not add internal_duplicates: {str(e)}")
                        return False
                else:
                    print("✓ internal_duplicates already exists")
            
            print("\n" + "="*70)
            print("✓ MIGRATION COMPLETED SUCCESSFULLY!")
            print("="*70)
            print("\nNEXT STEPS:")
            print("1. Restart your Flask backend")
            print("2. Try processing a reconciliation again")
            print()
            return True
            
        except Exception as e:
            print("\n" + "="*70)
            print("✗ MIGRATION FAILED!")
            print("="*70)
            print(f"\nError: {str(e)}\n")
            import traceback
            traceback.print_exc()
            return False

if __name__ == '__main__':
    success = migrate()
    exit(0 if success else 1)
