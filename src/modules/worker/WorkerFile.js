const mongoose = require('mongoose');

const FILE_TYPES = [
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
  'dvla_check',
];

const workerFileItemSchema = new mongoose.Schema(
  {
    file_type: {
      type: String,
      enum: FILE_TYPES,
      required: true,
    },
    file_url: {
      type: String,
      required: true,
    },
    cloudinary_public_id: {
      type: String,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const workerFileBundleSchema = new mongoose.Schema(
  {
    worker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    files: {
      type: [workerFileItemSchema],
      default: [],
    },
    dvla_code: {
      type: String,
      trim: true,
    },
    /** Same BSON Date type as createdAt/updatedAt (UTC instant). */
    dvla_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const WorkerFile = mongoose.model('WorkerFile', workerFileBundleSchema, 'worker_files');
WorkerFile.FILE_TYPES = FILE_TYPES;

module.exports = WorkerFile;
