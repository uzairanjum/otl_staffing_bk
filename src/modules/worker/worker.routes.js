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
 *           enum: [invited, onboarding, pending_approval, active, inactive]
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
 * /api/workers/active/role_based:
 *   get:
 *     summary: List active workers by role
 *     description: Get active workers for the company filtered by company_role_id
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: company_role_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company role id to filter by
 *     responses:
 *       200:
 *         description: List of active workers for the role
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  '/active/role_based',
  authenticate,
  requireRole('admin'),
  workerController.getActiveWorkersRoleBased
);

/**
 * @swagger
 * /api/workers/approved:
 *   get:
 *     summary: List approved workers
 *     description: Workers with approved=true for the authenticated admin's company (JWT). Optimized query.
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approved workers (same shape as GET /api/workers rows)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/approved', authenticate, requireRole('admin'), workerController.getApprovedWorkers);

/**
 * @swagger
 * /api/workers/filters/locations:
 *   get:
 *     summary: Distinct cities for approved workers
 *     description: Searchable paginated facets from worker_addresses.city (joined to approved users). JWT.
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paged items with name field per row
 */
router.get(
  '/filters/locations',
  authenticate,
  requireRole('admin'),
  workerController.getApprovedWorkerLocationFacets,
);

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
/**
 * DELETE /api/workers/:id — Permanently remove worker (users) and related docs; admin JWT.
 */
router.delete('/:id', authenticate, requireRole('admin'), workerController.deleteWorker);
router.put(
  '/:id/onboarding/basic-info',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingBasicInfo),
  workerController.saveOnboardingBasicInfo
);
router.put(
  '/:id/onboarding/working-hours',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingWorkingHours),
  workerController.saveOnboardingWorkingHours
);
router.put(
  '/:id/onboarding/documents-trainings',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingDocumentsTrainings),
  workerController.saveOnboardingDocumentsTrainings
);
router.put(
  '/:id/onboarding/complete',
  authenticate,
  requireRole('admin'),
  validate(schemas.workerOnboardingComplete),
  workerController.completeOnboarding
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
 * /api/workers/{id}/inactive:
 *   put:
 *     summary: Inactivate worker
 *     description: Mark an active worker as inactive
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
 *         description: Worker inactivated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/inactive', authenticate, requireRole('admin'), workerController.inactiveWorker);
// Deprecated alias for backward compatibility.
router.put('/:id/suspend', authenticate, requireRole('admin'), workerController.suspendWorker);
router.put('/:id/activate', authenticate, requireRole('admin'), workerController.activateWorker);

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
router.get(
  '/:id/files/:fileId/view-url',
  authenticate,
  requireRole('admin'),
  workerController.getWorkerFileViewUrl
);

router.post(
  '/:id/training-documents/upload',
  authenticate,
  requireRole('admin'),
  uploadWorkerFileSingle,
  workerController.uploadWorkerTrainingDocumentMultipart
);
router.get(
  '/:id/training-documents/:docId/view-url',
  authenticate,
  requireRole('admin'),
  workerController.getWorkerTrainingDocumentViewUrl
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
