const trainingService = require('./training.service');
const { AppError } = require('../../common/middleware/error.middleware');

class TrainingController {
  async getTrainings(req, res, next) {
    try {
      const trainings = await trainingService.getTrainings(req.company_id);
      res.json(trainings);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getInactiveTrainings(req, res, next) {
    try {
      const trainings = await trainingService.getInactiveTrainings(req.company_id);
      res.json(trainings);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createTraining(req, res, next) {
    try {
      const training = await trainingService.createTraining(req.company_id, req.body);
      res.status(201).json(training);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateTraining(req, res, next) {
    try {
      const training = await trainingService.updateTraining(req.params.id, req.company_id, req.body);
      res.json(training);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteTraining(req, res, next) {
    try {
      await trainingService.deleteTraining(req.params.id, req.company_id);
      res.json({ message: 'Training deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async assignTraining(req, res, next) {
    try {
      const { workerId } = req.params;
      const workerTraining = await trainingService.assignTraining(req.params.id, workerId, req.company_id);
      res.status(201).json(workerTraining);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateWorkerTrainingStatus(req, res, next) {
    try {
      const { workerId } = req.params;
      const { status } = req.body;
      const workerTraining = await trainingService.updateWorkerTrainingStatus(req.params.id, workerId, req.company_id, status);
      res.json(workerTraining);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async uploadTrainingDocument(req, res, next) {
    try {
      const { workerId } = req.params;
      const document = await trainingService.uploadTrainingDocument(req.params.id, workerId, req.company_id, req.body);
      res.status(201).json(document);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkerTrainings(req, res, next) {
    try {
      const { workerId } = req.params;
      const trainings = await trainingService.getWorkerTrainings(workerId, req.company_id);
      res.json(trainings);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new TrainingController();
