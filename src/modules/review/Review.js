const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  shift_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },
  shift_position_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftPosition',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  actual_start_time: {
    type: Date
  },
  actual_end_time: {
    type: Date
  },
  comment: {
    type: String
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

reviewSchema.index({ shift_position_id: 1 }, { unique: true });
reviewSchema.index({ client_id: 1, shift_id: 1 });

module.exports = mongoose.model('Review', reviewSchema);
