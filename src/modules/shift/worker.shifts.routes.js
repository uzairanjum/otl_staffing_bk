const express = require('express');
const router = express.Router();
const shiftService = require('./shift.service');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { AppError } = require('../../common/middleware/error.middleware');

/**
 * @route GET /api/me/shifts/open
 * @description Get all open shifts available for worker (based on role)
 * @group Worker Shifts - Worker shift management
 * @security BearerAuth
 * @returns {array} 200 - List of open shifts with available positions
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Evening Security Shift",
 *     "date": "2024-02-15",
 *     "start_time": "18:00",
 *     "end_time": "23:00",
 *     "location": "Convention Center",
 *     "status": "published",
 *     "open_positions": [
 *       {
 *         "id": "...",
 *         "company_role_id": { "name": "Security" },
 *         "needed_count": 5,
 *         "filled_count": 2,
 *         "status": "partially_filled"
 *       }
 *     ]
 *   }
 * ]
 */
class WorkerShiftController {
  async getOpenShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerOpenShifts(req.user.worker_id._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getAssignedShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerAssignedShifts(req.user.worker_id._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getUpcomingShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerUpcomingShifts(req.user.worker_id._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async requestShift(req, res, next) {
    try {
      const assignment = await shiftService.requestShift(
        req.params.shiftId,
        req.params.positionId,
        req.user.worker_id._id,
        req.company_id
      );
      res.status(201).json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async unassignSelf(req, res, next) {
    try {
      const assignment = await shiftService.unassignWorker(
        req.params.shiftId,
        req.params.positionId,
        req.user.worker_id._id,
        req.company_id,
        'worker',
        req.body.reason
      );
      res.json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

const workerShiftController = new WorkerShiftController();

router.use(authenticate);
router.use(requireRole('worker'));

/**
 * @route GET /api/me/shifts/assigned
 * @description Get worker's currently assigned shifts
 * @group Worker Shifts - Worker shift management
 * @security BearerAuth
 * @returns {array} 200 - List of assigned shifts
 * @example response - 200
 * [
 *   {
 *     "id": "...",
 *     "shift_position_id": {
 *       "shift_id": { "name": "Evening Shift", "date": "2024-02-15" },
 *       "company_role_id": { "name": "Security" }
 *     },
 *     "status": "assigned"
 *   }
 * ]
 */
router.get('/assigned', workerShiftController.getAssignedShifts);

/**
 * @route GET /api/me/shifts/upcoming
 * @description Get worker's upcoming shifts (from assigned)
 * @group Worker Shifts - Worker shift management
 * @security BearerAuth
 * @returns {array} 200 - List of upcoming shifts
 */
router.get('/upcoming', workerShiftController.getUpcomingShifts);

/**
 * @route POST /api/me/shifts/:shiftId/positions/:positionId/request
 * @description Request to fill an open shift position
 * @group Worker Shifts - Worker shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @returns {object} 201 - Shift request submitted
 * @example response - 201
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "shift_position_id": "...",
 *   "worker_id": "...",
 *   "status": "requested",
 *   "is_requested": true
 * }
 */
router.post('/:shiftId/positions/:positionId/request', workerShiftController.requestShift);

/**
 * @route POST /api/me/shifts/:shiftId/positions/:positionId/unassign
 * @description Unassign self from a shift (must be 3+ hours before start)
 * @group Worker Shifts - Worker shift management
 * @security BearerAuth
 * @param {string} shiftId.path.required - Shift ID
 * @param {string} positionId.path.required - Position ID
 * @param {string} reason.body - Reason for unassignment
 * @returns {object} 200 - Successfully unassigned
 * @returns {object} 400 - Cannot unassign (less than 3 hours before shift)
 * @example request
 * {
 *   "reason": "Personal emergency"
 * }
 */
router.post('/:shiftId/positions/:positionId/unassign', workerShiftController.unassignSelf);

module.exports = router;
