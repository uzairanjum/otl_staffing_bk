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
  date: {
    type: Date,
    required: true
  },
  // Derived for fast listing: boundaries of any assignments (system_start_time/system_end_time).
  // Stored to avoid scanning assignments when listing shifts.
  start_time: {
    type: Date,
    default: null,
  },
  end_time: {
    type: Date,
    default: null,
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

shiftSchema.index({ company_id: 1, date: -1, status: 1 });
shiftSchema.index({ company_id: 1, client_id: 1, date: -1 });
shiftSchema.index({ company_id: 1, job_id: 1, date: -1 });

module.exports = mongoose.model('Shift', shiftSchema, 'shifts');
