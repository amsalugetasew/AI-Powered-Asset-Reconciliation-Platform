"""
Script to add approval status columns to reconciliation_records table
Run this once: python add_approval_columns.py
"""

from app import app, db
from sqlalchemy import text

def add_approval_columns():
    with app.app_context():
        try:
            print("Adding approval status columns to reconciliation_records table...")
            
            # Check if columns already exist
            check_query = text("""
                SELECT COUNT(*) as count
                FROM pragma_table_info('reconciliation_records')
                WHERE name = 'approval_status'
            """)
            
            result = db.session.execute(check_query).fetchone()
            
            if result[0] > 0:
                print("✓ Columns already exist. Skipping migration.")
                return
            
            # Add approval_status column
            db.session.execute(text("""
                ALTER TABLE reconciliation_records 
                ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending' NOT NULL
            """))
            print("✓ Added approval_status column")
            
            # Add approved_by column
            db.session.execute(text("""
                ALTER TABLE reconciliation_records 
                ADD COLUMN approved_by INTEGER
            """))
            print("✓ Added approved_by column")
            
            # Add approved_at column
            db.session.execute(text("""
                ALTER TABLE reconciliation_records 
                ADD COLUMN approved_at DATETIME
            """))
            print("✓ Added approved_at column")
            
            # Create index
            db.session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_reconciliation_records_approval_status 
                ON reconciliation_records(approval_status)
            """))
            print("✓ Created index on approval_status")
            
            db.session.commit()
            print("\n✅ Migration completed successfully!")
            print("All existing records have been set to 'pending' status.")
            
        except Exception as e:
            print(f"\n❌ Error during migration: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    print("=" * 60)
    print("DATABASE MIGRATION: Add Approval Status Columns")
    print("=" * 60)
    add_approval_columns()
