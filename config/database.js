const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// MongoDB connection options
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://gulmanm8787:Gulmaan@4455@cluster0.cf3x8ni.mongodb.net/?appName=Cluster0';
    
    await mongoose.connect(mongoURI, options);
    
    logger.info('✅ Connected to MongoDB successfully');
    
    // Create indexes for better performance
    await createIndexes();
    
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function createIndexes() {
  try {
    // User indexes
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('users').createIndex({ createdAt: 1 });
    
    // Expense indexes
    await mongoose.connection.db.collection('expenses').createIndex({ userId: 1, date: -1 });
    await mongoose.connection.db.collection('expenses').createIndex({ userId: 1, category: 1 });
    await mongoose.connection.db.collection('expenses').createIndex({ userId: 1, amount: 1 });
    await mongoose.connection.db.collection('expenses').createIndex({ createdAt: 1 });
    
    // AI insights indexes
    await mongoose.connection.db.collection('aiinsights').createIndex({ userId: 1, createdAt: -1 });
    await mongoose.connection.db.collection('aiinsights').createIndex({ insightType: 1 });
    
    // User feedback indexes
    await mongoose.connection.db.collection('userfeedbacks').createIndex({ userId: 1, createdAt: -1 });
    await mongoose.connection.db.collection('userfeedbacks').createIndex({ expenseId: 1 });
    
    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.warn('⚠️ Index creation failed (this is normal for existing databases):', error.message);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('📊 MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('🔌 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

module.exports = {
  connectDB,
  mongoose
};