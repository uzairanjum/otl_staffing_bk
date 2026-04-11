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
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  },
  location: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  }
}, {
  timestamps: true
});

shiftSchema.index({ company_id: 1, job_id: 1, date: 1 });

module.exports = mongoose.model('Shift', shiftSchema, 'shifts');
