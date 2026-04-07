const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/notifications/me:
 *   get:
 *     summary: Get my notifications
 *     description: Get all notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.use(authenticate);

router.get('/me', notificationController.getMyNotifications);

/**
 * @swagger
 * /api/notifications/me/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/me/:id/read', notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/me/fcm-token:
 *   post:
 *     summary: Register FCM token
 *     description: Register Firebase Cloud Messaging token for push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FcmToken'
 *     responses:
 *       201:
 *         description: FCM token registered
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   delete:
 *     summary: Remove FCM token
 *     description: Remove FCM token
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token removed
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/me/fcm-token', notificationController.saveFcmToken);
router.delete('/me/fcm-token', notificationController.removeFcmToken);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Send notification
 *     description: Send a broadcast or targeted notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Notification'
 *     responses:
 *       201:
 *         description: Notification sent
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   get:
 *     summary: List sent notifications
 *     description: Get all sent notifications (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sent notifications
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authenticate, requireRole('admin'), validate(schemas.notification), notificationController.createNotification);
router.get('/', authenticate, requireRole('admin'), notificationController.getNotifications);

module.exports = router;
