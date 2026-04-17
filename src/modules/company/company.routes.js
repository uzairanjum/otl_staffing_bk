const express = require('express');
const router = express.Router();
const companyController = require('./company.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/company:
 *   get:
 *     summary: Get company details
 *     description: Get the authenticated user's company information
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   put:
 *     summary: Update company
 *     description: Update company information
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyUpdate'
 *     responses:
 *       200:
 *         description: Company updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/', authenticate, companyController.getCompany);
router.put('/', authenticate, validate(schemas.companyUpdate), companyController.updateCompany);

/**
 * @swagger
 * /api/company/roles:
 *   get:
 *     summary: List company roles
 *     description: Get all roles defined for the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search role names (case-insensitive)
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
 *     responses:
 *       200:
 *         description: List of roles
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Create role
 *     description: Create a new company role
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyRole'
 *     responses:
 *       201:
 *         description: Role created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/roles', authenticate, companyController.getRoles);
router.post('/roles', authenticate, validate(schemas.companyRole), companyController.createRole);

/**
 * @swagger
 * /api/company/roles/{id}:
 *   put:
 *     summary: Update role
 *     description: Update an existing company role
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyRole'
 *     responses:
 *       200:
 *         description: Role updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   delete:
 *     summary: Delete role
 *     description: Delete a company role
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/roles/:id', authenticate, validate(schemas.companyRole), companyController.updateRole);
router.delete('/roles/:id', authenticate, companyController.deleteRole);

/**
 * @swagger
 * /api/company/role-categories:
 *   get:
 *     summary: List role categories
 *     description: Get all role categories for the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of role categories
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Create role category
 *     description: Create a new role category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleCategory'
 *     responses:
 *       201:
 *         description: Role category created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/role-categories', authenticate, companyController.getRoleCategories);
router.post('/role-categories', authenticate, validate(schemas.roleCategory), companyController.createRoleCategory);

/**
 * @swagger
 * /api/company/role-categories/{id}:
 *   put:
 *     summary: Update role category
 *     description: Update an existing role category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleCategory'
 *     responses:
 *       200:
 *         description: Role category updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   delete:
 *     summary: Delete role category
 *     description: Delete a role category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Role category deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/role-categories/:id', authenticate, validate(schemas.roleCategory), companyController.updateRoleCategory);
router.delete('/role-categories/:id', authenticate, companyController.deleteRoleCategory);

/**
 * @swagger
 * /api/company/training-categories:
 *   get:
 *     summary: List training categories
 *     description: Get all training categories for the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of training categories
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   post:
 *     summary: Create training category
 *     description: Create a new training category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrainingCategory'
 *     responses:
 *       201:
 *         description: Training category created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/training-categories', authenticate, companyController.getTrainingCategories);
router.post('/training-categories', authenticate, validate(schemas.trainingCategory), companyController.createTrainingCategory);

/**
 * @swagger
 * /api/company/training-categories/{id}:
 *   put:
 *     summary: Update training category
 *     description: Update an existing training category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrainingCategory'
 *     responses:
 *       200:
 *         description: Training category updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   delete:
 *     summary: Delete training category
 *     description: Delete a training category
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Training category deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/training-categories/:id', authenticate, validate(schemas.trainingCategory), companyController.updateTrainingCategory);
router.delete('/training-categories/:id', authenticate, companyController.deleteTrainingCategory);

/**
 * @swagger
 * /api/company/working-hours:
 *   get:
 *     summary: Get standard working hours
 *     description: Get the company's standard working hours configuration
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Working hours configuration
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 * 
 *   put:
 *     summary: Update working hours
 *     description: Update the company's standard working hours
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               working_hours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day_of_week:
 *                       type: number
 *                     start_time:
 *                       type: string
 *                     end_time:
 *                       type: string
 *     responses:
 *       200:
 *         description: Working hours updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/working-hours', authenticate, companyController.getWorkingHours);
router.put('/working-hours', authenticate, companyController.updateWorkingHours);

/**
 * @swagger
 * /api/company/dashboard:
 *   get:
 *     summary: Get company dashboard data
 *     description: Fast dashboard payload for the admin dashboard page
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard', authenticate, companyController.getDashboard);

/**
 * @swagger
 * /api/company/stats:
 *   get:
 *     summary: Get company statistics
 *     description: Get statistics for the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company statistics
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/stats', authenticate, companyController.getStats);

module.exports = router;
