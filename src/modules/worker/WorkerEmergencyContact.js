const mongoose = require('mongoose');

const workerEmergencyContactSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contact_name: {
    type: String
  },
  relationship: {
    type: String
  },
  phone: {
    type: String
  },
  email: {
    type: String
  },
  address_line1: {
    type: String
  },
  address_line2: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  postal_code: {
    type: String
  },
  country: {
    type: String,
    default: 'USA'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkerEmergencyContact', workerEmergencyContactSchema, 'worker_emergencycontacts');
