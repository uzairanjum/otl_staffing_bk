const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  training_category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingCategory',
    required: true
  },
  document_required: {
    type: Boolean,
    default: false
  },
  description: {
    type: String
  },
  expiry: {
    type: Date
  },
  validity: {
    type: String,
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

trainingSchema.index({ company_id: 1 });

module.exports = mongoose.model('Training', trainingSchema, 'trainings');
