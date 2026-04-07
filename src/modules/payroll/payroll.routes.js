const express = require('express');
const router = express.Router();
const payrollController = require('./payroll.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.post('/reports', authenticate, requireRole('worker'), validate(schemas.payrollReport), payrollController.submitPayrollReport);
router.get('/reports', authenticate, requireRole('worker'), payrollController.getWorkerPayrollReports);

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/reports', payrollController.getPayrollReports);
router.get('/reports/:id', payrollController.getPayrollReport);
router.put('/reports/:id/approve', payrollController.approvePayrollReport);
router.put('/reports/:id/modify', payrollController.modifyPayrollReport);
router.put('/reports/:id/paid', payrollController.markAsPaid);

module.exports = router;
