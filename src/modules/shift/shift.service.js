const mongoose = require('mongoose');
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
const { filterResponseCache } = require('../../common/utils/filter-response-cache');

const ACTIVE_ASSIGNMENT_STATUSES = ['assigned', 'approved', 'completed'];
let legacyAssignmentIndexChecked = false;

class ShiftService {
  /**
   * When a slot has a worker, persist who assigned them. Admin create/update payloads often omit
   * `assigned_by`; use the authenticated user id from the controller (`opts.actorUserId`).
   */
  _assignedByForPersistedAssignment(assignmentInput, actorUserId) {
    const a = assignmentInput || {};
    if (!a.worker_id) return null;
    return actorUserId || a.assigned_by || null;
  }

  async _decorateShiftsWithPositionsAndStaff(shifts, companyId, opts = { includeStaff: true }) {
    const shiftIds = shifts.map((s) => s._id);
    if (shiftIds.length === 0) return [];

    const [positionDocs, assignmentDocs] = await Promise.all([
      ShiftPosition.find({ company_id: companyId, shift_id: { $in: shiftIds } }).populate('positions.company_role_id'),
      opts.includeStaff
        ? ShiftPositionAssignment.find({ company_id: companyId, shift_id: { $in: shiftIds } })
        : Promise.resolve([]),
    ]);

    const activeStatuses = new Set(['assigned', 'approved', 'completed']);
    const workerMap = new Map();
    if (opts.includeStaff) {
      const workerIds = [
        ...new Set(
          assignmentDocs
            .flatMap((doc) => doc.assignments || [])
            .filter((a) => a.worker_id && activeStatuses.has(a.status))
            .map((a) => String(a.worker_id)),
        ),
      ];
      const workers =
        workerIds.length > 0 ? await User.find({ _id: { $in: workerIds } }).select('_id first_name last_name') : [];
      for (const w of workers) workerMap.set(String(w._id), w);
    }

    const posByShiftId = new Map(positionDocs.map((d) => [String(d.shift_id), d]));
    const assignmentByShiftId = new Map();
    if (opts.includeStaff) {
      for (const doc of assignmentDocs) {
        const key = String(doc.shift_id);
        if (!assignmentByShiftId.has(key)) assignmentByShiftId.set(key, []);
        assignmentByShiftId.get(key).push(doc);
      }
    }

    return shifts.map((shift) => {
      const base =
        shift && typeof shift.toObject === 'function' ? shift.toObject() : { ...(shift || {}) };
      const posDoc = posByShiftId.get(String(shift._id));
      const docs = opts.includeStaff ? assignmentByShiftId.get(String(shift._id)) || [] : [];
      const roleByItemId = new Map(
        (posDoc?.positions || []).map((p) => [String(p._id), p?.company_role_id?.name || '']),
      );

      let minStart = null;
      let maxEnd = null;
      if (opts.includeStaff) {
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
      } else {
        minStart = shift.start_time || null;
        maxEnd = shift.end_time || null;
      }

      const staff = opts.includeStaff
        ? docs.flatMap((doc) => {
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
          })
        : [];

      const staff_needed = (posDoc?.positions || []).reduce((sum, p) => sum + (p.needed_count || 0), 0);
      const staff_assigned = (posDoc?.positions || []).reduce((sum, p) => sum + (p.filled_count || 0), 0);

      return {
        ...base,
        position_count: posDoc?.positions?.length || 0,
        staff_needed,
        staff_assigned,
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

  _parseSort(filters) {
    const by = typeof filters.sort_by === 'string' ? filters.sort_by : 'date';
    const dirRaw = typeof filters.sort_dir === 'string' ? filters.sort_dir : 'desc';
    const dir = dirRaw.toLowerCase() === 'asc' ? 1 : -1;
    const field = by === 'createdAt' || by === 'updatedAt' || by === 'date' ? by : 'date';
    return { field, dir };
  }

  _parsePaging(filters) {
    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  _escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _assignmentBoundariesFromInput(positions) {
    let minStart = null;
    let maxEnd = null;
    const pos = Array.isArray(positions) ? positions : [];
    for (const p of pos) {
      const assigns = Array.isArray(p?.assignments) ? p.assignments : [];
      for (const a of assigns) {
        if (a?.system_start_time) {
          const t = new Date(a.system_start_time);
          if (!Number.isNaN(t.getTime())) {
            if (!minStart || t < minStart) minStart = t;
          }
        }
        if (a?.system_end_time) {
          const t = new Date(a.system_end_time);
          if (!Number.isNaN(t.getTime())) {
            if (!maxEnd || t > maxEnd) maxEnd = t;
          }
        }
      }
    }
    return { start_time: minStart, end_time: maxEnd };
  }

  async _getShiftSummary(shiftId, companyId) {
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId })
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id');
    if (!shift) throw new AppError('Shift not found', 404);

    const posDoc = await ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId }).populate(
      'positions.company_role_id',
    );
    const staff_needed = (posDoc?.positions || []).reduce((sum, p) => sum + (p.needed_count || 0), 0);
    const staff_assigned = (posDoc?.positions || []).reduce((sum, p) => sum + (p.filled_count || 0), 0);

    return {
      ...shift.toObject(),
      position_count: posDoc?.positions?.length || 0,
      staff_needed,
      staff_assigned,
      start_time: shift.start_time || null,
      end_time: shift.end_time || null,
      positions: (posDoc?.positions || []).map((p) => ({
        id: p._id,
        name: p?.company_role_id?.name || '',
        needed_count: p.needed_count || 1,
        filled_count: p.filled_count || 0,
        status: p.status,
      })),
      staff: [],
    };
  }

  async _decorateListShifts(shifts, companyId) {
    const shiftIds = shifts.map((s) => s._id);
    if (shiftIds.length === 0) return [];

    const positionDocs = await ShiftPosition.find({ company_id: companyId, shift_id: { $in: shiftIds } }).populate(
      'positions.company_role_id',
    );
    const posByShiftId = new Map(positionDocs.map((d) => [String(d.shift_id), d]));

    return shifts.map((shift) => {
      const posDoc = posByShiftId.get(String(shift._id));
      const staff_needed = (posDoc?.positions || []).reduce((sum, p) => sum + (p.needed_count || 0), 0);
      const staff_assigned = (posDoc?.positions || []).reduce((sum, p) => sum + (p.filled_count || 0), 0);

      return {
        ...shift.toObject(),
        position_count: posDoc?.positions?.length || 0,
        staff_needed,
        staff_assigned,
        start_time: shift.start_time || null,
        end_time: shift.end_time || null,
        positions: (posDoc?.positions || []).map((p) => ({
          id: p._id,
          name: p?.company_role_id?.name || '',
          needed_count: p.needed_count || 1,
          filled_count: p.filled_count || 0,
          status: p.status,
        })),
        staff: [],
      };
    });
  }
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
    const isPagedRequest =
      filters.page != null || filters.limit != null || (typeof filters.q === 'string' && filters.q.trim());

    if (!isPagedRequest) {
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

      return this._decorateShiftsWithPositionsAndStaff(shifts, companyId, { includeStaff: true });
    }

    const { page, limit, skip } = this._parsePaging(filters);
    const { field: sortField, dir: sortDir } = this._parseSort(filters);
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';

    const match = { company_id: companyId };
    if (filters.status) match.status = filters.status;
    if (filters.job_id) match.job_id = filters.job_id;
    if (filters.client_id) match.client_id = filters.client_id;
    if (filters.date_from) match.date = { $gte: new Date(filters.date_from) };
    if (filters.date_to) match.date = { ...(match.date || {}), $lte: new Date(filters.date_to) };
    if (typeof filters.location === 'string' && filters.location.trim()) {
      match.location = filters.location.trim();
    }

    // Resolve dropdown filters to indexed Shift fields — run independent lookups in parallel.
    const jobNameStr = typeof filters.job === 'string' ? filters.job.trim() : '';
    const roleNameStr = typeof filters.role === 'string' ? filters.role.trim() : '';

    const shouldResolveJob = jobNameStr && !match.job_id && !jobNameStr.startsWith('All ');
    const shouldResolveRole = roleNameStr && !roleNameStr.startsWith('All ');

    const [jdoc, cr] = await Promise.all([
      shouldResolveJob
        ? Job.findOne({ company_id: companyId, name: jobNameStr }).select('_id').lean()
        : Promise.resolve(null),
      shouldResolveRole
        ? CompanyRole.findOne({ company_id: companyId, name: roleNameStr }).select('_id').lean()
        : Promise.resolve(null),
    ]);

    if (shouldResolveJob) {
      if (!jdoc) return { items: [], page, limit, totalItems: 0, totalPages: 0 };
      match.job_id = jdoc._id;
    }

    if (shouldResolveRole) {
      if (!cr) return { items: [], page, limit, totalItems: 0, totalPages: 0 };
      const roleShiftIds = await ShiftPosition.distinct('shift_id', {
        company_id: companyId,
        'positions.company_role_id': cr._id,
      });
      if (!roleShiftIds.length) {
        return { items: [], page, limit, totalItems: 0, totalPages: 0 };
      }
      if (match._id && match._id.$in) {
        const allowed = new Set(roleShiftIds.map((id) => String(id)));
        const inter = match._id.$in.filter((id) => allowed.has(String(id)));
        if (!inter.length) {
          return { items: [], page, limit, totalItems: 0, totalPages: 0 };
        }
        match._id = { $in: inter };
      } else {
        match._id = { $in: roleShiftIds };
      }
    }

    const searchRegex = q ? new RegExp(this._escapeRegex(q), 'i') : null;

    const tabKey = typeof filters.tab === 'string' ? filters.tab.trim() : '';
    const needsTabAggregation = tabKey && tabKey !== 'all';

    const needsAggregation = !!searchRegex || needsTabAggregation;

    // Optimized paged list path: avoid aggregation when filters are only on Shift fields.
    if (!needsAggregation) {
      const query = { ...match };

      const [totalItems, shifts] = await Promise.all([
        Shift.countDocuments(query),
        Shift.find(query)
          .populate('job_id')
          .populate('client_id')
          .populate('client_rep_id')
          .sort({ [sortField]: sortDir })
          .skip(skip)
          .limit(limit),
      ]);
      const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
      const items = await this._decorateShiftsWithPositionsAndStaff(shifts, companyId, { includeStaff: false });
      return { items, page, limit, totalItems, totalPages };
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job_id',
          foreignField: '_id',
          as: 'job',
        },
      },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clients',
          localField: 'client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'shift_positions',
          let: { shiftId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$shift_id', '$$shiftId'] }, { $eq: ['$company_id', companyId] }],
                },
              },
            },
            { $project: { positions: 1 } },
          ],
          as: 'shift_positions',
        },
      },
      { $unwind: { path: '$shift_positions', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          staffNeededAgg: {
            $sum: {
              $map: {
                input: { $ifNull: ['$shift_positions.positions', []] },
                as: 'p',
                in: { $ifNull: ['$$p.needed_count', 0] },
              },
            },
          },
          staffAssignedAgg: {
            $sum: {
              $map: {
                input: { $ifNull: ['$shift_positions.positions', []] },
                as: 'p',
                in: { $ifNull: ['$$p.filled_count', 0] },
              },
            },
          },
          roleIdsAgg: {
            $map: {
              input: { $ifNull: ['$shift_positions.positions', []] },
              as: 'p',
              in: '$$p.company_role_id',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'company_roles',
          let: { roleIds: '$roleIdsAgg' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$roleIds', []] }] } } },
            { $project: { name: 1 } },
          ],
          as: 'roles',
        },
      },
      {
        $addFields: {
          roleNamesAgg: {
            $map: {
              input: { $ifNull: ['$roles', []] },
              as: 'r',
              in: '$$r.name',
            },
          },
        },
      },
    ];

    // Job / location / role dropdowns are applied via indexed fields on `match` above (resolved before aggregation).

    // Status tabs from the UI.
    if (typeof filters.tab === 'string' && filters.tab) {
      if (filters.tab === 'published') {
        pipeline.push({ $match: { status: { $in: ['published', 'in_progress', 'completed'] } } });
      } else if (filters.tab === 'unpublished') {
        pipeline.push({ $match: { status: { $nin: ['published', 'in_progress', 'completed'] } } });
      } else if (filters.tab === 'open') {
        pipeline.push({ $match: { $expr: { $lt: ['$staffAssignedAgg', '$staffNeededAgg'] } } });
      } else if (filters.tab === 'assigned') {
        pipeline.push({ $match: { $expr: { $gte: ['$staffAssignedAgg', '$staffNeededAgg'] } } });
      }
    }

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { location: searchRegex },
            { 'client.name': searchRegex },
            { 'job.name': searchRegex },
            { roleNamesAgg: searchRegex },
          ],
        },
      });
    }

    pipeline.push({ $sort: { [sortField]: sortDir } });
    pipeline.push({
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 1 } }],
        total: [{ $count: 'count' }],
      },
    });

    const [aggResult] = await Shift.aggregate(pipeline);
    const rows = Array.isArray(aggResult?.items) ? aggResult.items : [];
    const totalItems = Number(aggResult?.total?.[0]?.count ?? 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const ids = rows.map((r) => r._id).filter(Boolean);

    if (ids.length === 0) {
      return { items: [], page, limit, totalItems, totalPages };
    }

    const shifts = await Shift.find({ _id: { $in: ids }, company_id: companyId })
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id')
      .sort({ [sortField]: sortDir });

    const items = await this._decorateShiftsWithPositionsAndStaff(shifts, companyId, { includeStaff: false });
    return { items, page, limit, totalItems, totalPages };
  }

  async searchShifts(companyId, filters = {}) {
    const { page, limit, skip } = this._parsePaging(filters);
    const { field: sortField, dir: sortDir } = this._parseSort(filters);

    const q = typeof filters.q === 'string' ? filters.q.trim() : '';
    const searchRegex = q ? new RegExp(this._escapeRegex(q), 'i') : null;

    const match = { company_id: companyId };
    if (filters.job_id) match.job_id = filters.job_id;
    if (filters.client_id) match.client_id = filters.client_id;
    if (filters.location) match.location = filters.location;
    if (filters.date_from) match.date = { $gte: new Date(filters.date_from) };
    if (filters.date_to) match.date = { ...(match.date || {}), $lte: new Date(filters.date_to) };

    const roleName = typeof filters.role_name === 'string' ? filters.role_name.trim() : '';
    const roleId = typeof filters.role_id === 'string' ? filters.role_id.trim() : '';
    const staffId = typeof filters.staff_id === 'string' ? filters.staff_id.trim() : '';
    const staffName = typeof filters.staff_name === 'string' ? filters.staff_name.trim() : '';

    /** Narrow to shift ids by role *before* aggregation when we are not doing full-text search on roles. */
    let rolePrefiltered = false;
    if (roleName && !searchRegex) {
      const cr = await CompanyRole.findOne({ company_id: companyId, name: roleName }).select('_id').lean();
      if (!cr) {
        return { items: [], page, limit, totalItems: 0, totalPages: 0 };
      }
      const sids = await ShiftPosition.distinct('shift_id', {
        company_id: companyId,
        'positions.company_role_id': cr._id,
      });
      if (!sids.length) {
        return { items: [], page, limit, totalItems: 0, totalPages: 0 };
      }
      match._id = { $in: sids };
      rolePrefiltered = true;
    } else if (roleId && !searchRegex) {
      try {
        const oid = new mongoose.Types.ObjectId(roleId);
        const sids = await ShiftPosition.distinct('shift_id', {
          company_id: companyId,
          'positions.company_role_id': oid,
        });
        if (!sids.length) {
          return { items: [], page, limit, totalItems: 0, totalPages: 0 };
        }
        match._id = { $in: sids };
        rolePrefiltered = true;
      } catch {
        // invalid role id — fall through; pipeline may still apply other filters
      }
    }

    const needsJobClientLookup = !!searchRegex;
    const needsRoleLookup =
      !!searchRegex || (!!roleName && !rolePrefiltered) || (!!roleId && !rolePrefiltered);
    const needsStaffLookup = !!searchRegex || !!staffId || !!staffName;

    const pipeline = [{ $match: match }];

    if (needsJobClientLookup) {
      pipeline.push(
        {
          $lookup: { from: 'jobs', localField: 'job_id', foreignField: '_id', as: 'job' },
        },
        { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
        {
          $lookup: { from: 'clients', localField: 'client_id', foreignField: '_id', as: 'client' },
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      );
    }

    if (needsRoleLookup) {
      pipeline.push(
        {
          $lookup: {
            from: 'shift_positions',
            let: { shiftId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$shift_id', '$$shiftId'] }, { $eq: ['$company_id', companyId] }],
                  },
                },
              },
              { $project: { positions: 1 } },
            ],
            as: 'shift_positions',
          },
        },
        { $unwind: { path: '$shift_positions', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            roleIdsAgg: {
              $map: {
                input: { $ifNull: ['$shift_positions.positions', []] },
                as: 'p',
                in: '$$p.company_role_id',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'company_roles',
            let: { roleIds: '$roleIdsAgg' },
            pipeline: [
              { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$roleIds', []] }] } } },
              { $project: { name: 1 } },
            ],
            as: 'roles',
          },
        },
        {
          $addFields: {
            roleNamesAgg: {
              $map: { input: { $ifNull: ['$roles', []] }, as: 'r', in: '$$r.name' },
            },
          },
        },
      );

      if (roleId && !rolePrefiltered) {
        try {
          const oid = new mongoose.Types.ObjectId(roleId);
          pipeline.push({ $match: { roleIdsAgg: oid } });
        } catch {
          // ignore invalid role id
        }
      }
      if (roleName && !rolePrefiltered) {
        pipeline.push({ $match: { roleNamesAgg: roleName } });
      }
    }

    if (needsStaffLookup) {
      // Match worker assignments only when needed.
      pipeline.push(
        {
          $lookup: {
            from: 'shift_position_assignments',
            let: { shiftId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$shift_id', '$$shiftId'] }, { $eq: ['$company_id', companyId] }],
                  },
                },
              },
              { $project: { assignments: 1, shift_position_item_id: 1 } },
            ],
            as: 'spa',
          },
        },
        {
          $addFields: {
            staffIdsAgg: {
              $reduce: {
                input: { $ifNull: ['$spa', []] },
                initialValue: [],
                in: {
                  $setUnion: [
                    '$$value',
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ['$$this.assignments', []] },
                            as: 'a',
                            cond: {
                              $and: [
                                { $ne: ['$$a.worker_id', null] },
                                { $in: ['$$a.status', ['assigned', 'approved', 'completed']] },
                              ],
                            },
                          },
                        },
                        as: 'a',
                        in: '$$a.worker_id',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      );

      if (staffId) {
        try {
          const oid = new mongoose.Types.ObjectId(staffId);
          pipeline.push({ $match: { staffIdsAgg: oid } });
        } catch {
          // ignore invalid staff id
        }
      }

      if (staffName || searchRegex) {
        pipeline.push(
          {
            $lookup: {
              from: 'users',
              let: { ids: '$staffIdsAgg' },
              pipeline: [
                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$ids', []] }] } } },
                { $project: { first_name: 1, last_name: 1 } },
              ],
              as: 'staffUsers',
            },
          },
          {
            $addFields: {
              staffNamesAgg: {
                $map: {
                  input: { $ifNull: ['$staffUsers', []] },
                  as: 'u',
                  in: { $trim: { input: { $concat: ['$$u.first_name', ' ', '$$u.last_name'] } } },
                },
              },
            },
          },
        );
      }

      if (staffName) {
        const staffRegex = new RegExp(this._escapeRegex(staffName), 'i');
        pipeline.push({ $match: { staffNamesAgg: staffRegex } });
      }
    }

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { location: searchRegex },
            ...(needsJobClientLookup ? [{ 'client.name': searchRegex }, { 'job.name': searchRegex }] : []),
            ...(needsRoleLookup ? [{ roleNamesAgg: searchRegex }] : []),
            ...(needsStaffLookup ? [{ staffNamesAgg: searchRegex }] : []),
          ],
        },
      });
    }

    pipeline.push({ $sort: { [sortField]: sortDir } });
    pipeline.push({
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 1 } }],
        total: [{ $count: 'count' }],
      },
    });

    const [aggResult] = await Shift.aggregate(pipeline);
    const rows = Array.isArray(aggResult?.items) ? aggResult.items : [];
    const totalItems = Number(aggResult?.total?.[0]?.count ?? 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const ids = rows.map((r) => r._id).filter(Boolean);

    if (ids.length === 0) {
      return { items: [], page, limit, totalItems, totalPages };
    }

    const shifts = await Shift.find({ _id: { $in: ids }, company_id: companyId })
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id')
      .sort({ [sortField]: sortDir });

    const decorated = await this._decorateListShifts(shifts, companyId);
    return { items: decorated, page, limit, totalItems, totalPages };
  }

  async createShift(companyId, data, opts = {}) {
    await this._dropLegacyAssignmentIndexIfExists();
    await this._validateShiftReferences(companyId, data);
    await this._validateRoleIds(companyId, data.positions || []);

    const { start_time, end_time } = this._assignmentBoundariesFromInput(data.positions);
    const shift = await Shift.create({
      company_id: companyId,
      client_id: data.client_id,
      job_id: data.job_id,
      name: data.name,
      client_rep_id: data.client_rep_id || null,
      date: data.date,
      start_time,
      end_time,
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
        assigned_by: this._assignedByForPersistedAssignment(a, opts.actorUserId),
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

    if (opts?.summary) {
      return this._getShiftSummary(shift._id, companyId);
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

    const workerIds = [
      ...new Set(
        assignmentDocs.flatMap((doc) =>
          (doc.assignments || []).map((a) => a.worker_id).filter((id) => id != null),
        ),
      ),
    ];
    const workers =
      workerIds.length > 0
        ? await User.find({ _id: { $in: workerIds } }).select('_id first_name last_name name email').lean()
        : [];
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

  async updateShift(shiftId, companyId, data, opts = {}) {
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
    if (Array.isArray(data.positions)) {
      const { start_time, end_time } = this._assignmentBoundariesFromInput(data.positions);
      updatePayload.start_time = start_time;
      updatePayload.end_time = end_time;
    }
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
          assigned_by: this._assignedByForPersistedAssignment(a, opts.actorUserId),
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

    if (opts?.summary) {
      return this._getShiftSummary(shiftId, companyId);
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
    }).populate('shift_id', 'name date location status job_id client_id start_time end_time');
    return docs;
  }

  async getWorkerUpcomingShifts(workerId, companyId) {
    const now = new Date();
    const docs = await this.getWorkerAssignedShifts(workerId, companyId);
    return docs.filter((doc) => doc.shift_id && new Date(doc.shift_id.date) >= now);
  }

  async getWorkerShiftsCalendar(workerId, companyId, query = {}) {
    const dateFromRaw = (query.date_from || '').toString().trim();
    const dateToRaw = (query.date_to || '').toString().trim();
    const includeParam = query.include;
    const includeRaw =
      includeParam === undefined || includeParam === null || String(includeParam).trim() === ''
        ? 'both'
        : String(includeParam).trim().toLowerCase();

    if (!dateFromRaw || !dateToRaw) {
      throw new AppError('date_from and date_to are required', 400);
    }

    if (!['assigned', 'open', 'both'].includes(includeRaw)) {
      throw new AppError('include must be one of: assigned, open, both', 400);
    }
    const include = includeRaw;

    const from = new Date(dateFromRaw);
    const to = new Date(dateToRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError('Invalid date_from/date_to', 400);
    }
    if (from > to) {
      throw new AppError('date_from must be before or equal to date_to', 400);
    }

    const shiftIdSet = new Set();

    const collectAssignedIds = async () => {
      const rows = await ShiftPositionAssignment.aggregate([
        {
          $match: {
            company_id: companyId,
            assignments: {
              $elemMatch: {
                worker_id: workerId,
                status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
              },
            },
          },
        },
        {
          $lookup: {
            from: 'shifts',
            localField: 'shift_id',
            foreignField: '_id',
            as: 'shift',
          },
        },
        { $unwind: '$shift' },
        {
          $match: {
            'shift.company_id': companyId,
            'shift.date': { $gte: from, $lte: to },
            'shift.status': { $ne: 'draft' },
          },
        },
        { $group: { _id: '$shift_id' } },
      ]);
      for (const row of rows) {
        if (row?._id) shiftIdSet.add(String(row._id));
      }
    };

    const collectOpenIds = async () => {
      const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId }).lean();
      const roleObjectIds = (wrDoc?.roles || [])
        .map((r) => r.company_role_id)
        .filter((id) => id && mongoose.isValidObjectId(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)));

      if (roleObjectIds.length === 0) return;

      const rows = await ShiftPosition.aggregate([
        {
          $match: {
            company_id: companyId,
            positions: {
              $elemMatch: {
                company_role_id: { $in: roleObjectIds },
                status: { $in: ['open', 'partially_filled'] },
              },
            },
          },
        },
        {
          $lookup: {
            from: 'shifts',
            localField: 'shift_id',
            foreignField: '_id',
            as: 'shift',
          },
        },
        { $unwind: '$shift' },
        {
          $match: {
            'shift.company_id': companyId,
            'shift.status': 'published',
            'shift.date': { $gte: from, $lte: to },
          },
        },
        { $group: { _id: '$shift_id' } },
      ]);

      for (const row of rows) {
        if (row?._id) shiftIdSet.add(String(row._id));
      }
    };

    if (include === 'both') {
      await Promise.all([collectAssignedIds(), collectOpenIds()]);
    } else if (include === 'assigned') {
      await collectAssignedIds();
    } else {
      await collectOpenIds();
    }

    const ids = [...shiftIdSet]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (ids.length === 0) return [];

    const shifts = await Shift.find({ _id: { $in: ids }, company_id: companyId, date: { $gte: from, $lte: to } })
      .populate('job_id')
      .populate('client_id')
      .populate('client_rep_id')
      .sort({ date: -1 });

    return this._decorateShiftsWithPositionsAndStaff(shifts, companyId, { includeStaff: true });
  }

  _toObjectId(id) {
    if (id == null) return null;
    const raw = id && id._id ? id._id : id;
    if (!mongoose.isValidObjectId(raw)) return null;
    return new mongoose.Types.ObjectId(String(raw));
  }

  /** ObjectIds for User._id and optional linked ClientRepresentative id (same person, alternate refs). */
  _repIdsObjectIdsForClientRepUser(user) {
    const repIdSet = new Set();
    repIdSet.add(String(user._id));
    if (user.client_rep_id) {
      const crId = user.client_rep_id._id ? user.client_rep_id._id : user.client_rep_id;
      if (crId) repIdSet.add(String(crId));
    }
    return [...repIdSet]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }

  _clientRepIdMatchClause(user) {
    const repIds = this._repIdsObjectIdsForClientRepUser(user);
    return repIds.length === 1 ? repIds[0] : { $in: repIds };
  }

  /**
   * Full shift detail for client portal (same payload as admin `getShift`) after access check.
   */
  async getClientRepShiftDetail(shiftId, user, companyId) {
    const companyOid = this._toObjectId(companyId);
    if (!companyOid) {
      throw new AppError('Invalid company context', 400);
    }
    const sid = this._toObjectId(shiftId);
    if (!sid) {
      throw new AppError('Invalid shift id', 400);
    }
    const repClause = this._clientRepIdMatchClause(user);
    const allowed = await Shift.findOne({
      _id: sid,
      company_id: companyOid,
      client_rep_id: repClause,
    })
      .select('_id')
      .lean();
    if (!allowed) {
      throw new AppError('Shift not found', 404);
    }
    return this.getShift(sid, companyOid);
  }

  /**
   * Client portal: shifts where the logged-in user is the designated representative.
   * Matches `shift.client_rep_id` to the rep's User id and/or linked ClientRepresentative id.
   * Does not require `user.client_id` — many client_rep accounts only have `company_id` + role;
   * access is still scoped by company and designated rep on each shift.
   */
  async getClientRepShiftsCalendar(user, companyId, query = {}) {
    const dateFromRaw = (query.date_from || '').toString().trim();
    const dateToRaw = (query.date_to || '').toString().trim();

    if (!dateFromRaw || !dateToRaw) {
      throw new AppError('date_from and date_to are required', 400);
    }

    // Inclusive UTC calendar days for YYYY-MM-DD (covers whole last day, not only midnight)
    const from = new Date(`${dateFromRaw}T00:00:00.000Z`);
    const to = new Date(`${dateToRaw}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError('Invalid date_from/date_to', 400);
    }
    if (from > to) {
      throw new AppError('date_from must be before or equal to date_to', 400);
    }

    const MAX_RANGE_DAYS = 400;
    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs < 0 || rangeMs > MAX_RANGE_DAYS * 86400000) {
      throw new AppError(`date range must be between 0 and ${MAX_RANGE_DAYS} days`, 400);
    }

    const repClause = this._clientRepIdMatchClause(user);

    const companyOid = this._toObjectId(companyId);
    if (!companyOid) {
      throw new AppError('Invalid company context', 400);
    }

    // Do not filter by shift.client_id here: it must match the designated rep, but user.client_id
    // can be missing or out of sync with legacy shift rows while company_id + client_rep_id are correct.
    const match = {
      company_id: companyOid,
      client_rep_id: repClause,
      date: { $gte: from, $lte: to },
      status: { $ne: 'cancelled' },
    };

    const shifts = await Shift.find(match)
      .populate({ path: 'job_id', select: 'name' })
      .populate({ path: 'client_id', select: 'name' })
      .populate({ path: 'client_rep_id', select: 'first_name last_name name email' })
      .sort({ date: 1 })
      .lean();

    if (!shifts.length) {
      return [];
    }

    return this._decorateShiftsWithPositionsAndStaff(shifts, companyId, { includeStaff: true });
  }

  /**
   * Whether the worker may load full shift detail (same rules as calendar: assigned on non-draft,
   * or published open/partial position matching their company roles).
   */
  async _workerCanViewShiftDetail(workerId, companyId, shift) {
    const shiftId = shift._id;

    const assigned = await ShiftPositionAssignment.findOne({
      company_id: companyId,
      shift_id: shiftId,
      assignments: {
        $elemMatch: {
          worker_id: workerId,
          status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
        },
      },
    })
      .select('_id')
      .lean();
    if (assigned) {
      if (String(shift.status || '') === 'draft') return false;
      return true;
    }

    if (String(shift.status || '') !== 'published') return false;

    const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId }).lean();
    const roleIds = new Set(
      (wrDoc?.roles || [])
        .map((r) => r.company_role_id)
        .filter((id) => id && mongoose.isValidObjectId(String(id)))
        .map((id) => String(id)),
    );
    if (roleIds.size === 0) return false;

    const posDoc = await ShiftPosition.findOne({ company_id: companyId, shift_id: shiftId }).populate(
      'positions.company_role_id',
    );
    if (!posDoc) return false;

    for (const p of posDoc.positions || []) {
      const rid = String(p.company_role_id?._id || p.company_role_id || '');
      if (!roleIds.has(rid)) continue;
      if (['open', 'partially_filled'].includes(p.status)) return true;
    }
    return false;
  }

  /**
   * Worker portal: only positions whose company_role is on the worker's WorkerRole list, plus any
   * line where this worker has an active assignment (covers stale role data).
   */
  async _filterShiftPayloadForWorkerView(payload, workerId, companyId) {
    const spRaw = payload.shift_positions;
    if (!spRaw) return payload;

    const wrDoc = await WorkerRole.findOne({ worker_id: workerId, company_id: companyId }).lean();
    const allowedRoleIds = new Set(
      (wrDoc?.roles || [])
        .map((r) => r.company_role_id)
        .filter((id) => id != null)
        .map((id) => String(id)),
    );

    const spObj =
      typeof spRaw.toObject === 'function'
        ? spRaw.toObject({ depopulate: false })
        : { ...spRaw };
    const posArr = Array.isArray(spObj.positions) ? spObj.positions : [];
    const assignmentsArr = Array.isArray(payload.shift_position_assignments)
      ? payload.shift_position_assignments
      : [];

    const wid = String(workerId);

    const positionLineId = (p) => String(p._id || p.id || '');

    const positionIncluded = (p) => {
      const itemId = positionLineId(p);
      if (!itemId) return false;
      const crid = String(p.company_role_id?._id || p.company_role_id || '');
      const roleMatch = allowedRoleIds.size > 0 && allowedRoleIds.has(crid);

      const doc = assignmentsArr.find((d) => String(d.shift_position_item_id) === itemId);
      const assignedHere =
        doc &&
        (doc.assignments || []).some(
          (a) =>
            a.worker_id &&
            String(a.worker_id) === wid &&
            ACTIVE_ASSIGNMENT_STATUSES.includes(String(a.status || '')),
        );

      return Boolean(roleMatch || assignedHere);
    };

    const filteredPos = posArr.filter(positionIncluded);
    const keptIds = new Set(filteredPos.map((p) => positionLineId(p)).filter(Boolean));

    const filteredAssign = assignmentsArr.filter((d) => keptIds.has(String(d.shift_position_item_id)));

    return {
      ...payload,
      shift_positions: { ...spObj, positions: filteredPos },
      shift_position_assignments: filteredAssign,
    };
  }

  /** Full shift payload for worker portal overview (JWT). Same as admin detail, then role-filtered. */
  async getWorkerShiftDetail(shiftId, workerId, companyId) {
    if (!mongoose.isValidObjectId(String(shiftId))) {
      throw new AppError('Invalid shift id', 400);
    }
    const shift = await Shift.findOne({ _id: shiftId, company_id: companyId });
    if (!shift) throw new AppError('Shift not found', 404);

    const allowed = await this._workerCanViewShiftDetail(workerId, companyId, shift);
    if (!allowed) throw new AppError('Shift not found', 404);

    const full = await this.getShift(shiftId, companyId);
    return this._filterShiftPayloadForWorkerView(full, workerId, companyId);
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
    const [client, job, rep] = await Promise.all([
      Client.findOne({ _id: data.client_id, company_id: companyId, status: 'active' }).select('_id').lean(),
      Job.findOne({ _id: data.job_id, company_id: companyId, client_id: data.client_id, status: 'active' }).select('_id').lean(),
      data.client_rep_id
        ? User.findOne({ _id: data.client_rep_id, company_id: companyId, client_id: data.client_id, role: 'client_rep', is_active: true }).select('_id').lean()
        : Promise.resolve(true),
    ]);

    if (!client) throw new AppError('Client not found', 404);
    if (!job) throw new AppError('Job not found for selected client', 404);
    if (data.client_rep_id && !rep) throw new AppError('Client representative not found for selected client', 404);
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

  async getShiftFilters(companyId) {
    const [roleDocs, locationsRaw, jobIdsRaw] = await Promise.all([
      CompanyRole.find({ company_id: companyId, is_active: true }).select('_id name').sort({ name: 1 }).lean(),
      Shift.distinct('location', { company_id: companyId }),
      Shift.distinct('job_id', { company_id: companyId }),
    ]);

    const locations = (Array.isArray(locationsRaw) ? locationsRaw : [])
      .map((l) => (typeof l === 'string' ? l.trim() : ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const jobIds = (Array.isArray(jobIdsRaw) ? jobIdsRaw : []).filter(Boolean);
    const jobs = jobIds.length
      ? await Job.find({ _id: { $in: jobIds }, company_id: companyId }).select('_id name').sort({ name: 1 }).lean()
      : [];

    return {
      roles: roleDocs.map((r) => ({ id: String(r._id), name: r.name })),
      locations,
      jobs: jobs.map((j) => ({ id: String(j._id), name: j.name })),
    };
  }

  /**
   * Jobs that appear on at least one company shift — search + pagination for admin filters.
   */
  async getShiftJobsPaged(companyId, filters = {}) {
    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const qRaw = typeof filters.q === 'string' ? filters.q.trim() : '';
    const cacheKey = filterResponseCache.makeKey('shiftFilters:jobs', companyId, { q: qRaw, page, limit });
    const cached = filterResponseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = qRaw ? new RegExp(escapeRegex(qRaw), 'i') : null;
    const skip = (page - 1) * limit;

    const companyOid =
      mongoose.Types.ObjectId.isValid(companyId) && String(companyId).length === 24
        ? mongoose.Types.ObjectId.createFromHexString(String(companyId))
        : companyId;

    // Indexed distinct — avoids scanning every shift into a $group + $lookup pipeline.
    const jobIdsRaw = await Shift.distinct('job_id', {
      company_id: companyOid,
      job_id: { $exists: true, $ne: null },
    });
    const jobIds = (Array.isArray(jobIdsRaw) ? jobIdsRaw : []).filter(Boolean);
    if (!jobIds.length) {
      return { items: [], page, limit, totalItems: 0, totalPages: 0 };
    }

    const jobQuery = { _id: { $in: jobIds }, company_id: companyOid };
    if (searchRegex) {
      jobQuery.name = searchRegex;
    }

    const [rows, totalItems] = await Promise.all([
      Job.find(jobQuery).select('_id name').sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(jobQuery),
    ]);

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const result = {
      items: rows.map((j) => ({
        id: String(j._id),
        value: j.name,
        label: j.name,
      })),
      page,
      limit,
      totalItems,
      totalPages,
    };
    filterResponseCache.set(cacheKey, result);
    return result;
  }

  /**
   * Distinct shift locations for the company, with optional substring search and pagination.
   */
  async getShiftLocationsPaged(companyId, filters = {}) {
    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const qRaw = typeof filters.q === 'string' ? filters.q.trim().toLowerCase() : '';
    const cacheKey = filterResponseCache.makeKey('shiftFilters:locations', companyId, {
      q: qRaw,
      page,
      limit,
    });
    const cached = filterResponseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const skip = (page - 1) * limit;

    const companyOid =
      mongoose.Types.ObjectId.isValid(companyId) && String(companyId).length === 24
        ? mongoose.Types.ObjectId.createFromHexString(String(companyId))
        : companyId;

    // Single distinct pass (uses company_id + location index); unique location count is usually small.
    const locationsRaw = await Shift.distinct('location', {
      company_id: companyOid,
      location: { $type: 'string', $nin: [null, ''] },
    });
    let rows = (Array.isArray(locationsRaw) ? locationsRaw : [])
      .map((l) => (typeof l === 'string' ? l.trim() : ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (qRaw) {
      rows = rows.filter((l) => l.toLowerCase().includes(qRaw));
    }

    const totalItems = rows.length;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const slice = rows.slice(skip, skip + limit);
    const items = slice.map((location) => ({
      id: location,
      value: location,
      label: location,
    }));

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
}

module.exports = new ShiftService();
