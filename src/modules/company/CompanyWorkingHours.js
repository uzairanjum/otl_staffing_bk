const mongoose = require('mongoose');

const companyWorkingHoursSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  day_of_week: {
    type: Number,
    min: 0,
    max: 6,
    required: true
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

companyWorkingHoursSchema.index({ company_id: 1, day_of_week: 1 }, { unique: true });

module.exports = mongoose.model('CompanyWorkingHours', companyWorkingHoursSchema, 'company_workinghours');
