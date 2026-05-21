"""
Quick diagnostic script to test backend components
"""
import sys
import os

print("=" * 50)
print("Backend Diagnostic Test")
print("=" * 50)

# Test 1: Python version
print(f"\n1. Python Version: {sys.version}")

# Test 2: Import core modules
print("\n2. Testing Core Imports...")
try:
    import flask
    print("   ✓ Flask imported successfully")
except ImportError as e:
    print(f"   ✗ Flask import failed: {e}")

try:
    import flask_cors
    print("   ✓ Flask-CORS imported successfully")
except ImportError as e:
    print(f"   ✗ Flask-CORS import failed: {e}")

try:
    import flask_jwt_extended
    print("   ✓ Flask-JWT-Extended imported successfully")
except ImportError as e:
    print(f"   ✗ Flask-JWT-Extended import failed: {e}")

try:
    import pymysql
    print("   ✓ PyMySQL imported successfully")
except ImportError as e:
    print(f"   ✗ PyMySQL import failed: {e}")

try:
    import pandas
    print("   ✓ Pandas imported successfully")
except ImportError as e:
    print(f"   ✗ Pandas import failed: {e}")

# Test 3: Check directories
print("\n3. Checking Directories...")
dirs_to_check = ['uploads', 'reports', 'routes', 'services', 'utils']
for dir_name in dirs_to_check:
    if os.path.exists(dir_name):
        print(f"   ✓ {dir_name}/ exists")
    else:
        print(f"   ✗ {dir_name}/ missing")
        try:
            os.makedirs(dir_name, exist_ok=True)
            print(f"     → Created {dir_name}/")
        except Exception as e:
            print(f"     → Failed to create: {e}")

# Test 4: Check .env file
print("\n4. Checking Configuration...")
if os.path.exists('.env'):
    print("   ✓ .env file exists")
    from dotenv import load_dotenv
    load_dotenv()
    
    required_vars = ['SECRET_KEY', 'JWT_SECRET_KEY', 'DATABASE_URL']
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"   ✓ {var} is set")
        else:
            print(f"   ✗ {var} is missing")
else:
    print("   ✗ .env file not found")
    print("     → Copy .env.example to .env and configure it")

# Test 5: Test database connection
print("\n5. Testing Database Connection...")
try:
    import pymysql
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL', '')
    if 'mysql' in db_url:
        # Parse connection string
        # Format: mysql+pymysql://user:pass@host:port/dbname
        parts = db_url.replace('mysql+pymysql://', '').split('@')
        if len(parts) == 2:
            user_pass = parts[0].split(':')
            host_db = parts[1].split('/')
            host_port = host_db[0].split(':')
            
            user = user_pass[0]
            password = user_pass[1] if len(user_pass) > 1 else ''
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 3306
            database = host_db[1] if len(host_db) > 1 else ''
            
            try:
                connection = pymysql.connect(
                    host=host,
                    user=user,
                    password=password,
                    database=database,
                    port=port
                )
                print(f"   ✓ Connected to MySQL database: {database}")
                connection.close()
            except Exception as e:
                print(f"   ✗ Database connection failed: {e}")
                print(f"     → Check MySQL is running")
                print(f"     → Verify DATABASE_URL in .env")
    else:
        print("   ⚠ DATABASE_URL not configured for MySQL")
except Exception as e:
    print(f"   ✗ Database test failed: {e}")

# Test 6: Try importing app modules
print("\n6. Testing App Modules...")
try:
    from config import config
    print("   ✓ config.py imported successfully")
except Exception as e:
    print(f"   ✗ config.py import failed: {e}")

try:
    from models import db, User
    print("   ✓ models.py imported successfully")
except Exception as e:
    print(f"   ✗ models.py import failed: {e}")

try:
    from routes.auth_routes import auth_bp
    print("   ✓ auth_routes.py imported successfully")
except Exception as e:
    print(f"   ✗ auth_routes.py import failed: {e}")

try:
    from routes.reconciliation_routes import reconciliation_bp
    print("   ✓ reconciliation_routes.py imported successfully")
except Exception as e:
    print(f"   ✗ reconciliation_routes.py import failed: {e}")

print("\n" + "=" * 50)
print("Diagnostic Complete!")
print("=" * 50)
print("\nIf all tests pass, try running: python app.py")
print("If tests fail, fix the issues shown above.\n")
