const shiftService = require('./shift.service');
const { AppError } = require('../../common/middleware/error.middleware');

class ShiftController {
  async getShiftTemplates(req, res, next) {
    try {
      const templates = await shiftService.getShiftTemplates(req.company_id);
      res.json(templates);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createShiftTemplate(req, res, next) {
    try {
      const template = await shiftService.createShiftTemplate(req.company_id, req.body);
      res.status(201).json(template);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateShiftTemplate(req, res, next) {
    try {
      const template = await shiftService.updateShiftTemplate(req.params.templateId, req.company_id, req.body);
      res.json(template);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteShiftTemplate(req, res, next) {
    try {
      const result = await shiftService.deleteShiftTemplate(req.params.templateId, req.company_id);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getShifts(req, res, next) {
    try {
      const shifts = await shiftService.getShifts(req.company_id, req.query);
      res.json(shifts);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getShiftFilters(req, res, next) {
    try {
      const filters = await shiftService.getShiftFilters(req.company_id);
      res.json(filters);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async searchShifts(req, res, next) {
    try {
      const result = await shiftService.searchShifts(req.company_id, req.query);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createShift(req, res, next) {
    try {
      const shift = await shiftService.createShift(req.company_id, req.body, {
        summary: req.query?.summary === '1' || req.query?.summary === 'true',
      });
      res.status(201).json(shift);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getShift(req, res, next) {
    try {
      const shift = await shiftService.getShift(req.params.id, req.company_id);
      res.json(shift);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateShift(req, res, next) {
    try {
      const shift = await shiftService.updateShift(req.params.id, req.company_id, req.body, {
        summary: req.query?.summary === '1' || req.query?.summary === 'true',
      });
      res.json(shift);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteShift(req, res, next) {
    try {
      await shiftService.deleteShift(req.params.id, req.company_id);
      res.json({ message: 'Shift deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async duplicateShift(req, res, next) {
    try {
      const shift = await shiftService.duplicateShift(req.params.id, req.company_id);
      res.status(201).json(shift);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async publishShift(req, res, next) {
    try {
      const shift = await shiftService.publishShift(req.params.id, req.company_id);
      res.json(shift);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async addPosition(req, res, next) {
    try {
      const position = await shiftService.addPosition(req.params.shiftId, req.company_id, req.body);
      res.status(201).json(position);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updatePosition(req, res, next) {
    try {
      const position = await shiftService.updatePosition(req.params.shiftId, req.params.positionId, req.company_id, req.body);
      res.json(position);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deletePosition(req, res, next) {
    try {
      await shiftService.deletePosition(req.params.shiftId, req.params.positionId, req.company_id);
      res.json({ message: 'Position deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getPositionRequests(req, res, next) {
    try {
      const requests = await shiftService.getPositionRequests(req.params.shiftId, req.params.positionId, req.company_id);
      res.json(requests);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async approveWorkerRequest(req, res, next) {
    try {
      const assignment = await shiftService.approveWorkerRequest(
        req.params.shiftId,
        req.params.positionId,
        req.params.workerId,
        req.company_id,
        req.user?._id
      );
      res.json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async rejectWorkerRequest(req, res, next) {
    try {
      const assignment = await shiftService.rejectWorkerRequest(
        req.params.shiftId,
        req.params.positionId,
        req.params.workerId,
        req.company_id
      );
      res.json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async assignWorker(req, res, next) {
    try {
      const assignment = await shiftService.assignWorker(
        req.params.shiftId,
        req.params.positionId,
        req.body.worker_id || req.body.workerId,
        req.company_id,
        req.user._id
      );
      res.status(201).json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async unassignWorker(req, res, next) {
    try {
      const assignment = await shiftService.unassignWorker(
        req.params.shiftId,
        req.params.positionId,
        req.body.worker_id || req.body.workerId,
        req.company_id,
        'company',
        req.body.reason
      );
      res.json(assignment);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new ShiftController();
