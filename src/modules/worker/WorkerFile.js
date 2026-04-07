const mongoose = require('mongoose');

const workerFileSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  file_type: {
    type: String,
    enum: [
      'nic',
      'driver_license',
      'insurance',
      'other',
      'proof_of_address',
      'ni_utr',
      'driving_license_front',
      'driving_license_back',
      'passport_front',
      'passport_inner',
      'passport_back',
      'profile_photo',
      'dvla_check'
    ],
    required: true
  },
  file_url: {
    type: String,
    required: true
  },
  cloudinary_public_id: {
    type: String
  },
  uploaded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

workerFileSchema.index({ worker_id: 1, file_type: 1 });

module.exports = mongoose.model('WorkerFile', workerFileSchema);
