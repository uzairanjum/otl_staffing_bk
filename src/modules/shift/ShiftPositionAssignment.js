const mongoose = require('mongoose');

const shiftPositionAssignmentSchema = new mongoose.Schema({
  shift_position_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftPosition',
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
  status: {
    type: String,
    enum: ['assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed'],
    default: 'assigned'
  },
  system_start_time: {
    type: Date
  },
  system_end_time: {
    type: Date
  },
  worker_start_time: {
    type: Date
  },
  worker_end_time: {
    type: Date
  },
  client_start_time: {
    type: Date
  },
  client_end_time: {
    type: Date
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  is_requested: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

shiftPositionAssignmentSchema.index({ shift_position_id: 1, worker_id: 1 }, { unique: true });
shiftPositionAssignmentSchema.index({ worker_id: 1, status: 1 });

module.exports = mongoose.model('ShiftPositionAssignment', shiftPositionAssignmentSchema);
