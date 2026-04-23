'use strict';

const mongoose = require('mongoose');
const ShiftPositionAssignment = require('../shift/ShiftPositionAssignment');
const { AppError } = require('../../common/middleware/error.middleware');

const VALID_SHIFT_STATUSES = ['draft', 'published', 'in_progress', 'completed', 'cancelled'];

class CalenderService {
  // ─── Shared lookup stages (4–16) used by both worker and unassigned pipelines ───

  _buildLookupStages(shiftLookupPipeline, jobLookupPipeline) {
    return [
      {
        $lookup: {
          from: 'shifts',
          let: { shiftId: '$shift_id' },
          pipeline: shiftLookupPipeline,
          as: 'shift',
        },
      },
      { $unwind: '$shift' },
      {
        $lookup: {
          from: 'jobs',
          let: { jobId: '$shift.job_id' },
          pipeline: jobLookupPipeline,
          as: 'job',
        },
      },
      { $unwind: '$job' },
      {
        $lookup: {
          from: 'clients',
          localField: 'shift.client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignments.worker_id',
          foreignField: '_id',
          as: 'worker',
        },
      },
      { $unwind: { path: '$worker', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'shift_positions',
          localField: 'shift_position_id',
          foreignField: '_id',
          as: 'shiftPosition',
        },
      },
      { $unwind: { path: '$shiftPosition', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          positionItem: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$shiftPosition.positions', []] },
                  as: 'pos',
                  cond: { $eq: ['$$pos._id', '$shift_position_item_id'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'company_roles',
          localField: 'positionItem.company_role_id',
          foreignField: '_id',
          as: 'companyRole',
        },
      },
      { $unwind: { path: '$companyRole', preserveNullAndEmptyArrays: true } },
    ];
  }

  // ─── Workers aggregation (view=user) ─────────────────────────────────────────

  async _getWorkerView(companyId, filters, page, limit) {
    const { from, to, shiftLookupPipeline, jobLookupPipeline } = filters;
    const skip = (page - 1) * limit;

    const pipeline = [
      // Stage 1: indexed match on company + date range
      {
        $match: {
          company_id: companyId,
          'assignments.system_date': { $gte: from, $lte: to },
        },
      },
      // Stage 2: flatten assignment items
      { $unwind: '$assignments' },
      // Stage 3: filter by date + assigned slots only
      {
        $match: {
          'assignments.system_date': { $gte: from, $lte: to },
          'assignments.worker_id': { $ne: null },
        },
      },
      // Stages 4–16: all lookups
      ...this._buildLookupStages(shiftLookupPipeline, jobLookupPipeline),
      // Stage 17: compute duration_hours + names before grouping
      {
        $addFields: {
          duration_hours: {
            $divide: [
              { $subtract: ['$assignments.system_end_time', '$assignments.system_start_time'] },
              3600000,
            ],
          },
          _worker_name: {
            $cond: {
              if: { $gt: [{ $ifNull: ['$worker._id', null] }, null] },
              then: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$worker.first_name', ''] },
                      ' ',
                      { $ifNull: ['$worker.last_name', ''] },
                    ],
                  },
                },
              },
              else: null,
            },
          },
          _role_name: { $ifNull: ['$companyRole.name', null] },
        },
      },
      // Stage 18: shape the assignment sub-doc for $push, keep grouping fields at top level
      {
        $project: {
          _id: 0,
          worker_id: '$assignments.worker_id',
          _worker_name: 1,
          _role_name: 1,
          duration_hours: 1,
          assignment: {
            shift_id: '$shift_id',
            start_time: { $dateToString: { format: '%H:%M', date: '$assignments.system_start_time' } },
            end_time: { $dateToString: { format: '%H:%M', date: '$assignments.system_end_time' } },
            system_date: '$assignments.system_date',
            shift_name: '$shift.name',
            job_name: '$job.name',
            client_name: { $ifNull: ['$client.name', null] },
            status: { $ifNull: ['$shift.status', null] },
            assignment_status: '$assignments.status',
            position_status: '$status',
            job_color: { $ifNull: ['$job.color', null] },
            client_color: { $ifNull: ['$client.color', null] },
            worker_role: { $ifNull: ['$companyRole.name', null] },
          },
        },
      },
      // Stage 19: group by worker
      {
        $group: {
          _id: '$worker_id',
          worker_id: { $first: '$worker_id' },
          worker_name: { $first: '$_worker_name' },
          worker_role: { $first: '$_role_name' },
          total_hours: { $sum: '$duration_hours' },
          assignments: { $push: '$assignment' },
        },
      },
      // Stage 20: sort workers alphabetically
      { $sort: { worker_name: 1 } },
      // Stage 21: single-pass count + paginated slice
      {
        $facet: {
          total: [{ $count: 'count' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                worker_id: 1,
                worker_name: 1,
                worker_role: 1,
                total_hours: { $round: ['$total_hours', 2] },
                assignments: 1,
              },
            },
          ],
        },
      },
    ];

    const [result] = await ShiftPositionAssignment.aggregate(pipeline);
    return result;
  }

  // ─── Unassigned slots aggregation ────────────────────────────────────────────

  async _getUnassignedSlots(companyId, filters) {
    const { from, to, shiftLookupPipeline, jobLookupPipeline } = filters;

    const pipeline = [
      // Stage 1: indexed match on company + date range
      {
        $match: {
          company_id: companyId,
          'assignments.system_date': { $gte: from, $lte: to },
        },
      },
      // Stage 2: flatten assignment items
      { $unwind: '$assignments' },
      // Stage 3: filter by date + unassigned slots only
      {
        $match: {
          'assignments.system_date': { $gte: from, $lte: to },
          'assignments.worker_id': null,
        },
      },
      // Stages 4–16: all lookups
      ...this._buildLookupStages(shiftLookupPipeline, jobLookupPipeline),
      // Stage 17: project flat assignment shape (no worker fields)
      {
        $project: {
          _id: 0,
          shift_id: '$shift_id',
          start_time: { $dateToString: { format: '%H:%M', date: '$assignments.system_start_time' } },
          end_time: { $dateToString: { format: '%H:%M', date: '$assignments.system_end_time' } },
          system_date: '$assignments.system_date',
          shift_name: '$shift.name',
          job_name: '$job.name',
          client_name: { $ifNull: ['$client.name', null] },
          status: { $ifNull: ['$shift.status', null] },
          assignment_status: '$assignments.status',
          position_status: '$status',
          job_color: { $ifNull: ['$job.color', null] },
          client_color: { $ifNull: ['$client.color', null] },
          worker_role: { $ifNull: ['$companyRole.name', null] },
        },
      },
      { $sort: { system_date: 1, start_time: 1 } },
    ];

    return ShiftPositionAssignment.aggregate(pipeline);
  }

  // ─── Public method ────────────────────────────────────────────────────────────

  async getAssignmentsByDateRange(companyId, query = {}) {
    const dateFromRaw = (query.date_from || '').toString().trim();
    const dateToRaw = (query.date_to || '').toString().trim();

    if (!dateFromRaw || !dateToRaw) {
      throw new AppError('date_from and date_to are required', 400);
    }

    const from = new Date(dateFromRaw);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(dateToRaw);
    to.setUTCHours(23, 59, 59, 999);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError('Invalid date_from or date_to', 400);
    }
    if (from > to) {
      throw new AppError('date_from must be before or equal to date_to', 400);
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

    if (query.shift_status && !VALID_SHIFT_STATUSES.includes(query.shift_status)) {
      throw new AppError(`Invalid shift_status. Must be one of: ${VALID_SHIFT_STATUSES.join(', ')}`, 400);
    }
    const shiftStatus = query.shift_status || null;

    const jobId =
      query.job_id && mongoose.isValidObjectId(query.job_id)
        ? new mongoose.Types.ObjectId(query.job_id)
        : null;
    if (query.job_id && !jobId) {
      throw new AppError('Invalid job_id', 400);
    }

    const location = query.location ? query.location.toString().trim() : null;

    // Build $lookup sub-pipeline for shifts
    const shiftLookupPipeline = [
      { $match: { $expr: { $eq: ['$_id', '$$shiftId'] } } },
    ];
    if (shiftStatus) shiftLookupPipeline.push({ $match: { status: shiftStatus } });
    if (jobId) shiftLookupPipeline.push({ $match: { job_id: jobId } });

    // Build $lookup sub-pipeline for jobs
    const jobLookupPipeline = [
      { $match: { $expr: { $eq: ['$_id', '$$jobId'] } } },
    ];
    if (location) {
      jobLookupPipeline.push({ $match: { location: { $regex: location, $options: 'i' } } });
    }

    const filters = { from, to, shiftLookupPipeline, jobLookupPipeline };

    // Run both aggregations in parallel
    const [workersResult, unassigned_slots] = await Promise.all([
      this._getWorkerView(companyId, filters, page, limit),
      this._getUnassignedSlots(companyId, filters),
    ]);

    const total = workersResult?.total?.[0]?.count ?? 0;
    const data = workersResult?.data ?? [];

    return {
      unassigned_slots,
      data,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new CalenderService();
