const mongoose = require('mongoose');

const timeOffRequestSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

timeOffRequestSchema.index({ worker_id: 1, start_date: 1, end_date: 1 });

module.exports = mongoose.model('TimeOffRequest', timeOffRequestSchema, 'time_off_requests');
