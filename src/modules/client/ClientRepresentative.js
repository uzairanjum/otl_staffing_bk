const mongoose = require('mongoose');

const clientRepresentativeSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
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
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String
  }
}, {
  timestamps: true
});

clientRepresentativeSchema.index({ client_id: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('ClientRepresentative', clientRepresentativeSchema, 'client_representatives');
