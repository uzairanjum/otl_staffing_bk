const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  location: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'completed', 'cancelled'],
    default: 'draft'
  }
}, {
  timestamps: true
});

jobSchema.index({ company_id: 1, client_id: 1 });

module.exports = mongoose.model('Job', jobSchema, 'jobs');
