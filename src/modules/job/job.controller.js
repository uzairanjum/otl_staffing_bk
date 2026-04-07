const jobService = require('./job.service');
const { AppError } = require('../../common/middleware/error.middleware');

class JobController {
  async getJobs(req, res, next) {
    try {
      const jobs = await jobService.getJobs(req.company_id, req.query);
      res.json(jobs);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createJob(req, res, next) {
    try {
      const job = await jobService.createJob(req.company_id, req.body);
      res.status(201).json(job);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getJob(req, res, next) {
    try {
      const job = await jobService.getJob(req.params.id, req.company_id);
      res.json(job);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateJob(req, res, next) {
    try {
      const job = await jobService.updateJob(req.params.id, req.company_id, req.body);
      res.json(job);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteJob(req, res, next) {
    try {
      await jobService.deleteJob(req.params.id, req.company_id);
      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new JobController();
