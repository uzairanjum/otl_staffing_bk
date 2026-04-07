const mongoose = require('mongoose');

const payrollReportEntrySchema = new mongoose.Schema({
  payroll_report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollReport',
    required: true
  },
  shift_assignment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShiftPositionAssignment'
  },
  external_work_desc: {
    type: String
  },
  external_start_time: {
    type: Date
  },
  external_end_time: {
    type: Date
  },
  external_hourly_rate: {
    type: Number
  },
  hours_worked: {
    type: Number,
    default: 0
  },
  hourly_rate: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['submitted', 'approved', 'modified'],
    default: 'submitted'
  },
  modified_hours: {
    type: Number
  },
  modified_rate: {
    type: Number
  },
  modified_amount: {
    type: Number
  }
}, {
  timestamps: true
});

payrollReportEntrySchema.index({ payroll_report_id: 1 });

module.exports = mongoose.model('PayrollReportEntry', payrollReportEntrySchema);
