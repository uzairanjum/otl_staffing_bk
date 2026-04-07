const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.post('/', authenticate, requireRole('admin'), validate(schemas.inviteWorker), workerController.inviteWorker);
router.get('/', authenticate, requireRole('admin'), workerController.getWorkers);
router.get('/:id', authenticate, requireRole('admin'), workerController.getWorker);
router.put('/:id', authenticate, requireRole('admin'), workerController.updateWorker);
router.put('/:id/approve', authenticate, requireRole('admin'), workerController.approveWorker);
router.put('/:id/suspend', authenticate, requireRole('admin'), workerController.suspendWorker);
router.get('/:id/files', authenticate, requireRole('admin'), workerController.getWorkerFiles);
router.post('/:id/files', authenticate, requireRole('admin'), workerController.uploadWorkerFile);
router.delete('/:id/files/:fileId', authenticate, requireRole('admin'), workerController.deleteWorkerFile);
router.get('/:id/time-off', authenticate, requireRole('admin'), workerController.getWorkerTimeOffs);

module.exports = router;
