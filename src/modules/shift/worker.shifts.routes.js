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

router.use(authenticate);
router.use(requireRole('worker'));

router.get('/open', workerShiftController.getOpenShifts);
router.get('/assigned', workerShiftController.getAssignedShifts);
router.get('/upcoming', workerShiftController.getUpcomingShifts);
router.post('/:shiftId/positions/:positionId/request', workerShiftController.requestShift);
router.post('/:shiftId/positions/:positionId/unassign', workerShiftController.unassignSelf);

module.exports = router;
