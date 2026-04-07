const express = require('express');
const router = express.Router();
const companyController = require('./company.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/company
 * @description Get current company details
 * @group Company - Company management
 * @security BearerAuth
 * @returns {object} 200 - Company details
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "OTL Staffing",
 *   "email": "admin@otlstaffing.com",
 *   "phone": "+1234567890",
 *   "status": "active",
 *   "logo_url": "https://...",
 *   "created_at": "2024-01-01T00:00:00.000Z"
 * }
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', companyController.getCompany);

/**
 * @route PUT /api/company
 * @description Update company details
 * @group Company - Company management
 * @security BearerAuth
 * @param {string} name.body - Company name
 * @param {string} email.body - Company email
 * @param {string} phone.body - Company phone
 * @param {string} logo_url.body - Company logo URL
 * @returns {object} 200 - Updated company details
 * @example request
 * {
 *   "name": "OTL Staffing Ltd",
 *   "phone": "+1987654321"
 * }
 */
router.put('/', validate(schemas.companyUpdate), companyController.updateCompany);

/**
 * @route GET /api/company/roles
 * @description Get all company roles
 * @group Company - Company management
 * @security BearerAuth
 * @returns {array} 200 - List of company roles
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "General Staff",
 *     "category": "general",
 *     "default_hourly_rate": 15,
 *     "description": "General staff role",
 *     "is_active": true
 *   }
 * ]
 */
router.get('/roles', companyController.getRoles);

/**
 * @route POST /api/company/roles
 * @description Create a new company role
 * @group Company - Company management
 * @security BearerAuth
 * @param {string} name.body.required - Role name
 * @param {string} category.body - Role category
 * @param {number} default_hourly_rate.body - Default hourly rate
 * @param {string} description.body - Role description
 * @returns {object} 201 - Created role
 * @example request
 * {
 *   "name": "Security Guard",
 *   "category": "security",
 *   "default_hourly_rate": 18,
 *   "description": "Security personnel"
 * }
 */
router.post('/roles', validate(schemas.companyRole), companyController.createRole);

/**
 * @route PUT /api/company/roles/:id
 * @description Update a company role
 * @group Company - Company management
 * @security BearerAuth
 * @param {string} id.path.required - Role ID
 * @param {string} name.body - Role name
 * @param {string} category.body - Role category
 * @param {number} default_hourly_rate.body - Default hourly rate
 * @param {string} description.body - Role description
 * @returns {object} 200 - Updated role
 */
router.put('/roles/:id', validate(schemas.companyRole), companyController.updateRole);

/**
 * @route DELETE /api/company/roles/:id
 * @description Delete (deactivate) a company role
 * @group Company - Company management
 * @security BearerAuth
 * @param {string} id.path.required - Role ID
 * @returns {object} 200 - Role deleted successfully
 * @example response - 200
 * {
 *   "message": "Role deleted successfully"
 * }
 */
router.delete('/roles/:id', companyController.deleteRole);

/**
 * @route GET /api/company/working-hours
 * @description Get company default working hours
 * @group Company - Company management
 * @security BearerAuth
 * @returns {array} 200 - List of working hours by day
 * @example response - 200
 * [
 *   { "day_of_week": 0, "start_time": "09:00", "end_time": "17:00" },
 *   { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" }
 * ]
 */
router.get('/working-hours', companyController.getWorkingHours);

/**
 * @route PUT /api/company/working-hours
 * @description Update company default working hours
 * @group Company - Company management
 * @security BearerAuth
 * @param {array} body.body.required - Array of working hours
 * @returns {array} 200 - Updated working hours
 * @example request
 * [
 *   { "day_of_week": 0, "start_time": "10:00", "end_time": "18:00" },
 *   { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" }
 * ]
 */
router.put('/working-hours', companyController.updateWorkingHours);

/**
 * @route GET /api/company/stats
 * @description Get company statistics
 * @group Company - Company management
 * @security BearerAuth
 * @returns {object} 200 - Company statistics
 * @example response - 200
 * {
 *   "total_workers": 50,
 *   "active_workers": 45,
 *   "total_clients": 10,
 *   "total_jobs": 25,
 *   "total_shifts": 100,
 *   "upcoming_shifts": 15,
 *   "total_assignments": 500,
 *   "paid_payroll_reports": 20
 * }
 */
router.get('/stats', companyController.getStats);

module.exports = router;
