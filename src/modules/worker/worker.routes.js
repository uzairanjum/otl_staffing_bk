const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route POST /api/workers
 * @description Invite a new worker to the platform
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} email.body.required - Worker email address
 * @param {string} first_name.body.required - Worker first name
 * @param {string} last_name.body.required - Worker last name
 * @param {string} phone.body - Worker phone number
 * @param {array} role_ids.body - Array of company role IDs
 * @returns {object} 201 - Worker invited successfully
 * @returns {object} 400 - Email already in use
 * @example request
 * {
 *   "email": "john.doe@example.com",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "phone": "+1234567890",
 *   "role_ids": ["550e8400-e29b-41d4-a716-446655440001"]
 * }
 * @example response - 201
 * {
 *   "worker": {
 *     "id": "550e8400-e29b-41d4-a716-446655440002",
 *     "first_name": "John",
 *     "last_name": "Doe",
 *     "status": "invited"
 *   },
 *   "user": {
 *     "id": "550e8400-e29b-41d4-a716-446655440003",
 *     "email": "john.doe@example.com"
 *   }
 * }
 */
router.post('/', authenticate, requireRole('admin'), validate(schemas.inviteWorker), workerController.inviteWorker);

/**
 * @route GET /api/workers
 * @description Get all workers for the company
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} status.query - Filter by worker status (invited|onboarding|pending_approval|active|suspended)
 * @returns {array} 200 - List of workers
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440002",
 *     "first_name": "John",
 *     "last_name": "Doe",
 *     "phone": "+1234567890",
 *     "status": "active",
 *     "onboarding_step": 7
 *   }
 * ]
 */
router.get('/', authenticate, requireRole('admin'), workerController.getWorkers);

/**
 * @route GET /api/workers/:id
 * @description Get worker details by ID
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @returns {object} 200 - Worker details with address, tax info, bank details, files
 * @returns {object} 404 - Worker not found
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440002",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "phone": "+1234567890",
 *   "status": "active",
 *   "address": { "city": "New York", "state": "NY" },
 *   "tax_info": { "national_id": "ABC123" },
 *   "bank_detail": { "bank_name": "Bank of America" },
 *   "emergency_contact": { "contact_name": "Jane Doe", "phone": "+1987654321" },
 *   "working_hours": [{ "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" }],
 *   "files": [{ "file_type": "nic", "file_url": "https://..." }]
 * }
 */
router.get('/:id', authenticate, requireRole('admin'), workerController.getWorker);

/**
 * @route PUT /api/workers/:id
 * @description Update worker details
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @param {string} first_name.body - Worker first name
 * @param {string} last_name.body - Worker last name
 * @param {string} phone.body - Worker phone number
 * @returns {object} 200 - Updated worker details
 */
router.put('/:id', authenticate, requireRole('admin'), workerController.updateWorker);

/**
 * @route PUT /api/workers/:id/approve
 * @description Approve a worker (move from pending_approval to active)
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @returns {object} 200 - Worker approved
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440002",
 *   "status": "active",
 *   "approved_at": "2024-01-15T10:00:00.000Z"
 * }
 */
router.put('/:id/approve', authenticate, requireRole('admin'), workerController.approveWorker);

/**
 * @route PUT /api/workers/:id/suspend
 * @description Suspend a worker
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @returns {object} 200 - Worker suspended
 */
router.put('/:id/suspend', authenticate, requireRole('admin'), workerController.suspendWorker);

/**
 * @route GET /api/workers/:id/files
 * @description Get all files uploaded by worker
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @returns {array} 200 - List of worker files
 * @example response - 200
 * [
 *   { "id": "...", "file_type": "nic", "file_url": "https://...", "uploaded_at": "2024-01-10T..." },
 *   { "id": "...", "file_type": "passport_front", "file_url": "https://...", "uploaded_at": "2024-01-11T..." }
 * ]
 */
router.get('/:id/files', authenticate, requireRole('admin'), workerController.getWorkerFiles);

/**
 * @route POST /api/workers/:id/files
 * @description Upload a file for worker
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @param {string} file_type.body.required - Type of file (nic|driver_license|insurance|proof_of_address|ni_utr|driving_license_front|driving_license_back|passport_front|passport_inner|passport_back|profile_photo|dvla_check|other)
 * @param {string} file_url.body.required - Cloudinary file URL
 * @param {string} cloudinary_public_id.body - Cloudinary public ID
 * @returns {object} 201 - File uploaded
 * @example request
 * {
 *   "file_type": "nic",
 *   "file_url": "https://res.cloudinary.com/.../nic.jpg",
 *   "cloudinary_public_id": "workers/nic_123"
 * }
 */
router.post('/:id/files', authenticate, requireRole('admin'), workerController.uploadWorkerFile);

/**
 * @route DELETE /api/workers/:id/files/:fileId
 * @description Delete a worker file
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @param {string} fileId.path.required - File ID
 * @returns {object} 200 - File deleted
 */
router.delete('/:id/files/:fileId', authenticate, requireRole('admin'), workerController.deleteWorkerFile);

/**
 * @route GET /api/workers/:id/time-off
 * @description Get all time-off requests for a worker
 * @group Workers - Worker management
 * @security BearerAuth
 * @param {string} id.path.required - Worker ID
 * @returns {array} 200 - List of time-off requests
 */
router.get('/:id/time-off', authenticate, requireRole('admin'), workerController.getWorkerTimeOffs);

module.exports = router;
