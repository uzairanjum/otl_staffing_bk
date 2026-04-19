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
jobSchema.index({ company_id: 1, createdAt: -1 });
jobSchema.index({ company_id: 1, status: 1, createdAt: -1 });
jobSchema.index({ company_id: 1, client_id: 1, createdAt: -1 });
/** Client rep jobs list: filter by client + sort by recency */
jobSchema.index({ company_id: 1, client_id: 1, updatedAt: -1 });
/** Filtered tabs (status) + sort */
jobSchema.index({ company_id: 1, client_id: 1, status: 1, updatedAt: -1 });
jobSchema.index({ company_id: 1, name: 1 });
jobSchema.index({ company_id: 1, location: 1 });

module.exports = mongoose.model('Job', jobSchema, 'jobs');
