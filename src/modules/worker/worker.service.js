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
const TimeOffRequest = require('./TimeOffRequest');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const config = require('../../config');
const passwordResetTokenService = require('../../common/services/passwordResetToken.service');
const CompanyRole = require('../company/CompanyRole');
const Training = require('../company/Training');
const { v4: uuidv4 } = require('uuid');

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

  async getWorkers(companyId, filters = {}) {
    const query = { company_id: companyId, role: 'worker' };
    if (filters.status) {
      query.status = filters.status;
    }

    const users = await User.find(query).sort({ createdAt: -1 }).lean();
    const ids = users.map((u) => u._id);

    const [roleDocs, trainingDocs] = await Promise.all([
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
    ]);

    const roleByWorker = new Map(roleDocs.map((d) => [String(d.worker_id), d]));
    const trainByWorker = new Map(
      trainingDocs.map((d) => [String(d.worker_id), this.normalizeWorkerTrainingLean(d)])
    );

    return users.map((u) => ({
      ...u,
      worker_roles: roleByWorker.get(String(u._id)) || null,
      worker_trainings: trainByWorker.get(String(u._id)) || null,
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
    };
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
    user.approved_by = approvedBy;
    user.approved_at = new Date();
    await user.save();

    return user;
  }

  async suspendWorker(workerUserId, companyId) {
    const user = await User.findOneAndUpdate(
      { _id: workerUserId, company_id: companyId, role: 'worker' },
      { status: 'suspended' },
      { new: true }
    );

    if (!user) {
      throw new AppError('Worker not found', 404);
    }

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
    } else {
      user.status = 'pending_approval';
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
}

module.exports = new WorkerService();
