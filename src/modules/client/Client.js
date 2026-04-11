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

module.exports = mongoose.model('Client', clientSchema, 'clients');
