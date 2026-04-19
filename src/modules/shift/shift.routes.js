const express = require('express');
const router = express.Router();
const shiftController = require('./shift.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: List shifts
 *     description: Get all shifts with optional filters
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, in_progress, completed, cancelled]
 *       - in: query
 *         name: job_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of shifts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Create shift
 *     description: Create a new shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Shift'
 *     responses:
 *       201:
 *         description: Shift created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/templates', shiftController.getShiftTemplates);
router.post('/templates', validate(schemas.shiftTemplateCreate), shiftController.createShiftTemplate);
router.put('/templates/:templateId', validate(schemas.shiftTemplateUpdate), shiftController.updateShiftTemplate);
router.delete('/templates/:templateId', shiftController.deleteShiftTemplate);

/**
 * @swagger
 * /api/shifts/filters:
 *   get:
 *     summary: Get shift filter options
 *     description: Returns global roles, distinct shift locations, and distinct jobs used in shifts for the company
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter options
 */
router.get('/filters', shiftController.getShiftFilters);

/**
 * @swagger
 * /api/shifts/filters/jobs:
 *   get:
 *     summary: Jobs used on shifts (search & pagination)
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/filters/jobs', shiftController.getShiftJobsPaged);

/**
 * @swagger
 * /api/shifts/filters/locations:
 *   get:
 *     summary: List distinct shift locations (search & pagination)
 *     description: Locations that appear on company shifts; supports q, page, limit (default 5)
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paged location strings
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/filters/locations', shiftController.getShiftLocationsPaged);

/**
 * @swagger
 * /api/shifts/search:
 *   get:
 *     summary: Search shifts (paged)
 *     description: Search shifts by job/client/location/roles/staff with date-range and sorting
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [date, createdAt, updatedAt]
 *       - in: query
 *         name: sort_dir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: job_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: role_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: role_name
 *         schema:
 *           type: string
 *       - in: query
 *         name: staff_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: staff_name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated shifts
 */
router.get('/search', shiftController.searchShifts);

router.get('/', shiftController.getShifts);
router.post('/', validate(schemas.shift), shiftController.createShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: Get shift
 *     description: Get shift details with all positions and assignments
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 * 
 *   put:
 *     summary: Update shift
 *     description: Update shift information
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Shift'
 *     responses:
 *       200:
 *         description: Shift updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   delete:
 *     summary: Delete shift
 *     description: Cancel a shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift cancelled
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:id', shiftController.getShift);
router.put('/:id', validate(schemas.shiftUpdate), shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);
router.post('/:id/duplicate', shiftController.duplicateShift);

/**
 * @swagger
 * /api/shifts/{id}/publish:
 *   post:
 *     summary: Publish shift
 *     description: Publish a shift making it available for worker requests
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift published
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:id/publish', shiftController.publishShift);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions:
 *   post:
 *     summary: Add position to shift
 *     description: Add a new position requirement to a shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShiftPosition'
 *     responses:
 *       201:
 *         description: Position added
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/:shiftId/positions', validate(schemas.shiftPosition), shiftController.addPosition);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}:
 *   put:
 *     summary: Update position
 *     description: Update a position in a shift
 *     tags: [Shifts]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShiftPosition'
 *     responses:
 *       200:
 *         description: Position updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   delete:
 *     summary: Delete position
 *     description: Remove a position from a shift (only if no assignments exist)
 *     tags: [Shifts]
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
 *       200:
 *         description: Position deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/:shiftId/positions/:positionId', validate(schemas.shiftPositionUpdate), shiftController.updatePosition);
router.delete('/:shiftId/positions/:positionId', shiftController.deletePosition);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}/requests:
 *   get:
 *     summary: List position requests
 *     description: Get all worker requests for a position
 *     tags: [Shifts]
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
 *       200:
 *         description: List of worker requests
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:shiftId/positions/:positionId/requests', shiftController.getPositionRequests);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}/requests/{workerId}/approve:
 *   post:
 *     summary: Approve worker request
 *     description: Approve a worker's request for a position
 *     tags: [Shifts]
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
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:shiftId/positions/:positionId/requests/:workerId/approve', shiftController.approveWorkerRequest);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}/requests/{workerId}/reject:
 *   post:
 *     summary: Reject worker request
 *     description: Reject a worker's request for a position
 *     tags: [Shifts]
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
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request rejected
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:shiftId/positions/:positionId/requests/:workerId/reject', shiftController.rejectWorkerRequest);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}/assign:
 *   post:
 *     summary: Assign worker
 *     description: Directly assign a worker to a position
 *     tags: [Shifts]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               worker_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Worker assigned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:shiftId/positions/:positionId/assign', shiftController.assignWorker);

/**
 * @swagger
 * /api/shifts/{shiftId}/positions/{positionId}/unassign:
 *   post:
 *     summary: Unassign worker
 *     description: Remove a worker from a position
 *     tags: [Shifts]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               worker_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Worker unassigned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/:shiftId/positions/:positionId/unassign', shiftController.unassignWorker);

module.exports = router;
