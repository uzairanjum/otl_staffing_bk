const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('worker'));

router.post('/time-off', validate(schemas.timeOff), workerController.requestTimeOff);
router.get('/time-off', workerController.getMyTimeOffs);
router.delete('/time-off/:id', workerController.cancelTimeOff);

module.exports = router;
