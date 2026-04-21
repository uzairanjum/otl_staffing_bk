const config = require('../../config');
const { uploadBufferToCloudinary } = require('../../config/cloudinary');
const workerService = require('./worker.service');
const trainingService = require('../company/training.service');
const WorkerFile = require('./WorkerFile');
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

  async getApprovedWorkers(req, res, next) {
    try {
      const workers = await workerService.getApprovedWorkers(req.company_id);
      res.json(workers);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getApprovedWorkerLocationFacets(req, res, next) {
    try {
      const result = await workerService.getApprovedWorkerLocationFacets(req.company_id, req.query);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getActiveWorkersRoleBased(req, res, next) {
    try {
      const companyRoleId = req.query.company_role_id;
      const workers = await workerService.getActiveWorkersRoleBased(req.company_id, companyRoleId);
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

  async deleteWorker(req, res, next) {
    try {
      const result = await workerService.deleteWorker(req.params.id, req.company_id);
      res.status(200).json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async saveOnboardingBasicInfo(req, res, next) {
    try {
      const payload = await workerService.saveOnboardingBasicInfo(
        req.params.id,
        req.company_id,
        req.body
      );
      res.json(payload);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async saveOnboardingWorkingHours(req, res, next) {
    try {
      const payload = await workerService.saveOnboardingWorkingHours(
        req.params.id,
        req.company_id,
        req.body
      );
      res.json(payload);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async saveOnboardingDocumentsTrainings(req, res, next) {
    try {
      const payload = await workerService.saveOnboardingDocumentsTrainings(
        req.params.id,
        req.company_id
      );
      res.json(payload);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async completeOnboarding(req, res, next) {
    try {
      const payload = await workerService.completeOnboarding(req.params.id, req.company_id);
      res.json(payload);
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

  async inactiveWorker(req, res, next) {
    try {
      const worker = await workerService.inactiveWorker(req.params.id, req.company_id);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  // Backward-compatible alias; prefer inactiveWorker.
  async suspendWorker(req, res, next) {
    return this.inactiveWorker(req, res, next);
  }

  async activateWorker(req, res, next) {
    try {
      const worker = await workerService.activateWorker(req.params.id, req.company_id, req.user._id);
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

  async uploadWorkerTrainingDocumentMultipart(req, res, next) {
    try {
      if (!req.file?.buffer) {
        next(new AppError('File is required', 400));
        return;
      }
      const { training_id, worker_training_id, document_type } = req.body;
      if (!training_id || !worker_training_id) {
        next(new AppError('training_id and worker_training_id are required', 400));
        return;
      }
      if (
        !config.cloudinary?.cloudName ||
        !config.cloudinary?.apiKey ||
        !config.cloudinary?.apiSecret
      ) {
        next(new AppError('File storage is not configured', 503));
        return;
      }

      const { url, publicId } = await uploadBufferToCloudinary(
        req.file.buffer,
        `workers/${req.params.id}/training-documents`
      );

      const saved = await trainingService.uploadTrainingDocument(
        training_id,
        req.params.id,
        req.company_id,
        {
          worker_training_id,
          file_url: url,
          cloudinary_public_id: publicId,
          document_type: document_type || undefined,
        }
      );
      res.status(201).json(saved);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async uploadWorkerFileMultipart(req, res, next) {
    try {
      if (!req.file?.buffer) {
        next(new AppError('File is required', 400));
        return;
      }
      const file_type = req.body.file_type;
      if (!file_type || !WorkerFile.FILE_TYPES.includes(file_type)) {
        next(new AppError('Invalid or missing file_type', 400));
        return;
      }
      if (
        !config.cloudinary?.cloudName ||
        !config.cloudinary?.apiKey ||
        !config.cloudinary?.apiSecret
      ) {
        next(new AppError('File storage is not configured', 503));
        return;
      }

      const { url, publicId } = await uploadBufferToCloudinary(
        req.file.buffer,
        `workers/${req.params.id}/documents`
      );

      const saved = await workerService.uploadWorkerFile(req.params.id, req.company_id, {
        file_type,
        file_url: url,
        cloudinary_public_id: publicId,
      });
      res.status(201).json(saved);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateWorkerFilesMeta(req, res, next) {
    try {
      const bundle = await workerService.updateWorkerFilesMeta(
        req.params.id,
        req.company_id,
        req.body
      );
      res.json(bundle);
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

  async getWorkerFileViewUrl(req, res, next) {
    try {
      const url = await workerService.getWorkerFileViewUrl(
        req.params.id,
        req.company_id,
        req.params.fileId
      );
      res.json({ url });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkerTrainingDocumentViewUrl(req, res, next) {
    try {
      const url = await workerService.getWorkerTrainingDocumentViewUrl(
        req.params.id,
        req.company_id,
        req.params.docId
      );
      res.json({ url });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getOnboardingStatus(req, res, next) {
    try {
      const status = await workerService.getOnboardingStatus(req.user._id, req.company_id);
      res.json(status);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async submitContract(req, res, next) {
    try {
      const worker = await workerService.submitContract(req.user._id, req.company_id, req.body.name);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateOnboardingStep(req, res, next) {
    try {
      const { step } = req.params;
      const worker = await workerService.updateOnboardingStep(req.user._id, req.company_id, parseInt(step), req.body);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async requestTimeOff(req, res, next) {
    try {
      const timeOff = await workerService.requestTimeOff(req.user._id, req.company_id, req.body);
      res.status(201).json(timeOff);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getMyTimeOffs(req, res, next) {
    try {
      const timeOffs = await workerService.getMyTimeOffs(req.user._id);
      res.json(timeOffs);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async cancelTimeOff(req, res, next) {
    try {
      const timeOff = await workerService.cancelTimeOff(req.params.id, req.user._id);
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

  async getMyProfile(req, res, next) {
    try {
      const worker = await workerService.getWorker(req.user._id, req.company_id);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateMyProfile(req, res, next) {
    try {
      const worker = await workerService.updateWorker(req.user._id, req.company_id, req.body);
      res.json(worker);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getMyWorkerFileViewUrl(req, res, next) {
    try {
      const url = await workerService.getWorkerFileViewUrl(
        req.user._id,
        req.company_id,
        req.params.fileId
      );
      res.json({ url });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getMyTrainingDocumentViewUrl(req, res, next) {
    try {
      const url = await workerService.getWorkerTrainingDocumentViewUrl(
        req.user._id,
        req.company_id,
        req.params.docId
      );
      res.json({ url });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new WorkerController();
