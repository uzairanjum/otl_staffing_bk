const express = require('express');
const router = express.Router();
const shiftController = require('./shift.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', shiftController.getShifts);
router.post('/', validate(schemas.shift), shiftController.createShift);
router.get('/:id', shiftController.getShift);
router.put('/:id', shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);
router.post('/:id/publish', shiftController.publishShift);

router.post('/:shiftId/positions', validate(schemas.shiftPosition), shiftController.addPosition);
router.put('/:shiftId/positions/:positionId', shiftController.updatePosition);
router.delete('/:shiftId/positions/:positionId', shiftController.deletePosition);

router.get('/:shiftId/positions/:positionId/requests', shiftController.getPositionRequests);
router.post('/:shiftId/positions/:positionId/requests/:workerId/approve', shiftController.approveWorkerRequest);
router.post('/:shiftId/positions/:positionId/requests/:workerId/reject', shiftController.rejectWorkerRequest);

router.post('/:shiftId/positions/:positionId/assign', shiftController.assignWorker);
router.post('/:shiftId/positions/:positionId/unassign', shiftController.unassignWorker);

module.exports = router;
