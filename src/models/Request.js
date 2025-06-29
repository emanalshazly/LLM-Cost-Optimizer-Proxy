import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  originalPrompt: {
    type: String,
    required: true
  },
  optimizedPrompt: String,
  model: {
    type: String,
    required: true
  },
  originalModel: String,
  provider: {
    type: String,
    required: true
  },
  response: String,
  tokensUsed: {
    input: Number,
    output: Number,
    total: Number
  },
  cost: {
    original: Number,
    optimized: Number,
    saved: Number
  },
  processingTime: Number,
  cacheHit: {
    type: Boolean,
    default: false
  },
  optimizationApplied: {
    type: Boolean,
    default: false
  },
  routingReason: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
requestSchema.index({ timestamp: -1 });
requestSchema.index({ model: 1, timestamp: -1 });
requestSchema.index({ cacheHit: 1 });

export default mongoose.model('Request', requestSchema);