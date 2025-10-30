# 🤖 AI-Powered Expense Tracker

A production-grade, full-stack expense tracking application with advanced AI capabilities including OCR, ML categorization, anomaly detection, and LLM-powered insights.

## ✨ Features

### 🧠 AI-Powered Features
- **Receipt OCR**: Automatic data extraction from receipt images using Tesseract.js
- **Smart Categorization**: ML-based expense categorization with confidence scoring
- **Anomaly Detection**: Statistical analysis to identify unusual spending patterns
- **LLM Assistant**: Natural language queries about your spending habits
- **Semantic Search**: Find expenses using natural language descriptions
- **Automated Insights**: AI-generated spending analysis and recommendations

### 🏗️ Technical Features
- **Full-Stack Architecture**: Node.js/Express backend with PostgreSQL database
- **JWT Authentication**: Secure user authentication and authorization
- **Real-time Analytics**: Interactive charts and spending visualizations
- **RESTful API**: Comprehensive API with rate limiting and security
- **Docker Support**: Containerized deployment with Docker Compose
- **CI/CD Pipeline**: Automated testing and deployment with GitHub Actions

### 📊 Analytics & Reporting
- **Interactive Charts**: Expense distribution and trend analysis
- **Budget Tracking**: Monthly limit setting and monitoring
- **Export Options**: JSON and PDF report generation
- **Spending Insights**: AI-powered financial recommendations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- mongodb atlas
- Redis 6+
- Docker (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-expense-tracker.git
   cd ai-expense-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/ai_expense_tracker
   JWT_SECRET=your-super-secret-jwt-key
   google-gemni-key = your-openai-api-key
   REDIS_URL=redis://localhost:6379
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

### Docker Deployment

1. **Using Docker Compose (Recommended)**
   ```bash
   # Set your OpenAI API key
   export OPENAI_API_KEY=your-openai-api-key
   
   # Start all services
   docker-compose up -d
   ```

2. **Using Docker only**
   ```bash
   # Build the image
   docker build -t ai-expense-tracker .
   
   # Run the container
   docker run -p 3000:3000 \
     -e DATABASE_URL=postgresql://user:pass@host:5432/db \
     -e OPENAI_API_KEY=your-key \
     ai-expense-tracker
   ```

## 📖 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### Expense Endpoints

#### Get All Expenses
```http
GET /api/expenses
Authorization: Bearer <token>
```

#### Create Expense
```http
POST /api/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Coffee",
  "amount": 4.50,
  "category": "food",
  "date": "2024-01-15",
  "notes": "Morning coffee"
}
```

#### Upload Receipt
```http
POST /api/expenses/upload-receipt
Authorization: Bearer <token>
Content-Type: multipart/form-data

receipt: <image-file>
```

### AI Endpoints

#### Chat with AI Assistant
```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What did I spend most on this month?"
}
```

#### Generate Insights
```http
POST /api/ai/generate-insights
Authorization: Bearer <token>
```

#### Semantic Search
```http
POST /api/ai/semantic-search
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "dinner with client"
}
```

## 🏗️ Architecture

### Backend Architecture
```
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js             # JWT authentication
│   └── errorHandler.js     # Error handling
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── expenses.js         # Expense management
│   └── ai.js               # AI features
├── services/
│   ├── mlService.js        # ML categorization & anomaly detection
│   └── ocrService.js       # Receipt OCR processing
├── utils/
│   └── logger.js           # Logging configuration
└── server.js               # Main application entry
```

### Database Schema
- **users**: User accounts and authentication
- **expenses**: Expense records with AI metadata
- **categories**: ML training data for categorization
- **ai_insights**: Generated insights and recommendations
- **user_feedback**: User feedback for ML improvement

### AI/ML Pipeline
1. **Receipt OCR**: Tesseract.js extracts text from images
2. **Data Parsing**: NLP techniques extract structured data
3. **ML Categorization**: TF-IDF + keyword matching for categorization
4. **Anomaly Detection**: Statistical analysis (Z-score) for unusual spending
5. **LLM Integration**: OpenAI API for natural language processing
6. **Insight Generation**: AI-powered financial recommendations

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | mongodb connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `GOOGLE_API_KEY` | GOOGLE_API_KEY for LLM features | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `MAX_FILE_SIZE` | Max upload file size | `10485760` (10MB) |

### Database Configuration
The application automatically creates the required database tables on startup. For production, ensure your mongodb instance has:
- Sufficient storage for expense data
- Regular backups configured
- Connection pooling enabled

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "auth"
```

### Test Categories
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user workflow testing
- **AI Tests**: ML model accuracy testing

## 🚀 Deployment

### Production Checklist
- [ ] Set strong JWT secret
- [ ] Configure production database
- [ ] Set up Redis for caching
- [ ] Configure GOOGLE_API_KEY
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategy
- [ ] Configure rate limiting
- [ ] Set up CI/CD pipeline

### Deployment Options



#### AWS/GCP/Azure
Use the provided Docker configuration with your preferred container orchestration service.

## 📊 Performance Metrics

### Target Performance
- **API Response Time**: < 200ms average
- **OCR Processing**: < 2 seconds per receipt
- **Categorization Accuracy**: 80-90%
- **Anomaly Detection Precision**: > 85%
- **Uptime**: 99.9%

### Monitoring
- Application logs via Winston
- Database query performance
- API response times
- Error rates and types
- AI model performance

## 🔒 Security

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration
- Helmet.js security headers
- SQL injection prevention
- XSS protection

### Best Practices
- Regular security audits
- Dependency vulnerability scanning
- Secure environment variable management
- HTTPS enforcement
- Database encryption at rest
- API key rotation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Follow conventional commits
- Ensure all tests pass



## 🙏 Acknowledgments

- **GOOGLE gemini** for LLM capabilities
- **Tesseract.js** for OCR functionality
- **Chart.js** for data visualization
- **Mongodb atlas** for robust data storage
- **Express.js** for the web framework


For support, email support@ai-expense-tracker.com or create an issue on GitHub.

---

**Built with ❤️ for modern financial management**
