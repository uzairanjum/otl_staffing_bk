const payrollService = require('./payroll.service');
const { AppError } = require('../../common/middleware/error.middleware');

class PayrollController {
  async submitPayrollReport(req, res, next) {
    try {
      const report = await payrollService.submitPayrollReport(
        req.user._id,
        req.company_id,
        req.body
      );
      res.status(201).json(report);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkerPayrollReports(req, res, next) {
    try {
      const reports = await payrollService.getWorkerPayrollReports(req.user._id);
      res.json(reports);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getPayrollReports(req, res, next) {
    try {
      const reports = await payrollService.getPayrollReports(req.company_id, req.query);
      res.json(reports);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getPayrollReport(req, res, next) {
    try {
      const report = await payrollService.getPayrollReport(req.params.id, req.company_id);
      res.json(report);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async approvePayrollReport(req, res, next) {
    try {
      const report = await payrollService.approvePayrollReport(
        req.params.id,
        req.company_id,
        req.user._id
      );
      res.json(report);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async modifyPayrollReport(req, res, next) {
    try {
      const report = await payrollService.modifyPayrollReport(
        req.params.id,
        req.company_id,
        req.user._id,
        req.body.entries
      );
      res.json(report);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async markAsPaid(req, res, next) {
    try {
      const report = await payrollService.markAsPaid(req.params.id, req.company_id);
      res.json(report);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new PayrollController();
