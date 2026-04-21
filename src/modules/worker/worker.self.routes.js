const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { uploadWorkerFileSingle } = require('./worker.upload.middleware');
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
router.put('/profile', workerController.updateMyProfile);
router.post('/change-password', validate(schemas.changePassword), workerController.changeMyPassword);
router.put(
  '/onboarding/basic-info',
  validate(schemas.workerOnboardingBasicInfo),
  workerController.saveMyOnboardingBasicInfo
);
router.put(
  '/onboarding/working-hours',
  validate(schemas.workerOnboardingWorkingHours),
  workerController.saveMyOnboardingWorkingHours
);
router.put(
  '/onboarding/documents-trainings',
  validate(schemas.workerOnboardingDocumentsTrainings),
  workerController.saveMyOnboardingDocumentsTrainings
);
router.put(
  '/onboarding/complete',
  validate(schemas.workerOnboardingComplete),
  workerController.completeMyOnboarding
);

router.put('/files/meta', validate(schemas.workerFileMeta), workerController.updateMyWorkerFilesMeta);
router.get('/files', workerController.getMyWorkerFiles);
router.post('/files/upload', uploadWorkerFileSingle, workerController.uploadMyWorkerFileMultipart);
router.post('/files', validate(schemas.workerFileUpload), workerController.uploadMyWorkerFile);
router.delete('/files/:fileId', workerController.deleteMyWorkerFile);

router.get('/files/:fileId/view-url', workerController.getMyWorkerFileViewUrl);
router.get('/training-documents/:docId/view-url', workerController.getMyTrainingDocumentViewUrl);
router.post(
  '/training-documents/upload',
  uploadWorkerFileSingle,
  workerController.uploadMyWorkerTrainingDocumentMultipart
);

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
