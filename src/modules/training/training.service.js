const Training = require('./Training');
const WorkerTraining = require('./WorkerTraining');
const WorkerTrainingDocument = require('./WorkerTrainingDocument');
const { AppError } = require('../../common/middleware/error.middleware');

class TrainingService {
  async getTrainings(companyId) {
    return Training.find({ company_id: companyId, is_active: true });
  }

  async createTraining(companyId, data) {
    const training = await Training.create({
      ...data,
      company_id: companyId
    });
    return training;
  }

  async updateTraining(trainingId, companyId, data) {
    const training = await Training.findOneAndUpdate(
      { _id: trainingId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!training) {
      throw new AppError('Training not found', 404);
    }
    return training;
  }

  async deleteTraining(trainingId, companyId) {
    const training = await Training.findOneAndUpdate(
      { _id: trainingId, company_id: companyId },
      { is_active: false },
      { new: true }
    );
    if (!training) {
      throw new AppError('Training not found', 404);
    }
    return training;
  }

  async assignTraining(trainingId, workerId, companyId) {
    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    const existing = await WorkerTraining.findOne({
      training_id: trainingId,
      worker_id: workerId
    });
    if (existing) {
      throw new AppError('Worker already assigned to this training', 400);
    }

    const workerTraining = await WorkerTraining.create({
      training_id: trainingId,
      worker_id: workerId,
      status: 'assigned'
    });

    return workerTraining;
  }

  async updateWorkerTrainingStatus(trainingId, workerId, companyId, status) {
    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    const workerTraining = await WorkerTraining.findOneAndUpdate(
      { training_id: trainingId, worker_id: workerId },
      { 
        status,
        ...(status === 'completed' ? { completed_at: new Date() } : {})
      },
      { new: true }
    );
    
    if (!workerTraining) {
      throw new AppError('Worker training not found', 404);
    }

    return workerTraining;
  }

  async uploadTrainingDocument(trainingId, workerId, companyId, documentData) {
    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    const workerTraining = await WorkerTraining.findOne({
      training_id: trainingId,
      worker_id: workerId
    });
    
    if (!workerTraining) {
      throw new AppError('Worker not assigned to this training', 404);
    }

    const document = await WorkerTrainingDocument.create({
      worker_training_id: workerTraining._id,
      file_url: documentData.file_url,
      cloudinary_public_id: documentData.cloudinary_public_id,
      document_type: documentData.document_type
    });

    workerTraining.status = 'in_progress';
    await workerTraining.save();

    return document;
  }

  async getWorkerTrainings(workerId, companyId) {
    return WorkerTraining.find({ worker_id: workerId })
      .populate('training_id');
  }
}

module.exports = new TrainingService();
