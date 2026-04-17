const express = require('express');
const router = express.Router();
const shiftService = require('./shift.service');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { AppError } = require('../../common/middleware/error.middleware');

class WorkerShiftController {
  async getCalendar(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerShiftsCalendar(req.user._id, req.company_id, req.query);
      res.json(shifts);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load calendar shifts', 500));
    }
  }

  async getOpenShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerOpenShifts(req.user._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load open shifts', 500));
    }
  }

  async getAssignedShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerAssignedShifts(req.user._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load assigned shifts', 500));
    }
  }

  async getUpcomingShifts(req, res, next) {
    try {
      const shifts = await shiftService.getWorkerUpcomingShifts(req.user._id, req.company_id);
      res.json(shifts);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load upcoming shifts', 500));
    }
  }

  async requestShift(req, res, next) {
    try {
      const assignment = await shiftService.requestShift(
        req.params.shiftId,
        req.params.positionId,
        req.user._id,
        req.company_id
      );
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to request shift', 500));
    }
  }

  async unassignSelf(req, res, next) {
    try {
      const assignment = await shiftService.unassignWorker(
        req.params.shiftId,
        req.params.positionId,
        req.user._id,
        req.company_id,
        'worker',
        req.body.reason
      );
      res.json(assignment);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to unassign from shift', 500));
    }
  }

  async getShiftById(req, res, next) {
    try {
      const shift = await shiftService.getWorkerShiftDetail(req.params.shiftId, req.user._id, req.company_id);
      res.json(shift);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load shift', 500));
    }
  }
}

const workerShiftController = new WorkerShiftController();
router.use(authenticate);
router.use(requireRole('worker'));

/**
 * @swagger
 * /api/me/shifts/calendar:
 *   get:
 *     summary: Worker shifts calendar
 *     description: >-
 *       Returns shifts for the authenticated worker within a date range, scoped to the worker's company.
 *       `include` controls whether to return assigned shifts, open shifts matching the worker's roles, or both.
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *           enum: [assigned, open, both]
 *           default: both
 *     responses:
 *       200:
 *         description: Calendar shifts
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/calendar', workerShiftController.getCalendar);

/**
 * @swagger
 * /api/me/shifts/open:
 *   get:
 *     summary: List open shifts
 *     description: Get all published shifts with open positions matching worker's roles
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of open shifts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/open', workerShiftController.getOpenShifts);

/**
 * @swagger
 * /api/me/shifts/assigned:
 *   get:
 *     summary: List assigned shifts
 *     description: Get all shifts the worker is assigned to
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned shifts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/assigned', workerShiftController.getAssignedShifts);

/**
 * @swagger
 * /api/me/shifts/upcoming:
 *   get:
 *     summary: List upcoming shifts
 *     description: Get future shifts the worker is assigned to
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of upcoming shifts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/upcoming', workerShiftController.getUpcomingShifts);

/**
 * @swagger
 * /api/me/shifts/{shiftId}:
 *   get:
 *     summary: Worker shift detail
 *     description: >-
 *       Returns full shift data (same shape as admin GET /api/shifts/:id) when the worker is assigned
 *       or may see the shift as an open role match. Returns 404 if not allowed.
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift detail
 *       404:
 *         description: Not found or not visible to this worker
 */
router.get('/:shiftId', workerShiftController.getShiftById);

/**
 * @swagger
 * /api/me/shifts/{shiftId}/positions/{positionId}/request:
 *   post:
 *     summary: Request position
 *     description: Submit a request to work a specific position
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: positionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Request submitted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/:shiftId/positions/:positionId/request', workerShiftController.requestShift);

/**
 * @swagger
 * /api/me/shifts/{shiftId}/positions/{positionId}/unassign:
 *   post:
 *     summary: Unassign self
 *     description: Remove self from a position (requires 3+ hours advance notice)
 *     tags: [Worker Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: positionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Self unassigned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/:shiftId/positions/:positionId/unassign', workerShiftController.unassignSelf);

module.exports = router;
