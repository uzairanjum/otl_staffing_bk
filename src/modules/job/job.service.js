const Job = require('./Job');
const Shift = require('../shift/Shift');
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
    const jobs = await Job.find(query).populate('client_id').sort({ createdAt: -1 }).lean();
    if (!jobs.length) {
      return [];
    }

    const jobIds = jobs.map((j) => j._id);
    const shiftStats = await Shift.aggregate([
      {
        $match: {
          company_id: companyId,
          job_id: { $in: jobIds },
        },
      },
      {
        $group: {
          _id: '$job_id',
          total_shifts: { $sum: 1 },
          active_shifts: {
            $sum: {
              $cond: [
                { $in: ['$status', ['draft', 'published', 'in_progress']] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const byJobId = Object.fromEntries(
      shiftStats.map((row) => [String(row._id), row])
    );

    return jobs.map((j) => {
      const stats = byJobId[String(j._id)];
      return {
        ...j,
        total_shifts: stats?.total_shifts ?? 0,
        active_shifts: stats?.active_shifts ?? 0,
      };
    });
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
