const express = require('express');
const router = express.Router();
const shiftService = require('./shift.service');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { AppError } = require('../../common/middleware/error.middleware');

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
