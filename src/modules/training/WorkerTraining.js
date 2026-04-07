const mongoose = require('mongoose');

const workerTrainingSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  training_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Training',
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed'],
    default: 'assigned'
  },
  completed_at: {
    type: Date
  }
}, {
  timestamps: true
});

workerTrainingSchema.index({ worker_id: 1, training_id: 1 }, { unique: true });

module.exports = mongoose.model('WorkerTraining', workerTrainingSchema);
