const mongoose = require('mongoose');

const workerTrainingDocumentSchema = new mongoose.Schema({
  worker_training_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkerTraining',
    required: true
  },
  file_url: {
    type: String,
    required: true
  },
  cloudinary_public_id: {
    type: String
  },
  document_type: {
    type: String
  },
  uploaded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkerTrainingDocument', workerTrainingDocumentSchema);
