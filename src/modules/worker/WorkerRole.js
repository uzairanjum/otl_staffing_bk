const mongoose = require('mongoose');

const roleEntrySchema = new mongoose.Schema({
  company_role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyRole',
    required: true
  },
  hourly_rate_override: {
    type: Number
  }
}, { _id: true });

const workerRoleSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roles: {
    type: [roleEntrySchema],
    default: []
  }
}, {
  timestamps: true
});

workerRoleSchema.index({ company_id: 1, worker_id: 1 }, { unique: true });

module.exports = mongoose.model('WorkerRole', workerRoleSchema);
