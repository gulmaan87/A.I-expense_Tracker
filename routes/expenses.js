const express = require('express');
const multer = require('multer');
const path = require('path');
const Joi = require('joi');
const fs = require('fs');
const Expense = require('../models/Expense');
const { auth } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { categorizeExpense, detectAnomalies } = require('../services/mlService');
const { extractReceiptData } = require('../services/ocrService');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
// Ensure upload directory exists
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  logger.error('Failed to ensure upload directory exists:', e);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image or PDF files are allowed'), false);
    }
  }
});

// Validation schemas
const expenseSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  amount: Joi.number().positive().precision(2).max(999999.99).required(),
  category: Joi.string().min(1).max(100).required(),
  subcategory: Joi.string().max(100).optional(),
  date: Joi.date().required(),
  notes: Joi.string().allow('').max(1000).optional(),
  receiptImageUrl: Joi.string().uri().optional()
});

// @route   GET /api/expenses
// @desc    Get all expenses for user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, category, startDate, endDate, search } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      startDate,
      endDate,
      search
    };

    const result = await Expense.getUserExpenses(req.user._id, options);

    res.json({
      success: true,
      data: result.expenses,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/expenses
// @desc    Create new expense
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    // Normalize empty optional fields before validation
    const requestBody = { ...req.body };
    if (typeof requestBody.notes === 'string' && requestBody.notes.trim() === '') {
      delete requestBody.notes;
    }
    if (typeof requestBody.subcategory === 'string' && requestBody.subcategory.trim() === '') {
      delete requestBody.subcategory;
    }

    const { error, value } = expenseSchema.validate(requestBody);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, amount, category, subcategory, date, notes, receiptImageUrl } = value;
    const normalizedAmount = Math.min(Math.max(parseFloat(amount) || 0, 0), 999999.99);

    // AI categorization
    let aiCategory = category;
    let confidenceScore = null;
    let aiCategorized = false;

    if (category === 'auto' || !category) {
      try {
        const aiResult = await categorizeExpense(name, normalizedAmount, notes);
        aiCategory = aiResult.category;
        confidenceScore = aiResult.confidence;
        aiCategorized = true;
      } catch (aiError) {
        logger.warn('AI categorization failed:', aiError);
        aiCategory = 'other';
      }
    }

    // Anomaly detection
    let isAnomaly = false;
    try {
      const anomalyResult = await detectAnomalies(req.user._id, amount, aiCategory);
      isAnomaly = anomalyResult.isAnomaly;
    } catch (anomalyError) {
      logger.warn('Anomaly detection failed:', anomalyError);
    }

    const expense = new Expense({
      userId: req.user._id,
      name,
      amount: normalizedAmount,
      category: aiCategory,
      subcategory,
      date,
      notes,
      receiptImageUrl,
      aiCategorized,
      confidenceScore,
      isAnomaly
    });

    await expense.save();

    // Generate AI insights if anomaly detected
    if (isAnomaly) {
      logger.info(`Anomaly detected for user ${req.user._id}, expense ${expense._id}`);
    }

    logger.info(`Expense created: ${expense._id} for user ${req.user._id}`);

    res.status(201).json({
      success: true,
      data: expense,
      aiCategorized,
      confidenceScore,
      isAnomaly
    });
  } catch (error) {
    logger.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/expenses/upload-receipt
// @desc    Upload receipt and extract data using OCR
// @access  Private
router.post('/upload-receipt', auth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No receipt image provided'
      });
    }

    // Extract data using OCR
    const ocrData = await extractReceiptData(req.file.path);
    
    // Save OCR data to database for future ML training
    const clampedAmount = Math.min(Math.max(parseFloat(ocrData.amount) || 0, 0), 999999.99);
    const normalizedDate = ocrData.date ? new Date(ocrData.date) : new Date();
    const expense = new Expense({
      userId: req.user._id,
      name: ocrData.merchant || 'Unknown Merchant',
      amount: clampedAmount,
      // Use a valid enum value; AI categorization can adjust later on edit
      category: 'other',
      date: normalizedDate,
      notes: ocrData.items ? ocrData.items.join(', ') : '',
      receiptImageUrl: req.file.path,
      ocrData: ocrData
    });

    await expense.save();

    res.json({
      success: true,
      data: expense,
      ocrData
    });
  } catch (error) {
    logger.error('Receipt upload error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Server error during receipt processing'
    });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Normalize empty optional fields before validation
    const requestBody = { ...req.body };
    if (typeof requestBody.notes === 'string' && requestBody.notes.trim() === '') {
      delete requestBody.notes;
    }
    if (typeof requestBody.subcategory === 'string' && requestBody.subcategory.trim() === '') {
      delete requestBody.subcategory;
    }

    const { error, value } = expenseSchema.validate(requestBody);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, amount, category, subcategory, date, notes } = value;

    // Check if expense belongs to user
    const expense = await Expense.findOne({ _id: id, userId: req.user._id });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Update expense
    expense.name = name;
    expense.amount = amount;
    expense.category = category;
    expense.subcategory = subcategory;
    expense.date = date;
    expense.notes = notes;

    await expense.save();

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    logger.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    logger.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/expenses/stats
// @desc    Get expense statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await Expense.getSpendingStats(req.user._id, startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
