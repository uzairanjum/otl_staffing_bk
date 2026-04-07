const express = require('express');
const router = express.Router();
const jobController = require('./job.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/jobs
 * @description Get all jobs for the company
 * @group Jobs - Job management
 * @security BearerAuth
 * @param {string} status.query - Filter by status (draft|active|completed|cancelled)
 * @param {string} client_id.query - Filter by client ID
 * @returns {array} 200 - List of jobs
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Annual Gala 2024",
 *     "description": "Corporate annual gala event",
 *     "client_id": { "name": "Acme Events" },
 *     "status": "active"
 *   }
 * ]
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', jobController.getJobs);

/**
 * @route POST /api/jobs
 * @description Create a new job
 * @group Jobs - Job management
 * @security BearerAuth
 * @param {string} client_id.body.required - Client ID
 * @param {string} name.body.required - Job name
 * @param {string} description.body - Job description
 * @returns {object} 201 - Job created
 * @example request
 * {
 *   "client_id": "550e8400-e29b-41d4-a716-446655440010",
 *   "name": "Summer Music Festival",
 *   "description": "Annual summer music festival staffing"
 * }
 */
router.post('/', validate(schemas.job), jobController.createJob);

/**
 * @route GET /api/jobs/:id
 * @description Get job details
 * @group Jobs - Job management
 * @security BearerAuth
 * @param {string} id.path.required - Job ID
 * @returns {object} 200 - Job details
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "name": "Annual Gala 2024",
 *   "description": "Corporate annual gala event",
 *   "client_id": { "id": "...", "name": "Acme Events" },
 *   "status": "active"
 * }
 */
router.get('/:id', jobController.getJob);

/**
 * @route PUT /api/jobs/:id
 * @description Update job details
 * @group Jobs - Job management
 * @security BearerAuth
 * @param {string} id.path.required - Job ID
 * @param {string} name.body - Job name
 * @param {string} description.body - Job description
 * @param {string} status.body - Job status
 * @returns {object} 200 - Job updated
 */
router.put('/:id', jobController.updateJob);

/**
 * @route DELETE /api/jobs/:id
 * @description Delete (cancel) a job
 * @group Jobs - Job management
 * @security BearerAuth
 * @param {string} id.path.required - Job ID
 * @returns {object} 200 - Job deleted
 * @example response - 200
 * {
 *   "message": "Job deleted successfully"
 * }
 */
router.delete('/:id', jobController.deleteJob);

module.exports = router;
