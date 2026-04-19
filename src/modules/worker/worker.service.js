const mongoose = require('mongoose');
const User = require('../../common/models/User');
const WorkerAddress = require('./WorkerAddress');
const WorkerTaxInfo = require('./WorkerTaxInfo');
const WorkerBankDetail = require('./WorkerBankDetail');
const WorkerRole = require('./WorkerRole');
const WorkerTraining = require('./WorkerTraining');
const WorkerTrainingDocument = require('./WorkerTrainingDocument');
const WorkerWorkingHours = require('./WorkerWorkingHours');
const WorkerFile = require('./WorkerFile');
const WorkerEmergencyContact = require('./WorkerEmergencyContact');
const WorkerTimeOff = require('./WorkerTimeOff');
const TimeOffRequest = require('./TimeOffRequest');
const { cloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const config = require('../../config');
const passwordResetTokenService = require('../../common/services/passwordResetToken.service');
const CompanyRole = require('../company/CompanyRole');
const Training = require('../company/Training');
const { v4: uuidv4 } = require('uuid');
const { filterResponseCache } = require('../../common/utils/filter-response-cache');
const FcmToken = require('../notification/FcmToken');

class WorkerService {
  generateTempPassword() {
    return uuidv4().slice(0, 8) + 'A1!';
  }

  buildRoleAssignments(data, roleIds) {
    if (data.role_assignments && data.role_assignments.length > 0) {
      return data.role_assignments.map((r) => ({
        company_role_id: String(r.company_role_id),
        hourly_rate_override:
          r.hourly_rate_override !== undefined && r.hourly_rate_override !== null
            ? Number(r.hourly_rate_override)
            : undefined,
      }));
    }
    return roleIds.map((id) => ({
      company_role_id: String(id),
      hourly_rate_override: undefined,
    }));
  }

  /**
   * Maps each training id to company role ids that require it among the given role documents.
   */
  buildTrainingIdToRoleIdsMap(companyRoleDocs) {
    const map = new Map();
    for (const role of companyRoleDocs) {
      const rid = role._id;
      for (const tid of role.required_training_ids || []) {
        const key = String(tid);
        if (!map.has(key)) {
          map.set(key, []);
        }
        const list = map.get(key);
        if (!list.some((x) => String(x) === String(rid))) {
          list.push(rid);
        }
      }
    }
    return map;
  }

  buildInviteWorkerTrainingEntries(combinedTrainingIds, activeRequiredFromRoles, trainingIdToRoleIds) {
    const requiredSet = new Set(activeRequiredFromRoles.map(String));
    return combinedTrainingIds.map((trainingId) => {
      const tid = String(trainingId);
      const linkedToAssignedRoles = requiredSet.has(tid);
      const role_ids = linkedToAssignedRoles ? trainingIdToRoleIds.get(tid) || [] : [];
      return {
        training_id: trainingId,
        status: 'assigned',
        role_ids,
      };
    });
  }

  /** Ensures each training subdoc has role_ids for lean/API consistency (legacy rows). */
  normalizeWorkerTrainingLean(doc) {
    if (!doc) return null;
    return {
      ...doc,
      trainings: (doc.trainings || []).map((t) => ({
        ...t,
        role_ids: Array.isArray(t.role_ids) ? t.role_ids : [],
      })),
    };
  }

  async upsertWorkerRoleEntry(workerUserId, companyId, company_role_id, hourly_rate_override) {
    const rid = String(company_role_id);
    let doc = await WorkerRole.findOne({
      worker_id: workerUserId,
      company_id: companyId,
    });
    if (!doc) {
      await WorkerRole.create({
        company_id: companyId,
        worker_id: workerUserId,
        roles: [
          {
            company_role_id: rid,
            hourly_rate_override:
              hourly_rate_override !== undefined ? hourly_rate_override : undefined,
          },
        ],
      });
      return;
    }
    const idx = doc.roles.findIndex((r) => String(r.company_role_id) === rid);
    if (idx >= 0) {
      if (hourly_rate_override !== undefined) {
        doc.roles[idx].hourly_rate_override = hourly_rate_override;
      }
    } else {
      doc.roles.push({
        company_role_id: rid,
        hourly_rate_override:
          hourly_rate_override !== undefined ? hourly_rate_override : undefined,
      });
    }
    await doc.save();
  }

  async inviteWorker(companyId, data) {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const roleIds = Array.from(new Set((data.role_ids || []).map(String)));
    const roleAssignments = this.buildRoleAssignments(data, roleIds);
    const assignmentRoleIds = Array.from(
      new Set(roleAssignments.map((r) => String(r.company_role_id)))
    );

    if (assignmentRoleIds.length > 0) {
      const roleCount = await CompanyRole.countDocuments({
        _id: { $in: assignmentRoleIds },
        company_id: companyId,
        is_active: true,
      });
      if (roleCount !== assignmentRoleIds.length) {
        throw new AppError('One or more selected roles are invalid', 400);
      }
    }

    const roles = assignmentRoleIds.length > 0
      ? await CompanyRole.find({
          _id: { $in: assignmentRoleIds },
          company_id: companyId,
          is_active: true,
        })
      : [];

    const requiredTrainingIdsFromRoles = Array.from(
      new Set(roles.flatMap((r) => (r.required_training_ids || []).map(String)))
    );
    let activeRequiredFromRoles = [];
    if (requiredTrainingIdsFromRoles.length > 0) {
      const activeRoleTrainings = await Training.find({
        _id: { $in: requiredTrainingIdsFromRoles },
        company_id: companyId,
        is_active: true,
      })
        .select('_id')
        .lean();
      activeRequiredFromRoles = activeRoleTrainings.map((t) => String(t._id));
    }

    const additionalTrainingIds = Array.from(
      new Set((data.additional_training_ids || []).map(String))
    );
    const combinedTrainingIds = Array.from(
      new Set([...activeRequiredFromRoles, ...additionalTrainingIds])
    );

    const trainingIdToRoleIds = this.buildTrainingIdToRoleIdsMap(roles);
    const inviteTrainingPayload = this.buildInviteWorkerTrainingEntries(
      combinedTrainingIds,
      activeRequiredFromRoles,
      trainingIdToRoleIds
    );

    if (combinedTrainingIds.length > 0) {
      const validTrainingsCount = await Training.countDocuments({
        _id: { $in: combinedTrainingIds },
        company_id: companyId,
        is_active: true,
      });
      if (validTrainingsCount !== combinedTrainingIds.length) {
        throw new AppError('One or more selected trainings are invalid', 400);
      }
    }

    const tempPassword = this.generateTempPassword();

    const session = await User.startSession();
    session.startTransaction();

    try {
      const [user] = await User.create(
        [
          {
            company_id: companyId,
            email: data.email.toLowerCase(),
            password_hash: tempPassword,
            role: 'worker',
            first_login: true,
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
            status: 'invited',
            onboarding_step: 0,
            contract_signed: false,
          },
        ],
        { session }
      );

      const roleById = new Map();
      for (const r of roleAssignments) {
        const id = String(r.company_role_id);
        roleById.set(id, r);
      }
      const rolesPayload = [...roleById.values()].map((r) => ({
        company_role_id: r.company_role_id,
        ...(r.hourly_rate_override !== undefined
          ? { hourly_rate_override: r.hourly_rate_override }
          : {}),
      }));

      if (rolesPayload.length > 0) {
        await WorkerRole.create(
          [
            {
              company_id: companyId,
              worker_id: user._id,
              roles: rolesPayload,
            },
          ],
          { session }
        );
      }

      if (inviteTrainingPayload.length > 0) {
        await WorkerTraining.create(
          [
            {
              company_id: companyId,
              worker_id: user._id,
              trainings: inviteTrainingPayload,
            },
          ],
          { session }
        );
      }

      if (data.send_invite !== false) {
        const rawToken = await passwordResetTokenService.createTokenForUser(user._id, session);
        const baseUrl = config.passwordReset.frontendUrl.replace(/\/$/, '');
        await sendEmailWithTemplate(data.email, 'Welcome to OTL Staffing', 'invitation', {
          name: `${data.first_name} ${data.last_name}`,
          email: data.email,
          setPasswordUrl: `${baseUrl}/auth/set-password?token=${rawToken}`,
          expiryMinutes: config.passwordReset.expiryMinutes,
        });
      }

      await session.commitTransaction();

      const staffProfile = {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.status,
        onboarding_step: user.onboarding_step,
        email: user.email,
      };

      return { user, worker: staffProfile };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async _enrichWorkersWithRolesAndTrainings(companyId, users) {
    const ids = users.map((u) => u._id);
    if (ids.length === 0) {
      return [];
    }

    const [roleDocs, trainingDocs, addressDocs] = await Promise.all([
      WorkerRole.find({ worker_id: { $in: ids }, company_id: companyId })
        .populate({
          path: 'roles.company_role_id',
          select: 'name default_hourly_rate',
        })
        .lean(),
      WorkerTraining.find({ worker_id: { $in: ids }, company_id: companyId })
        .populate([
          { path: 'trainings.training_id', select: 'name' },
          { path: 'trainings.role_ids', select: 'name' },
        ])
        .lean(),
      WorkerAddress.find({ worker_id: { $in: ids } }).select('worker_id city').lean(),
    ]);

    const roleByWorker = new Map(roleDocs.map((d) => [String(d.worker_id), d]));
    const trainByWorker = new Map(
      trainingDocs.map((d) => [String(d.worker_id), this.normalizeWorkerTrainingLean(d)])
    );
    const cityByWorker = new Map();
    for (const d of addressDocs) {
      const wid = String(d.worker_id);
      if (!cityByWorker.has(wid)) {
        cityByWorker.set(wid, String(d.city ?? '').trim());
      }
    }

    return users.map((u) => ({
      ...u,
      worker_roles: roleByWorker.get(String(u._id)) || null,
      worker_trainings: trainByWorker.get(String(u._id)) || null,
      /** Trimmed `worker_addresses.city` for list UIs (All Staff location). */
      address_city: cityByWorker.get(String(u._id)) || '',
    }));
  }

  async getWorkers(companyId, filters = {}) {
    const query = { company_id: companyId, role: 'worker' };
    if (filters.status) {
      query.status = filters.status;
    }

    const users = await User.find(query).sort({ createdAt: -1 }).lean();
    return this._enrichWorkersWithRolesAndTrainings(companyId, users);
  }

  /**
   * Approved workers only (same company as JWT). Indexed query + parallel role/training hydration.
   */
  async getApprovedWorkers(companyId) {
    const users = await User.find({
      company_id: companyId,
      role: 'worker',
      approved: true,
    })
      .sort({ approved_at: -1, createdAt: -1 })
      .lean();
    return this._enrichWorkersWithRolesAndTrainings(companyId, users);
  }

  /**
   * Distinct trimmed `worker_addresses.city` for approved workers in this company (admin location filter).
   * Joins `worker_addresses` → `users` so only company-approved workers contribute cities.
   */
  async getApprovedWorkerLocationFacets(companyId, filters = {}) {
    const page = Number.isFinite(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedLimit =
      Number.isFinite(Number(filters.limit)) && Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = q ? new RegExp(escapeRegex(q), 'i') : null;

    const cacheKey = filterResponseCache.makeKey('workerFilters:approvedCities', companyId, {
      q,
      page,
      limit,
    });
    const cached = filterResponseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const companyOid = new mongoose.Types.ObjectId(String(companyId));
    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'worker_id',
          foreignField: '_id',
          as: 'workerUser',
        },
      },
      { $unwind: '$workerUser' },
      {
        $match: {
          'workerUser.company_id': companyOid,
          'workerUser.role': 'worker',
          'workerUser.approved': true,
        },
      },
      {
        $addFields: {
          loc: { $trim: { input: { $ifNull: ['$city', ''] } } },
        },
      },
      { $match: { loc: { $nin: ['', null] } } },
    ];
    if (searchRegex) {
      pipeline.push({ $match: { loc: searchRegex } });
    }
    pipeline.push(
      { $group: { _id: '$loc' } },
      { $sort: { _id: 1 } },
      {
        $facet: {
          pageSlice: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'c' }],
        },
      },
    );

    const [agg] = await WorkerAddress.aggregate(pipeline);
    if (!agg) {
      const empty = { items: [], page, limit, totalItems: 0, totalPages: 0 };
      filterResponseCache.set(cacheKey, empty);
      return empty;
    }
    const rows = agg.pageSlice || [];
    const totalItems = agg.totalCount?.[0]?.c ?? 0;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    const items = rows.map((r) => ({ name: r._id }));
    const result = { items, page, limit, totalItems, totalPages };
    filterResponseCache.set(cacheKey, result);
    return result;
  }

  async getActiveWorkersRoleBased(companyId, companyRoleId) {
    const roleId = String(companyRoleId || '').trim();
    if (!roleId) {
      throw new AppError('company_role_id is required', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      throw new AppError('Invalid company_role_id', 400);
    }

    const roleDocs = await WorkerRole.find({
      company_id: companyId,
      'roles.company_role_id': roleId,
    })
      .select('worker_id')
      .lean();

    const workerIds = Array.from(new Set(roleDocs.map((d) => String(d.worker_id)).filter(Boolean)));
    if (workerIds.length === 0) return [];

    const users = await User.find({
      _id: { $in: workerIds },
      company_id: companyId,
      role: 'worker',
      status: 'active',
    })
      .select('_id first_name last_name')
      .sort({ first_name: 1, last_name: 1 })
      .lean();

    return users.map((u) => ({
      id: String(u._id),
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    }));
  }

  async getWorker(workerUserId, companyId) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    const [
      workerRole,
      workerTraining,
      workerTrainingDocuments,
      address,
      taxInfo,
      bankDetail,
      workingHours,
      workerFileBundle,
      timeOffs,
      emergencyContact,
      workerTimeOff,
    ] = await Promise.all([
      WorkerRole.findOne({ worker_id: workerUserId, company_id: companyId }).populate(
        'roles.company_role_id'
      ),
      WorkerTraining.findOne({ worker_id: workerUserId, company_id: companyId }).populate([
        { path: 'trainings.training_id', select: 'name' },
        { path: 'trainings.role_ids', select: 'name' },
      ]),
      WorkerTrainingDocument.find({ worker_id: workerUserId, company_id: companyId }).lean(),
      WorkerAddress.findOne({ worker_id: workerUserId }),
      WorkerTaxInfo.findOne({ worker_id: workerUserId }),
      WorkerBankDetail.findOne({ worker_id: workerUserId }),
      WorkerWorkingHours.find({ worker_id: workerUserId }),
      WorkerFile.findOne({ worker_id: workerUserId }),
      TimeOffRequest.find({ worker_id: workerUserId, status: 'active' }),
      WorkerEmergencyContact.findOne({ worker_id: workerUserId }),
      WorkerTimeOff.findOne({ worker_id: workerUserId }),
    ]);

    return {
      ...user.toObject(),
      worker_roles_aggregate: workerRole,
      worker_trainings_aggregate: workerTraining,
      worker_training_documents_aggregate: workerTrainingDocuments,
      address,
      tax_info: taxInfo,
      bank_detail: bankDetail,
      emergency_contact: emergencyContact,
      working_hours: workingHours,
      files: workerFileBundle?.files || [],
      dvla_code: workerFileBundle?.dvla_code,
      dvla_date: workerFileBundle?.dvla_date,
      time_offs: timeOffs,
      worker_time_off: workerTimeOff,
    };
  }

  _advanceOnboardingStepIfExpected(user, expectedCurrentStep, nextStep, options = {}) {
    if (typeof user.onboarding_step !== 'number') return false;
    if (user.onboarding_step !== expectedCurrentStep) return false;

    user.onboarding_step = nextStep;
    if (options.setStatusOnboarding && user.status === 'invited') {
      user.status = 'onboarding';
    }
    return true;
  }

  async saveOnboardingContract(workerUserId, companyId, data) {
    const MAX_CONTRACT_LEN = 100000;
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (data.employment_contract_text !== undefined) {
      const raw = String(data.employment_contract_text ?? '');
      if (raw.length > MAX_CONTRACT_LEN) {
        throw new AppError('Contract text exceeds maximum length', 400);
      }
      user.employment_contract_text = raw;
    }

    /** Active workers: persist contract text only (no onboarding step / signature changes here). */
    if (user.status === 'active') {
      await user.save();
      return this.getWorker(workerUserId, companyId);
    }

    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    const expected = `${user.first_name} ${user.last_name}`.trim().replace(/\s+/g, ' ');
    if (name.toLowerCase() !== expected.toLowerCase()) {
      throw new AppError('Name does not match worker full name', 400);
    }

    if (this._advanceOnboardingStepIfExpected(user, 0, 1, { setStatusOnboarding: true })) {
      user.contract_signed = true;
      user.contract_signed_at = new Date();
    }

    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async saveOnboardingBasicInfo(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Basic onboarding info cannot be changed for active workers here', 400);
    }

    const email = data.email.trim().toLowerCase();
    if (email !== user.email) {
      const taken = await User.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (taken) {
        throw new AppError('Email already in use', 400);
      }
      user.email = email;
    }

    user.first_name = data.first_name.trim();
    user.last_name = data.last_name.trim();
    user.phone = data.phone.trim();

    const a = data.address || {};
    await WorkerAddress.findOneAndUpdate(
      { worker_id: user._id },
      {
        worker_id: user._id,
        address_line1: (a.address_line1 != null ? String(a.address_line1) : '').trim(),
        address_line2: (a.address_line2 != null ? String(a.address_line2) : '').trim(),
        city: (a.city != null ? String(a.city) : '').trim(),
        state: (a.state != null ? String(a.state) : '').trim(),
        postal_code: (a.postal_code != null ? String(a.postal_code) : '').trim(),
        country: (a.country != null ? String(a.country) : '').trim() || 'USA',
      },
      { upsert: true, new: true, runValidators: true }
    );

    this._advanceOnboardingStepIfExpected(user, 1, 2);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  _pickAddressField(data, nestedKey, flatKey) {
    const nested = data.address && typeof data.address === 'object' ? data.address : {};
    const fromNested = nested[nestedKey];
    const fromFlat = data[flatKey];
    const raw = fromNested !== undefined && fromNested !== null ? fromNested : fromFlat;
    return raw != null ? String(raw).trim() : '';
  }

  async saveOnboardingEmergencyContact(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Emergency contact cannot be changed for active workers here', 400);
    }

    const addressLine1 = this._pickAddressField(data, 'address_line1', 'address_line1');
    const addressLine2 = this._pickAddressField(data, 'address_line2', 'address_line2');
    const city = this._pickAddressField(data, 'city', 'city');
    const state = this._pickAddressField(data, 'state', 'state');
    const postalCode = this._pickAddressField(data, 'postal_code', 'postal_code');
    let country = this._pickAddressField(data, 'country', 'country');
    if (!country) {
      country = 'USA';
    }

    await WorkerEmergencyContact.findOneAndUpdate(
      { worker_id: user._id },
      {
        worker_id: user._id,
        contact_name: data.contact_name.trim(),
        phone: data.phone.trim(),
        relationship: data.relationship.trim(),
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country,
      },
      { upsert: true, new: true, runValidators: true }
    );

    this._advanceOnboardingStepIfExpected(user, 2, 3);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async saveOnboardingTaxBank(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Tax and bank details cannot be changed for active workers here', 400);
    }

    const taxNumber = data.tax_number != null ? String(data.tax_number).trim() : '';

    await WorkerTaxInfo.findOneAndUpdate(
      { worker_id: user._id },
      {
        worker_id: user._id,
        national_id: data.national_id.trim(),
        tax_number: taxNumber,
      },
      { upsert: true, new: true, runValidators: true }
    );

    await WorkerBankDetail.findOneAndUpdate(
      { worker_id: user._id },
      {
        worker_id: user._id,
        bank_name: data.bank_name.trim(),
        account_name: data.account_name.trim(),
        account_number: data.account_number.trim(),
        routing_number: data.routing_number.trim(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    this._advanceOnboardingStepIfExpected(user, 3, 4);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async saveOnboardingTimeOff(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Time off cannot be changed for active workers here', 400);
    }

    const entries = Array.isArray(data.entries) ? data.entries : [];
    const normalizedEntries = entries.map((entry, index) => {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime())) {
        throw new AppError(`Invalid time off date at row ${index + 1}`, 400);
      }

      const from = String(entry.from || '').trim();
      const to = String(entry.to || '').trim();
      if (!from || !to) {
        throw new AppError(`Time off from/to is required at row ${index + 1}`, 400);
      }
      if (from >= to) {
        throw new AppError(`Time off end time must be after start time at row ${index + 1}`, 400);
      }

      return {
        date,
        from,
        to,
      };
    });

    await WorkerTimeOff.findOneAndUpdate(
      { worker_id: user._id },
      {
        worker_id: user._id,
        notes: data.notes != null ? String(data.notes).trim() : '',
        entries: normalizedEntries,
      },
      { upsert: true, new: true, runValidators: true }
    );

    this._advanceOnboardingStepIfExpected(user, 4, 5);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async saveOnboardingDocuments(workerUserId, companyId) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Documents cannot be changed for active workers here', 400);
    }

    this._advanceOnboardingStepIfExpected(user, 5, 6);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async saveOnboardingTraining(workerUserId, companyId) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Training cannot be changed for active workers here', 400);
    }

    // Step 7 is the Review screen. Do not move to pending_approval here.
    // The worker/admin should only transition to pending_approval when Step 8 is completed.
    this._advanceOnboardingStepIfExpected(user, 6, 7);
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async completeOnboarding(workerUserId, companyId) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      throw new AppError('Onboarding cannot be changed for active workers here', 400);
    }

    const advanced = this._advanceOnboardingStepIfExpected(user, 7, 8);
    // Only change onboarding → pending_approval when completing step 8,
    // and only if the last onboarding_step in DB was exactly 7.
    if (advanced && user.status === 'onboarding') {
      user.status = 'pending_approval';
    }
    await user.save();
    return this.getWorker(workerUserId, companyId);
  }

  async updateWorker(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active') {
      const allowedFields = ['phone', 'profile_image_url'];
      const updateData = {};
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      }
      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(workerUserId, updateData);
      }
      return this.getWorker(workerUserId, companyId);
    }

    const allowed = [
      'first_name',
      'last_name',
      'phone',
      'profile_image_url',
    ];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        user[field] = data[field];
      }
    }
    await user.save();

    return this.getWorker(workerUserId, companyId);
  }

  async approveWorker(workerUserId, companyId, approvedBy) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    user.status = 'active';
    user.approved = true;
    user.approved_by = approvedBy;
    user.approved_at = new Date();
    await user.save();

    return user;
  }

  async inactiveWorker(workerUserId, companyId) {
    const user = await User.findOneAndUpdate(
      { _id: workerUserId, company_id: companyId, role: 'worker' },
      { status: 'inactive' },
      { new: true }
    );

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    return user;
  }

  // Backward-compatible alias; prefer inactiveWorker.
  async suspendWorker(workerUserId, companyId) {
    return this.inactiveWorker(workerUserId, companyId);
  }

  async activateWorker(workerUserId, companyId, activatedBy) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    user.status = 'active';
    user.approved = true;
    if (activatedBy) {
      user.approved_by = activatedBy;
    }
    user.approved_at = new Date();
    await user.save();

    return user;
  }

  async getWorkerFiles(workerUserId, companyId) {
    await this.getWorker(workerUserId, companyId);
    const bundle = await WorkerFile.findOne({ worker_id: workerUserId }).lean();
    if (!bundle) {
      return {
        worker_id: workerUserId,
        files: [],
        dvla_code: undefined,
        dvla_date: undefined,
      };
    }
    return bundle;
  }

  async getWorkerFileViewUrl(workerUserId, companyId, fileId) {
    await this.getWorker(workerUserId, companyId);

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError('Invalid file id', 400);
    }

    const bundle = await WorkerFile.findOne({ worker_id: workerUserId });
    if (!bundle) {
      throw new AppError('File not found', 404);
    }

    const sub = bundle.files.id(fileId);
    if (!sub) {
      throw new AppError('File not found', 404);
    }

    const publicId = sub.cloudinary_public_id ? String(sub.cloudinary_public_id).trim() : '';
    const fileUrl = sub.file_url ? String(sub.file_url).trim() : '';
    if (!publicId) {
      if (!fileUrl) throw new AppError('File missing URL', 500);
      return fileUrl;
    }

    // Infer delivery params from the stored Cloudinary URL when available.
    let resource_type = 'image';
    let format = 'pdf';
    try {
      const u = new URL(fileUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const rt = parts[0]; // "image" | "raw" | "video"
      if (rt === 'raw' || rt === 'image' || rt === 'video') {
        resource_type = rt;
      }
      const last = parts[parts.length - 1] || '';
      const ext = last.includes('.') ? last.split('.').pop() : '';
      if (ext) format = ext.toLowerCase();
    } catch {
      // If parsing fails, keep defaults.
    }

    const expires_at = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes
    const signed = cloudinary.utils.private_download_url(publicId, format, {
      resource_type,
      type: 'upload',
      expires_at,
    });
    return signed;
  }

  async getWorkerTrainingDocumentViewUrl(workerUserId, companyId, docId) {
    await this.getWorker(workerUserId, companyId);

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      throw new AppError('Invalid document id', 400);
    }

    const bundle = await WorkerTrainingDocument.findOne({
      worker_id: workerUserId,
      company_id: companyId,
      'documents._id': docId,
    });
    if (!bundle) {
      throw new AppError('Training document not found', 404);
    }

    const sub = bundle.documents.id(docId);
    if (!sub) {
      throw new AppError('Training document not found', 404);
    }

    const publicId = sub.cloudinary_public_id ? String(sub.cloudinary_public_id).trim() : '';
    const fileUrl = sub.file_url ? String(sub.file_url).trim() : '';
    if (!publicId) {
      if (!fileUrl) throw new AppError('Training document missing URL', 500);
      return fileUrl;
    }

    let resource_type = 'image';
    let format = 'pdf';
    try {
      const u = new URL(fileUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const rt = parts[0];
      if (rt === 'raw' || rt === 'image' || rt === 'video') {
        resource_type = rt;
      }
      const last = parts[parts.length - 1] || '';
      const ext = last.includes('.') ? last.split('.').pop() : '';
      if (ext) format = ext.toLowerCase();
    } catch {
      /* ignore */
    }

    const expires_at = Math.floor(Date.now() / 1000) + 60 * 5;
    const signed = cloudinary.utils.private_download_url(publicId, format, {
      resource_type,
      type: 'upload',
      expires_at,
    });
    return signed;
  }

  async uploadWorkerFile(workerUserId, companyId, fileData) {
    await this.getWorker(workerUserId, companyId);

    const file_url = String(fileData.file_url).trim();
    const cloudinaryPublicId =
      fileData.cloudinary_public_id != null ? String(fileData.cloudinary_public_id).trim() : '';
    const file_type = fileData.file_type;
    const uploaded_at = new Date();

    const setElem = {
      'files.$[elem].file_url': file_url,
      'files.$[elem].uploaded_at': uploaded_at,
      'files.$[elem].cloudinary_public_id': cloudinaryPublicId || null,
    };

    const updatedExisting = await WorkerFile.updateOne(
      { worker_id: workerUserId, 'files.file_type': file_type },
      { $set: setElem },
      { arrayFilters: [{ 'elem.file_type': file_type }] }
    );

    if (updatedExisting.matchedCount === 0) {
      await WorkerFile.updateOne(
        { worker_id: workerUserId },
        {
          $push: {
            files: {
              file_type,
              file_url,
              cloudinary_public_id: cloudinaryPublicId || undefined,
              uploaded_at,
            },
          },
          $setOnInsert: { worker_id: workerUserId },
        },
        { upsert: true }
      );
    }

    const bundle = await WorkerFile.findOne({ worker_id: workerUserId });
    const saved = bundle?.files?.find((f) => f.file_type === file_type);
    if (!saved) {
      throw new AppError('Failed to persist file', 500);
    }
    return saved.toObject();
  }

  async updateWorkerFilesMeta(workerUserId, companyId, data) {
    await this.getWorker(workerUserId, companyId);

    const hasDvlaCode = data.dvla_code !== undefined;
    const hasDvlaDate = data.dvla_date !== undefined;
    if (!hasDvlaCode && !hasDvlaDate) {
      const existing = await WorkerFile.findOne({ worker_id: workerUserId }).lean();
      if (!existing) {
        return {
          worker_id: workerUserId,
          files: [],
          dvla_code: undefined,
          dvla_date: undefined,
        };
      }
      return existing;
    }

    const set = {};
    const unset = {};

    if (hasDvlaCode) {
      const c = data.dvla_code;
      if (c != null && String(c).trim() !== '') {
        set.dvla_code = String(c).trim();
      } else {
        unset.dvla_code = '';
      }
    }

    if (hasDvlaDate) {
      const d = data.dvla_date;
      if (d === null || d === '') {
        unset.dvla_date = '';
      } else {
        const ms =
          typeof d === 'number' && !Number.isNaN(d)
            ? d
            : new Date(d).getTime();
        if (Number.isNaN(ms)) {
          unset.dvla_date = '';
        } else {
          set.dvla_date = new Date(ms);
        }
      }
    }

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const bundle = await WorkerFile.findOneAndUpdate(
      { worker_id: workerUserId },
      {
        ...update,
        $setOnInsert: { worker_id: workerUserId, files: [] },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return bundle.toObject();
  }

  async deleteWorkerFile(workerUserId, companyId, fileId) {
    await this.getWorker(workerUserId, companyId);

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError('Invalid file id', 400);
    }

    const bundle = await WorkerFile.findOne({ worker_id: workerUserId });
    if (!bundle) {
      throw new AppError('File not found', 404);
    }

    const sub = bundle.files.id(fileId);
    if (!sub) {
      throw new AppError('File not found', 404);
    }

    sub.deleteOne();
    await bundle.save();

    return { message: 'File deleted successfully' };
  }

  async getOnboardingStatus(workerUserId, companyId) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    return {
      status: user.status,
      onboarding_step: user.onboarding_step,
      contract_signed: user.contract_signed,
    };
  }

  async submitContract(workerUserId, companyId, name) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.contract_signed) {
      throw new AppError('Contract already signed', 400);
    }

    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    if (name.toLowerCase() !== fullName) {
      throw new AppError('Name does not match', 400);
    }

    user.contract_signed = true;
    user.contract_signed_at = new Date();
    user.onboarding_step = 1;
    user.status = 'onboarding';
    await user.save();

    return user;
  }

  async updateOnboardingStep(workerUserId, companyId, step, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    if (user.status === 'active' || user.status === 'pending_approval') {
      throw new AppError('Onboarding already completed', 400);
    }

    switch (step) {
      case 1:
        await WorkerAddress.findOneAndUpdate(
          { worker_id: workerUserId },
          { worker_id: workerUserId, ...data },
          { upsert: true }
        );
        break;
      case 2:
        await WorkerTaxInfo.findOneAndUpdate(
          { worker_id: workerUserId },
          { worker_id: workerUserId, ...data },
          { upsert: true }
        );
        if (data.bank_name) {
          await WorkerBankDetail.findOneAndUpdate(
            { worker_id: workerUserId },
            { worker_id: workerUserId, ...data },
            { upsert: true }
          );
        }
        break;
      case 3:
        await WorkerEmergencyContact.findOneAndUpdate(
          { worker_id: workerUserId },
          { worker_id: workerUserId, ...data },
          { upsert: true }
        );
        break;
      case 4:
        if (data.company_role_id) {
          await this.upsertWorkerRoleEntry(
            workerUserId,
            companyId,
            data.company_role_id,
            data.hourly_rate_override
          );
        }
        break;
      case 5:
        if (data.availability && data.availability.length > 0) {
          await WorkerWorkingHours.deleteMany({ worker_id: workerUserId });
          await WorkerWorkingHours.create(
            data.availability.map((h) => ({
              worker_id: workerUserId,
              day_of_week: h.day_of_week,
              start_time: h.start_time,
              end_time: h.end_time,
            }))
          );
        }
        break;
      case 6:
        break;
      case 7:
        break;
      default:
        throw new AppError('Invalid step', 400);
    }

    if (step < 7) {
      user.onboarding_step = step + 1;
    } else if (step === 7) {
      // Treat "step 7" as completing onboarding (moving to step 8).
      // Only flip status when the DB's current onboarding_step is exactly 7.
      const advanced = this._advanceOnboardingStepIfExpected(user, 7, 8);
      if (advanced && user.status === 'onboarding') {
        user.status = 'pending_approval';
      }
    }
    await user.save();

    return user;
  }

  async requestTimeOff(workerUserId, companyId, data) {
    const user = await User.findOne({
      _id: workerUserId,
      company_id: companyId,
      role: 'worker',
    });

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

    const timeOff = await TimeOffRequest.create({
      worker_id: workerUserId,
      company_id: companyId,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
    });

    return timeOff;
  }

  async getMyTimeOffs(workerUserId) {
    return TimeOffRequest.find({ worker_id: workerUserId }).sort({ createdAt: -1 });
  }

  async cancelTimeOff(timeOffId, workerUserId) {
    const timeOff = await TimeOffRequest.findOneAndUpdate(
      { _id: timeOffId, worker_id: workerUserId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!timeOff) {
      throw new AppError('Time off not found', 404);
    }

    return timeOff;
  }

  async getWorkerTimeOffs(workerUserId, companyId) {
    await this.getWorker(workerUserId, companyId);
    return TimeOffRequest.find({ worker_id: workerUserId }).sort({ createdAt: -1 });
  }

  /**
   * Remove Cloudinary assets referenced by worker file and training-document bundles (best-effort).
   */
  async _deleteCloudinaryAssetsForWorker(workerUserId, companyId) {
    const wid =
      workerUserId instanceof mongoose.Types.ObjectId
        ? workerUserId
        : new mongoose.Types.ObjectId(String(workerUserId));
    const companyOid =
      companyId instanceof mongoose.Types.ObjectId
        ? companyId
        : new mongoose.Types.ObjectId(String(companyId));

    const publicIds = new Set();
    const [fileBundle, trainingBundles] = await Promise.all([
      WorkerFile.findOne({ worker_id: wid }).lean(),
      WorkerTrainingDocument.find({ worker_id: wid, company_id: companyOid }).lean(),
    ]);

    if (fileBundle?.files?.length) {
      for (const f of fileBundle.files) {
        const pid = f.cloudinary_public_id ? String(f.cloudinary_public_id).trim() : '';
        if (pid) publicIds.add(pid);
      }
    }
    if (Array.isArray(trainingBundles)) {
      for (const b of trainingBundles) {
        for (const d of b.documents || []) {
          const pid = d.cloudinary_public_id ? String(d.cloudinary_public_id).trim() : '';
          if (pid) publicIds.add(pid);
        }
      }
    }

    await Promise.allSettled(
      [...publicIds].map((publicId) =>
        deleteFromCloudinary(publicId).catch(() => undefined),
      ),
    );
  }

  /**
   * Unassign worker from shift position rows so deleted user ids are not left referenced.
   */
  async _clearWorkerShiftAssignments(companyId, workerUserId) {
    const ShiftPositionAssignment = require('../shift/ShiftPositionAssignment');
    const wid =
      workerUserId instanceof mongoose.Types.ObjectId
        ? workerUserId
        : new mongoose.Types.ObjectId(String(workerUserId));
    const companyOid =
      companyId instanceof mongoose.Types.ObjectId
        ? companyId
        : new mongoose.Types.ObjectId(String(companyId));

    await ShiftPositionAssignment.updateMany(
      { company_id: companyOid, 'assignments.worker_id': wid },
      [
        {
          $set: {
            assignments: {
              $map: {
                input: '$assignments',
                as: 'a',
                in: {
                  $cond: [
                    { $eq: ['$$a.worker_id', wid] },
                    {
                      $mergeObjects: [
                        '$$a',
                        {
                          worker_id: null,
                          status: 'unassigned',
                        },
                      ],
                    },
                    '$$a',
                  ],
                },
              },
            },
          },
        },
      ],
    );
  }

  /**
   * Permanently remove a worker and related documents (admin, company-scoped). JWT via route.
   * Deletes are batched in parallel where safe; user row removed last.
   */
  async deleteWorker(workerUserId, companyId) {
    if (!mongoose.Types.ObjectId.isValid(workerUserId)) {
      throw new AppError('Invalid worker id', 400);
    }
    const wid = new mongoose.Types.ObjectId(String(workerUserId));
    const companyOid = new mongoose.Types.ObjectId(String(companyId));

    const exists = await User.findOne({
      _id: wid,
      company_id: companyOid,
      role: 'worker',
    })
      .select('_id')
      .lean();
    if (!exists) {
      throw new AppError('Worker not found', 404);
    }

    await this._deleteCloudinaryAssetsForWorker(wid, companyOid);
    await this._clearWorkerShiftAssignments(companyOid, wid);

    const filterWorker = { worker_id: wid };
    const filterWorkerCompany = { worker_id: wid, company_id: companyOid };

    await Promise.all([
      WorkerAddress.deleteMany(filterWorker),
      WorkerBankDetail.deleteMany(filterWorker),
      WorkerEmergencyContact.deleteMany(filterWorker),
      WorkerFile.deleteMany(filterWorker),
      WorkerRole.deleteMany(filterWorkerCompany),
      WorkerTaxInfo.deleteMany(filterWorker),
      WorkerTraining.deleteMany(filterWorkerCompany),
      WorkerTrainingDocument.deleteMany(filterWorkerCompany),
      WorkerTimeOff.deleteMany(filterWorker),
      WorkerWorkingHours.deleteMany(filterWorker),
      TimeOffRequest.deleteMany({ worker_id: wid, company_id: companyOid }),
      FcmToken.deleteMany({ user_id: wid }),
    ]);

    const deleted = await User.deleteOne({ _id: wid, company_id: companyOid, role: 'worker' });
    if (deleted.deletedCount !== 1) {
      throw new AppError('Worker could not be deleted', 500);
    }

    return { message: 'Worker deleted', id: String(wid) };
  }
}

module.exports = new WorkerService();
