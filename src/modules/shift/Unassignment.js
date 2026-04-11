const mongoose = require('mongoose');

const unassignmentSchema = new mongoose.Schema({
  assignment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftPositionAssignment',
    required: true
  },
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
  reason: {
    type: String
  },
  unassigned_by: {
    type: String,
    enum: ['worker', 'company'],
    required: true
  },
  unassigned_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Unassignment', unassignmentSchema);
