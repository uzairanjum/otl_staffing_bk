const companyService = require('./company.service');
const { AppError } = require('../../common/middleware/error.middleware');
const { filterResponseCache } = require('../../common/utils/filter-response-cache');
const logger = require('../../config/logger');

class CompanyController {
  async getCompany(req, res, next) {
    try {
      logger.debug('Fetching company details', {
        companyId: req.company_id?.toString?.() || req.company_id
      });
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
      const roles = await companyService.getRoles(req.company_id, req.query);
      // Avoid browser/proxy caching of mutable company data (list must refresh after mutations).
      res.set('Cache-Control', 'no-store');
      res.json(roles);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getOnboardingSteps(req, res, next) {
    try {
      const data = await companyService.getOnboardingSteps(req.company_id, req.query);
      res.json(data);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createRole(req, res, next) {
    try {
      logger.debug('Creating role', {
        companyId: req.company_id?.toString?.() || req.company_id,
        hasBody: Boolean(req.body)
      });
      const role = await companyService.createRole(req.company_id, req.body);
      filterResponseCache.invalidateCompanyRoleFilters(req.company_id);
      res.status(201).json(role);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateRole(req, res, next) {
    try {
      const role = await companyService.updateRole(req.params.id, req.company_id, req.body);
      filterResponseCache.invalidateCompanyRoleFilters(req.company_id);
      res.json(role);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteRole(req, res, next) {
    try {
      await companyService.deleteRole(req.params.id, req.company_id);
      filterResponseCache.invalidateCompanyRoleFilters(req.company_id);
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

  async getDashboard(req, res, next) {
    try {
      const dashboard = await companyService.getDashboard(req.company_id);
      res.json(dashboard);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getRoleCategories(req, res, next) {
    try {
      const categories = await companyService.getRoleCategories(req.company_id);
      res.json(categories);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createRoleCategory(req, res, next) {
    try {
      logger.debug('Creating role category', {
        companyId: req.company_id?.toString?.() || req.company_id,
        hasBody: Boolean(req.body)
      });
      const category = await companyService.createRoleCategory(req.company_id, req.body);
      res.status(201).json(category);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateRoleCategory(req, res, next) {
    try {
      const category = await companyService.updateRoleCategory(req.params.id, req.company_id, req.body);
      res.json(category);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteRoleCategory(req, res, next) {
    try {
      await companyService.deleteRoleCategory(req.params.id, req.company_id);
      res.json({ message: 'Role category deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getTrainingCategories(req, res, next) {
    try {
      const categories = await companyService.getTrainingCategories(req.company_id);
      res.json(categories);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createTrainingCategory(req, res, next) {
    try {
      const category = await companyService.createTrainingCategory(req.company_id, req.body);
      res.status(201).json(category);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateTrainingCategory(req, res, next) {
    try {
      const category = await companyService.updateTrainingCategory(req.params.id, req.company_id, req.body);
      res.json(category);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteTrainingCategory(req, res, next) {
    try {
      await companyService.deleteTrainingCategory(req.params.id, req.company_id);
      res.json({ message: 'Training category deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new CompanyController();
