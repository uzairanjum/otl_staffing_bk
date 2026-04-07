const express = require('express');
const router = express.Router();
const trainingController = require('./training.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/training
 * @description Get all active trainings for the company
 * @group Training - Training management
 * @security BearerAuth
 * @returns {array} 200 - List of trainings
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Safety Training",
 *     "category": "safety",
 *     "description": "Mandatory workplace safety training",
 *     "is_active": true
 *   }
 * ]
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', trainingController.getTrainings);

/**
 * @route POST /api/training
 * @description Create a new training
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} name.body.required - Training name
 * @param {string} category.body - Training category
 * @param {string} description.body - Training description
 * @returns {object} 201 - Training created
 * @example request
 * {
 *   "name": "Health & Safety",
 *   "category": "safety",
 *   "description": "Comprehensive health and safety training"
 * }
 */
router.post('/', validate(schemas.training), trainingController.createTraining);

/**
 * @route PUT /api/training/:id
 * @description Update a training
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} id.path.required - Training ID
 * @param {string} name.body - Training name
 * @param {string} category.body - Training category
 * @param {string} description.body - Training description
 * @returns {object} 200 - Training updated
 */
router.put('/:id', trainingController.updateTraining);

/**
 * @route DELETE /api/training/:id
 * @description Delete (deactivate) a training
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} id.path.required - Training ID
 * @returns {object} 200 - Training deleted
 * @example response - 200
 * {
 *   "message": "Training deleted successfully"
 * }
 */
router.delete('/:id', trainingController.deleteTraining);

/**
 * @route POST /api/training/:id/assign/:workerId
 * @description Assign a training to a worker
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} id.path.required - Training ID
 * @param {string} workerId.path.required - Worker ID
 * @returns {object} 201 - Training assigned
 * @example response - 201
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440002",
 *   "worker_id": "550e8400-e29b-41d4-a716-446655440003",
 *   "training_id": "550e8400-e29b-41d4-a716-446655440001",
 *   "status": "assigned"
 * }
 */
router.post('/:id/assign/:workerId', trainingController.assignTraining);

/**
 * @route PUT /api/training/:id/assign/:workerId
 * @description Update worker's training status
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} id.path.required - Training ID
 * @param {string} workerId.path.required - Worker ID
 * @param {string} status.body.required - Status (assigned|in_progress|completed)
 * @returns {object} 200 - Training status updated
 * @example request
 * {
 *   "status": "completed"
 * }
 */
router.put('/:id/assign/:workerId', trainingController.updateWorkerTrainingStatus);

/**
 * @route POST /api/training/:id/assign/:workerId/documents
 * @description Upload training completion document
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} id.path.required - Training ID
 * @param {string} workerId.path.required - Worker ID
 * @param {string} file_url.body.required - Cloudinary file URL
 * @param {string} cloudinary_public_id.body - Cloudinary public ID
 * @param {string} document_type.body - Document type
 * @returns {object} 201 - Document uploaded
 * @example request
 * {
 *   "file_url": "https://res.cloudinary.com/.../certificate.pdf",
 *   "cloudinary_public_id": "training/cert_123",
 *   "document_type": "completion_certificate"
 * }
 */
router.post('/:id/assign/:workerId/documents', trainingController.uploadTrainingDocument);

/**
 * @route GET /api/training/worker/:workerId
 * @description Get all trainings assigned to a worker
 * @group Training - Training management
 * @security BearerAuth
 * @param {string} workerId.path.required - Worker ID
 * @returns {array} 200 - List of worker trainings
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440002",
 *     "worker_id": "550e8400-e29b-41d4-a716-446655440003",
 *     "training_id": { "name": "Safety Training", "category": "safety" },
 *     "status": "completed",
 *     "completed_at": "2024-01-15T10:00:00.000Z"
 *   }
 * ]
 */
router.get('/worker/:workerId', trainingController.getWorkerTrainings);

module.exports = router;
