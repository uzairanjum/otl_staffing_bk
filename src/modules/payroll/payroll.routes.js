const express = require('express');
const router = express.Router();
const payrollController = require('./payroll.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/me/payroll/reports:
 *   post:
 *     summary: Submit payroll report
 *     description: Submit a bi-weekly payroll report with hours worked
 *     tags: [Worker Payroll]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayrollReport'
 *     responses:
 *       201:
 *         description: Report submitted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   get:
 *     summary: Get my payroll reports
 *     description: Get all payroll reports submitted by the worker
 *     tags: [Worker Payroll]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payroll reports
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/reports', authenticate, requireRole('worker'), validate(schemas.payrollReport), payrollController.submitPayrollReport);
router.get('/reports', authenticate, requireRole('worker'), payrollController.getWorkerPayrollReports);

/**
 * @swagger
 * /api/payroll/reports:
 *   get:
 *     summary: List payroll reports
 *     description: Get all payroll reports for the company
 *     tags: [Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitted, under_review, approved, modified, paid]
 *     responses:
 *       200:
 *         description: List of payroll reports
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/reports', payrollController.getPayrollReports);

/**
 * @swagger
 * /api/payroll/reports/{id}:
 *   get:
 *     summary: Get payroll report
 *     description: Get payroll report details
 *     tags: [Payroll]
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
 *         description: Report details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/reports/:id', payrollController.getPayrollReport);

/**
 * @swagger
 * /api/payroll/reports/{id}/approve:
 *   put:
 *     summary: Approve payroll report
 *     description: Approve a payroll report
 *     tags: [Payroll]
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
 *         description: Report approved
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/reports/:id/approve', payrollController.approvePayrollReport);

/**
 * @swagger
 * /api/payroll/reports/{id}/modify:
 *   put:
 *     summary: Request modifications
 *     description: Request changes to a payroll report
 *     tags: [Payroll]
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
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Modification requested
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/reports/:id/modify', payrollController.modifyPayrollReport);

/**
 * @swagger
 * /api/payroll/reports/{id}/paid:
 *   put:
 *     summary: Mark as paid
 *     description: Mark a payroll report as paid
 *     tags: [Payroll]
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
 *         description: Report marked as paid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/reports/:id/paid', payrollController.markAsPaid);

module.exports = router;
