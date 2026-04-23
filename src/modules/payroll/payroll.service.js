const PayrollReport = require('./PayrollReport');
const PayrollReportEntry = require('./PayrollReportEntry');
const ShiftPositionAssignment = require('../shift/ShiftPositionAssignment');
const User = require('../../common/models/User');
const WorkerRole = require('../worker/WorkerRole');
const CompanyRole = require('../company/CompanyRole');
const { AppError } = require('../../common/middleware/error.middleware');

class PayrollService {
  async submitPayrollReport(workerId, companyId, data) {
    const staffUser = await User.findOne({
      _id: workerId,
      company_id: companyId,
      role: 'worker',
      status: 'active',
    });
    if (!staffUser) {
      throw new AppError('Worker not found or not active', 404);
    }

    const report = await PayrollReport.create({
      worker_id: workerId,
      company_id: companyId,
      start_date: data.start_date,
      end_date: data.end_date,
      status: 'submitted'
    });

    if (!data.entries || data.entries.length === 0) {
      return report;
    }

    const assignmentIds = data.entries
      .filter(e => e.shift_assignment_id)
      .map(e => e.shift_assignment_id);

    const [assignments, workerRole] = await Promise.all([
      ShiftPositionAssignment.find({
        _id: { $in: assignmentIds },
        worker_id: workerId,
        status: 'completed'
      }).populate('shift_position_id', 'company_role_id').lean(),
      WorkerRole.findOne({ worker_id: workerId, company_id: companyId }).lean()
    ]);

    const assignmentMap = new Map(assignments.map(a => [String(a._id), a]));
    const roleRates = new Map();
    if (workerRole?.roles) {
      workerRole.roles.forEach(r => {
        roleRates.set(String(r.company_role_id), r.hourly_rate_override);
      });
    }

    const uniqueRoleIds = new Set();
    assignments.forEach(a => {
      if (a.shift_position_id?.company_role_id) {
        uniqueRoleIds.add(String(a.shift_position_id.company_role_id));
      }
    });
    if (workerRole?.roles?.length) {
      workerRole.roles.forEach(r => {
        uniqueRoleIds.add(String(r.company_role_id));
      });
    }

    const companyRoles = await CompanyRole.find({
      _id: { $in: Array.from(uniqueRoleIds) }
    }).lean();
    const roleMap = new Map(companyRoles.map(r => [String(r._id), r]));

    let totalHours = 0;
    let totalAmount = 0;

    const entries = data.entries.map(entry => {
      let hoursWorked = entry.hours_worked || 0;
      let hourlyRate = entry.hourly_rate || 0;

      if (entry.shift_assignment_id) {
        const assignment = assignmentMap.get(String(entry.shift_assignment_id));
        if (assignment?.worker_end_time && assignment?.worker_start_time) {
          hoursWorked = (assignment.worker_end_time - assignment.worker_start_time) / (1000 * 60 * 60);
        }

        const positionRoleId = assignment?.shift_position_id?.company_role_id;
        const rateOverride = roleRates.get(String(positionRoleId));

        if (rateOverride != null) {
          hourlyRate = rateOverride;
        } else if (positionRoleId) {
          const role = roleMap.get(String(positionRoleId));
          hourlyRate = role?.default_hourly_rate || 0;
        } else if (workerRole?.roles?.length) {
          const first = workerRole.roles[0];
          const override = roleRates.get(String(first.company_role_id));
          if (override != null) {
            hourlyRate = override;
          } else {
            const role = roleMap.get(String(first.company_role_id));
            hourlyRate = role?.default_hourly_rate || 0;
          }
        }
      }

      if (entry.external_work_desc) {
        hourlyRate = entry.external_hourly_rate || 0;
      }

      const entryAmount = hoursWorked * hourlyRate;
      totalHours += hoursWorked;
      totalAmount += entryAmount;

      return {
        payroll_report_id: report._id,
        shift_assignment_id: entry.shift_assignment_id,
        external_work_desc: entry.external_work_desc,
        external_start_time: entry.external_start_time,
        external_end_time: entry.external_end_time,
        external_hourly_rate: entry.external_hourly_rate,
        hours_worked: hoursWorked,
        hourly_rate: hourlyRate,
        total_amount: entryAmount,
        status: 'submitted'
      };
    });

    await PayrollReportEntry.insertMany(entries);

    report.total_hours = totalHours;
    report.total_amount = totalAmount;
    await report.save();

    return report;
  }

  async getWorkerPayrollReports(workerId) {
    return PayrollReport.find({ worker_id: workerId }).sort({ submitted_at: -1 }).lean();
  }

  async getPayrollReports(companyId, filters = {}) {
    const query = { company_id: companyId };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.worker_id) {
      query.worker_id = filters.worker_id;
    }
    return PayrollReport.find(query).populate('worker_id', 'first_name last_name email').sort({ submitted_at: -1 }).lean();
  }

  async getPayrollReport(reportId, companyId) {
    const report = await PayrollReport.findOne({ _id: reportId, company_id: companyId })
      .populate('worker_id');
    
    if (!report) {
      throw new AppError('Payroll report not found', 404);
    }

    const entries = await PayrollReportEntry.find({ payroll_report_id: reportId })
      .populate({
        path: 'shift_assignment_id',
        populate: {
          path: 'shift_position_id',
          populate: 'shift_id'
        }
      });

    return { ...report.toObject(), entries };
  }

  async approvePayrollReport(reportId, companyId, reviewedBy) {
    const report = await PayrollReport.findOne({ _id: reportId, company_id: companyId });
    
    if (!report) {
      throw new AppError('Payroll report not found', 404);
    }

    if (report.status !== 'submitted') {
      throw new AppError('Report already reviewed', 400);
    }

    report.status = 'approved';
    report.reviewed_by = reviewedBy;
    report.reviewed_at = new Date();
    await report.save();

    await PayrollReportEntry.updateMany(
      { payroll_report_id: reportId },
      { status: 'approved' }
    );

    return report;
  }

  async modifyPayrollReport(reportId, companyId, reviewedBy, modifications) {
    const report = await PayrollReport.findOne({ _id: reportId, company_id: companyId });
    
    if (!report) {
      throw new AppError('Payroll report not found', 404);
    }

    if (report.status !== 'submitted') {
      throw new AppError('Report already reviewed', 400);
    }

    let totalHours = 0;
    let totalAmount = 0;

    for (const mod of modifications) {
      const entry = await PayrollReportEntry.findById(mod.entry_id);
      if (!entry) continue;

      entry.modified_hours = mod.hours_worked;
      entry.modified_rate = mod.hourly_rate;
      entry.modified_amount = mod.hours_worked * mod.hourly_rate;
      entry.status = 'modified';
      await entry.save();

      const finalHours = mod.hours_worked;
      const finalRate = mod.hourly_rate;
      const finalAmount = finalHours * finalRate;

      totalHours += finalHours;
      totalAmount += finalAmount;
    }

    report.status = 'modified';
    report.reviewed_by = reviewedBy;
    report.reviewed_at = new Date();
    report.total_hours = totalHours;
    report.total_amount = totalAmount;
    await report.save();

    return report;
  }

  async markAsPaid(reportId, companyId) {
    const report = await PayrollReport.findOne({ _id: reportId, company_id: companyId });
    
    if (!report) {
      throw new AppError('Payroll report not found', 404);
    }

    if (!['approved', 'modified'].includes(report.status)) {
      throw new AppError('Report must be approved or modified first', 400);
    }

    report.status = 'paid';
    await report.save();

    return report;
  }
}

module.exports = new PayrollService();
