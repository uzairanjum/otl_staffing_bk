const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  type: {
    type: String,
    enum: ['broadcast', 'targeted'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['email', 'push', 'both'],
    default: 'both'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  target_user_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

notificationSchema.index({ company_id: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema, 'notifications');
