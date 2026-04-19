const express = require('express');
const shiftService = require('./shift.service');
const jobService = require('../job/job.service');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { AppError } = require('../../common/middleware/error.middleware');

const router = express.Router();

class ClientRepShiftController {
  async getCalendar(req, res, next) {
    try {
      const data = await shiftService.getClientRepShiftsCalendar(req.user, req.company_id, req.query);
      res.set('Cache-Control', 'private, no-store');
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load calendar shifts', 500));
    }
  }

  async getShiftById(req, res, next) {
    try {
      const data = await shiftService.getClientRepShiftDetail(req.params.shiftId, req.user, req.company_id);
      res.set('Cache-Control', 'private, no-store');
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load shift', 500));
    }
  }
}

class ClientRepJobsController {
  async list(req, res, next) {
    try {
      const data = await jobService.getClientRepJobs(req.user, req.company_id, req.query);
      res.set('Cache-Control', 'private, no-store');
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load jobs', 500));
    }
  }
}

const controller = new ClientRepShiftController();
const jobsController = new ClientRepJobsController();

router.use(authenticate);
router.use(requireRole('client_rep'));

/**
 * GET /api/me/clientrep/jobs
 * Jobs for the rep's client (JWT `client_id` + `company_id`). Query: page, limit, filter (all|active|hiring|completed|draft|inactive|cancelled).
 */
router.get('/jobs', jobsController.list.bind(jobsController));

/**
 * GET /api/me/clientrep/shifts/calendar
 * Shifts where the authenticated user is the designated client_rep_id (JWT).
 * Query: date_from, date_to (YYYY-MM-DD), required.
 */
router.get('/shifts/calendar', controller.getCalendar.bind(controller));

/**
 * GET /api/me/clientrep/shifts/:shiftId
 * Full shift detail (same shape as GET /api/shifts/:id) when the rep is designated on the shift.
 */
router.get('/shifts/:shiftId', controller.getShiftById.bind(controller));

module.exports = router;
