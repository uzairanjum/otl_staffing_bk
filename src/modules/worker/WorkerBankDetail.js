const mongoose = require('mongoose');

const workerBankDetailSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  bank_name: {
    type: String
  },
  account_name: {
    type: String
  },
  account_number: {
    type: String
  },
  routing_number: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkerBankDetail', workerBankDetailSchema);
