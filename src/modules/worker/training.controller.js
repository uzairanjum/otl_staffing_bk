const trainingService = require('../company/training.service');
const { AppError } = require('../../common/middleware/error.middleware');

class WorkerTrainingController {
  async getMyTrainings(req, res, next) {
    try {
      const workerId = req.user._id;
      const trainings = await trainingService.getWorkerTrainings(workerId, req.company_id);
      res.json(trainings);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async uploadMyTrainingDocument(req, res, next) {
    try {
      const workerId = req.user._id;
      const { id: trainingId } = req.params;
      const document = await trainingService.uploadTrainingDocument(trainingId, workerId, req.company_id, req.body);
      res.status(201).json(document);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateMyTrainingStatus(req, res, next) {
    try {
      const workerId = req.user._id;
      const { id: trainingId } = req.params;
      const { status } = req.body;
      const workerTraining = await trainingService.updateWorkerTrainingStatus(
        trainingId,
        workerId,
        req.company_id,
        status
      );
      res.json(workerTraining);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new WorkerTrainingController();
