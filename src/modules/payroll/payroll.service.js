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

    let totalHours = 0;
    let totalAmount = 0;

    if (data.entries && data.entries.length > 0) {
      for (const entry of data.entries) {
        let hoursWorked = entry.hours_worked || 0;
        let hourlyRate = entry.hourly_rate || 0;

        if (entry.shift_assignment_id) {
          const assignment = await ShiftPositionAssignment.findOne({
            _id: entry.shift_assignment_id,
            worker_id: workerId,
            status: 'completed'
          }).populate({
            path: 'shift_position_id',
            select: 'company_role_id',
            populate: { path: 'company_role_id', select: 'default_hourly_rate' },
          });

          if (assignment && assignment.worker_end_time && assignment.worker_start_time) {
            hoursWorked = (assignment.worker_end_time - assignment.worker_start_time) / (1000 * 60 * 60);
          }

          const positionRoleId =
            assignment?.shift_position_id?.company_role_id?._id ||
            assignment?.shift_position_id?.company_role_id;
          const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId });
          let roleEntry = null;
          if (wrDoc && positionRoleId) {
            roleEntry = wrDoc.roles.find(
              (r) => String(r.company_role_id) === String(positionRoleId)
            );
          }
          if (roleEntry?.hourly_rate_override != null) {
            hourlyRate = roleEntry.hourly_rate_override;
          } else if (positionRoleId) {
            const role = await CompanyRole.findById(positionRoleId);
            hourlyRate = role?.default_hourly_rate || 0;
          } else if (wrDoc?.roles?.length) {
            const first = wrDoc.roles[0];
            if (first.hourly_rate_override != null) {
              hourlyRate = first.hourly_rate_override;
            } else {
              const role = await CompanyRole.findById(first.company_role_id);
              hourlyRate = role?.default_hourly_rate || 0;
            }
          }
        }

        if (entry.external_work_desc) {
          hourlyRate = entry.external_hourly_rate || 0;
        }

        const totalAmount = hoursWorked * hourlyRate;

        await PayrollReportEntry.create({
          payroll_report_id: report._id,
          shift_assignment_id: entry.shift_assignment_id,
          external_work_desc: entry.external_work_desc,
          external_start_time: entry.external_start_time,
          external_end_time: entry.external_end_time,
          external_hourly_rate: entry.external_hourly_rate,
          hours_worked: hoursWorked,
          hourly_rate: hourlyRate,
          total_amount: totalAmount,
          status: 'submitted'
        });

        totalHours += hoursWorked;
        totalAmount += totalAmount;
      }
    }

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
