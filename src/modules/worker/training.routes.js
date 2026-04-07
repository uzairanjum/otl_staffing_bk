const express = require('express');
const router = express.Router();
const trainingController = require('./training.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');

/**
 * @swagger
 * /api/workers/trainings:
 *   get:
 *     summary: Get my trainings
 *     description: Get all training assigned to the authenticated worker
 *     tags: [Worker Training]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of worker trainings
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.use(authenticate);
router.use(requireRole('worker'));

router.get('/', trainingController.getMyTrainings);

/**
 * @swagger
 * /api/workers/trainings/{id}/documents:
 *   post:
 *     summary: Upload training document
 *     description: Upload training completion documents for a worker
 *     tags: [Worker Training]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Training ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_url:
 *                 type: string
 *               cloudinary_public_id:
 *                 type: string
 *               document_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/:id/documents', trainingController.uploadMyTrainingDocument);

module.exports = router;
