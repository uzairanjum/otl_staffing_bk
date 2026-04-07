const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);

router.get('/me', notificationController.getMyNotifications);
router.put('/me/:id/read', notificationController.markAsRead);
router.post('/me/fcm-token', notificationController.saveFcmToken);
router.delete('/me/fcm-token', notificationController.removeFcmToken);

router.post('/', authenticate, requireRole('admin'), validate(schemas.notification), notificationController.createNotification);
router.get('/', authenticate, requireRole('admin'), notificationController.getNotifications);

module.exports = router;
