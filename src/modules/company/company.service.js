const Company = require('./Company');
const CompanyRole = require('./CompanyRole');
const CompanyWorkingHours = require('./CompanyWorkingHours');
const RoleCategory = require('./RoleCategory');
const TrainingCategory = require('./TrainingCategory');
const { AppError } = require('../../common/middleware/error.middleware');
const { filterResponseCache } = require('../../common/utils/filter-response-cache');
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

  async getRoles(companyId, filters = {}) {
    const isPagedRequest =
      filters.page != null || filters.limit != null || (typeof filters.q === 'string' && filters.q.trim());

    // Backwards-safe: keep the original array response unless paging/search is requested.
    if (!isPagedRequest) {
      return CompanyRole.find({ company_id: companyId, is_active: true }).sort({ name: 1 });
    }

    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = q ? new RegExp(escapeRegex(q), 'i') : null;

    const query = { company_id: companyId, is_active: true };
    if (searchRegex) {
      query.name = searchRegex;
    }

    const cacheKey = filterResponseCache.makeKey('companyFilters:roles', companyId, { q, page, limit });
    const cached = filterResponseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const [items, totalItems] = await Promise.all([
      CompanyRole.find(query).select('_id name').sort({ name: 1 }).skip(skip).limit(limit).lean(),
      CompanyRole.countDocuments(query),
    ]);

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const result = {
      items,
      page,
      limit,
      totalItems,
      totalPages,
    };
    filterResponseCache.set(cacheKey, result);
    return result;
  }

  /**
   * Canonical onboarding step definitions (aligned with worker onboarding flow).
   * Search + pagination for admin filter dropdowns; companyId reserved for future overrides.
   */
  async getOnboardingSteps(_companyId, filters = {}) {
    const CANONICAL = [
      { id: 'contract', value: 'Contract', label: 'Contract', order: 1 },
      { id: 'basic_info', value: 'Basic Info', label: 'Basic Info', order: 2 },
      { id: 'emergency', value: 'Emergency', label: 'Emergency', order: 3 },
      { id: 'tax_bank', value: 'Tax & Bank', label: 'Tax & Bank', order: 4 },
      { id: 'time_off', value: 'Time Off', label: 'Time Off', order: 5 },
      { id: 'documents', value: 'Documents', label: 'Documents', order: 6 },
      { id: 'training', value: 'Training', label: 'Training', order: 7 },
      { id: 'review', value: 'Review', label: 'Review', order: 8 },
      { id: 'complete', value: 'Complete', label: 'Complete', order: 9 },
    ];

    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const q = typeof filters.q === 'string' ? filters.q.trim().toLowerCase() : '';

    let rows = [...CANONICAL];
    if (q) {
      rows = rows.filter(
        (row) =>
          row.label.toLowerCase().includes(q) || row.value.toLowerCase().includes(q),
      );
    }

    const totalItems = rows.length;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const skip = (page - 1) * limit;
    const items = rows.slice(skip, skip + limit);

    return {
      items,
      page,
      limit,
      totalItems,
      totalPages,
    };
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

    const assignedWorkers = await WorkerRole.countDocuments({
      'roles.company_role_id': roleId,
    });
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
    const User = require('../../common/models/User');
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
      User.countDocuments({ company_id: companyId, role: 'worker' }),
      User.countDocuments({ company_id: companyId, role: 'worker', status: 'active' }),
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

  async getDashboard(companyId) {
    const mongoose = require('mongoose');
    const User = require('../../common/models/User');
    const Job = require('../job/Job');
    const Shift = require('../shift/Shift');
    const WorkerRole = require('../worker/WorkerRole');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const [
      totalWorkers,
      activeJobs,
      pendingShifts,
      workersByRole,
      upcomingShifts,
    ] = await Promise.all([
      User.countDocuments({ company_id: companyId, role: 'worker' }),
      Job.countDocuments({ company_id: companyId, status: 'active' }),
      Shift.countDocuments({ company_id: companyId, status: { $in: ['draft', 'published'] } }),
      WorkerRole.aggregate([
        { $match: { company_id: companyObjectId } },
        { $unwind: { path: '$roles', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'company_roles',
            localField: 'roles.company_role_id',
            foreignField: '_id',
            as: 'role',
          },
        },
        { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$role.name', 'Unknown'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 12 },
        { $project: { _id: 0, role: '$_id', count: 1 } },
      ]),
      Shift.find(
        { company_id: companyId, status: 'published', date: { $gte: today } },
        { _id: 1, name: 1, date: 1, start_time: 1, end_time: 1, location: 1, status: 1, job_id: 1 },
      )
        .sort({ date: 1 })
        .limit(5)
        .lean(),
    ]);

    // Static parts for now (as requested)
    const monthlyRevenue = 185000;
    const revenueChart = [
      { month: 'Jan', value: 45000 },
      { month: 'Feb', value: 52000 },
      { month: 'Mar', value: 48000 },
      { month: 'Apr', value: 61000 },
      { month: 'May', value: 55000 },
      { month: 'Jun', value: 67000 },
      { month: 'Jul', value: 72000 },
      { month: 'Aug', value: 69000 },
    ];
    const topWorkers = [
      { name: 'Sarah Johnson', initials: 'SJ', revenue: 2450, hours: 42 },
      { name: 'Michael Chen', initials: 'MC', revenue: 2280, hours: 38 },
      { name: 'James Wilson', initials: 'JW', revenue: 2100, hours: 35 },
      { name: 'Emily Rodriguez', initials: 'ER', revenue: 1890, hours: 32 },
      { name: 'Lisa Thompson', initials: 'LT', revenue: 1650, hours: 28 },
    ];

    return {
      stats: {
        totalWorkers,
        activeJobs,
        pendingApplications: pendingShifts,
        monthlyRevenue,
        workersTrend: 12,
        jobsTrend: 8,
        applicationsTrend: -5,
        revenueTrend: 15,
      },
      revenue: {
        monthlyRevenue,
        chart: revenueChart,
      },
      topWorkers,
      workersByRole,
      upcomingShifts,
    };
  }
}

module.exports = new CompanyService();
