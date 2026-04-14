const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { uploadWorkerFileSingle } = require('./worker.upload.middleware');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/workers:
 *   post:
 *     summary: Invite a new worker
 *     description: Create a new worker account and send invitation email
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteWorker'
 *     responses:
 *       201:
 *         description: Worker invited successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   get:
 *     summary: List all workers
 *     description: Get all workers for the company with optional filters
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [invited, onboarding, pending_approval, active, suspended]
 *         description: Filter by worker status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: List of workers
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authenticate, requireRole('admin'), validate(schemas.inviteWorker), workerController.inviteWorker);
router.get('/', authenticate, requireRole('admin'), workerController.getWorkers);

/**
 * @swagger
 * /api/workers/{id}:
 *   get:
 *     summary: Get worker by ID
 *     description: Get detailed worker information including all related data
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 * 
 *   put:
 *     summary: Update worker
 *     description: Update worker information
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               profile_image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Worker updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, requireRole('admin'), workerController.getWorker);
router.put('/:id', authenticate, requireRole('admin'), workerController.updateWorker);
router.put(
  '/:id/onboarding/contract',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingContract),
  workerController.saveOnboardingContract
);
router.put(
  '/:id/onboarding/basic-info',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingBasicInfo),
  workerController.saveOnboardingBasicInfo
);
router.put(
  '/:id/onboarding/emergency-contact',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingEmergencyContact),
  workerController.saveOnboardingEmergencyContact
);
router.put(
  '/:id/onboarding/tax-bank',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingTaxBank),
  workerController.saveOnboardingTaxBank
);
router.put(
  '/:id/onboarding/time-off',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingTimeOff),
  workerController.saveOnboardingTimeOff
);
router.put(
  '/:id/onboarding/documents',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingDocuments),
  workerController.saveOnboardingDocuments
);
router.put(
  '/:id/onboarding/training',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingTraining),
  workerController.saveOnboardingTraining
);

/**
 * @swagger
 * /api/workers/{id}/approve:
 *   put:
 *     summary: Approve worker
 *     description: Approve a worker transitioning them from onboarding to active status
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker approved successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/approve', authenticate, requireRole('admin'), workerController.approveWorker);

/**
 * @swagger
 * /api/workers/{id}/suspend:
 *   put:
 *     summary: Suspend worker
 *     description: Suspend an active worker
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker suspended successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/suspend', authenticate, requireRole('admin'), workerController.suspendWorker);

/**
 * @swagger
 * /api/workers/{id}/files:
 *   get:
 *     summary: List worker files
 *     description: Get all uploaded files for a worker
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: List of worker files
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Upload worker file
 *     description: Upload a document for a worker
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               file_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put(
  '/:id/files/meta',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerFileMeta),
  workerController.updateWorkerFilesMeta
);
router.get('/:id/files', authenticate, requireRole('admin'), workerController.getWorkerFiles);
router.post(
  '/:id/files/upload',
  authenticate,
  requireRole('admin'),
  uploadWorkerFileSingle,
  workerController.uploadWorkerFileMultipart
);
router.post(
  '/:id/files',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerFileUpload),
  workerController.uploadWorkerFile
);
router.delete(
  '/:id/files/:fileId',
  authenticate,
  requireRole('admin'),
  workerController.deleteWorkerFile
);

router.post(
  '/:id/training-documents/upload',
  authenticate,
  requireRole('admin'),
  uploadWorkerFileSingle,
  workerController.uploadWorkerTrainingDocumentMultipart
);

/**
 * @swagger
 * /api/workers/{id}/time-off:
 *   get:
 *     summary: List worker time-off requests
 *     description: Get all time-off requests for a worker
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: List of time-off requests
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:id/time-off', authenticate, requireRole('admin'), workerController.getWorkerTimeOffs);

module.exports = router;
