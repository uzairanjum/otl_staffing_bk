const mongoose = require('mongoose');

const workerTaxInfoSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tax_number: {
    type: String
  },
  national_id: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkerTaxInfo', workerTaxInfoSchema, 'worker_taxinfos');
