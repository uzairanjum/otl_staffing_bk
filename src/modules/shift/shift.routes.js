const express = require('express');
const router = express.Router();
const shiftController = require('./shift.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/shifts
 * @description Get all shifts for the company
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} status.query - Filter by status (draft|published|in_progress|completed|cancelled)
 * @param {string} job_id.query - Filter by job ID
 * @param {string} date_from.query - Filter by start date (YYYY-MM-DD)
 * @param {string} date_to.query - Filter by end date (YYYY-MM-DD)
 * @returns {array} 200 - List of shifts
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Evening Shift",
 *     "date": "2024-02-15",
 *     "start_time": "18:00",
 *     "end_time": "23:00",
 *     "location": "Convention Center",
 *     "job_id": { "name": "Annual Gala" },
 *     "status": "published"
 *   }
 * ]
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', shiftController.getShifts);

/**
 * @route POST /api/shifts
 * @description Create a new shift
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} job_id.body.required - Job ID
 * @param {string} name.body.required - Shift name
 * @param {string} date.body.required - Shift date (YYYY-MM-DD)
 * @param {string} start_time.body.required - Start time (HH:MM)
 * @param {string} end_time.body.required - End time (HH:MM)
 * @param {string} location.body - Shift location
 * @returns {object} 201 - Shift created
 * @example request
 * {
 *   "job_id": "550e8400-e29b-41d4-a716-446655440010",
 *   "name": "Evening Security Shift",
 *   "date": "2024-02-15",
 *   "start_time": "18:00",
 *   "end_time": "23:00",
 *   "location": "Convention Center, New York"
 * }
 */
router.post('/', validate(schemas.shift), shiftController.createShift);

/**
 * @route GET /api/shifts/:id
 * @description Get shift details with positions and assignments
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} id.path.required - Shift ID
 * @returns {object} 200 - Shift details with positions and worker assignments
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "name": "Evening Shift",
 *   "date": "2024-02-15",
 *   "start_time": "18:00",
 *   "end_time": "23:00",
 *   "location": "Convention Center",
 *   "status": "published",
 *   "positions": [
 *     {
 *       "id": "...",
 *       "company_role_id": { "name": "Security" },
 *       "needed_count": 5,
 *       "filled_count": 3,
 *       "status": "partially_filled",
 *       "assignments": [
 *         { "worker_id": { "first_name": "John" }, "status": "assigned" }
 *       ]
 *     }
 *   ]
 * }
 */
router.get('/:id', shiftController.getShift);

/**
 * @route PUT /api/shifts/:id
 * @description Update shift details
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} id.path.required - Shift ID
 * @param {string} name.body - Shift name
 * @param {string} date.body - Shift date
 * @param {string} start_time.body - Start time
 * @param {string} end_time.body - End time
 * @param {string} location.body - Location
 * @returns {object} 200 - Shift updated
 */
router.put('/:id', shiftController.updateShift);

/**
 * @route DELETE /api/shifts/:id
 * @description Cancel a shift
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} id.path.required - Shift ID
 * @returns {object} 200 - Shift cancelled
 * @example response - 200
 * {
 *   "message": "Shift deleted successfully"
 * }
 */
router.delete('/:id', shiftController.deleteShift);

/**
 * @route POST /api/shifts/:id/publish
 * @description Publish a shift (change status from draft to published)
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} id.path.required - Shift ID
 * @returns {object} 200 - Shift published
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "status": "published"
 * }
 */
router.post('/:id/publish', shiftController.publishShift);

/**
 * @route POST /api/shifts/:shiftId/positions
 * @description Add a position to a shift
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} company_role_id.body.required - Company role ID
 * @param {number} needed_count.body - Number of workers needed (default: 1)
 * @returns {object} 201 - Position created
 * @example request
 * {
 *   "company_role_id": "550e8400-e29b-41d4-a716-446655440001",
 *   "needed_count": 3
 * }
 */
router.post('/:shiftId/positions', validate(schemas.shiftPosition), shiftController.addPosition);

/**
 * @route PUT /api/shifts/:shiftId/positions/:positionId
 * @description Update a shift position
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {number} needed_count.body - Update needed count
 * @returns {object} 200 - Position updated
 */
router.put('/:shiftId/positions/:positionId', shiftController.updatePosition);

/**
 * @route DELETE /api/shifts/:shiftId/positions/:positionId
 * @description Delete a shift position
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @returns {object} 200 - Position deleted
 */
router.delete('/:shiftId/positions/:positionId', shiftController.deletePosition);

/**
 * @route GET /api/shifts/:shiftId/positions/:positionId/requests
 * @description Get all requests for a position
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @returns {array} 200 - List of worker requests
 */
router.get('/:shiftId/positions/:positionId/requests', shiftController.getPositionRequests);

/**
 * @route POST /api/shifts/:shiftId/positions/:positionId/requests/:workerId/approve
 * @description Approve a worker's shift request
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {string} workerId.path.required - Worker ID
 * @returns {object} 200 - Request approved
 * @example response - 200
 * {
 *   "id": "...",
 *   "worker_id": "...",
 *   "status": "approved",
 *   "approved_at": "2024-01-15T10:00:00.000Z"
 * }
 */
router.post('/:shiftId/positions/:positionId/requests/:workerId/approve', shiftController.approveWorkerRequest);

/**
 * @route POST /api/shifts/:shiftId/positions/:positionId/requests/:workerId/reject
 * @description Reject a worker's shift request
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {string} workerId.path.required - Worker ID
 * @returns {object} 200 - Request rejected
 */
router.post('/:shiftId/positions/:positionId/requests/:workerId/reject', shiftController.rejectWorkerRequest);

/**
 * @route POST /api/shifts/:shiftId/positions/:positionId/assign
 * @description Directly assign a worker to a position
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {string} workerId.body.required - Worker ID to assign
 * @returns {object} 201 - Worker assigned
 * @example request
 * {
 *   "workerId": "550e8400-e29b-41d4-a716-446655440002"
 * }
 */
router.post('/:shiftId/positions/:positionId/assign', shiftController.assignWorker);

/**
 * @route POST /api/shifts/:shiftId/positions/:positionId/unassign
 * @description Unassign a worker from a position (admin action)
 * @group Shifts - Shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {string} workerId.body.required - Worker ID to unassign
 * @param {string} reason.body - Reason for unassignment
 * @returns {object} 200 - Worker unassigned
 * @example request
 * {
 *   "workerId": "550e8400-e29b-41d4-a716-446655440002",
 *   "reason": "Worker requested to be removed"
 * }
 */
router.post('/:shiftId/positions/:positionId/unassign', shiftController.unassignWorker);

module.exports = router;
