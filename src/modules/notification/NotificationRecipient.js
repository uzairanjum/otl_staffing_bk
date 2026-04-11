const mongoose = require('mongoose');

const notificationRecipientSchema = new mongoose.Schema({
  notification_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  sent_at: {
    type: Date,
    default: Date.now
  },
  delivered_at: {
    type: Date
  },
  read_at: {
    type: Date
  }
}, {
  timestamps: true
});

notificationRecipientSchema.index({ notification_id: 1, user_id: 1 }, { unique: true });
notificationRecipientSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('NotificationRecipient', notificationRecipientSchema, 'notification_recipients');
