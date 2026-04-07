const Company = require('./Company');
const CompanyRole = require('./CompanyRole');
const CompanyWorkingHours = require('./CompanyWorkingHours');
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
    const role = await CompanyRole.findOneAndUpdate(
      { _id: roleId, company_id: companyId },
      { is_active: false },
      { new: true }
    );
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
