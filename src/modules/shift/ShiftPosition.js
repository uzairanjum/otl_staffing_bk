const mongoose = require('mongoose');

const positionItemSchema = new mongoose.Schema({
  company_role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyRole',
    required: true
  },
  needed_count: {
    type: Number,
    min: 1,
    default: 1
  },
  pay_rate: {
    type: Number,
    min: 0,
    default: 0
  },
  break_time: {
    type: String,
    default: 'No Break'
  },
  filled_count: {
    type: Number,
    min: 0,
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
  positions: {
    type: [positionItemSchema],
    default: []
  }
}, {
  timestamps: true
});

shiftPositionSchema.index({ company_id: 1, shift_id: 1 }, { unique: true });
shiftPositionSchema.index({ company_id: 1, 'positions.company_role_id': 1 });

module.exports = mongoose.model('ShiftPosition', shiftPositionSchema, 'shift_positions');
