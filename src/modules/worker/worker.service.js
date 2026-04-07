const User = require('../../common/models/User');
const Worker = require('./Worker');
const WorkerAddress = require('./WorkerAddress');
const WorkerTaxInfo = require('./WorkerTaxInfo');
const WorkerBankDetail = require('./WorkerBankDetail');
const WorkerRole = require('./WorkerRole');
const WorkerWorkingHours = require('./WorkerWorkingHours');
const WorkerFile = require('./WorkerFile');
const TimeOffRequest = require('./TimeOffRequest');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const { v4: uuidv4 } = require('uuid');

class WorkerService {
  generateTempPassword() {
    return uuidv4().slice(0, 8) + 'A1!';
  }

  async inviteWorker(companyId, data) {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const worker = await Worker.create({
      company_id: companyId,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      status: 'invited'
    });

    const tempPassword = this.generateTempPassword();

    const user = await User.create({
      company_id: companyId,
      email: data.email.toLowerCase(),
      password_hash: tempPassword,
      role: 'worker',
      worker_id: worker._id,
      first_login: true
    });

    await sendEmailWithTemplate(data.email, 'Welcome to OTL Staffing', 'invitation', {
      name: `${data.first_name} ${data.last_name}`,
      email: data.email,
      tempPassword: tempPassword,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });

    if (data.role_ids && data.role_ids.length > 0) {
      await WorkerRole.create(
        data.role_ids.map(roleId => ({
          worker_id: worker._id,
          company_role_id: roleId
        }))
      );
    }

    return { worker, user };
  }

  async getWorkers(companyId, filters = {}) {
    const query = { company_id: companyId };
    
    if (filters.status) {
      query.status = filters.status;
    }

    return Worker.find(query).populate('worker_roles').sort({ createdAt: -1 });
  }

  async getWorker(workerId, companyId) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId })
      .populate('worker_roles.company_role_id');
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    const [address, taxInfo, bankDetail, workingHours, files, timeOffs] = await Promise.all([
      WorkerAddress.findOne({ worker_id: workerId }),
      WorkerTaxInfo.findOne({ worker_id: workerId }),
      WorkerBankDetail.findOne({ worker_id: workerId }),
      WorkerWorkingHours.find({ worker_id: workerId }),
      WorkerFile.find({ worker_id: workerId }),
      TimeOffRequest.find({ worker_id: workerId, status: 'active' })
    ]);

    return {
      ...worker.toObject(),
      address,
      tax_info: taxInfo,
      bank_detail: bankDetail,
      working_hours: workingHours,
      files,
      time_offs: timeOffs
    };
  }

  async updateWorker(workerId, companyId, data) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    if (worker.status === 'active') {
      const allowedFields = ['phone'];
      const updateData = {};
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      }
      if (Object.keys(updateData).length > 0) {
        await Worker.findByIdAndUpdate(workerId, updateData);
      }
      return this.getWorker(workerId, companyId);
    }

    Object.assign(worker, data);
    await worker.save();
    
    return this.getWorker(workerId, companyId);
  }

  async approveWorker(workerId, companyId, approvedBy) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    worker.status = 'active';
    worker.approved_by = approvedBy;
    worker.approved_at = new Date();
    await worker.save();

    return worker;
  }

  async suspendWorker(workerId, companyId) {
    const worker = await Worker.findOneAndUpdate(
      { _id: workerId, company_id: companyId },
      { status: 'suspended' },
      { new: true }
    );
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    return worker;
  }

  async getWorkerFiles(workerId, companyId) {
    await this.getWorker(workerId, companyId);
    return WorkerFile.find({ worker_id: workerId });
  }

  async uploadWorkerFile(workerId, companyId, fileData) {
    await this.getWorker(workerId, companyId);
    
    const file = await WorkerFile.create({
      worker_id: workerId,
      file_type: fileData.file_type,
      file_url: fileData.file_url,
      cloudinary_public_id: fileData.cloudinary_public_id
    });

    return file;
  }

  async deleteWorkerFile(workerId, companyId, fileId) {
    await this.getWorker(workerId, companyId);
    
    const file = await WorkerFile.findOneAndDelete({ _id: fileId, worker_id: workerId });
    
    if (!file) {
      throw new AppError('File not found', 404);
    }

    return { message: 'File deleted successfully' };
  }

  async getOnboardingStatus(workerId, companyId) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    return {
      status: worker.status,
      onboarding_step: worker.onboarding_step,
      contract_signed: worker.contract_signed
    };
  }

  async submitContract(workerId, companyId, name) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    if (worker.contract_signed) {
      throw new AppError('Contract already signed', 400);
    }

    const fullName = `${worker.first_name} ${worker.last_name}`.toLowerCase();
    if (name.toLowerCase() !== fullName) {
      throw new AppError('Name does not match', 400);
    }

    worker.contract_signed = true;
    worker.contract_signed_at = new Date();
    worker.onboarding_step = 1;
    worker.status = 'onboarding';
    await worker.save();

    return worker;
  }

  async updateOnboardingStep(workerId, companyId, step, data) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    if (worker.status === 'active' || worker.status === 'pending_approval') {
      throw new AppError('Onboarding already completed', 400);
    }

    switch(step) {
      case 1:
        await WorkerAddress.findOneAndUpdate(
          { worker_id: workerId },
          { worker_id: workerId, ...data },
          { upsert: true }
        );
        break;
      case 2:
        await WorkerTaxInfo.findOneAndUpdate(
          { worker_id: workerId },
          { worker_id: workerId, ...data },
          { upsert: true }
        );
        if (data.bank_name) {
          await WorkerBankDetail.findOneAndUpdate(
            { worker_id: workerId },
            { worker_id: workerId, ...data },
            { upsert: true }
          );
        }
        break;
      case 3:
        if (data.company_role_id) {
          await WorkerRole.findOneAndUpdate(
            { worker_id: workerId },
            { worker_id: workerId, company_role_id: data.company_role_id, hourly_rate_override: data.hourly_rate_override },
            { upsert: true }
          );
        }
        break;
      case 4:
        if (data.availability && data.availability.length > 0) {
          await WorkerWorkingHours.deleteMany({ worker_id: workerId });
          await WorkerWorkingHours.create(
            data.availability.map(h => ({
              worker_id: workerId,
              day_of_week: h.day_of_week,
              start_time: h.start_time,
              end_time: h.end_time
            }))
          );
        }
        break;
      case 5:
        break;
      case 6:
        break;
      default:
        throw new AppError('Invalid step', 400);
    }

    if (step < 6) {
      worker.onboarding_step = step + 1;
    } else {
      worker.status = 'pending_approval';
    }
    await worker.save();

    return worker;
  }

  async requestTimeOff(workerId, companyId, data) {
    const worker = await Worker.findOne({ _id: workerId, company_id: companyId });
    
    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    const timeOff = await TimeOffRequest.create({
      worker_id: workerId,
      company_id: companyId,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason
    });

    return timeOff;
  }

  async getMyTimeOffs(workerId) {
    return TimeOffRequest.find({ worker_id: workerId }).sort({ createdAt: -1 });
  }

  async cancelTimeOff(timeOffId, workerId) {
    const timeOff = await TimeOffRequest.findOneAndUpdate(
      { _id: timeOffId, worker_id: workerId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!timeOff) {
      throw new AppError('Time off not found', 404);
    }

    return timeOff;
  }

  async getWorkerTimeOffs(workerId, companyId) {
    await this.getWorker(workerId, companyId);
    return TimeOffRequest.find({ worker_id: workerId }).sort({ createdAt: -1 });
  }
}

module.exports = new WorkerService();
