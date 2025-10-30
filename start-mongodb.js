// Simple MongoDB connection test
require('dotenv').config();
const mongoose = require('mongoose');

async function testMongoDB() {
  try {
    console.log('🍃 Testing MongoDB connection...');
    
    // Try to connect to MongoDB using environment variable
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_expense_tracker';
    await mongoose.connect(mongoURI);
    
    console.log('✅ MongoDB connected successfully!');
    console.log('📊 Database: ai_expense_tracker');
    console.log('🔗 Connection:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide password
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections:', collections.length);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.log('❌ MongoDB connection failed:');
    console.log('Error:', error.message);
    console.log('');
    console.log('🔧 Setup Options:');
    console.log('1. Install MongoDB locally: https://www.mongodb.com/try/download/community');
    console.log('2. Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
    console.log('3. Install Docker Desktop and run: docker run -p 27017:27017 -d mongo:7');
    console.log('');
    console.log('💡 Recommended: Use MongoDB Atlas (free cloud database)');
    console.log('   - Go to https://www.mongodb.com/atlas');
    console.log('   - Create free account');
    console.log('   - Create free cluster');
    console.log('   - Get connection string');
    console.log('   - Update .env file with your connection string');
  }
}

testMongoDB();
