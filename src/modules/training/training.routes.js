const express = require('express');
const router = express.Router();
const trainingController = require('./training.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/training:
 *   get:
 *     summary: List trainings
 *     description: Get all training programs
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of training programs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Create training
 *     description: Create a new training program
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Training'
 *     responses:
 *       201:
 *         description: Training created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', trainingController.getTrainings);
router.post('/', validate(schemas.training), trainingController.createTraining);

/**
 * @swagger
 * /api/training/{id}:
 *   put:
 *     summary: Update training
 *     description: Update a training program
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Training'
 *     responses:
 *       200:
 *         description: Training updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   delete:
 *     summary: Delete training
 *     description: Delete a training program
 *     tags: [Training]
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
 *         description: Training deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/:id', trainingController.updateTraining);
router.delete('/:id', trainingController.deleteTraining);

/**
 * @swagger
 * /api/training/{id}/assign/{workerId}:
 *   post:
 *     summary: Assign training to worker
 *     description: Assign a training program to a worker
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Training assigned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   put:
 *     summary: Update worker training status
 *     description: Update worker's training completion status
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [assigned, in_progress, completed]
 *     responses:
 *       200:
 *         description: Training status updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:id/assign/:workerId', trainingController.assignTraining);
router.put('/:id/assign/:workerId', trainingController.updateWorkerTrainingStatus);

/**
 * @swagger
 * /api/training/{id}/assign/{workerId}/documents:
 *   post:
 *     summary: Upload training document
 *     description: Upload training completion documents for a worker
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       201:
 *         description: Document uploaded
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:id/assign/:workerId/documents', trainingController.uploadTrainingDocument);

/**
 * @swagger
 * /api/training/worker/{workerId}:
 *   get:
 *     summary: Get worker trainings
 *     description: Get all training assigned to a worker
 *     tags: [Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of worker trainings
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/worker/:workerId', trainingController.getWorkerTrainings);

module.exports = router;
