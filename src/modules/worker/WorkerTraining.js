const mongoose = require('mongoose');

const trainingEntrySchema = new mongoose.Schema({
  training_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Training',
    required: true
  },
  role_ids: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyRole',
    }],
    default: [],
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed'],
    default: 'assigned'
  },
  completed_at: {
    type: Date
  }
}, { _id: true });

trainingEntrySchema.set('toJSON', {
  transform(_doc, ret) {
    if (ret.role_ids == null) ret.role_ids = [];
    return ret;
  },
});
trainingEntrySchema.set('toObject', {
  transform(_doc, ret) {
    if (ret.role_ids == null) ret.role_ids = [];
    return ret;
  },
});

const workerTrainingSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trainings: {
    type: [trainingEntrySchema],
    default: []
  }
}, {
  timestamps: true
});

workerTrainingSchema.index({ company_id: 1, worker_id: 1 }, { unique: true });

module.exports = mongoose.model('WorkerTraining', workerTrainingSchema);
