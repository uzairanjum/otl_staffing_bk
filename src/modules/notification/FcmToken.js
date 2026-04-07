const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  device_type: {
    type: String,
    enum: ['android', 'ios', 'web'],
    default: 'web'
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

fcmTokenSchema.index({ user_id: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('FcmToken', fcmTokenSchema);
