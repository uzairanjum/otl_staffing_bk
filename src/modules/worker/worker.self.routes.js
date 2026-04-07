const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route POST /api/me/time-off
 * @description Request time off
 * @group Self Service - Worker self-service endpoints
 * @security BearerAuth
 * @param {string} start_date.body.required - Start date (YYYY-MM-DD)
 * @param {string} end_date.body.required - End date (YYYY-MM-DD)
 * @param {string} reason.body - Reason for time off
 * @returns {object} 201 - Time-off request created
 * @example request
 * {
 *   "start_date": "2024-02-01",
 *   "end_date": "2024-02-05",
 *   "reason": "Family vacation"
 * }
 * @example response - 201
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440010",
 *   "worker_id": "550e8400-e29b-41d4-a716-446655440002",
 *   "start_date": "2024-02-01T00:00:00.000Z",
 *   "end_date": "2024-02-05T00:00:00.000Z",
 *   "reason": "Family vacation",
 *   "status": "active",
 *   "created_at": "2024-01-15T10:00:00.000Z"
 * }
 */
router.use(authenticate);
router.use(requireRole('worker'));

router.post('/time-off', validate(schemas.timeOff), workerController.requestTimeOff);

/**
 * @route GET /api/me/time-off
 * @description Get all my time-off requests
 * @group Self Service - Worker self-service endpoints
 * @security BearerAuth
 * @returns {array} 200 - List of time-off requests
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440010",
 *     "start_date": "2024-02-01T00:00:00.000Z",
 *     "end_date": "2024-02-05T00:00:00.000Z",
 *     "reason": "Family vacation",
 *     "status": "active"
 *   }
 * ]
 */
router.get('/time-off', workerController.getMyTimeOffs);

/**
 * @route DELETE /api/me/time-off/:id
 * @description Cancel a time-off request
 * @group Self Service - Worker self-service endpoints
 * @security BearerAuth
 * @param {string} id.path.required - Time-off request ID
 * @returns {object} 200 - Time-off cancelled
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440010",
 *   "status": "cancelled"
 * }
 */
router.delete('/time-off/:id', workerController.cancelTimeOff);

module.exports = router;
