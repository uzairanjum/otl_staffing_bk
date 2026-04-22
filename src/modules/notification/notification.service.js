const Notification = require('./Notification');
const NotificationRecipient = require('./NotificationRecipient');
const User = require('../../common/models/User');
const FcmToken = require('./FcmToken');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const { sendFCM, sendMulticastFCM } = require('../../config/firebase');
const logger = require('../../config/logger');

class NotificationService {
  async createNotification(companyId, userId, data) {
    const notification = await Notification.create({
      company_id: companyId,
      type: data.type,
      title: data.title,
      message: data.message,
      channel: data.channel || 'both',
      created_by: userId,
      target_user_ids: data.target_user_ids || []
    });

    if (data.type === 'broadcast') {
      const users = await User.find({ company_id: companyId, is_active: true, role: 'worker' })
        .select('_id')
        .lean();
      const userIds = users.map(u => u._id);
      
      await this.sendToUsers(notification, userIds);
    } else if (data.type === 'targeted' && data.target_user_ids?.length > 0) {
      await this.sendToUsers(notification, data.target_user_ids);
    }

    return notification;
  }

  async sendToUsers(notification, userIds) {
    if (!userIds || userIds.length === 0) return;

    const [userDocs, allTokens] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('_id email first_name last_name name').lean(),
      FcmToken.find({ user_id: { $in: userIds }, is_active: true }).lean(),
    ]);

    const userMap = new Map(userDocs.map(u => [String(u._id), u]));
    const tokensByUser = new Map();
    for (const t of allTokens) {
      const key = String(t.user_id);
      if (!tokensByUser.has(key)) tokensByUser.set(key, []);
      tokensByUser.get(key).push(t.token);
    }

    const sendEmail = notification.channel === 'email' || notification.channel === 'both';
    const sendPush = notification.channel === 'push' || notification.channel === 'both';

    for (const userId of userIds) {
      const user = userMap.get(String(userId));
      if (!user) continue;

      const recipient = await NotificationRecipient.create({
        notification_id: notification._id,
        user_id: userId,
        status: 'sent'
      });

      if (sendEmail) {
        try {
          await sendEmailWithTemplate(user.email, notification.title, 'notification', {
            name:
              user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.name || 'User',
            title: notification.title,
            message: notification.message
          });

          recipient.status = 'delivered';
          await recipient.save();
        } catch (error) {
          logger.error('Notification email delivery failed', {
            userId: userId.toString(),
            notificationId: notification._id.toString(),
            message: error.message
          });
        }
      }

      if (sendPush) {
        const tokenList = tokensByUser.get(String(userId)) || [];
        if (tokenList.length > 0) {
          try {
            if (tokenList.length === 1) {
              await sendFCM(tokenList[0], notification.title, notification.message, {
                notification_id: notification._id.toString()
              });
            } else {
              await sendMulticastFCM(tokenList, notification.title, notification.message, {
                notification_id: notification._id.toString()
              });
            }
          } catch (error) {
            logger.error('Notification push delivery failed', {
              userId: userId.toString(),
              notificationId: notification._id.toString(),
              message: error.message
            });
          }
        }
      }
    }
  }

  async getNotifications(companyId, filters = {}) {
    const query = { company_id: companyId };
    return Notification.find(query).populate('created_by', 'email').sort({ createdAt: -1 }).lean();
  }

  async getMyNotifications(userId, filters = {}) {
    const recipients = await NotificationRecipient.find({ user_id: userId })
      .populate({
        path: 'notification_id',
        populate: { path: 'created_by', select: 'email' }
      })
      .sort({ 'notification_id.createdAt': -1 });

    return recipients.map(r => ({
      ...r.notification_id.toObject(),
      recipient_status: r.status,
      read_at: r.read_at
    }));
  }

  async markAsRead(notificationId, userId) {
    const recipient = await NotificationRecipient.findOneAndUpdate(
      { notification_id: notificationId, user_id: userId },
      { 
        status: 'read',
        read_at: new Date()
      },
      { new: true }
    );

    if (!recipient) {
      throw new AppError('Notification recipient not found', 404);
    }

    return recipient;
  }

  async saveFcmToken(userId, token, deviceType) {
    const existing = await FcmToken.findOne({ user_id: userId, token });
    
    if (existing) {
      existing.is_active = true;
      existing.device_type = deviceType;
      await existing.save();
      return existing;
    }

    await FcmToken.updateMany({ user_id: userId }, { is_active: false });

    const fcmToken = await FcmToken.create({
      user_id: userId,
      token,
      device_type: deviceType || 'web'
    });

    return fcmToken;
  }

  async removeFcmToken(userId, token) {
    await FcmToken.findOneAndDelete({ user_id: userId, token });
    return { message: 'Token removed successfully' };
  }
}

module.exports = new NotificationService();
