# AssetSync AI - Complete Setup Guide

## Quick Start (Development)

### 1. Clone Repository
```bash
git clone <repository-url>
cd AI-Powered-Asset-Reconciliation-Platform
```

### 2. Backend Setup (5 minutes)

#### Install MySQL
Download and install MySQL from https://dev.mysql.com/downloads/mysql/
Download MySQL Workbench from https://dev.mysql.com/downloads/workbench/

#### Create Database
```bash
# Using MySQL Workbench:
# 1. Open MySQL Workbench
# 2. Connect to your local MySQL server
# 3. Click "Create a new schema" icon
# 4. Enter name: assetsync_db
# 5. Click Apply

# Or using MySQL command line:
mysql -u root -p

# Create database
CREATE DATABASE assetsync_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Exit
exit;
```

#### Setup Python Environment
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Configure Environment
```bash
# Copy example environment file
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Edit .env file with your settings
notepad .env  # Windows
# nano .env   # Linux/Mac
```

**Minimum required configuration**:
```env
SECRET_KEY=your-random-secret-key-here
JWT_SECRET_KEY=your-random-jwt-secret-here
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/assetsync_db
```

**Optional AI configuration** (for AI-assisted matching):
```env
# Choose ONE provider
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key-here

# OR
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

#### Run Backend
```bash
python app.py
```

Backend should now be running on `http://localhost:5000`

### 3. Frontend Setup (3 minutes)

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend should now be running on `http://localhost:3000`

### 4. Test the Application

1. Open browser to `http://localhost:3000`
2. Click "Register" and create an account
3. Login with your credentials
4. Upload two Excel files (customer and internal)
5. View reconciliation results

## Detailed Configuration

### Database Configuration

#### Database Configuration

#### MySQL Connection String Format
```
mysql+pymysql://username:password@host:port/database_name
```

Examples:
```env
# Local development with root user
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/assetsync_db

# Local development with dedicated user
DATABASE_URL=mysql+pymysql://assetsync_user:assetsync_pass@localhost:3306/assetsync_db

# Remote MySQL server
DATABASE_URL=mysql+pymysql://user:pass@db.example.com:3306/assetsync_db

# With special characters in password (URL encode)
DATABASE_URL=mysql+pymysql://user:p%40ssw0rd@localhost:3306/assetsync_db
```

### AI Provider Setup

#### Option 1: OpenAI (GPT-4)
1. Sign up at https://platform.openai.com/
2. Create API key at https://platform.openai.com/api-keys
3. Add to `.env`:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
```

#### Option 2: Anthropic (Claude)
1. Sign up at https://console.anthropic.com/
2. Create API key
3. Add to `.env`:
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

#### Option 3: No AI (Rule-based + Fuzzy only)
Simply don't set any AI API keys. The system will work with:
- Rule-based matching (exact matches)
- Fuzzy matching (similarity-based)
- Manual review for remaining records

### File Upload Configuration

```env
# Maximum file size in MB
MAX_FILE_SIZE=50

# Upload and report directories (relative to backend/)
UPLOAD_FOLDER=uploads
REPORTS_FOLDER=reports
```

### Reconciliation Thresholds

```env
# AI match threshold (0.0 to 1.0)
# Records with confidence >= this value are auto-matched
AI_MATCH_THRESHOLD=0.75

# Manual review threshold (0.0 to 1.0)
# Records with confidence >= this value require manual review
MANUAL_REVIEW_THRESHOLD=0.50
```

## Excel File Requirements

### Required Columns
Your Excel files must contain these columns (case-insensitive):

1. **Old Tag Number** (or "old_tag", "old tag no")
2. **New Tag Number** (or "new_tag", "new tag no")
3. **Year**
4. **Category**
5. **Description** (or "desc")
6. **Serial No** (or "serial number", "serial")
7. **Department** (or "unit", "department/unit")
8. **District**
9. **Book Value** (or "value")
10. **Asset Number** (or "asset no", "asset_no")

### Example Excel Structure

| Old Tag Number | New Tag Number | Year | Category | Description | Serial No | Department | District | Book Value | Asset Number |
|----------------|----------------|------|----------|-------------|-----------|------------|----------|------------|--------------|
| TAG001 | TAG101 | 2023 | Computer | Dell Laptop | SN12345 | IT | North | 1500.00 | AST001 |
| TAG002 | TAG102 | 2023 | Furniture | Office Desk | SN12346 | Admin | South | 500.00 | AST002 |

### Sample Data
Create sample Excel files for testing:

**customer_assets.xlsx**:
```
Old Tag Number, New Tag Number, Year, Category, Description, Serial No, Department, District, Book Value, Asset Number
TAG001, TAG101, 2023, Computer, Dell Laptop, SN12345, IT, North, 1500.00, AST001
TAG002, TAG102, 2023, Furniture, Office Desk, SN12346, Admin, South, 500.00, AST002
```

**internal_assets.xlsx**:
```
Old Tag Number, New Tag Number, Year, Category, Description, Serial No, Department, District, Book Value, Asset Number
TAG001, TAG101, 2023, Computer, Dell Laptop, SN12345, IT, North, 1500.00, AST001
TAG003, TAG103, 2023, Equipment, Printer, SN12347, IT, East, 800.00, AST003
```

## Troubleshooting

### Backend Issues

#### Database Connection Error
```
Error: could not connect to server
```
**Solution**:
1. Ensure MySQL is running (check Services on Windows or `systemctl status mysql` on Linux)
2. Check DATABASE_URL in `.env`
3. Verify database exists in MySQL Workbench or: `mysql -u root -p -e "SHOW DATABASES;"`
4. Test connection: `mysql -u root -p assetsync_db`

#### Module Not Found Error
```
ModuleNotFoundError: No module named 'flask'
```
**Solution**:
```bash
# Ensure virtual environment is activated
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Reinstall dependencies
pip install -r requirements.txt
```

#### Port Already in Use
```
Error: Address already in use
```
**Solution**:
```bash
# Windows: Find and kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:5000 | xargs kill -9
```

### Frontend Issues

#### npm install fails
**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json  # Linux/Mac
rmdir /s node_modules & del package-lock.json  # Windows

# Reinstall
npm install
```

#### Port 3000 already in use
**Solution**:
Edit `vite.config.js`:
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,  // Change to different port
    // ...
  }
})
```

### Excel Processing Issues

#### "Error reading Excel file"
**Solution**:
1. Ensure file is valid Excel format (.xlsx or .xls)
2. Check file is not corrupted
3. Verify all required columns exist
4. Remove any merged cells or complex formatting

#### "Missing required fields"
**Solution**:
1. Check column names match required format
2. Column names are case-insensitive
3. Ensure no extra spaces in column names

### AI Matching Issues

#### "AI matching error"
**Solution**:
1. Verify API key is correct
2. Check API key has sufficient credits
3. Ensure AI_PROVIDER matches your API key (openai or anthropic)
4. Check internet connection

## Production Deployment

### Backend (Flask)

#### Using Gunicorn
```bash
# Install gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

#### Using Docker
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

### Frontend (React)

#### Build for Production
```bash
cd frontend
npm run build
```

#### Serve with Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Environment Variables for Production

```env
FLASK_ENV=production
SECRET_KEY=<strong-random-key>
JWT_SECRET_KEY=<strong-random-key>
DATABASE_URL=postgresql://user:pass@prod-db:5432/assetsync_db
```

## Performance Optimization

### Database Indexing
```sql
-- Add indexes for better query performance (run in MySQL Workbench)
USE assetsync_db;
CREATE INDEX idx_reconciliation_user_id ON reconciliations(user_id);
CREATE INDEX idx_reconciliation_status ON reconciliations(status);
CREATE INDEX idx_reconciliation_created_at ON reconciliations(created_at);
```

### File Size Limits
For large Excel files (>10MB), consider:
1. Increasing `MAX_FILE_SIZE` in `.env`
2. Processing in chunks
3. Using background tasks (Celery)

### AI Cost Optimization
The system minimizes AI costs by:
1. Rule-based matching first (free)
2. Fuzzy matching second (free)
3. AI matching only for remaining records
4. Limiting AI processing to 50 records per batch

To further reduce costs:
```env
# Increase fuzzy matching threshold to reduce AI calls
FUZZY_MATCH_THRESHOLD=0.55  # Default: 0.60

# Increase AI match threshold to be more selective
AI_MATCH_THRESHOLD=0.80  # Default: 0.75
```

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong secret keys** - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
3. **Enable HTTPS in production**
4. **Regularly update dependencies**
5. **Implement rate limiting** for API endpoints
6. **Validate and sanitize all inputs**
7. **Use environment-specific configurations**

## Monitoring and Logging

### Enable Logging
```python
# In app.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Monitor Database
```sql
-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'assetsync_db';

-- Check database size
SELECT pg_size_pretty(pg_database_size('assetsync_db'));
```

## Backup and Recovery

### Database Backup
```bash
# Backup
mysqldump -u root -p assetsync_db > backup.sql

# Restore
mysql -u root -p assetsync_db < backup.sql

# Or use MySQL Workbench: Server → Data Export/Import
```

### File Backup
Regularly backup:
- `backend/uploads/` - Uploaded Excel files
- `backend/reports/` - Generated reports
- `.env` file (securely)

## Support and Resources

- **Documentation**: See README.md
- **Issues**: Open GitHub issue
- **Flask Docs**: https://flask.palletsprojects.com/
- **React Docs**: https://react.dev/
- **MySQL Docs**: https://dev.mysql.com/doc/
- **MySQL Workbench**: https://dev.mysql.com/doc/workbench/en/

---

**Happy Reconciling! 🚀**