const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    max: 999999.99
  },
  category: {
    type: String,
    required: true,
    enum: ['food', 'transport', 'utilities', 'entertainment', 'shopping', 'healthcare', 'education', 'other']
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  receiptImageUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  ocrData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  aiCategorized: {
    type: Boolean,
    default: false
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1
  },
  isAnomaly: {
    type: Boolean,
    default: false
  },
  anomalyScore: {
    type: Number,
    min: 0
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, amount: 1 });
expenseSchema.index({ userId: 1, createdAt: -1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

// Text search index
expenseSchema.index({
  name: 'text',
  notes: 'text',
  tags: 'text'
});

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.amount);
});

// Virtual for formatted date
expenseSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

// Static method to get user expenses with pagination
expenseSchema.statics.getUserExpenses = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    category,
    startDate,
    endDate,
    search,
    sortBy = 'date',
    sortOrder = -1
  } = options;

  const query = { userId };
  
  // Add filters
  if (category && category !== 'all') {
    query.category = category;
  }
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  if (search) {
    query.$text = { $search: search };
  }

  const skip = (page - 1) * limit;
  
  const expenses = await this.find(query)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await this.countDocuments(query);

  return {
    expenses,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get spending statistics
expenseSchema.statics.getSpendingStats = async function(userId, startDate, endDate) {
  const matchStage = {
    userId: new mongoose.Types.ObjectId(userId)
  };
  
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' },
        averageExpense: { $avg: '$amount' },
        totalExpenses: { $sum: 1 },
        categoryBreakdown: {
          $push: {
            category: '$category',
            amount: '$amount'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSpent: 1,
        averageExpense: { $round: ['$averageExpense', 2] },
        totalExpenses: 1,
        categoryBreakdown: {
          $reduce: {
            input: '$categoryBreakdown',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{
                      k: '$$this.category',
                      v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.category', input: '$$value' } }, 0] }, '$$this.amount'] }
                    }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalSpent: 0,
    averageExpense: 0,
    totalExpenses: 0,
    categoryBreakdown: {}
  };
};

module.exports = mongoose.model('Expense', expenseSchema);
