const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  profile_image_url: {
    type: String
  },
  status: {
    type: String,
    enum: ['invited', 'onboarding', 'pending_approval', 'active', 'suspended'],
    default: 'invited'
  },
  onboarding_step: {
    type: Number,
    min: 1,
    max: 6,
    default: 0
  },
  contract_signed: {
    type: Boolean,
    default: false
  },
  contract_signed_at: {
    type: Date
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  }
}, {
  timestamps: true
});

workerSchema.virtual('fullName').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

workerSchema.index({ company_id: 1, email: 1 });

module.exports = mongoose.model('Worker', workerSchema);
