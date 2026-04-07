const express = require('express');
const router = express.Router();
const payrollController = require('./payroll.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route POST /api/me/payroll/reports
 * @description Submit a bi-weekly payroll report
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} start_date.body.required - Report period start date
 * @param {string} end_date.body.required - Report period end date
 * @param {array} entries.body - Array of shift entries or external work
 * @returns {object} 201 - Payroll report submitted
 * @example request
 * {
 *   "start_date": "2024-01-29",
 *   "end_date": "2024-02-11",
 *   "entries": [
 *     {
 *       "shift_assignment_id": "550e8400-e29b-41d4-a716-446655440001",
 *       "hours_worked": 8,
 *       "hourly_rate": 18
 *     },
 *     {
 *       "external_work_desc": "Extra catering work",
 *       "external_start_time": "2024-02-10T10:00:00Z",
 *       "external_end_time": "2024-02-10T18:00:00Z",
 *       "external_hourly_rate": 20
 *     }
 *   ]
 * }
 */
router.post('/reports', authenticate, requireRole('worker'), validate(schemas.payrollReport), payrollController.submitPayrollReport);

/**
 * @route GET /api/me/payroll/reports
 * @description Get worker's own payroll reports
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @returns {array} 200 - List of payroll reports
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "start_date": "2024-01-29",
 *     "end_date": "2024-02-11",
 *     "status": "submitted",
 *     "total_hours": 40,
 *     "total_amount": 720,
 *     "submitted_at": "2024-02-12T10:00:00.000Z"
 *   }
 * ]
 */
router.get('/reports', authenticate, requireRole('worker'), payrollController.getWorkerPayrollReports);

router.use(authenticate);
router.use(requireRole('admin'));

/**
 * @route GET /api/payroll/reports
 * @description Get all payroll reports for the company
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} status.query - Filter by status
 * @param {string} worker_id.query - Filter by worker
 * @returns {array} 200 - List of all payroll reports
 */
router.get('/reports', payrollController.getPayrollReports);

/**
 * @route GET /api/payroll/reports/:id
 * @description Get payroll report details with entries
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} id.path.required - Report ID
 * @returns {object} 200 - Report details with entries
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "worker_id": { "first_name": "John", "last_name": "Doe" },
 *   "start_date": "2024-01-29",
 *   "end_date": "2024-02-11",
 *   "status": "submitted",
 *   "total_hours": 40,
 *   "total_amount": 720,
 *   "entries": [
 *     {
 *       "shift_assignment_id": "...",
 *       "hours_worked": 8,
 *       "hourly_rate": 18,
 *       "total_amount": 144,
 *       "status": "submitted"
 *     }
 *   ]
 * }
 */
router.get('/reports/:id', payrollController.getPayrollReport);

/**
 * @route PUT /api/payroll/reports/:id/approve
 * @description Approve a payroll report
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} id.path.required - Report ID
 * @returns {object} 200 - Report approved
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "status": "approved",
 *   "reviewed_at": "2024-02-15T10:00:00.000Z"
 * }
 */
router.put('/reports/:id/approve', payrollController.approvePayrollReport);

/**
 * @route PUT /api/payroll/reports/:id/modify
 * @description Modify a payroll report (adjust hours/rates)
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} id.path.required - Report ID
 * @param {array} entries.body.required - Array of modifications
 * @returns {object} 200 - Report modified
 * @example request
 * {
 *   "entries": [
 *     {
 *       "entry_id": "550e8400-e29b-41d4-a716-446655440002",
 *       "hours_worked": 7.5,
 *       "hourly_rate": 18
 *     }
 *   ]
 * }
 */
router.put('/reports/:id/modify', payrollController.modifyPayrollReport);

/**
 * @route PUT /api/payroll/reports/:id/paid
 * @description Mark payroll report as paid
 * @group Payroll - Payroll management
 * @security BearerAuth
 * @param {string} id.path.required - Report ID
 * @returns {object} 200 - Report marked as paid
 */
router.put('/reports/:id/paid', payrollController.markAsPaid);

module.exports = router;
