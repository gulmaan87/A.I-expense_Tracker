const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  insightType: {
    type: String,
    required: true,
    enum: ['chat', 'generated', 'anomaly', 'forecast']
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
aiInsightSchema.index({ userId: 1, createdAt: -1 });
aiInsightSchema.index({ insightType: 1 });
aiInsightSchema.index({ isRead: 1 });

module.exports = mongoose.model('AIInsight', aiInsightSchema);