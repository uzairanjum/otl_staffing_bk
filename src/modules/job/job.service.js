const mongoose = require('mongoose');
const Job = require('./Job');
const Shift = require('../shift/Shift');
const { AppError } = require('../../common/middleware/error.middleware');

class JobService {
  _escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _maybeObjectId(id) {
    if (typeof id !== 'string') return null;
    const trimmed = id.trim();
    if (!trimmed) return null;
    return /^[a-f\d]{24}$/i.test(trimmed) ? trimmed : null;
  }

  _parsePaging(filters = {}, defaultLimit = 5) {
    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : defaultLimit;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    return { page, limit, skip: (page - 1) * limit };
  }

  async _shiftStatsByJobIds(companyId, jobIds) {
    if (!Array.isArray(jobIds) || jobIds.length === 0) return {};
    const shiftStats = await Shift.aggregate([
      {
        $match: {
          company_id: companyId,
          job_id: { $in: jobIds },
        },
      },
      {
        $group: {
          _id: '$job_id',
          total_shifts: { $sum: 1 },
          active_shifts: {
            $sum: {
              $cond: [{ $in: ['$status', ['draft', 'published', 'in_progress']] }, 1, 0],
            },
          },
        },
      },
    ]);
    return Object.fromEntries(shiftStats.map((row) => [String(row._id), row]));
  }

  _decorateJobsWithShiftStats(items, byJobId) {
    return items.map((j) => {
      const stats = byJobId[String(j._id)];
      return {
        ...j,
        total_shifts: stats?.total_shifts ?? 0,
        active_shifts: stats?.active_shifts ?? 0,
      };
    });
  }

  async getJobs(companyId, filters = {}) {
    const leanList = ['1', 'true', 'yes'].includes(String(filters.lean_list || '').toLowerCase());
    if (leanList && filters.client_id) {
      const asId = this._maybeObjectId(filters.client_id);
      if (!asId) return [];
      const query = {
        company_id: companyId,
        client_id: mongoose.Types.ObjectId.createFromHexString(asId),
      };
      if (filters.status) query.status = filters.status;
      const limitRaw = parseInt(filters.limit, 10);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100, 1), 200);
      return Job.find(query).select('_id name status').sort({ createdAt: -1 }).limit(limit).lean();
    }

    const isPagedRequest =
      filters.page != null || filters.limit != null || (typeof filters.q === 'string' && filters.q.trim());

    // Backwards-safe behavior: if no pagination/search params are provided, keep the original
    // "return an array of all jobs" response shape for existing callers.
    if (!isPagedRequest) {
      const query = { company_id: companyId };
      if (filters.status) query.status = filters.status;
      if (filters.client_id) {
        const asId = this._maybeObjectId(filters.client_id);
        query.client_id = asId ? require('mongoose').Types.ObjectId.createFromHexString(asId) : filters.client_id;
      }

      const jobs = await Job.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'clients',
            localField: 'client_id',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, address: 1, organization: 1 } }],
            as: 'client_id',
          },
        },
        { $unwind: { path: '$client_id', preserveNullAndEmptyArrays: true } },
      ]);
      if (!jobs.length) return [];

      const jobIds = jobs.map((j) => j._id);
      const byJobId = await this._shiftStatsByJobIds(companyId, jobIds);
      return this._decorateJobsWithShiftStats(jobs, byJobId);
    }

    const { page, limit, skip } = this._parsePaging(filters, 5);
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';

    const match = { company_id: companyId };
    if (filters.status) match.status = filters.status;
    if (filters.client_id) {
      const asId = this._maybeObjectId(filters.client_id);
      match.client_id = asId ? require('mongoose').Types.ObjectId.createFromHexString(asId) : filters.client_id;
    }

    const searchRegex = q ? new RegExp(this._escapeRegex(q), 'i') : null;

    // Optimized pipeline:
    // - Project minimal client fields in lookup
    // - Apply search after lookup so "client-name-only" searches work correctly
    const pipeline = [{ $match: match }];

    pipeline.push(
      {
        $lookup: {
          from: 'clients',
          localField: 'client_id',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, address: 1, organization: 1 } }],
          as: 'client_id',
        },
      },
      { $unwind: { path: '$client_id', preserveNullAndEmptyArrays: true } },
    );

    // If user searched, match both job + client fields.
    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { location: searchRegex },
            { 'client_id.name': searchRegex },
            { 'client_id.organization': searchRegex },
            { 'client_id.address': searchRegex },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [aggResult] = await Job.aggregate(pipeline);
    const items = Array.isArray(aggResult?.items) ? aggResult.items : [];
    const totalItems = Number(aggResult?.total?.[0]?.count ?? 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    if (!items.length) {
      return {
        items: [],
        page,
        limit,
        totalItems,
        totalPages,
      };
    }

    const jobIds = items.map((j) => j._id);
    const byJobId = await this._shiftStatsByJobIds(companyId, jobIds);
    const enriched = this._decorateJobsWithShiftStats(items, byJobId);

    return {
      items: enriched,
      page,
      limit,
      totalItems,
      totalPages,
    };
  }

  async searchJobs(companyId, filters = {}) {
    const { page, limit, skip } = this._parsePaging(filters, 5);
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';

    const match = { company_id: companyId };
    if (filters.status) match.status = filters.status;
    if (filters.client_id) {
      const asId = this._maybeObjectId(filters.client_id);
      match.client_id = asId ? require('mongoose').Types.ObjectId.createFromHexString(asId) : filters.client_id;
    }

    const searchRegex = q ? new RegExp(this._escapeRegex(q), 'i') : null;
    const pipeline = [{ $match: match }];

    // Join client with minimal projection (needed for client-name searches + table display).
    pipeline.push(
      {
        $lookup: {
          from: 'clients',
          localField: 'client_id',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, address: 1, organization: 1 } }],
          as: 'client_id',
        },
      },
      { $unwind: { path: '$client_id', preserveNullAndEmptyArrays: true } },
    );

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { location: searchRegex },
            { 'client_id.name': searchRegex },
            { 'client_id.organization': searchRegex },
            { 'client_id.address': searchRegex },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [aggResult] = await Job.aggregate(pipeline);
    const items = Array.isArray(aggResult?.items) ? aggResult.items : [];
    const totalItems = Number(aggResult?.total?.[0]?.count ?? 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    if (!items.length) {
      return { items: [], page, limit, totalItems, totalPages };
    }

    const jobIds = items.map((j) => j._id);
    const byJobId = await this._shiftStatsByJobIds(companyId, jobIds);
    return {
      items: this._decorateJobsWithShiftStats(items, byJobId),
      page,
      limit,
      totalItems,
      totalPages,
    };
  }

  async getJobFilters(companyId) {
    const Client = require('../client/Client');
    const [clients] = await Promise.all([
      Client.find({ company_id: companyId }, { _id: 1, name: 1 }).sort({ name: 1 }).lean(),
    ]);

    return {
      clients: (clients || []).map((c) => ({ id: String(c._id), name: c.name || '' })).filter((c) => c.id && c.name),
      statuses: ['draft', 'active', 'inactive', 'completed', 'cancelled'],
    };
  }

  async createJob(companyId, data) {
    const job = await Job.create({
      ...data,
      company_id: companyId
    });
    return job.populate('client_id');
  }

  async getJob(jobId, companyId) {
    const job = await Job.findOne({ _id: jobId, company_id: companyId }).populate('client_id');
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }

  async updateJob(jobId, companyId, data) {
    const job = await Job.findOneAndUpdate(
      { _id: jobId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    ).populate('client_id');
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }

  async deleteJob(jobId, companyId) {
    const job = await Job.findOneAndUpdate(
      { _id: jobId, company_id: companyId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!job) {
      throw new AppError('Job not found', 404);
    }
    return job;
  }

  /**
   * Client portal: jobs scoped to the rep's `user.client_id` and company.
   * Single indexed find + parallel count; batched shift stats (one aggregation for all job ids on page).
   */
  async getClientRepJobs(user, companyId, query = {}) {
    if (!user.client_id) {
      throw new AppError('Client representative is not linked to a client account', 403);
    }

    const companyOid = mongoose.isValidObjectId(companyId)
      ? new mongoose.Types.ObjectId(String(companyId))
      : null;
    if (!companyOid) {
      throw new AppError('Invalid company context', 400);
    }
    const clientOid = new mongoose.Types.ObjectId(String(user.client_id));

    const page = Number.isFinite(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1;
    const limitRaw = Number.isFinite(Number(query.limit)) ? Number(query.limit) : 24;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const skip = (page - 1) * limit;

    const match = {
      company_id: companyOid,
      client_id: clientOid,
    };

    const filter = typeof query.filter === 'string' ? query.filter.trim().toLowerCase() : '';
    switch (filter) {
      case 'active':
        match.status = 'active';
        break;
      case 'completed':
        match.status = 'completed';
        break;
      case 'inactive':
        match.status = 'inactive';
        break;
      case 'draft':
        match.status = 'draft';
        break;
      case 'cancelled':
        match.status = 'cancelled';
        break;
      case 'hiring':
        match.status = { $in: ['draft', 'active'] };
        break;
      default:
        break;
    }

    const [items, totalItems] = await Promise.all([
      Job.find(match)
        .select('_id name description location status createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(match),
    ]);

    const jobIds = items.map((j) => j._id);
    const byJobId = await this._shiftStatsByJobIds(companyOid, jobIds);
    const enriched = this._decorateJobsWithShiftStats(items, byJobId);

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    return {
      items: enriched.map((j) => ({
        id: String(j._id),
        name: j.name,
        description: typeof j.description === 'string' ? j.description : '',
        location: typeof j.location === 'string' ? j.location : '',
        status: j.status,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        total_shifts: j.total_shifts ?? 0,
        active_shifts: j.active_shifts ?? 0,
      })),
      page,
      limit,
      totalItems,
      totalPages,
    };
  }
}

module.exports = new JobService();
