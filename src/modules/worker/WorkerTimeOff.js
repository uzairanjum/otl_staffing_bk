const mongoose = require('mongoose');

const workerTimeOffEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
    timestamps: true,
  }
);

const workerTimeOffSchema = new mongoose.Schema(
  {
    worker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    entries: {
      type: [workerTimeOffEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WorkerTimeOff', workerTimeOffSchema, 'worker_time_off');
