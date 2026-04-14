const mongoose = require('mongoose');

const assignmentItemSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  system_start_time: {
    type: Date,
  },
  system_end_time: {
    type: Date,
  },
  worker_start_time: {
    type: Date,
  },
  worker_end_time: {
    type: Date,
  },
  client_start_time: {
    type: Date,
  },
  client_end_time: {
    type: Date,
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approved_at: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed'],
    default: 'assigned',
  }
}, {
  timestamps: true
});

const shiftPositionAssignmentSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  shift_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true,
  },
  shift_position_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftPosition',
    required: true,
  },
  shift_position_item_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  assignments: {
    type: [assignmentItemSchema],
    default: [],
  },
  status: {
    type: String,
    enum: ['assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed'],
    default: 'unassigned',
  },
}, {
  timestamps: true,
});

shiftPositionAssignmentSchema.index(
  { company_id: 1, shift_id: 1, shift_position_id: 1, shift_position_item_id: 1 },
  { unique: true }
);
shiftPositionAssignmentSchema.index({ company_id: 1, shift_id: 1 });
shiftPositionAssignmentSchema.index({ company_id: 1, 'assignments.worker_id': 1, 'assignments.status': 1 });

module.exports = mongoose.model('ShiftPositionAssignment', shiftPositionAssignmentSchema, 'shift_positionassignments');
