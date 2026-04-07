const mongoose = require('mongoose');

const workerAddressSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
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

module.exports = mongoose.model('WorkerAddress', workerAddressSchema);
