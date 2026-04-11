const mongoose = require('mongoose');
const Training = require('./Training');
const WorkerTraining = require('../worker/WorkerTraining');
const WorkerTrainingDocument = require('../worker/WorkerTrainingDocument');
const { AppError } = require('../../common/middleware/error.middleware');

function toObjectId(id) {
  if (id == null) return id;
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
}

class TrainingService {
  async getTrainings(companyId) {
    return Training.find({ company_id: companyId }).sort({ updatedAt: -1 });
  }

  async getInactiveTrainings(companyId) {
    return Training.find({ company_id: companyId, is_active: false }).sort({ updatedAt: -1 });
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

  async assignTraining(trainingId, workerUserId, companyId) {
    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    let doc = await WorkerTraining.findOne({
      worker_id: workerUserId,
      company_id: companyId,
    });

    if (!doc) {
      doc = await WorkerTraining.create({
        company_id: companyId,
        worker_id: workerUserId,
        trainings: [{ training_id: trainingId, status: 'assigned', role_ids: [] }],
      });
      return doc;
    }

    const exists = doc.trainings.some(
      (t) => String(t.training_id) === String(trainingId)
    );
    if (exists) {
      throw new AppError('Worker already assigned to this training', 400);
    }

    doc.trainings.push({ training_id: trainingId, status: 'assigned', role_ids: [] });
    await doc.save();
    return doc;
  }

  async updateWorkerTrainingStatus(trainingId, workerUserId, companyId, status) {
    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    const doc = await WorkerTraining.findOne({
      worker_id: workerUserId,
      company_id: companyId,
    });
    if (!doc) {
      throw new AppError('Worker training not found', 404);
    }

    const entry = doc.trainings.find((t) => String(t.training_id) === String(trainingId));
    if (!entry) {
      throw new AppError('Worker training not found', 404);
    }

    entry.status = status;
    if (status === 'completed') {
      entry.completed_at = new Date();
    } else if (status !== 'completed') {
      entry.completed_at = undefined;
    }
    await doc.save();
    return doc;
  }

  async uploadTrainingDocument(trainingId, workerUserId, companyId, documentData) {
    if (!documentData.worker_training_id) {
      throw new AppError('worker_training_id is required', 400);
    }

    const training = await Training.findOne({ _id: trainingId, company_id: companyId });
    if (!training) {
      throw new AppError('Training not found', 404);
    }

    const wtDoc = await WorkerTraining.findOne({
      worker_id: workerUserId,
      company_id: companyId,
    });

    if (!wtDoc) {
      throw new AppError('Worker not assigned to this training', 404);
    }

    const entry = wtDoc.trainings.find((t) => String(t._id) === String(documentData.worker_training_id));
    if (!entry) {
      throw new AppError('Worker training assignment not found', 404);
    }

    if (String(entry.training_id) !== String(trainingId)) {
      throw new AppError('Training does not match assignment', 400);
    }

    if (!documentData.file_url) {
      throw new AppError('file_url is required', 400);
    }

    const workerOid = toObjectId(workerUserId);
    const companyOid = toObjectId(companyId);
    const trainingOid = toObjectId(trainingId);
    const assignmentOid = toObjectId(entry._id);

    const fileEntry = {
      training_id: trainingOid,
      file_url: documentData.file_url,
      cloudinary_public_id: documentData.cloudinary_public_id,
      document_type: documentData.document_type,
      uploaded_at: documentData.uploaded_at ? new Date(documentData.uploaded_at) : new Date(),
    };

    let bundle = await WorkerTrainingDocument.findOne({
      worker_id: workerOid,
      company_id: companyOid,
      worker_training_id: assignmentOid,
    });

    if (!bundle) {
      bundle = await WorkerTrainingDocument.create({
        worker_id: workerOid,
        company_id: companyOid,
        worker_training_id: assignmentOid,
        documents: [fileEntry],
      });
    } else {
      bundle.documents = (bundle.documents || []).filter(
        (d) => String(d.training_id) !== String(trainingOid)
      );
      bundle.documents.push(fileEntry);
      await bundle.save();
    }

    entry.status = 'in_progress';
    await wtDoc.save();

    return bundle;
  }

  async getWorkerTrainings(workerUserId, companyId) {
    const doc = await WorkerTraining.findOne({
      worker_id: workerUserId,
      company_id: companyId,
    }).populate([
      { path: 'trainings.training_id', select: 'name' },
      { path: 'trainings.role_ids', select: 'name' },
    ]);

    if (!doc) {
      return [];
    }

    return (doc.trainings || []).map((t) => ({
      _id: t._id,
      company_id: doc.company_id,
      worker_id: doc.worker_id,
      training_id: t.training_id,
      role_ids: t.role_ids != null ? t.role_ids : [],
      status: t.status,
      completed_at: t.completed_at,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }
}

module.exports = new TrainingService();
