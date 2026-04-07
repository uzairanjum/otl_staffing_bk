const mongoose = require('mongoose');

const payrollReportSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
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
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'modified', 'paid'],
    default: 'submitted'
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewed_at: {
    type: Date
  },
  total_hours: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

payrollReportSchema.index({ worker_id: 1, start_date: 1, end_date: 1 });

module.exports = mongoose.model('PayrollReport', payrollReportSchema);
