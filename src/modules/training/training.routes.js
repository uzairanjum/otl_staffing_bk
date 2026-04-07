const express = require('express');
const router = express.Router();
const trainingController = require('./training.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', trainingController.getTrainings);
router.post('/', validate(schemas.training), trainingController.createTraining);
router.put('/:id', trainingController.updateTraining);
router.delete('/:id', trainingController.deleteTraining);
router.post('/:id/assign/:workerId', trainingController.assignTraining);
router.put('/:id/assign/:workerId', trainingController.updateWorkerTrainingStatus);
router.post('/:id/assign/:workerId/documents', trainingController.uploadTrainingDocument);
router.get('/worker/:workerId', trainingController.getWorkerTrainings);

module.exports = router;
