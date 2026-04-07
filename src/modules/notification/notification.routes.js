const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/notifications/me
 * @description Get all notifications for the current user
 * @group Notifications - Notification management
 * @security BearerAuth
 * @returns {array} 200 - List of notifications
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "type": "targeted",
 *     "title": "Shift Assigned",
 *     "message": "You have been assigned to Evening Shift",
 *     "channel": "both",
 *     "recipient_status": "sent",
 *     "created_at": "2024-02-15T10:00:00.000Z"
 *   }
 * ]
 */
router.use(authenticate);

/**
 * @route PUT /api/notifications/me/:id/read
 * @description Mark a notification as read
 * @group Notifications - Notification management
 * @security BearerAuth
 * @param {string} id.path.required - Notification ID
 * @returns {object} 200 - Notification marked as read
 * @example response - 200
 * {
 *   "message": "Marked as read"
 * }
 */
router.get('/me', notificationController.getMyNotifications);
router.put('/me/:id/read', notificationController.markAsRead);

/**
 * @route POST /api/notifications/me/fcm-token
 * @description Save FCM token for push notifications
 * @group Notifications - Notification management
 * @security BearerAuth
 * @param {string} token.body.required - Firebase Cloud Messaging token
 * @param {string} device_type.body - Device type (android|ios|web)
 * @returns {object} 201 - Token saved
 * @example request
 * {
 *   "token": "dQw4w9WgXcQ...",
 *   "device_type": "android"
 * }
 */
router.post('/me/fcm-token', notificationController.saveFcmToken);

/**
 * @route DELETE /api/notifications/me/fcm-token
 * @description Remove FCM token
 * @group Notifications - Notification management
 * @security BearerAuth
 * @param {string} token.body.required - FCM token to remove
 * @returns {object} 200 - Token removed
 */
router.delete('/me/fcm-token', notificationController.removeFcmToken);

/**
 * @route POST /api/notifications
 * @description Create and send a notification (admin only)
 * @group Notifications - Notification management
 * @security BearerAuth
 * @param {string} type.body.required - Notification type (broadcast|targeted)
 * @param {string} title.body.required - Notification title
 * @param {string} message.body.required - Notification message
 * @param {string} channel.body - Channel (email|push|both)
 * @param {array} target_user_ids.body - Array of user IDs (for targeted)
 * @returns {object} 201 - Notification created and sent
 * @example request - Broadcast
 * {
 *   "type": "broadcast",
 *   "title": "System Maintenance",
 *   "message": "The system will be down for maintenance on Sunday",
 *   "channel": "email"
 * }
 * @example request - Targeted
 * {
 *   "type": "targeted",
 *   "title": "Shift Reminder",
 *   "message": "Your shift starts tomorrow at 9 AM",
 *   "channel": "push",
 *   "target_user_ids": ["550e8400-e29b-41d4-a716-446655440001"]
 * }
 */
router.post('/', authenticate, requireRole('admin'), validate(schemas.notification), notificationController.createNotification);

/**
 * @route GET /api/notifications
 * @description Get all notifications created by the company (admin only)
 * @group Notifications - Notification management
 * @security BearerAuth
 * @returns {array} 200 - List of notifications
 */
router.get('/', authenticate, requireRole('admin'), notificationController.getNotifications);

module.exports = router;
