"""
One-time migration: add full_name, employee_id, department columns to users table.
Run with: python add_user_profile_fields.py
"""
import sys
import traceback

try:
    from app import create_app
    from models import db
    from sqlalchemy import text

    app = create_app()

    with app.app_context():
        with db.engine.connect() as conn:
            for col, definition in [
                ('full_name',   'VARCHAR(150)'),
                ('employee_id', 'VARCHAR(50)'),
                ('department',  'VARCHAR(100)'),
            ]:
                try:
                    conn.execute(text(f'SELECT {col} FROM users LIMIT 1'))
                    print(f"  Column '{col}' already exists — skipping.")
                except Exception:
                    conn.rollback()
                    try:
                        conn.execute(text(f'ALTER TABLE users ADD COLUMN {col} {definition}'))
                        conn.commit()
                        print(f"  Added column '{col}'.")
                    except Exception as e2:
                        conn.rollback()
                        print(f"  ERROR adding '{col}': {e2}")

        print("Migration complete.")

except Exception as e:
    traceback.print_exc()
    sys.exit(1)
