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
router.get('/working-hours', companyController.getWorkingHours);
router.put('/working-hours', companyController.updateWorkingHours);
router.get('/stats', companyController.getStats);

module.exports = router;
