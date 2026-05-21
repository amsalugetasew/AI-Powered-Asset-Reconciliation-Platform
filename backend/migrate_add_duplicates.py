"""
Database migration script to add customer_duplicates and internal_duplicates columns
"""
from app import create_app, db
from models import Reconciliation

app = create_app()

def migrate():
    """Add duplicate columns to reconciliations table"""
    with app.app_context():
        try:
            # Check if columns already exist
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('reconciliations')]
            
            if 'customer_duplicates' in columns and 'internal_duplicates' in columns:
                print("OK: Columns already exist, no migration needed")
                return
            
            print("Adding customer_duplicates and internal_duplicates columns...")
            
            # Add columns using raw SQL
            with db.engine.connect() as conn:
                if 'customer_duplicates' not in columns:
                    conn.execute(db.text(
                        "ALTER TABLE reconciliations ADD COLUMN customer_duplicates INTEGER DEFAULT 0"
                    ))
                    conn.commit()
                    print("OK: Added customer_duplicates column")
                
                if 'internal_duplicates' not in columns:
                    conn.execute(db.text(
                        "ALTER TABLE reconciliations ADD COLUMN internal_duplicates INTEGER DEFAULT 0"
                    ))
                    conn.commit()
                    print("OK: Added internal_duplicates column")
            
            print("OK: Migration completed successfully!")
            print("\nPlease restart your Flask application.")
            
        except Exception as e:
            print(f"Error: Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate()
