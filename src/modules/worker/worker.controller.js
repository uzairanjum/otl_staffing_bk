const workerService = require('./worker.service');
const { AppError } = require('../../common/middleware/error.middleware');

class WorkerController {
  async inviteWorker(req, res, next) {
    try {
      const result = await workerService.inviteWorker(req.company_id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkers(req, res, next) {
    try {
      const workers = await workerService.getWorkers(req.company_id, req.query);
      res.json(workers);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorker(req, res, next) {
    try {
      const worker = await workerService.getWorker(req.params.id, req.company_id);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateWorker(req, res, next) {
    try {
      const worker = await workerService.updateWorker(req.params.id, req.company_id, req.body);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async approveWorker(req, res, next) {
    try {
      const worker = await workerService.approveWorker(req.params.id, req.company_id, req.user._id);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async suspendWorker(req, res, next) {
    try {
      const worker = await workerService.suspendWorker(req.params.id, req.company_id);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkerFiles(req, res, next) {
    try {
      const files = await workerService.getWorkerFiles(req.params.id, req.company_id);
      res.json(files);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async uploadWorkerFile(req, res, next) {
    try {
      const file = await workerService.uploadWorkerFile(req.params.id, req.company_id, req.body);
      res.status(201).json(file);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteWorkerFile(req, res, next) {
    try {
      const result = await workerService.deleteWorkerFile(req.params.id, req.company_id, req.params.fileId);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getOnboardingStatus(req, res, next) {
    try {
      const status = await workerService.getOnboardingStatus(req.user.worker_id._id, req.company_id);
      res.json(status);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async submitContract(req, res, next) {
    try {
      const worker = await workerService.submitContract(req.user.worker_id._id, req.company_id, req.body.name);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateOnboardingStep(req, res, next) {
    try {
      const { step } = req.params;
      const worker = await workerService.updateOnboardingStep(req.user.worker_id._id, req.company_id, parseInt(step), req.body);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async requestTimeOff(req, res, next) {
    try {
      const timeOff = await workerService.requestTimeOff(req.user.worker_id._id, req.company_id, req.body);
      res.status(201).json(timeOff);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getMyTimeOffs(req, res, next) {
    try {
      const timeOffs = await workerService.getMyTimeOffs(req.user.worker_id._id);
      res.json(timeOffs);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async cancelTimeOff(req, res, next) {
    try {
      const timeOff = await workerService.cancelTimeOff(req.params.id, req.user.worker_id._id);
      res.json(timeOff);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkerTimeOffs(req, res, next) {
    try {
      const timeOffs = await workerService.getWorkerTimeOffs(req.params.id, req.company_id);
      res.json(timeOffs);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new WorkerController();
