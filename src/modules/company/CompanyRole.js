const mongoose = require('mongoose');

const companyRoleSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role_category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoleCategory',
    required: true
  },
  default_hourly_rate: {
    type: Number,
    default: 0
  },
  description: {
    type: String
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

companyRoleSchema.index({ company_id: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CompanyRole', companyRoleSchema);
