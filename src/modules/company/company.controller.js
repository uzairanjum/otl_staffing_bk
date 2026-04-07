const companyService = require('./company.service');
const { AppError } = require('../../common/middleware/error.middleware');

class CompanyController {
  async getCompany(req, res, next) {
    try {
      const company = await companyService.getCompany(req.company_id);
      res.json(company);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateCompany(req, res, next) {
    try {
      const company = await companyService.updateCompany(req.company_id, req.body);
      res.json(company);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getRoles(req, res, next) {
    try {
      const roles = await companyService.getRoles(req.company_id);
      res.json(roles);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createRole(req, res, next) {
    try {
      const role = await companyService.createRole(req.company_id, req.body);
      res.status(201).json(role);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateRole(req, res, next) {
    try {
      const role = await companyService.updateRole(req.params.id, req.company_id, req.body);
      res.json(role);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteRole(req, res, next) {
    try {
      await companyService.deleteRole(req.params.id, req.company_id);
      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getWorkingHours(req, res, next) {
    try {
      const hours = await companyService.getWorkingHours(req.company_id);
      res.json(hours);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateWorkingHours(req, res, next) {
    try {
      const hours = await companyService.updateWorkingHours(req.company_id, req.body);
      res.json(hours);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await companyService.getStats(req.company_id);
      res.json(stats);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new CompanyController();
