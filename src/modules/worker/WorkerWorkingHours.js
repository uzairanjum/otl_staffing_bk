const mongoose = require('mongoose');

const availabilityEntrySchema = new mongoose.Schema(
  {
    day_of_week: {
      type: Number,
      min: 0,
      max: 6,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    start_time: {
      type: String,
      default: '',
    },
    end_time: {
      type: String,
      default: '',
    },
  },
  { _id: true, timestamps: true }
);

const workerWorkingHoursSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  availability: {
    type: [availabilityEntrySchema],
    default: [],
  },
}, {
  timestamps: true
});

workerWorkingHoursSchema.index({ worker_id: 1 }, { unique: true });

module.exports = mongoose.model('WorkerWorkingHours', workerWorkingHoursSchema, 'worker_workinghours');
