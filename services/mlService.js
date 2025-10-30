const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const { logger } = require('../utils/logger');

// Simple ML-based categorization using TF-IDF and keyword matching
class ExpenseCategorizer {
  constructor() {
    this.categories = {
      'food': ['restaurant', 'cafe', 'food', 'dining', 'lunch', 'dinner', 'breakfast', 'coffee', 'pizza', 'burger', 'sushi', 'chinese', 'indian', 'mexican', 'grocery', 'supermarket', 'market'],
      'transport': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'metro', 'bus', 'train', 'flight', 'airline', 'car', 'vehicle', 'transportation'],
      'utilities': ['electric', 'water', 'gas', 'internet', 'phone', 'cable', 'utility', 'bill', 'payment', 'service'],
      'entertainment': ['movie', 'cinema', 'theater', 'concert', 'show', 'game', 'gaming', 'netflix', 'spotify', 'subscription', 'entertainment', 'fun'],
      'shopping': ['amazon', 'store', 'shop', 'mall', 'clothing', 'clothes', 'shoes', 'electronics', 'book', 'purchase', 'buy'],
      'healthcare': ['doctor', 'hospital', 'clinic', 'pharmacy', 'medicine', 'medical', 'health', 'dental', 'vision', 'insurance'],
      'education': ['school', 'university', 'college', 'course', 'book', 'education', 'learning', 'tuition', 'student'],
      'other': []
    };
  }

  // Calculate TF-IDF score for text
  calculateTFIDF(text, category) {
    const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 2);
    const categoryKeywords = this.categories[category] || [];
    
    let score = 0;
    words.forEach(word => {
      if (categoryKeywords.includes(word)) {
        score += 1;
      }
    });
    
    return score / words.length;
  }

  // Categorize expense using ML approach
  async categorize(expenseName, amount, notes = '') {
    const text = `${expenseName} ${notes}`.toLowerCase();
    let bestCategory = 'other';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(this.categories)) {
      if (category === 'other') continue;
      
      let score = this.calculateTFIDF(text, category);
      
      // Add amount-based heuristics
      if (category === 'food' && amount < 100) score += 0.1;
      if (category === 'transport' && amount < 50) score += 0.1;
      if (category === 'utilities' && amount > 50) score += 0.1;
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    // If no good match, use amount-based fallback
    if (bestScore < 0.1) {
      if (amount < 20) bestCategory = 'food';
      else if (amount < 100) bestCategory = 'shopping';
      else if (amount < 500) bestCategory = 'utilities';
      else bestCategory = 'other';
    }

    return {
      category: bestCategory,
      confidence: Math.min(bestScore * 2, 1.0)
    };
  }
}

// Anomaly detection using statistical methods
class AnomalyDetector {
  async detectAnomalies(userId, amount, category) {
    try {
      // Get user's historical data for this category
      const expenses = await Expense.find({
        userId: userId,
        category: category,
        date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      }).sort({ date: -1 });

      if (expenses.length < 5) {
        return { isAnomaly: false, reason: 'Insufficient data' };
      }

      const amounts = expenses.map(exp => exp.amount);
      const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
      const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      // Z-score calculation
      const zScore = Math.abs((amount - mean) / stdDev);
      
      // Threshold for anomaly (2.5 standard deviations)
      const isAnomaly = zScore > 2.5;
      
      return {
        isAnomaly,
        zScore,
        mean,
        stdDev,
        reason: isAnomaly ? `Amount ${amount} is ${zScore.toFixed(2)} standard deviations from mean ${mean.toFixed(2)}` : 'Normal spending pattern'
      };
    } catch (error) {
      logger.error('Anomaly detection error:', error);
      return { isAnomaly: false, reason: 'Detection failed' };
    }
  }
}

// Expense forecasting using simple linear regression
class ExpenseForecaster {
  async forecastExpenses(userId, category, months = 3) {
    try {
      const expenses = await Expense.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            category: category,
            date: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      if (expenses.length < 3) {
        return { forecast: [], confidence: 'low' };
      }

      const data = expenses.map(exp => ({
        month: new Date(exp._id.year, exp._id.month - 1),
        amount: exp.total
      }));

      // Simple linear regression
      const n = data.length;
      const x = data.map((_, i) => i);
      const y = data.map(d => d.amount);
      
      const sumX = x.reduce((sum, val) => sum + val, 0);
      const sumY = y.reduce((sum, val) => sum + val, 0);
      const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
      const sumXX = x.reduce((sum, val) => sum + val * val, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Generate forecast
      const forecast = [];
      for (let i = 1; i <= months; i++) {
        const predictedAmount = slope * (n + i - 1) + intercept;
        const forecastDate = new Date(data[data.length - 1].month);
        forecastDate.setMonth(forecastDate.getMonth() + i);
        
        forecast.push({
          month: forecastDate.toISOString().split('T')[0],
          predictedAmount: Math.max(0, predictedAmount)
        });
      }

      return {
        forecast,
        confidence: n >= 6 ? 'high' : n >= 3 ? 'medium' : 'low'
      };
    } catch (error) {
      logger.error('Forecasting error:', error);
      return { forecast: [], confidence: 'low' };
    }
  }
}

const categorizer = new ExpenseCategorizer();
const anomalyDetector = new AnomalyDetector();
const forecaster = new ExpenseForecaster();

// Export functions
async function categorizeExpense(name, amount, notes) {
  return await categorizer.categorize(name, amount, notes);
}

async function detectAnomalies(userId, amount, category) {
  return await anomalyDetector.detectAnomalies(userId, amount, category);
}

async function forecastExpenses(userId, category, months = 3) {
  return await forecaster.forecastExpenses(userId, category, months);
}

module.exports = {
  categorizeExpense,
  detectAnomalies,
  forecastExpenses
};
