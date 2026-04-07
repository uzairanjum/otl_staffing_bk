const Job = require('./Job');
const { AppError } = require('../../common/middleware/error.middleware');

class JobService {
  async getJobs(companyId, filters = {}) {
    const query = { company_id: companyId };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.client_id) {
      query.client_id = filters.client_id;
    }
    return Job.find(query).populate('client_id').sort({ createdAt: -1 });
  }

  async createJob(companyId, data) {
    const job = await Job.create({
      ...data,
      company_id: companyId
    });
    return job.populate('client_id');
  }

  async getJob(jobId, companyId) {
    const job = await Job.findOne({ _id: jobId, company_id: companyId }).populate('client_id');
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }

  async updateJob(jobId, companyId, data) {
    const job = await Job.findOneAndUpdate(
      { _id: jobId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    ).populate('client_id');
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }

  async deleteJob(jobId, companyId) {
    const job = await Job.findOneAndUpdate(
      { _id: jobId, company_id: companyId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }
}

module.exports = new JobService();
