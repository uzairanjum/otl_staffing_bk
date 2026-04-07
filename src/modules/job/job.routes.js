const express = require('express');
const router = express.Router();
const jobController = require('./job.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', jobController.getJobs);
router.post('/', validate(schemas.job), jobController.createJob);
router.get('/:id', jobController.getJob);
router.put('/:id', jobController.updateJob);
router.delete('/:id', jobController.deleteJob);

module.exports = router;
