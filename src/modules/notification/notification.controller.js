const notificationService = require('./notification.service');
const { AppError } = require('../../common/middleware/error.middleware');

class NotificationController {
  async createNotification(req, res, next) {
    try {
      const notification = await notificationService.createNotification(
        req.company_id,
        req.user._id,
        req.body
      );
      res.status(201).json(notification);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getNotifications(req, res, next) {
    try {
      const notifications = await notificationService.getNotifications(req.company_id, req.query);
      res.json(notifications);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getMyNotifications(req, res, next) {
    try {
      const notifications = await notificationService.getMyNotifications(req.user._id, req.query);
      res.json(notifications);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async markAsRead(req, res, next) {
    try {
      await notificationService.markAsRead(req.params.id, req.user._id);
      res.json({ message: 'Marked as read' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async saveFcmToken(req, res, next) {
    try {
      const { token, device_type } = req.body;
      const result = await notificationService.saveFcmToken(req.user._id, token, device_type);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async removeFcmToken(req, res, next) {
    try {
      const { token } = req.body;
      await notificationService.removeFcmToken(req.user._id, token);
      res.json({ message: 'Token removed' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new NotificationController();
