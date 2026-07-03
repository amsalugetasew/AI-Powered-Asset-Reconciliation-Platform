# Asset Sync AI - Intelligent Asset Reconciliation Platform

A full-stack web application for intelligent asset reconciliation using rule-based matching, fuzzy matching, and AI-powered reasoning.

## 🚀 Features

### Core Functionality
- **JWT Authentication**: Secure user registration, login, and session management
- **Excel File Processing**: Upload and process customer and internal asset Excel files
- **Multi-Stage Reconciliation**:
  - **Rule-Based Matching**: Exact matching using tag numbers (old-old, new-new, old-new, new-old)
  - **Fuzzy Matching**: Similarity-based matching using description, serial number, department, and book value
  - **AI-Assisted Matching**: LLM-powered reasoning for complex matches (OpenAI GPT-4 or Anthropic Claude)
- **Confidence Scoring**: Automatic classification into AI Matched, Manual Review, and Unmatched categories
- **Comprehensive Reports**: Multi-sheet Excel reports with detailed match information
- **Analytics Dashboard**: KPI cards, charts, and visualizations using Recharts
- **MySQL Storage**: Persistent storage for users, reconciliations, and statistics

### Technical Highlights
- **Backend**: Python Flask with modular architecture (services, routes, utilities)
- **Frontend**: React.js with TailwindCSS for responsive UI
- **Data Processing**: Pandas for efficient Excel handling and data cleaning
- **AI Integration**: Support for OpenAI and Anthropic APIs
- **RESTful APIs**: Clean API design with proper error handling
- **Protected Routes**: Frontend route protection with React Router

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- MySQL 8.0+ (with MySQL Workbench recommended)
- OpenAI API Key or Anthropic API Key (optional, for AI matching)

## 🛠️ Installation

### Backend Setup

1. **Navigate to backend directory**:
```bash
cd backend
```

2. **Create virtual environment**:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**:
```bash
copy .env.example .env
```

Edit `.env` file with your configuration:
```env
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production

# Database (MySQL)
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/assetsync_db

# AI API Keys (optional - choose one)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# AI Configuration
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Thresholds
AI_MATCH_THRESHOLD=0.75
MANUAL_REVIEW_THRESHOLD=0.50
```

5. **Create MySQL database**:

**Using MySQL Workbench:**
- Open MySQL Workbench
- Connect to your MySQL server
- Create new schema: `assetsync_db`

**Or using MySQL command line:**
```sql
CREATE DATABASE assetsync_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

6. **Run the application**:
```bash
python app.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**:
```bash
cd frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Run development server**:
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## 📁 Project Structure

```
AssetSync-AI/
├── backend/
│   ├── app.py                      # Flask application entry point
│   ├── config.py                   # Configuration management
│   ├── models.py                   # Database models (User, Reconciliation)
│   ├── requirements.txt            # Python dependencies
│   ├── .env.example               # Environment variables template
│   ├── routes/
│   │   ├── auth_routes.py         # Authentication endpoints
│   │   └── reconciliation_routes.py # Reconciliation endpoints
│   ├── services/
│   │   └── reconciliation_service.py # Main reconciliation logic
│   └── utils/
│       ├── data_cleaner.py        # Excel data cleaning
│       ├── rule_matcher.py        # Rule-based matching
│       ├── fuzzy_matcher.py       # Fuzzy matching
│       ├── ai_matcher.py          # AI-assisted matching
│       └── report_generator.py    # Excel report generation
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main app component
│   │   ├── main.jsx               # React entry point
│   │   ├── index.css              # Global styles
│   │   ├── components/
│   │   │   └── Layout.jsx         # Main layout with navigation
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Authentication context
│   │   └── pages/
│   │       ├── Login.jsx          # Login page
│   │       ├── Register.jsx       # Registration page
│   │       ├── Dashboard.jsx      # Main dashboard
│   │       ├── Upload.jsx         # File upload page
│   │       ├── Results.jsx        # Results visualization
│   │       └── Analytics.jsx      # Analytics dashboard
│   ├── package.json               # Node dependencies
│   ├── vite.config.js             # Vite configuration
│   ├── tailwind.config.js         # TailwindCSS configuration
│   └── index.html                 # HTML template
└── README.md                      # This file
```

## 🔄 Reconciliation Process

### 1. Data Cleaning
- Standardize column names
- Clean text values (uppercase, trim whitespace)
- Clean numeric values (remove currency symbols)
- Handle missing values

### 2. Rule-Based Matching (Priority 1)
- **Old-Old**: Customer old tag = Internal old tag
- **New-New**: Customer new tag = Internal new tag
- **Old-New**: Customer old tag = Internal new tag
- **New-Old**: Customer new tag = Internal old tag
- Confidence: 1.0 (100%)

### 3. Fuzzy Matching (Priority 2)
Weighted similarity scoring:
- Description similarity: 35%
- Serial number similarity: 25%
- Department similarity: 15%
- Asset number similarity: 15%
- Book value similarity: 10%
- Threshold: 0.60 (60%)

### 4. AI-Assisted Matching (Priority 3)
- LLM-based reasoning for remaining unmatched records
- Considers all fields holistically
- Provides reasoning for matches
- Classification:
  - **AI Matched**: Confidence ≥ 0.75
  - **Manual Review**: 0.50 ≤ Confidence < 0.75
  - **Unmatched**: Confidence < 0.50

## 📊 Excel Report Structure

Generated reports contain 6 sheets:

1. **Summary**: Overall statistics and match rates
2. **Rule_Matched**: Records matched by exact rules
3. **AI_Matched**: Records matched by AI with high confidence
4. **Manual_Review**: Records requiring human review
5. **Customer_Unmatched**: Unmatched customer records
6. **Mine_Unmatched**: Unmatched internal records

Each matched record shows parallel columns:
- Customer data (old tag, new tag, description, etc.)
- Internal data (old tag, new tag, description, etc.)
- Match metadata (type, method, confidence score)

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Reconciliation
- `POST /api/reconciliation/upload` - Upload Excel files
- `POST /api/reconciliation/process/:id` - Process reconciliation
- `GET /api/reconciliation/list` - List all reconciliations
- `GET /api/reconciliation/:id` - Get reconciliation details
- `GET /api/reconciliation/download/:id` - Download report
- `GET /api/reconciliation/analytics` - Get analytics

## 🎨 Frontend Features

### Pages
- **Login/Register**: Secure authentication with JWT
- **Dashboard**: View all reconciliation jobs with status
- **Upload**: Drag-and-drop file upload interface
- **Results**: Detailed results with KPI cards and charts
- **Analytics**: Aggregate analytics across all reconciliations

### Components
- Responsive design with TailwindCSS
- Protected routes with authentication
- Toast notifications for user feedback
- Loading states and error handling
- Interactive charts with Recharts

## 🚀 Production Deployment

### Backend
1. Set `FLASK_ENV=production` in `.env`
2. Use strong secret keys
3. Configure production database
4. Use gunicorn: `gunicorn -w 4 -b 0.0.0.0:5000 app:app`
5. Set up reverse proxy (nginx)
6. Enable HTTPS

### Frontend
1. Build production bundle: `npm run build`
2. Serve static files with nginx or CDN
3. Configure API proxy
4. Enable HTTPS

## 🔧 Configuration

### Confidence Thresholds
Adjust in `.env`:
```env
AI_MATCH_THRESHOLD=0.75      # AI match confidence threshold
MANUAL_REVIEW_THRESHOLD=0.50 # Manual review threshold
```

### File Upload Limits
Adjust in `.env`:
```env
MAX_FILE_SIZE=50  # Maximum file size in MB
```

### AI Provider
Choose between OpenAI and Anthropic:
```env
AI_PROVIDER=openai  # or 'anthropic'
```

## 📝 Excel File Format

Required columns (case-insensitive):
- Old Tag Number
- New Tag Number
- Year
- Category
- Description
- Serial No
- Department/Unit
- District
- Book Value
- Asset Number

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Flask for backend framework
- React for frontend framework
- TailwindCSS for styling
- Recharts for data visualization
- OpenAI/Anthropic for AI capabilities
- Pandas for data processing

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for intelligent asset reconciliation**