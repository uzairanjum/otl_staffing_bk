const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
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
  client_rep_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  start_time: {
    type: Date,
    required: true,
  },
  end_time: {
    type: Date,
    required: true,
  },
  isMultiDay: {
    type: Boolean,
    default: false
  },
  location: {
    type: String
  },
  notes: {
    type: String,
    default: ''
  },
  required_approval: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  }
}, {
  timestamps: true
});

shiftSchema.index({ company_id: 1, start_time: -1, status: 1 });
shiftSchema.index({ company_id: 1, client_id: 1, start_time: -1 });
shiftSchema.index({ company_id: 1, job_id: 1, start_time: -1 });
shiftSchema.index({ company_id: 1, location: 1 });
/** Client rep calendar: filter by designated rep + client + date range */
shiftSchema.index({ company_id: 1, client_id: 1, client_rep_id: 1, start_time: 1 });
/** Worker shifts: overlap queries on start_time/end_time range */
shiftSchema.index({ company_id: 1, status: 1, start_time: -1 });
shiftSchema.index({ company_id: 1, end_time: 1 });
/** Sort-by-created list queries */
shiftSchema.index({ company_id: 1, createdAt: -1 });

module.exports = mongoose.model('Shift', shiftSchema, 'shifts');
