const express = require('express');
const router = express.Router();
const companyController = require('./company.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', companyController.getCompany);
router.put('/', validate(schemas.companyUpdate), companyController.updateCompany);

router.get('/roles', companyController.getRoles);
router.post('/roles', validate(schemas.companyRole), companyController.createRole);
router.put('/roles/:id', validate(schemas.companyRole), companyController.updateRole);
router.delete('/roles/:id', companyController.deleteRole);

router.get('/role-categories', companyController.getRoleCategories);
router.post('/role-categories', validate(schemas.roleCategory), companyController.createRoleCategory);
router.put('/role-categories/:id', validate(schemas.roleCategory), companyController.updateRoleCategory);
router.delete('/role-categories/:id', companyController.deleteRoleCategory);

router.get('/training-categories', companyController.getTrainingCategories);
router.post('/training-categories', validate(schemas.trainingCategory), companyController.createTrainingCategory);
router.put('/training-categories/:id', validate(schemas.trainingCategory), companyController.updateTrainingCategory);
router.delete('/training-categories/:id', companyController.deleteTrainingCategory);

router.get('/working-hours', companyController.getWorkingHours);
router.put('/working-hours', companyController.updateWorkingHours);
router.get('/stats', companyController.getStats);

module.exports = router;
