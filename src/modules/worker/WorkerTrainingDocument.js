const mongoose = require('mongoose');

const trainingFileEntrySchema = new mongoose.Schema(
  {
    training_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
      required: true,
    },
    file_url: {
      type: String,
      required: true,
    },
    cloudinary_public_id: {
      type: String,
    },
    document_type: {
      type: String,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const workerTrainingDocumentBundleSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    worker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    worker_training_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    documents: {
      type: [trainingFileEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

workerTrainingDocumentBundleSchema.index({ worker_id: 1, worker_training_id: 1 }, { unique: true });
workerTrainingDocumentBundleSchema.index({ worker_id: 1, company_id: 1 });

module.exports = mongoose.model('WorkerTrainingDocument', workerTrainingDocumentBundleSchema, 'worker_trainingdocuments');
