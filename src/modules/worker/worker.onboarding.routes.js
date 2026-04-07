const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('worker'));

router.get('/onboarding/status', workerController.getOnboardingStatus);
router.put('/onboarding/contract', workerController.submitContract);
router.put('/onboarding/step-:step', workerController.updateOnboardingStep);

module.exports = router;
