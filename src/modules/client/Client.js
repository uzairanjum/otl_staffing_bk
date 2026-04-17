const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  phone: {
    type: String
  },
  organization: {
    type: String
  },
  address: {
    type: String
  },
  notes: {
    type: String
  },
  website: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

clientSchema.index({ company_id: 1 });
// Single text index used for fast search across name/email/phone within a company.
clientSchema.index({ company_id: 1, name: 'text', email: 'text', phone: 'text' });
// Helpful compound indexes for common list/search patterns.
clientSchema.index({ company_id: 1, createdAt: -1 });
clientSchema.index({ company_id: 1, email: 1 });
clientSchema.index({ company_id: 1, phone: 1 });
clientSchema.index({ company_id: 1, name: 1 });

module.exports = mongoose.model('Client', clientSchema, 'clients');
