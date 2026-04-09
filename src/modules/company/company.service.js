const Company = require('./Company');
const CompanyRole = require('./CompanyRole');
const CompanyWorkingHours = require('./CompanyWorkingHours');
const RoleCategory = require('./RoleCategory');
const TrainingCategory = require('./TrainingCategory');
const { AppError } = require('../../common/middleware/error.middleware');
const { v4: uuidv4 } = require('uuid');

class CompanyService {
  async getCompany(companyId) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    return company;
  }

  async updateCompany(companyId, data) {
    const company = await Company.findByIdAndUpdate(
      companyId,
      data,
      { new: true, runValidators: true }
    );
    if (!company) {
      throw new AppError('Company not found', 404);
    }
    return company;
  }

  async getRoles(companyId) {
    return CompanyRole.find({ company_id: companyId, is_active: true });
  }

  async createRole(companyId, data) {
    const role = await CompanyRole.create({
      ...data,
      company_id: companyId
    });
    return role;
  }

  async updateRole(roleId, companyId, data) {
    const role = await CompanyRole.findOneAndUpdate(
      { _id: roleId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    return role;
  }

  async deleteRole(roleId, companyId) {
    const WorkerRole = require('../worker/WorkerRole');
    const ShiftPosition = require('../shift/ShiftPosition');

    const assignedWorkers = await WorkerRole.countDocuments({ company_role_id: roleId });
    if (assignedWorkers > 0) {
      throw new AppError('Cannot delete role assigned to workers', 400);
    }

    const shiftPositions = await ShiftPosition.countDocuments({ company_role_id: roleId });
    if (shiftPositions > 0) {
      throw new AppError('Cannot delete role used in shifts', 400);
    }

    const role = await CompanyRole.findOneAndDelete({
      _id: roleId,
      company_id: companyId
    });
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    return role;
  }

  async getWorkingHours(companyId) {
    return CompanyWorkingHours.find({ company_id: companyId }).sort({ day_of_week: 1 });
  }

  async updateWorkingHours(companyId, hoursData) {
    await CompanyWorkingHours.deleteMany({ company_id: companyId });
    
    const hours = await CompanyWorkingHours.insertMany(
      hoursData.map(h => ({
        company_id: companyId,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time
      }))
    );
    return hours;
  }

  async getRoleCategories(companyId) {
    return RoleCategory.find({ company_id: companyId });
  }

  async createRoleCategory(companyId, data) {
    const category = await RoleCategory.create({
      ...data,
      company_id: companyId
    });
    return category;
  }

  async updateRoleCategory(categoryId, companyId, data) {
    const category = await RoleCategory.findOneAndUpdate(
      { _id: categoryId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!category) {
      throw new AppError('Role category not found', 404);
    }
    return category;
  }

  async deleteRoleCategory(categoryId, companyId) {
    const linkedRoles = await CompanyRole.countDocuments({
      role_category_id: categoryId,
      company_id: companyId,
      is_active: true
    });

    if (linkedRoles > 0) {
      throw new AppError('Cannot delete category - roles are linked to it', 400);
    }

    const category = await RoleCategory.findOneAndDelete({
      _id: categoryId,
      company_id: companyId
    });
    if (!category) {
      throw new AppError('Role category not found', 404);
    }
    return category;
  }

  async getTrainingCategories(companyId) {
    return TrainingCategory.find({ company_id: companyId });
  }

  async createTrainingCategory(companyId, data) {
    const category = await TrainingCategory.create({
      ...data,
      company_id: companyId
    });
    return category;
  }

  async updateTrainingCategory(categoryId, companyId, data) {
    const category = await TrainingCategory.findOneAndUpdate(
      { _id: categoryId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!category) {
      throw new AppError('Training category not found', 404);
    }
    return category;
  }

  async deleteTrainingCategory(categoryId, companyId) {
    const Training = require('./Training');
    
    const linkedTraining = await Training.countDocuments({
      training_category_id: categoryId,
      company_id: companyId,
      is_active: true
    });

    if (linkedTraining > 0) {
      throw new AppError('Cannot delete category - training is linked to it', 400);
    }

    const category = await TrainingCategory.findOneAndDelete({
      _id: categoryId,
      company_id: companyId
    });
    if (!category) {
      throw new AppError('Training category not found', 404);
    }
    return category;
  }

  async getStats(companyId) {
    const Worker = require('../worker/Worker');
    const Client = require('../client/Client');
    const Job = require('../job/Job');
    const Shift = require('../shift/Shift');
    const ShiftPositionAssignment = require('../shift/ShiftPositionAssignment');
    const PayrollReport = require('../payroll/PayrollReport');

    const [
      workerCount,
      activeWorkerCount,
      clientCount,
      jobCount,
      shiftCount,
      upcomingShiftCount,
      assignmentCount,
      payrollReportCount
    ] = await Promise.all([
      Worker.countDocuments({ company_id: companyId }),
      Worker.countDocuments({ company_id: companyId, status: 'active' }),
      Client.countDocuments({ company_id: companyId }),
      Job.countDocuments({ company_id: companyId }),
      Shift.countDocuments({ company_id: companyId }),
      Shift.countDocuments({ 
        company_id: companyId, 
        status: 'published',
        date: { $gte: new Date() }
      }),
      ShiftPositionAssignment.countDocuments({ company_id: companyId }),
      PayrollReport.countDocuments({ company_id: companyId, status: 'paid' })
    ]);

    return {
      total_workers: workerCount,
      active_workers: activeWorkerCount,
      total_clients: clientCount,
      total_jobs: jobCount,
      total_shifts: shiftCount,
      upcoming_shifts: upcomingShiftCount,
      total_assignments: assignmentCount,
      paid_payroll_reports: payrollReportCount
    };
  }
}

module.exports = new CompanyService();
