const Shift = require('./Shift');
const ShiftPosition = require('./ShiftPosition');
const ShiftPositionAssignment = require('./ShiftPositionAssignment');
const Unassignment = require('./Unassignment');
const ShiftTemplate = require('./ShiftTemplate');
const User = require('../../common/models/User');
const WorkerRole = require('../worker/WorkerRole');
const TimeOffRequest = require('../worker/TimeOffRequest');
const Job = require('../job/Job');
const Client = require('../client/Client');
const CompanyRole = require('../company/CompanyRole');
const { AppError } = require('../../common/middleware/error.middleware');

const ACTIVE_ASSIGNMENT_STATUSES = ['assigned', 'approved', 'completed'];
let legacyAssignmentIndexChecked = false;

class ShiftService {
  async getShiftTemplates(companyId) {
    return ShiftTemplate.find({ company_id: companyId })
      .populate('positions.company_role_id')
      .sort({ createdAt: -1 });
  }

  async createShiftTemplate(companyId, data) {
    await this._validateRoleIds(companyId, data.positions || []);
    const template = await ShiftTemplate.create({
      company_id: companyId,
      name: data.name.trim(),
      positions: (data.positions || []).map((p) => ({
        company_role_id: p.company_role_id,
        needed_count: Number(p.needed_count) || 1,
        pay_rate: p.pay_rate != null ? Number(p.pay_rate) : 0,
        break_time: p.break_time || 'No Break',
      })),
    });
    return template.populate('positions.company_role_id');
  }

  async updateShiftTemplate(templateId, companyId, data) {
    const existing = await ShiftTemplate.findOne({ _id: templateId, company_id: companyId });
    if (!existing) throw new AppError('Shift template not found', 404);
    await this._validateRoleIds(companyId, data.positions || []);
    existing.name = data.name.trim();
    existing.positions = (data.positions || []).map((p) => ({
      company_role_id: p.company_role_id,
      needed_count: Number(p.needed_count) || 1,
      pay_rate: p.pay_rate != null ? Number(p.pay_rate) : 0,
      break_time: p.break_time || 'No Break',
    }));
    await existing.save();
    return existing.populate('positions.company_role_id');
  }

  async deleteShiftTemplate(templateId, companyId) {
    const deleted = await ShiftTemplate.findOneAndDelete({ _id: templateId, company_id: companyId });
    if (!deleted) throw new AppError('Shift template not found', 404);
    return { message: 'Shift template deleted successfully' };
  }

  async getShifts(companyId, filters = {}) {
    const query = { company_id: companyId };
    if (filters.status) query.status = filters.status;
    if (filters.job_id) query.job_id = filters.job_id;
    if (filters.client_id) query.client_id = filters.client_id;
    if (filters.date_from) query.date = { $gte: new Date(filters.date_from) };
    if (filters.date_to) query.date = { ...query.date, $lte: new Date(filters.date_to) };

    const shifts = await Shift.find(query)
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id')
      .sort({ date: -1 });

    const shiftIds = shifts.map((s) => s._id);
    const [positionDocs, assignmentDocs] = await Promise.all([
      ShiftPosition.find({ company_id: companyId, shift_id: { $in: shiftIds } }).populate('positions.company_role_id'),
      ShiftPositionAssignment.find({ company_id: companyId, shift_id: { $in: shiftIds } }),
    ]);

    const activeStatuses = new Set(['assigned', 'approved', 'completed']);
    const workerIds = [...new Set(
      assignmentDocs
        .flatMap((doc) => (doc.assignments || []))
        .filter((a) => a.worker_id && activeStatuses.has(a.status))
        .map((a) => String(a.worker_id))
    )];
    const workers = workerIds.length > 0
      ? await User.find({ _id: { $in: workerIds } }).select('_id first_name last_name')
      : [];
    const workerMap = new Map(workers.map((w) => [String(w._id), w]));

    const map = new Map(positionDocs.map((d) => [String(d.shift_id), d]));
    const assignmentMap = new Map();
    for (const doc of assignmentDocs) {
      const key = String(doc.shift_id);
      if (!assignmentMap.has(key)) assignmentMap.set(key, []);
      assignmentMap.get(key).push(doc);
    }

    return shifts.map((shift) => {
      const posDoc = map.get(String(shift._id));
      const docs = assignmentMap.get(String(shift._id)) || [];
      const roleByItemId = new Map(
        (posDoc?.positions || []).map((p) => [String(p._id), p?.company_role_id?.name || ''])
      );
      let minStart = null;
      let maxEnd = null;
      docs.forEach((doc) => {
        (doc.assignments || []).forEach((a) => {
          if (a.system_start_time) {
            const t = new Date(a.system_start_time);
            if (!minStart || t < minStart) minStart = t;
          }
          if (a.system_end_time) {
            const t = new Date(a.system_end_time);
            if (!maxEnd || t > maxEnd) maxEnd = t;
          }
        });
      });

      const staff = docs.flatMap((doc) => {
        const roleName = roleByItemId.get(String(doc.shift_position_item_id)) || '';
        return (doc.assignments || [])
          .filter((assignment) => assignment.worker_id && activeStatuses.has(assignment.status))
          .map((assignment) => {
            const worker = workerMap.get(String(assignment.worker_id));
            if (!worker) return null;
            return {
              id: worker._id,
              first_name: worker.first_name || '',
              last_name: worker.last_name || '',
              role: roleName,
            };
          })
          .filter(Boolean);
      });

      return {
        ...shift.toObject(),
        position_count: posDoc?.positions?.length || 0,
        staff_needed: (posDoc?.positions || []).reduce((sum, p) => sum + (p.needed_count || 0), 0),
        staff_assigned: (posDoc?.positions || []).reduce((sum, p) => sum + (p.filled_count || 0), 0),
        start_time: minStart,
        end_time: maxEnd,
        positions: (posDoc?.positions || []).map((p) => ({
          id: p._id,
          name: p?.company_role_id?.name || '',
          needed_count: p.needed_count || 1,
          filled_count: p.filled_count || 0,
          status: p.status,
        })),
        staff,
      };
    });
  }

  async createShift(companyId, data) {
    await this._dropLegacyAssignmentIndexIfExists();
    await this._validateShiftReferences(companyId, data);
    await this._validateRoleIds(companyId, data.positions || []);

    const shift = await Shift.create({
      company_id: companyId,
      client_id: data.client_id,
      job_id: data.job_id,
      name: data.name,
      client_rep_id: data.client_rep_id || null,
      date: data.date,
      location: data.location || '',
      status: data.status || 'draft',
      notes: data.notes || '',
      required_approval: data.required_approval !== false,
    });

    const positionItems = (data.positions || []).map((p) => ({
      company_role_id: p.company_role_id,
      needed_count: Number(p.needed_count) || 1,
      pay_rate: p.pay_rate != null ? Number(p.pay_rate) : 0,
      break_time: p.break_time || 'No Break',
      filled_count: 0,
      status: 'open',
    }));

    const shiftPositions = await ShiftPosition.create({
      company_id: companyId,
      shift_id: shift._id,
      positions: positionItems,
    });

    const assignmentDocs = [];
    for (let i = 0; i < shiftPositions.positions.length; i += 1) {
      const item = shiftPositions.positions[i];
      const inputAssignments = data.positions?.[i]?.assignments || [];
      const assignments = inputAssignments.map((a) => ({
        worker_id: a.worker_id || null,
        system_start_time: a.system_start_time || null,
        system_end_time: a.system_end_time || null,
        worker_start_time: a.worker_start_time || null,
        worker_end_time: a.worker_end_time || null,
        client_start_time: a.client_start_time || null,
        client_end_time: a.client_end_time || null,
        assigned_by: a.assigned_by || null,
        approved_by: a.approved_by || null,
        approved_at: a.approved_at || null,
        status: a.status || (a.worker_id ? 'assigned' : 'unassigned'),
      }));

      const rootStatus = this._deriveAssignmentRootStatus(assignments);
      if (assignments.length > 0) {
        assignmentDocs.push({
          company_id: companyId,
          shift_id: shift._id,
          shift_position_id: shiftPositions._id,
          shift_position_item_id: item._id,
          assignments,
          status: rootStatus,
        });
      }
      this._recalculatePositionItem(item, assignments);
    }

    await shiftPositions.save();
    if (assignmentDocs.length > 0) {
      await ShiftPositionAssignment.insertMany(assignmentDocs);
    }

    return this.getShift(shift._id, companyId);
  }

  async getShift(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId })
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id');
    if (!shift) throw new AppError('Shift not found', 404);

    const [positionsDoc, assignmentDocs] = await Promise.all([
      ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId }).populate('positions.company_role_id'),
      ShiftPositionAssignment.find({ company_id: companyId, shift_id: shiftId }),
    ]);

    const workerIds = assignmentDocs.flatMap((doc) => (doc.assignments || []).map((a) => a.worker_id)).filter(Boolean);
    const workers = await User.find({ _id: { $in: workerIds } }).select('_id first_name last_name email');
    const workerMap = new Map(workers.map((w) => [String(w._id), w]));

    return {
      ...shift.toObject(),
      shift_positions: positionsDoc || null,
      shift_position_assignments: assignmentDocs.map((doc) => ({
        ...doc.toObject(),
        assignments: (doc.assignments || []).map((assignment) => ({
          ...assignment.toObject(),
          worker: workerMap.get(String(assignment.worker_id)) || null,
        })),
      })),
    };
  }

  async updateShift(shiftId, companyId, data) {
    await this._dropLegacyAssignmentIndexIfExists();
    const existingShift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!existingShift) throw new AppError('Shift not found', 404);

    const nextClientId = data.client_id || existingShift.client_id;
    const nextJobId = data.job_id || existingShift.job_id;
    const nextClientRepId = data.client_rep_id != null ? data.client_rep_id : existingShift.client_rep_id;

    if (data.client_id || data.job_id || data.client_rep_id) {
      await this._validateShiftReferences(companyId, {
        client_id: nextClientId,
        job_id: nextJobId,
        client_rep_id: nextClientRepId,
      });
    }

    const updatePayload = { ...data };
    delete updatePayload.positions;
    const shift = await Shift.findOneAndUpdate({ _id: shiftId, company_id: companyId }, updatePayload, {
      new: true,
      runValidators: true,
    });
    if (!shift) throw new AppError('Shift not found', 404);

    if (Array.isArray(data.positions)) {
      await this._validateRoleIds(companyId, data.positions || []);
      let positionsDoc = await ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId });
      if (!positionsDoc) {
        positionsDoc = await ShiftPosition.create({
          company_id: companyId,
          shift_id: shiftId,
          positions: [],
        });
      }

      positionsDoc.positions = (data.positions || []).map((p) => ({
        company_role_id: p.company_role_id,
        needed_count: Number(p.needed_count) || 1,
        pay_rate: p.pay_rate != null ? Number(p.pay_rate) : 0,
        break_time: p.break_time || 'No Break',
        filled_count: 0,
        status: 'open',
      }));

      const assignmentDocs = [];
      for (let i = 0; i < positionsDoc.positions.length; i += 1) {
        const item = positionsDoc.positions[i];
        const inputAssignments = data.positions?.[i]?.assignments || [];
        const assignments = inputAssignments.map((a) => ({
          worker_id: a.worker_id || null,
          system_start_time: a.system_start_time || null,
          system_end_time: a.system_end_time || null,
          worker_start_time: a.worker_start_time || null,
          worker_end_time: a.worker_end_time || null,
          client_start_time: a.client_start_time || null,
          client_end_time: a.client_end_time || null,
          assigned_by: a.assigned_by || null,
          approved_by: a.approved_by || null,
          approved_at: a.approved_at || null,
          status: a.status || (a.worker_id ? 'assigned' : 'unassigned'),
        }));
        const rootStatus = this._deriveAssignmentRootStatus(assignments);
        assignmentDocs.push({
          company_id: companyId,
          shift_id: shiftId,
          shift_position_id: positionsDoc._id,
          shift_position_item_id: item._id,
          assignments,
          status: rootStatus,
        });
        this._recalculatePositionItem(item, assignments);
      }

      await positionsDoc.save();
      await ShiftPositionAssignment.deleteMany({ company_id: companyId, shift_id: shiftId });
      if (assignmentDocs.length > 0) {
        await ShiftPositionAssignment.insertMany(assignmentDocs);
      }
    }

    return this.getShift(shiftId, companyId);
  }

  async deleteShift(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) throw new AppError('Shift not found', 404);

    await Promise.all([
      ShiftPositionAssignment.deleteMany({ company_id: companyId, shift_id: shiftId }),
      ShiftPosition.deleteMany({ company_id: companyId, shift_id: shiftId }),
      Shift.deleteOne({ _id: shiftId, company_id: companyId }),
    ]);

    return { message: 'Shift deleted successfully' };
  }

  async duplicateShift(shiftId, companyId) {
    await this._dropLegacyAssignmentIndexIfExists();
    const sourceShift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!sourceShift) throw new AppError('Shift not found', 404);

    const [sourcePositionsDoc, sourceAssignmentDocs] = await Promise.all([
      ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId }),
      ShiftPositionAssignment.find({ company_id: companyId, shift_id: shiftId }),
    ]);

    const clonedShift = await Shift.create({
      company_id: sourceShift.company_id,
      client_id: sourceShift.client_id,
      job_id: sourceShift.job_id,
      name: sourceShift.name,
      client_rep_id: sourceShift.client_rep_id || null,
      date: sourceShift.date,
      location: sourceShift.location || '',
      status: sourceShift.status || 'draft',
      notes: sourceShift.notes || '',
      required_approval: sourceShift.required_approval !== false,
    });

    if (sourcePositionsDoc) {
      const clonedPositionsDoc = await ShiftPosition.create({
        company_id: companyId,
        shift_id: clonedShift._id,
        positions: (sourcePositionsDoc.positions || []).map((p) => ({
          company_role_id: p.company_role_id,
          needed_count: Number(p.needed_count) || 1,
          pay_rate: p.pay_rate != null ? Number(p.pay_rate) : 0,
          break_time: p.break_time || 'No Break',
          filled_count: Number(p.filled_count) || 0,
          status: p.status || 'open',
        })),
      });

      const itemIdMap = new Map();
      const sourceItems = sourcePositionsDoc.positions || [];
      const clonedItems = clonedPositionsDoc.positions || [];
      for (let i = 0; i < Math.min(sourceItems.length, clonedItems.length); i += 1) {
        itemIdMap.set(String(sourceItems[i]._id), clonedItems[i]._id);
      }

      const clonedAssignmentDocs = sourceAssignmentDocs
        .map((doc) => {
          const newItemId = itemIdMap.get(String(doc.shift_position_item_id));
          if (!newItemId) return null;
          return {
            company_id: companyId,
            shift_id: clonedShift._id,
            shift_position_id: clonedPositionsDoc._id,
            shift_position_item_id: newItemId,
            assignments: (doc.assignments || []).map((a) => ({
              worker_id: a.worker_id || null,
              system_start_time: a.system_start_time || null,
              system_end_time: a.system_end_time || null,
              worker_start_time: a.worker_start_time || null,
              worker_end_time: a.worker_end_time || null,
              client_start_time: a.client_start_time || null,
              client_end_time: a.client_end_time || null,
              assigned_by: a.assigned_by || null,
              approved_by: a.approved_by || null,
              approved_at: a.approved_at || null,
              status: a.status || (a.worker_id ? 'assigned' : 'unassigned'),
            })),
            status: doc.status || 'unassigned',
          };
        })
        .filter(Boolean);

      if (clonedAssignmentDocs.length > 0) {
        await ShiftPositionAssignment.insertMany(clonedAssignmentDocs);
      }
    }

    return this.getShift(clonedShift._id, companyId);
  }

  async publishShift(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) throw new AppError('Shift not found', 404);
    const positionsDoc = await ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId });
    if (!positionsDoc || (positionsDoc.positions || []).length === 0) {
      throw new AppError('Cannot publish shift without positions', 400);
    }
    shift.status = 'published';
    await shift.save();
    return this.getShift(shiftId, companyId);
  }

  async addPosition(shiftId, companyId, data) {
    await this._validateRoleIds(companyId, [data]);
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) throw new AppError('Shift not found', 404);

    const positionsDoc = await ShiftPosition.findOneAndUpdate(
      { company_id: companyId, shift_id: shiftId },
      {
        $push: {
          positions: {
            company_role_id: data.company_role_id,
            needed_count: Number(data.needed_count) || 1,
            pay_rate: data.pay_rate != null ? Number(data.pay_rate) : 0,
            break_time: data.break_time || 'No Break',
            filled_count: 0,
            status: 'open',
          },
        },
      },
      { new: true, upsert: true }
    );

    const createdItem = positionsDoc.positions[positionsDoc.positions.length - 1];
    await ShiftPositionAssignment.create({
      company_id: companyId,
      shift_id: shiftId,
      shift_position_id: positionsDoc._id,
      shift_position_item_id: createdItem._id,
      assignments: [],
      status: 'unassigned',
    });

    return createdItem;
  }

  async updatePosition(shiftId, positionId, companyId, data) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    if (data.company_role_id) await this._validateRoleIds(companyId, [{ company_role_id: data.company_role_id }]);

    if (data.company_role_id) context.positionItem.company_role_id = data.company_role_id;
    if (data.needed_count != null) context.positionItem.needed_count = Number(data.needed_count);
    if (data.pay_rate != null) context.positionItem.pay_rate = Number(data.pay_rate);
    if (data.break_time != null) context.positionItem.break_time = data.break_time;
    if (data.status) context.positionItem.status = data.status;

    await context.positionsDoc.save();
    return context.positionItem;
  }

  async deletePosition(shiftId, positionId, companyId) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const active = (context.assignmentDoc.assignments || []).some((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status));
    if (active) throw new AppError('Cannot delete position with active assignments', 400);

    context.positionItem.deleteOne();
    await context.positionsDoc.save();
    await ShiftPositionAssignment.deleteOne({ _id: context.assignmentDoc._id });
    return { message: 'Position deleted successfully' };
  }

  async getPositionRequests(shiftId, positionId, companyId) {
    const { assignmentDoc } = await this._getPositionContext(shiftId, positionId, companyId);
    const requested = (assignmentDoc.assignments || []).filter((a) => a.status === 'requested');
    const workerIds = requested.map((a) => a.worker_id);
    const workers = await User.find({ _id: { $in: workerIds } }).select('_id first_name last_name email');
    const map = new Map(workers.map((w) => [String(w._id), w]));
    return requested.map((a) => ({ ...a.toObject(), worker: map.get(String(a.worker_id)) || null }));
  }

  async approveWorkerRequest(shiftId, positionId, workerId, companyId, approvedBy) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const assignment = context.assignmentDoc.assignments.find(
      (a) => String(a.worker_id) === String(workerId) && a.status === 'requested'
    );
    if (!assignment) throw new AppError('Request not found', 404);

    assignment.status = 'approved';
    assignment.approved_at = new Date();
    assignment.approved_by = approvedBy || null;
    this._syncDerivedState(context.positionItem, context.assignmentDoc);
    await Promise.all([context.positionsDoc.save(), context.assignmentDoc.save()]);
    return assignment;
  }

  async rejectWorkerRequest(shiftId, positionId, workerId, companyId) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const assignment = context.assignmentDoc.assignments.find(
      (a) => String(a.worker_id) === String(workerId) && a.status === 'requested'
    );
    if (!assignment) throw new AppError('Request not found', 404);

    assignment.status = 'rejected';
    this._syncDerivedState(context.positionItem, context.assignmentDoc);
    await Promise.all([context.positionsDoc.save(), context.assignmentDoc.save()]);
    return assignment;
  }

  async assignWorker(shiftId, positionId, workerId, companyId, assignedBy) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const worker = await User.findOne({
      _id: workerId,
      company_id: companyId,
      role: 'worker',
      is_active: true,
    });
    if (!worker) throw new AppError('Worker not found or not active', 404);

    const exists = (context.assignmentDoc.assignments || []).some(
      (a) => String(a.worker_id) === String(workerId) && ['assigned', 'approved', 'requested'].includes(a.status)
    );
    if (exists) throw new AppError('Worker already linked to this position', 400);

    context.assignmentDoc.assignments.push({
      worker_id: workerId,
      assigned_by: assignedBy,
      status: 'assigned',
    });
    this._syncDerivedState(context.positionItem, context.assignmentDoc);
    await Promise.all([context.positionsDoc.save(), context.assignmentDoc.save()]);
    return context.assignmentDoc;
  }

  async unassignWorker(shiftId, positionId, workerId, companyId, unassignedBy, reason) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const assignment = context.assignmentDoc.assignments.find(
      (a) => String(a.worker_id) === String(workerId) && ['assigned', 'approved', 'requested'].includes(a.status)
    );
    if (!assignment) throw new AppError('Assignment not found', 404);

    assignment.status = 'unassigned';
    this._syncDerivedState(context.positionItem, context.assignmentDoc);
    await Promise.all([context.positionsDoc.save(), context.assignmentDoc.save()]);

    await Unassignment.create({
      assignment_id: context.assignmentDoc._id,
      worker_id: workerId,
      company_id: companyId,
      reason,
      unassigned_by: unassignedBy,
    });
    return assignment;
  }

  async getWorkerOpenShifts(workerId, companyId) {
    const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId });
    const roleIds = new Set((wrDoc?.roles || []).map((r) => String(r.company_role_id)));
    if (roleIds.size === 0) return [];

    const shifts = await Shift.find({ company_id: companyId, status: 'published' }).populate('job_id');
    const shiftIds = shifts.map((s) => s._id);
    const positionsDocs = await ShiftPosition.find({ company_id: companyId, shift_id: { $in: shiftIds } }).populate('positions.company_role_id');

    const byShift = new Map();
    for (const doc of positionsDocs) byShift.set(String(doc.shift_id), doc);

    return shifts
      .map((shift) => {
        const doc = byShift.get(String(shift._id));
        if (!doc) return null;
        const open = doc.positions.filter(
          (p) => roleIds.has(String(p.company_role_id?._id || p.company_role_id)) && ['open', 'partially_filled'].includes(p.status)
        );
        if (open.length === 0) return null;
        return { ...shift.toObject(), open_positions: open };
      })
      .filter(Boolean);
  }

  async getWorkerAssignedShifts(workerId, companyId) {
    const docs = await ShiftPositionAssignment.find({
      company_id: companyId,
      assignments: {
        $elemMatch: {
          worker_id: workerId,
          status: { $in: ['assigned', 'approved', 'completed'] },
        },
      },
    }).populate('shift_id');
    return docs;
  }

  async getWorkerUpcomingShifts(workerId, companyId) {
    const now = new Date();
    const docs = await this.getWorkerAssignedShifts(workerId, companyId);
    return docs.filter((doc) => doc.shift_id && new Date(doc.shift_id.date) >= now);
  }

  async requestShift(shiftId, positionId, workerId, companyId) {
    const context = await this._getPositionContext(shiftId, positionId, companyId);
    const timeOffConflict = await TimeOffRequest.findOne({
      worker_id: workerId,
      status: 'active',
      start_date: { $lte: context.shift.date },
      end_date: { $gte: context.shift.date },
    });
    if (timeOffConflict) throw new AppError('Worker has time off during this shift', 400);

    const exists = (context.assignmentDoc.assignments || []).some(
      (a) => String(a.worker_id) === String(workerId) && ['requested', 'assigned', 'approved'].includes(a.status)
    );
    if (exists) throw new AppError('Request already exists', 400);

    context.assignmentDoc.assignments.push({ worker_id: workerId, status: 'requested' });
    this._syncDerivedState(context.positionItem, context.assignmentDoc);
    await Promise.all([context.positionsDoc.save(), context.assignmentDoc.save()]);
    return context.assignmentDoc;
  }

  async _getPositionContext(shiftId, positionId, companyId) {
    await this._dropLegacyAssignmentIndexIfExists();
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) throw new AppError('Shift not found', 404);

    const positionsDoc = await ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId });
    if (!positionsDoc) throw new AppError('Shift positions not found', 404);

    const positionItem = positionsDoc.positions.id(positionId);
    if (!positionItem) throw new AppError('Position not found', 404);

    let assignmentDoc = await ShiftPositionAssignment.findOne({
      company_id: companyId,
      shift_id: shiftId,
      shift_position_id: positionsDoc._id,
      shift_position_item_id: positionId,
    });
    if (!assignmentDoc) {
      assignmentDoc = await ShiftPositionAssignment.create({
        company_id: companyId,
        shift_id: shiftId,
        shift_position_id: positionsDoc._id,
        shift_position_item_id: positionId,
        assignments: [],
        status: 'unassigned',
      });
    }

    return { shift, positionsDoc, positionItem, assignmentDoc };
  }

  async _validateShiftReferences(companyId, data) {
    const client = await Client.findOne({ _id: data.client_id, company_id: companyId, status: 'active' });
    if (!client) throw new AppError('Client not found', 404);

    const job = await Job.findOne({ _id: data.job_id, company_id: companyId, client_id: data.client_id, status: 'active' });
    if (!job) throw new AppError('Job not found for selected client', 404);

    if (data.client_rep_id) {
      const rep = await User.findOne({
        _id: data.client_rep_id,
        company_id: companyId,
        client_id: data.client_id,
        role: 'client_rep',
        is_active: true,
      });
      if (!rep) throw new AppError('Client representative not found for selected client', 404);
    }
  }

  async _validateRoleIds(companyId, positions) {
    const roleIds = [...new Set((positions || []).map((p) => String(p.company_role_id)).filter(Boolean))];
    if (roleIds.length === 0) return;
    const roleCount = await CompanyRole.countDocuments({
      _id: { $in: roleIds },
      company_id: companyId,
      is_active: true,
    });
    if (roleCount !== roleIds.length) {
      throw new AppError('One or more positions use invalid company roles', 400);
    }
  }

  _syncDerivedState(positionItem, assignmentDoc) {
    this._recalculatePositionItem(positionItem, assignmentDoc.assignments || []);
    assignmentDoc.status = this._deriveAssignmentRootStatus(assignmentDoc.assignments || []);
  }

  _recalculatePositionItem(positionItem, assignments) {
    const filled = assignments.filter((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status)).length;
    positionItem.filled_count = filled;
    if (filled === 0) positionItem.status = 'open';
    else if (filled >= (positionItem.needed_count || 0)) positionItem.status = 'filled';
    else positionItem.status = 'partially_filled';
  }

  _deriveAssignmentRootStatus(assignments) {
    if (!assignments || assignments.length === 0) return 'unassigned';
    if (assignments.some((a) => a.status === 'requested')) return 'requested';
    if (assignments.some((a) => a.status === 'approved')) return 'approved';
    if (assignments.some((a) => a.status === 'completed')) return 'completed';
    if (assignments.some((a) => a.status === 'assigned')) return 'assigned';
    if (assignments.every((a) => a.status === 'rejected')) return 'rejected';
    return 'unassigned';
  }

  async _dropLegacyAssignmentIndexIfExists() {
    if (legacyAssignmentIndexChecked) return;
    try {
      const indexes = await ShiftPositionAssignment.collection.indexes();
      const legacy = indexes.find((idx) => idx?.name === 'shift_position_id_1_worker_id_1');
      if (legacy) {
        await ShiftPositionAssignment.collection.dropIndex('shift_position_id_1_worker_id_1');
      }
    } catch (error) {
      // Non-fatal: collection might not exist yet in fresh environments.
    } finally {
      legacyAssignmentIndexChecked = true;
    }
  }
}

module.exports = new ShiftService();
