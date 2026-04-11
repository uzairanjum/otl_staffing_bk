const Shift = require('./Shift');
const ShiftPosition = require('./ShiftPosition');
const ShiftPositionAssignment = require('./ShiftPositionAssignment');
const Unassignment = require('./Unassignment');
const User = require('../../common/models/User');
const WorkerRole = require('../worker/WorkerRole');
const TimeOffRequest = require('../worker/TimeOffRequest');
const Job = require('../job/Job');
const { AppError } = require('../../common/middleware/error.middleware');

class ShiftService {
  async getShifts(companyId, filters = {}) {
    const query = { company_id: companyId };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.job_id) {
      query.job_id = filters.job_id;
    }
    if (filters.date_from) {
      query.date = { $gte: new Date(filters.date_from) };
    }
    if (filters.date_to) {
      query.date = { ...query.date, $lte: new Date(filters.date_to) };
    }
    return Shift.find(query).populate('job_id').sort({ date: -1 });
  }

  async createShift(companyId, data) {
    const job = await Job.findOne({ _id: data.job_id, company_id: companyId });
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const shift = await Shift.create({
      ...data,
      company_id: companyId
    });
    return shift.populate('job_id');
  }

  async getShift(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId }).populate('job_id');
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    const positions = await ShiftPosition.find({ shift_id: shiftId }).populate('company_role_id');
    
    const positionsWithAssignments = await Promise.all(
      positions.map(async (position) => {
        const assignments = await ShiftPositionAssignment.find({ 
          shift_position_id: position._id,
          status: { $in: ['assigned', 'approved', 'requested'] }
        }).populate('worker_id');
        return { ...position.toObject(), assignments };
      })
    );

    return { ...shift.toObject(), positions: positionsWithAssignments };
  }

  async updateShift(shiftId, companyId, data) {
    const shift = await Shift.findOneAndUpdate(
      { _id: shiftId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    ).populate('job_id');
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }
    return shift;
  }

  async deleteShift(shiftId, companyId) {
    const shift = await Shift.findOneAndUpdate(
      { _id: shiftId, company_id: companyId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }
    return shift;
  }

  async publishShift(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    const positions = await ShiftPosition.find({ shift_id: shiftId });
    if (positions.length === 0) {
      throw new AppError('Cannot publish shift without positions', 400);
    }

    shift.status = 'published';
    await shift.save();
    return shift.populate('job_id');
  }

  async addPosition(shiftId, companyId, data) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    if (shift.status !== 'draft') {
      throw new AppError('Can only add positions to draft shifts', 400);
    }

    const position = await ShiftPosition.create({
      shift_id: shiftId,
      company_id: companyId,
      company_role_id: data.company_role_id,
      needed_count: data.needed_count || 1
    });
    return position.populate('company_role_id');
  }

  async updatePosition(shiftId, positionId, companyId, data) {
    await this.getShift(shiftId, companyId);

    const position = await ShiftPosition.findOneAndUpdate(
      { _id: positionId, shift_id: shiftId },
      data,
      { new: true, runValidators: true }
    ).populate('company_role_id');
    
    if (!position) {
      throw new AppError('Position not found', 404);
    }
    return position;
  }

  async deletePosition(shiftId, positionId, companyId) {
    await this.getShift(shiftId, companyId);

    const assignments = await ShiftPositionAssignment.find({ 
      shift_position_id: positionId,
      status: { $in: ['assigned', 'approved'] }
    });
    
    if (assignments.length > 0) {
      throw new AppError('Cannot delete position with assignments', 400);
    }

    const position = await ShiftPosition.findOneAndDelete({ _id: positionId, shift_id: shiftId });
    if (!position) {
      throw new AppError('Position not found', 404);
    }
    return { message: 'Position deleted successfully' };
  }

  async getPositionRequests(shiftId, positionId, companyId) {
    await this.getShift(shiftId, companyId);

    return ShiftPositionAssignment.find({ 
      shift_position_id: positionId,
      is_requested: true,
      status: 'requested'
    }).populate('worker_id');
  }

  async approveWorkerRequest(shiftId, positionId, workerId, companyId) {
    const shift = await this.getShift(shiftId, companyId);
    const position = shift.positions.find(p => p._id.toString() === positionId);
    
    if (!position) {
      throw new AppError('Position not found', 404);
    }

    const assignment = await ShiftPositionAssignment.findOne({
      shift_position_id: positionId,
      worker_id: workerId,
      is_requested: true,
      status: 'requested'
    }).populate('worker_id');

    if (!assignment) {
      throw new AppError('Request not found', 404);
    }

    assignment.status = 'approved';
    assignment.approved_at = new Date();
    assignment.is_requested = false;
    await assignment.save();

    position.filled_count += 1;
    if (position.filled_count >= position.needed_count) {
      position.status = 'filled';
    } else {
      position.status = 'partially_filled';
    }
    await position.save();

    return assignment;
  }

  async rejectWorkerRequest(shiftId, positionId, workerId, companyId) {
    await this.getShift(shiftId, companyId);

    const assignment = await ShiftPositionAssignment.findOneAndUpdate(
      { shift_position_id: positionId, worker_id: workerId, is_requested: true, status: 'requested' },
      { status: 'rejected' },
      { new: true }
    );

    if (!assignment) {
      throw new AppError('Request not found', 404);
    }

    return assignment;
  }

  async assignWorker(shiftId, positionId, workerId, companyId, assignedBy) {
    const shift = await this.getShift(shiftId, companyId);
    const position = shift.positions.find(p => p._id.toString() === positionId);
    
    if (!position) {
      throw new AppError('Position not found', 404);
    }

    const staffUser = await User.findOne({
      _id: workerId,
      company_id: companyId,
      role: 'worker',
      status: 'active',
    });
    if (!staffUser) {
      throw new AppError('Worker not found or not active', 404);
    }

    const existingAssignment = await ShiftPositionAssignment.findOne({
      shift_position_id: positionId,
      worker_id: workerId,
      status: { $in: ['assigned', 'approved'] }
    });

    if (existingAssignment) {
      throw new AppError('Worker already assigned to this position', 400);
    }

    const timeOffConflict = await TimeOffRequest.findOne({
      worker_id: workerId,
      status: 'active',
      $or: [
        { start_date: { $lte: shift.date }, end_date: { $gte: shift.date } }
      ]
    });

    if (timeOffConflict) {
      throw new AppError('Worker has time off during this shift', 400);
    }

    const shiftDate = new Date(shift.date);
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const shiftStart = new Date(shiftDate);
    shiftStart.setHours(startHour, startMin, 0, 0);
    shiftStart.setDate(shiftStart.getDate() - 1);

    const assignment = await ShiftPositionAssignment.create({
      shift_position_id: positionId,
      worker_id: workerId,
      company_id: companyId,
      status: 'assigned',
      assigned_by: assignedBy,
      system_start_time: shiftStart
    });

    position.filled_count += 1;
    if (position.filled_count >= position.needed_count) {
      position.status = 'filled';
    } else {
      position.status = 'partially_filled';
    }
    await position.save();

    return assignment.populate('worker_id');
  }

  async unassignWorker(shiftId, positionId, workerId, companyId, unassignedBy, reason) {
    const shift = await this.getShift(shiftId, companyId);
    
    const assignment = await ShiftPositionAssignment.findOne({
      shift_position_id: positionId,
      worker_id: workerId,
      status: { $in: ['assigned', 'approved'] }
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (unassignedBy === 'worker') {
      const shiftDate = new Date(shift.date);
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      const shiftStart = new Date(shiftDate);
      shiftStart.setHours(startHour, startMin, 0, 0);
      
      const now = new Date();
      const hoursUntilShift = (shiftStart - now) / (1000 * 60 * 60);
      
      if (hoursUntilShift < 3) {
        throw new AppError('Can only unassign 3+ hours before shift start', 400);
      }
    }

    assignment.status = 'unassigned';
    await assignment.save();

    await Unassignment.create({
      assignment_id: assignment._id,
      worker_id: workerId,
      company_id: companyId,
      reason,
      unassigned_by: unassignedBy
    });

    const position = shift.positions.find(p => p._id.toString() === positionId);
    if (position) {
      position.filled_count = Math.max(0, position.filled_count - 1);
      position.status = position.filled_count === 0 ? 'open' : 'partially_filled';
      await ShiftPosition.findByIdAndUpdate(positionId, {
        filled_count: position.filled_count,
        status: position.status
      });
    }

    return assignment;
  }

  async getWorkerOpenShifts(workerId, companyId) {
    const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId });
    const roleIds = (wrDoc?.roles || []).map((r) => r.company_role_id);

    const timeOffs = await TimeOffRequest.find({
      worker_id: workerId,
      status: 'active'
    });

    const blockedDates = [];
    timeOffs.forEach(to => {
      const start = new Date(to.start_date);
      const end = new Date(to.end_date);
      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        blockedDates.push(d.toISOString().split('T')[0]);
      }
    });

    const shifts = await Shift.find({
      company_id: companyId,
      status: 'published',
      date: { $not: { $in: blockedDates.map(d => new Date(d)) } }
    }).populate('job_id');

    const shiftIds = shifts.map(s => s._id);

    const openPositions = await ShiftPosition.find({
      shift_id: { $in: shiftIds },
      company_role_id: { $in: roleIds },
      status: { $in: ['open', 'partially_filled'] }
    }).populate('company_role_id');

    const shiftsWithOpenPositions = shifts.filter(shift => {
      const shiftPositions = openPositions.filter(p => p.shift_id.toString() === shift._id.toString());
      return shiftPositions.length > 0;
    });

    return shiftsWithOpenPositions.map(shift => ({
      ...shift.toObject(),
      open_positions: openPositions.filter(p => p.shift_id.toString() === shift._id.toString())
    }));
  }

  async getWorkerAssignedShifts(workerId, companyId) {
    const assignments = await ShiftPositionAssignment.find({
      worker_id: workerId,
      status: { $in: ['assigned', 'approved'] }
    }).populate({
      path: 'shift_position_id',
      populate: {
        path: 'shift_id',
        populate: 'job_id'
      }
    });

    return assignments;
  }

  async getWorkerUpcomingShifts(workerId, companyId) {
    const now = new Date();
    
    const assignments = await ShiftPositionAssignment.find({
      worker_id: workerId,
      status: { $in: ['assigned', 'approved'] }
    }).populate({
      path: 'shift_position_id',
      populate: {
        path: 'shift_id',
        populate: 'job_id'
      }
    });

    return assignments.filter(a => {
      const shift = a.shift_position_id?.shift_id;
      return shift && new Date(shift.date) >= now;
    });
  }

  async requestShift(shiftId, positionId, workerId, companyId) {
    const shift = await this.getShift(shiftId, companyId);
    const position = shift.positions.find(p => p._id.toString() === positionId);
    
    if (!position) {
      throw new AppError('Position not found', 404);
    }

    if (position.status === 'filled') {
      throw new AppError('Position is already filled', 400);
    }

    const existingRequest = await ShiftPositionAssignment.findOne({
      shift_position_id: positionId,
      worker_id: workerId,
      is_requested: true
    });

    if (existingRequest) {
      throw new AppError('Request already exists', 400);
    }

    const assignment = await ShiftPositionAssignment.create({
      shift_position_id: positionId,
      worker_id: workerId,
      company_id: companyId,
      status: 'requested',
      is_requested: true
    });

    return assignment;
  }
}

module.exports = new ShiftService();
