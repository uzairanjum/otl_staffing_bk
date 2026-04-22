'use strict';

const express = require('express');
const router = express.Router();
const calenderService = require('./calender.service');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { AppError } = require('../../common/middleware/error.middleware');

class CalenderController {
  async getAssignments(req, res, next) {
    try {
      const result = await calenderService.getAssignmentsByDateRange(req.company_id, req.query);
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(new AppError(error.message || 'Failed to load calendar assignments', 500));
    }
  }
}

const calenderController = new CalenderController();

router.use(authenticate);
router.use(requireRole('admin'));

/**
 * @swagger
 * /api/calendar/assignments:
 *   get:
 *     summary: Calendar assignments by date range (user view)
 *     description: >-
 *       Returns workers paginated (default 10/page), each with their assignment slots for the date range,
 *       plus a separate unassigned_slots array for open (unfilled) positions.
 *       Supports optional filters for shift status, job, and location.
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: shift_status
 *         schema:
 *           type: string
 *           enum: [draft, published, in_progress, completed, cancelled]
 *         description: Filter by shift status
 *       - in: query
 *         name: job_id
 *         schema:
 *           type: string
 *         description: Filter by job ObjectId
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Partial case-insensitive match on job location
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Worker pagination page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of workers per page
 *     responses:
 *       200:
 *         description: Grouped calendar data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unassigned_slots:
 *                   type: array
 *                   description: All open (unfilled) position slots in the date range
 *                   items:
 *                     type: object
 *                     properties:
 *                       shift_id:
 *                         type: string
 *                       start_time:
 *                         type: string
 *                         example: "08:30"
 *                         description: "HH:MM (UTC)"
 *                       end_time:
 *                         type: string
 *                         example: "16:00"
 *                         description: "HH:MM (UTC)"
 *                       system_date:
 *                         type: string
 *                         format: date-time
 *                       shift_name:
 *                         type: string
 *                       job_name:
 *                         type: string
 *                       client_name:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [assigned, requested, approved, rejected, unassigned, completed]
 *                         description: Per-day assignment item status
 *                       position_status:
 *                         type: string
 *                         enum: [assigned, requested, approved, rejected, unassigned, completed]
 *                         description: Shift position assignment document status
 *                       job_color:
 *                         type: string
 *                         nullable: true
 *                       client_color:
 *                         type: string
 *                         nullable: true
 *                       worker_role:
 *                         type: string
 *                         nullable: true
 *                         description: Required role for this open slot
 *                 data:
 *                   type: array
 *                   description: Paginated list of workers with their assignments
 *                   items:
 *                     type: object
 *                     properties:
 *                       worker_id:
 *                         type: string
 *                       worker_name:
 *                         type: string
 *                       worker_role:
 *                         type: string
 *                         nullable: true
 *                       total_hours:
 *                         type: number
 *                         description: Total assigned hours in the date range (rounded to 2dp)
 *                         example: 0.5
 *                       assignments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             shift_id:
 *                               type: string
 *                             start_time:
 *                               type: string
 *                               example: "08:30"
 *                               description: "HH:MM (UTC)"
 *                             end_time:
 *                               type: string
 *                               example: "16:00"
 *                               description: "HH:MM (UTC)"
 *                             system_date:
 *                               type: string
 *                               format: date-time
 *                             shift_name:
 *                               type: string
 *                             job_name:
 *                               type: string
 *                             client_name:
 *                               type: string
 *                               nullable: true
 *                             status:
 *                               type: string
 *                               enum: [assigned, requested, approved, rejected, unassigned, completed]
 *                               description: Per-day assignment item status
 *                             position_status:
 *                               type: string
 *                               enum: [assigned, requested, approved, rejected, unassigned, completed]
 *                               description: Shift position assignment document status
 *                             job_color:
 *                               type: string
 *                               nullable: true
 *                             client_color:
 *                               type: string
 *                               nullable: true
 *                             worker_role:
 *                               type: string
 *                               nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of distinct workers
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/assignments', calenderController.getAssignments.bind(calenderController));

module.exports = router;
