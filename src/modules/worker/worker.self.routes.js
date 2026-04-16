const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

// All /api/me routes require an authenticated worker.
router.use(authenticate);
router.use(requireRole('worker'));

/**
 * @swagger
 * /api/me/profile:
 *   get:
 *     summary: Get my profile
 *     description: Get the authenticated worker profile with related onboarding data
 *     tags: [Worker Self-Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Worker profile payload
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/profile', workerController.getMyProfile);

router.get('/files/:fileId/view-url', workerController.getMyWorkerFileViewUrl);
router.get('/training-documents/:docId/view-url', workerController.getMyTrainingDocumentViewUrl);

/**
 * @swagger
 * /api/me/time-off:
 *   post:
 *     summary: Request time off
 *     description: Submit a time-off request
 *     tags: [Worker Self-Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimeOff'
 *     responses:
 *       201:
 *         description: Time-off request submitted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   get:
 *     summary: Get time-off history
 *     description: Get all time-off requests for the current worker
 *     tags: [Worker Self-Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of time-off requests
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/time-off', validate(schemas.timeOff), workerController.requestTimeOff);
router.get('/time-off', workerController.getMyTimeOffs);

/**
 * @swagger
 * /api/me/time-off/{id}:
 *   delete:
 *     summary: Cancel time-off request
 *     description: Cancel a pending time-off request
 *     tags: [Worker Self-Service]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Time-off request ID
 *     responses:
 *       200:
 *         description: Time-off request cancelled
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete('/time-off/:id', workerController.cancelTimeOff);

module.exports = router;
