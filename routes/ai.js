const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Joi = require('joi');
const Expense = require('../models/Expense');
const AIInsight = require('../models/AIInsight');
const { auth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Validation schemas
const chatSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
  context: Joi.string().max(2000).optional()
});

// @route   POST /api/ai/chat
// @desc    Chat with AI assistant about expenses
// @access  Private
router.post('/chat', auth, async (req, res) => {
  try {
    const { error, value } = chatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { message, context } = value;

    // Get user's recent expenses for context
    const expenses = await Expense.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(20)
      .select('name amount category date notes');

    // Get spending statistics using aggregation
    const stats = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Create context for AI
    const expenseContext = expenses.map(exp => 
      `${exp.date.toISOString().split('T')[0]}: ${exp.name} - ₹${exp.amount} (${exp.category})`
    ).join('\n');

    const categoryBreakdown = stats.map(stat => 
      `${stat._id}: ₹${stat.total.toFixed(2)}`
    ).join('\n');

    const totalSpent = stats.reduce((sum, stat) => sum + stat.total, 0);
    const avgExpense = stats.length > 0 ? totalSpent / stats.length : 0;

    const systemPrompt = `You are an AI financial assistant for an expense tracking app in India.
    Use Indian Rupees (₹) in all amounts and responses. Help the user understand their spending patterns and provide insights.

    User's recent expenses (last 20):
    ${expenseContext}

    Spending by category (last 30 days):
    ${categoryBreakdown}

    Total spent this month: ₹${totalSpent.toFixed(2)}
    Average expense: ₹${avgExpense.toFixed(2)}

    Respond naturally and helpfully to the user's question about their expenses. 
    Provide specific insights based on their data when possible.`;

    const completion = await genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nUser question: ${message}` }] }
      ]
    });

    let aiResponse = completion.response.text();
    if (typeof aiResponse === 'string' && aiResponse.length > 5000) {
      aiResponse = aiResponse.slice(0, 5000);
    }

    // Save the conversation for analytics
    const insight = new AIInsight({
      userId: req.user._id,
      insightType: 'chat',
      title: 'AI Chat Response',
      content: aiResponse,
      metadata: { userMessage: message, context: context || '' }
    });

    await insight.save();

    res.json({
      success: true,
      response: aiResponse,
      context: {
        recentExpenses: expenses.slice(0, 5),
        totalSpent,
        categoryBreakdown: stats
      }
    });

  } catch (error) {
    logger.error('AI chat error:', error);
    
    if (error.message && error.message.includes('quota')) {
      return res.status(402).json({
        success: false,
        message: 'AI service quota exceeded. Please try again later.'
      });
    }

    if (error.message && error.message.includes('404 Not Found')) {
      return res.status(503).json({
        success: false,
        message: 'AI service not available. Please check your Google API key configuration and ensure Gemini API is enabled.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'AI service temporarily unavailable'
    });
  }
});

// @route   GET /api/ai/insights
// @desc    Get AI-generated insights
// @access  Private
router.get('/insights', auth, async (req, res) => {
  try {
    const { type = 'all', limit = 10 } = req.query;

    let query = { userId: req.user._id };
    if (type !== 'all') {
      query.insightType = type;
    }

    const insights = await AIInsight.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Get insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/ai/generate-insights
// @desc    Generate new AI insights
// @access  Private
router.post('/generate-insights', auth, async (req, res) => {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Google API key missing. Set GOOGLE_API_KEY in your environment.'
      });
    }
    // Get comprehensive spending data
    const expenses = await Expense.find({
      userId: req.user._id,
      date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    }).sort({ date: -1 });

    // Compute basic metadata regardless of data volume
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const avgDaily = totalSpent / 90;
    const categoryTotals = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    const topCategoryEntry = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];
    const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'other';

    if (expenses.length < 5) {
      return res.json({
        success: true,
        message: 'Need more expense data to generate AI-written insights',
        insights: [],
        metadata: {
          totalSpent,
          avgDaily,
          topCategory,
          expenseCount: expenses.length
        }
      });
    }

    // Calculate spending patterns (already computed above)

    // Generate insights using AI
    const prompt = `Analyze this user's spending data in Indian Rupees (₹) and provide 3-5 key insights:

    Total spent (90 days): ₹${totalSpent.toFixed(2)}
    Average daily spending: ₹${avgDaily.toFixed(2)}
    Top category: ${topCategory}
    
    Recent expenses:
    ${expenses.slice(0, 10).map(exp => 
      `${exp.date.toISOString().split('T')[0]}: ${exp.name} - ₹${exp.amount} (${exp.category})`
    ).join('\n')}

    Provide actionable insights about spending patterns, potential savings, and recommendations.`;

    const completion = await genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent({
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ]
    });

    let insights = completion.response.text();
    if (typeof insights === 'string' && insights.length > 5000) {
      insights = insights.slice(0, 5000);
    }

    // Save insights to database
    const insight = new AIInsight({
      userId: req.user._id,
      insightType: 'generated',
      title: 'Monthly Spending Analysis',
      content: insights,
      metadata: { 
        totalSpent, 
        avgDaily, 
        topCategory,
        expenseCount: expenses.length 
      }
    });

    await insight.save();

    res.json({
      success: true,
      insights,
      metadata: {
        totalSpent,
        avgDaily,
        topCategory,
        expenseCount: expenses.length
      }
    });

  } catch (error) {
    logger.error('Generate insights error:', error);
    
    if (error.message && error.message.includes('404 Not Found')) {
      return res.status(503).json({
        success: false,
        message: 'AI service not available. Please check your Google API key configuration and ensure Gemini API is enabled.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to generate insights'
    });
  }
});

// @route   POST /api/ai/semantic-search
// @desc    Search expenses using natural language
// @access  Private
router.post('/semantic-search', auth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters'
      });
    }

    // Get all user expenses
    const expenses = await Expense.find({ userId: req.user._id })
      .sort({ date: -1 })
      .select('name amount category date notes');

    if (expenses.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: 'No expenses found'
      });
    }

    // Use AI to understand the search intent and find relevant expenses
    const searchPrompt = `Find expenses that match this search query: "${query}"

    Available expenses:
    ${expenses.map((exp, i) => 
      `${i + 1}. ${exp.date.toISOString().split('T')[0]}: ${exp.name} - ₹${exp.amount} (${exp.category}) ${exp.notes ? `- ${exp.notes}` : ''}`
    ).join('\n')}

    Return only the numbers of matching expenses, separated by commas. If no matches, return "none".`;

    const completion = await genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).generateContent({
      contents: [
        { role: "user", parts: [{ text: searchPrompt }] }
      ]
    });

    const response = completion.response.text().trim();
    
    if (response === 'none') {
      return res.json({
        success: true,
        results: [],
        message: 'No matching expenses found'
      });
    }

    // Parse the response and get matching expenses
    const matchIndices = response.split(',').map(num => parseInt(num.trim()) - 1);
    const matchingExpenses = matchIndices
      .filter(index => index >= 0 && index < expenses.length)
      .map(index => expenses[index]);

    res.json({
      success: true,
      results: matchingExpenses,
      query,
      totalMatches: matchingExpenses.length
    });

  } catch (error) {
    logger.error('Semantic search error:', error);
    
    if (error.message && error.message.includes('404 Not Found')) {
      return res.status(503).json({
        success: false,
        message: 'AI service not available. Please check your Google API key configuration and ensure Gemini API is enabled.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
});

module.exports = router;
