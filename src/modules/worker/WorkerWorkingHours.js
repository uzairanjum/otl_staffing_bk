const mongoose = require('mongoose');

const workerWorkingHoursSchema = new mongoose.Schema({
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  day_of_week: {
    type: Number,
    min: 0,
    max: 6,
    required: true
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

workerWorkingHoursSchema.index({ worker_id: 1, day_of_week: 1 });

module.exports = mongoose.model('WorkerWorkingHours', workerWorkingHoursSchema);
