const mongoose = require('mongoose');

const shiftPositionSchema = new mongoose.Schema({
  shift_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  company_role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyRole',
    required: true
  },
  needed_count: {
    type: Number,
    default: 1
  },
  filled_count: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['open', 'partially_filled', 'filled'],
    default: 'open'
  }
}, {
  timestamps: true
});

shiftPositionSchema.index({ shift_id: 1, company_role_id: 1 });

module.exports = mongoose.model('ShiftPosition', shiftPositionSchema);
