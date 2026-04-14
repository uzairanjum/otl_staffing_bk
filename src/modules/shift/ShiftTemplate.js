const mongoose = require('mongoose');

const shiftTemplatePositionSchema = new mongoose.Schema(
  {
    company_role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyRole',
      required: true,
    },
    needed_count: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    pay_rate: {
      type: Number,
      min: 0,
      default: 0,
    },
    break_time: {
      type: String,
      trim: true,
      default: 'No Break',
    },
  },
  { timestamps: true }
);

const shiftTemplateSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    positions: {
      type: [shiftTemplatePositionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

shiftTemplateSchema.index({ company_id: 1, name: 1 });

module.exports = mongoose.model('ShiftTemplate', shiftTemplateSchema, 'shift_templates');
