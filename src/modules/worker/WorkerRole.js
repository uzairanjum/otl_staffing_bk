const mongoose = require('mongoose');

const workerRoleSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  company_role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyRole',
    required: true
  },
  hourly_rate_override: {
    type: Number
  }
}, {
  timestamps: true
});

workerRoleSchema.index({ worker_id: 1, company_role_id: 1 }, { unique: true });

module.exports = mongoose.model('WorkerRole', workerRoleSchema);
