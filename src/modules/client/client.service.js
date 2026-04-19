const mongoose = require('mongoose');
const Client = require('./Client');
const Job = require('../job/Job');
const User = require('../../common/models/User');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const config = require('../../config');
const passwordResetTokenService = require('../../common/services/passwordResetToken.service');
const { v4: uuidv4 } = require('uuid');

class ClientService {
  _escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  generateTempPassword() {
    return uuidv4().slice(0, 8) + 'A1!';
  }

  async getClients(companyId, query = {}) {
    if (!companyId) {
      throw new AppError('Company context required', 400);
    }
    // Backward-compatible: if paging/search params provided, return paged object.
    if (query && (query.q !== undefined || query.page !== undefined || query.limit !== undefined)) {
      return this.searchClients(companyId, query);
    }
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Single round-trip: clients + jobs_count per client.
    return Client.aggregate([
      { $match: { company_id: companyObjectId } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'jobs',
          let: { clientId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$company_id', companyObjectId] },
                    { $eq: ['$client_id', '$$clientId'] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'job_count',
        },
      },
      {
        $addFields: {
          jobs_count: { $ifNull: [{ $first: '$job_count.count' }, 0] },
        },
      },
      {
        $project: {
          job_count: 0,
        },
      },
    ]);
  }

  async searchClients(companyId, query = {}) {
    if (!companyId) {
      throw new AppError('Company context required', 400);
    }
    const q = (query.q || '').toString().trim();
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limitRaw = parseInt(query.limit, 10);
    const limit = Math.min(Math.max(limitRaw || 10, 1), 50);
    const skip = (page - 1) * limit;

    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const match = { company_id: companyObjectId };
    if (q) {
      const escaped = this._escapeRegex(q);
      const rx = new RegExp(escaped, 'i');
      // Fast + reliable partial matching for email/phone/name (incl. '@' and '.').
      match.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const skipJobsCount = ['1', 'true', 'yes'].includes(
      String(query.skip_jobs_count ?? query.skip_job_counts ?? '').toLowerCase(),
    );

    const itemsWithCounts = [
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'jobs',
          let: { clientId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$company_id', companyObjectId] },
                    { $eq: ['$client_id', '$$clientId'] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'job_count',
        },
      },
      {
        $addFields: {
          jobs_count: { $ifNull: [{ $first: '$job_count.count' }, 0] },
        },
      },
      { $project: { job_count: 0 } },
    ];

    const itemsLight = [
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          jobs_count: { $literal: 0 },
        },
      },
    ];

    const [result] = await Client.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: skipJobsCount ? itemsLight : itemsWithCounts,
          totalCount: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $first: '$totalCount.count' }, 0] },
        },
      },
    ]);

    const total = result?.total || 0;
    return {
      items: result?.items || [],
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  async createClient(companyId, data) {
    const client = await Client.create({
      ...data,
      company_id: companyId
    });
    return client;
  }

  async getClient(clientId, companyId) {
    const client = await Client.findOne({ _id: clientId, company_id: companyId });
    if (!client) {
      throw new AppError('Client not found', 404);
    }

    const representatives = await User.find({
      client_id: clientId,
      company_id: companyId,
      role: 'client_rep'
    })
      .select('_id client_id company_id name email phone address representativerole status role first_login refresh_token is_active createdAt updatedAt')
      .sort({ createdAt: -1 });

    const jobs = await Job.find({ client_id: clientId, company_id: companyId }).sort({ createdAt: -1 });

    return { ...client.toObject(), representatives, jobs };
  }

  async createClientWithDetails(companyId, data) {
    const representatives = Array.isArray(data.representatives) ? data.representatives : [];
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    if (representatives.length < 1) {
      throw new AppError('At least one client representative is required', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [client] = await Client.create([{
        company_id: companyId,
        name: data.client.name,
        email: data.client.email,
        phone: data.client.phone,
        organization: data.client.organization,
        address: data.client.address,
        notes: data.client.notes,
        website: data.client.website,
        status: data.client.status || 'active'
      }], { session });

      const createdRepresentatives = [];
      const invitationPayloads = [];

      for (const rep of representatives) {
        const normalizedEmail = rep.email.toLowerCase();
        const existingUser = await User.findOne({
          email: normalizedEmail,
          company_id: companyId
        }).session(session);

        if (existingUser) {
          throw new AppError(`Representative email already in use: ${normalizedEmail}`, 400);
        }

        const tempPassword = this.generateTempPassword();
        const representativeUser = await User.create([{
          client_id: client._id,
          company_id: companyId,
          name: rep.name,
          email: normalizedEmail,
          phone: rep.phone,
          address: rep.address,
          representativerole: rep.representativerole,
          password_hash: tempPassword,
          status: 'active',
          role: 'client_rep',
          first_login: true,
          is_active: true
        }], { session });

        createdRepresentatives.push(representativeUser[0]);
        invitationPayloads.push({
          email: normalizedEmail,
          name: rep.name,
          userId: representativeUser[0]._id,
        });
      }

      let createdJobs = [];
      if (jobs.length > 0) {
        createdJobs = await Job.create(
          jobs.map(job => ({
            company_id: companyId,
            client_id: client._id,
            name: job.name,
            description: job.description,
            location: job.location,
            status: job.status || 'active'
          })),
          { session, ordered: true }
        );
      }

      const baseUrl = config.passwordReset.frontendUrl.replace(/\/$/, '');
      for (const invite of invitationPayloads) {
        const rawToken = await passwordResetTokenService.createTokenForUser(invite.userId, session);
        await sendEmailWithTemplate(invite.email, 'Welcome to OTL Staffing', 'invitation', {
          name: invite.name,
          email: invite.email,
          setPasswordUrl: `${baseUrl}/auth/set-password?token=${rawToken}`,
          expiryMinutes: config.passwordReset.expiryMinutes,
        });
      }

      await session.commitTransaction();

      return {
        client,
        representatives: createdRepresentatives,
        jobs: createdJobs
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateClientWithDetails(clientId, companyId, data) {
    const representatives = Array.isArray(data.representatives) ? data.representatives : [];
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    if (representatives.length < 1) {
      throw new AppError('At least one client representative is required', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const client = await Client.findOne({ _id: clientId, company_id: companyId }).session(session);
      if (!client) {
        throw new AppError('Client not found', 404);
      }

      client.name = data.client.name;
      client.email = data.client.email;
      client.phone = data.client.phone;
      client.organization = data.client.organization;
      client.address = data.client.address;
      client.notes = data.client.notes;
      client.website = data.client.website;
      client.status = data.client.status || client.status;
      await client.save({ session });

      const existingReps = await User.find({
        client_id: clientId,
        company_id: companyId,
        role: 'client_rep'
      }).session(session);
      const existingRepMap = new Map(existingReps.map(rep => [rep._id.toString(), rep]));

      const retainedRepIds = new Set();
      const newRepInvitations = [];

      for (const rep of representatives) {
        const normalizedEmail = rep.email.toLowerCase();
        if (rep.id && existingRepMap.has(rep.id)) {
          const currentRep = existingRepMap.get(rep.id);
          const duplicateEmailUser = await User.findOne({
            email: normalizedEmail,
            company_id: companyId,
            _id: { $ne: currentRep._id }
          }).session(session);

          if (duplicateEmailUser) {
            throw new AppError(`Representative email already in use: ${normalizedEmail}`, 400);
          }

          currentRep.name = rep.name;
          currentRep.email = normalizedEmail;
          currentRep.phone = rep.phone;
          currentRep.address = rep.address;
          currentRep.representativerole = rep.representativerole;
          currentRep.is_active = true;
          currentRep.status = 'active';
          await currentRep.save({ session });
          retainedRepIds.add(currentRep._id.toString());
          continue;
        }

        const existingUser = await User.findOne({
          email: normalizedEmail,
          company_id: companyId
        }).session(session);
        if (existingUser) {
          throw new AppError(`Representative email already in use: ${normalizedEmail}`, 400);
        }

        const tempPassword = this.generateTempPassword();
        const createdRep = await User.create([{
          client_id: clientId,
          company_id: companyId,
          name: rep.name,
          email: normalizedEmail,
          phone: rep.phone,
          address: rep.address,
          representativerole: rep.representativerole,
          password_hash: tempPassword,
          status: 'active',
          role: 'client_rep',
          first_login: true,
          is_active: true
        }], { session });

        retainedRepIds.add(createdRep[0]._id.toString());
        newRepInvitations.push({
          email: normalizedEmail,
          name: rep.name,
          userId: createdRep[0]._id,
        });
      }

      const repsToDelete = existingReps
        .filter(rep => !retainedRepIds.has(rep._id.toString()))
        .map(rep => rep._id);
      if (repsToDelete.length > 0) {
        await User.deleteMany({
          _id: { $in: repsToDelete },
          company_id: companyId,
          client_id: clientId,
          role: 'client_rep'
        }).session(session);
      }

      const existingJobs = await Job.find({ client_id: clientId, company_id: companyId }).session(session);
      const existingJobMap = new Map(existingJobs.map(job => [job._id.toString(), job]));
      const retainedJobIds = new Set();

      for (const job of jobs) {
        if (job.id && existingJobMap.has(job.id)) {
          const currentJob = existingJobMap.get(job.id);
          currentJob.name = job.name;
          currentJob.description = job.description;
          currentJob.location = job.location;
          currentJob.status = job.status || currentJob.status;
          await currentJob.save({ session });
          retainedJobIds.add(currentJob._id.toString());
          continue;
        }

        const createdJob = await Job.create([{
          company_id: companyId,
          client_id: clientId,
          name: job.name,
          description: job.description,
          location: job.location,
          status: job.status || 'active'
        }], { session });
        retainedJobIds.add(createdJob[0]._id.toString());
      }

      const jobsToDelete = existingJobs
        .filter(job => !retainedJobIds.has(job._id.toString()))
        .map(job => job._id);
      if (jobsToDelete.length > 0) {
        await Job.deleteMany({
          _id: { $in: jobsToDelete },
          company_id: companyId,
          client_id: clientId
        }).session(session);
      }

      const inviteBaseUrl = config.passwordReset.frontendUrl.replace(/\/$/, '');
      for (const invite of newRepInvitations) {
        const rawToken = await passwordResetTokenService.createTokenForUser(invite.userId, session);
        await sendEmailWithTemplate(invite.email, 'Welcome to OTL Staffing', 'invitation', {
          name: invite.name,
          email: invite.email,
          setPasswordUrl: `${inviteBaseUrl}/auth/set-password?token=${rawToken}`,
          expiryMinutes: config.passwordReset.expiryMinutes,
        });
      }

      await session.commitTransaction();
      return this.getClient(clientId, companyId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateClient(clientId, companyId, data) {
    const client = await Client.findOneAndUpdate(
      { _id: clientId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!client) {
      throw new AppError('Client not found', 404);
    }
    return client;
  }

  async deleteClient(clientId, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const client = await Client.findOne({ _id: clientId, company_id: companyId }).session(session);
      if (!client) {
        throw new AppError('Client not found', 404);
      }

      await User.deleteMany({
        client_id: clientId,
        company_id: companyId,
        role: 'client_rep'
      }).session(session);

      await Job.deleteMany({
        client_id: clientId,
        company_id: companyId
      }).session(session);

      await Client.deleteOne({
        _id: clientId,
        company_id: companyId
      }).session(session);

      await session.commitTransaction();
      return { message: 'Client and related data deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getRepresentatives(clientId, companyId) {
    const exists = await Client.exists({ _id: clientId, company_id: companyId });
    if (!exists) {
      throw new AppError('Client not found', 404);
    }
    return User.find({
      client_id: clientId,
      company_id: companyId,
      role: 'client_rep',
    })
      .select('_id name email phone representativerole')
      .sort({ createdAt: -1 })
      .lean();
  }

  async createRepresentative(clientId, companyId, data) {
    await this.getClient(clientId, companyId);

    const normalizedEmail = data.email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail, company_id: companyId });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const tempPassword = this.generateTempPassword();
    const repName = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();

    const user = await User.create({
      client_id: clientId,
      company_id: companyId,
      name: repName,
      email: normalizedEmail,
      phone: data.phone,
      address: data.address,
      representativerole: data.representativerole,
      password_hash: tempPassword,
      status: 'active',
      role: 'client_rep',
      first_login: true,
      is_active: true
    });

    const rawToken = await passwordResetTokenService.createTokenForUser(user._id);
    const baseUrl = config.passwordReset.frontendUrl.replace(/\/$/, '');
    await sendEmailWithTemplate(normalizedEmail, 'Welcome to OTL Staffing', 'invitation', {
      name: repName,
      email: normalizedEmail,
      setPasswordUrl: `${baseUrl}/auth/set-password?token=${rawToken}`,
      expiryMinutes: config.passwordReset.expiryMinutes,
    });

    return user;
  }

  async updateRepresentative(clientId, repId, companyId, data) {
    await this.getClient(clientId, companyId);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.representativerole !== undefined) updateData.representativerole = data.representativerole;
    if (data.status !== undefined) updateData.status = data.status;

    const representative = await User.findOneAndUpdate(
      { _id: repId, client_id: clientId, company_id: companyId, role: 'client_rep' },
      updateData,
      { new: true, runValidators: true }
    );

    if (!representative) {
      throw new AppError('Representative not found', 404);
    }

    return representative;
  }

  async deleteRepresentative(clientId, repId, companyId) {
    await this.getClient(clientId, companyId);

    const representative = await User.findOneAndUpdate(
      { _id: repId, client_id: clientId, company_id: companyId, role: 'client_rep' },
      { is_active: false, status: 'inactive', refresh_token: null },
      { new: true }
    );

    if (!representative) {
      throw new AppError('Representative not found', 404);
    }

    return { message: 'Representative deleted successfully' };
  }
}

module.exports = new ClientService();
