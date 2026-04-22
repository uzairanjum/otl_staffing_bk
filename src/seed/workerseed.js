'use strict';

const User = require('../common/models/User');
const CompanyRole = require('../modules/company/CompanyRole');
const WorkerRole = require('../modules/worker/WorkerRole');
const WorkerWorkingHours = require('../modules/worker/WorkerWorkingHours');
const logger = require('../config/logger');

/** Matches app convention: 0 = Sunday … 6 = Saturday (same as company working hours seed). */
const SEED_WORK_START = '09:00';
const SEED_WORK_END = '21:00';

const WORKER_PASSWORD = 'admin@123';
const WORKER_TOTAL = 20;
const APPROVED_COUNT = 12;
const ONBOARDING_COUNT = 5;
const ROLES_PER_WORKER_MIN = 3;
const ROLES_PER_WORKER_MAX = 4;
/** Preferred role names from default seed (order preserved when present). */
const PREFERRED_ROLE_NAMES = ['Bartender', 'Server', 'Line Cook', 'Barback', 'Event Setup', 'Dishwasher'];

/**
 * Load distinct company role ids for seeding (pool for 3–4 roles per worker).
 * @param {import('mongoose').Types.ObjectId} companyId
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
async function resolveSeedCompanyRolePool(companyId) {
  const pool = [];
  const seen = new Set();
  for (const name of PREFERRED_ROLE_NAMES) {
    const r = await CompanyRole.findOne({ company_id: companyId, name, is_active: true }).select('_id').lean();
    if (r && !seen.has(String(r._id))) {
      seen.add(String(r._id));
      pool.push(r._id);
    }
  }
  if (pool.length < ROLES_PER_WORKER_MIN) {
    const more = await CompanyRole.find({ company_id: companyId, is_active: true })
      .sort({ name: 1 })
      .select('_id')
      .limit(12)
      .lean();
    for (const m of more) {
      if (!seen.has(String(m._id))) {
        seen.add(String(m._id));
        pool.push(m._id);
      }
      if (pool.length >= ROLES_PER_WORKER_MAX + 2) break;
    }
  }
  return pool;
}

/**
 * Pick 3–4 distinct role ids per worker, rotated by worker index so assignments vary.
 * @param {import('mongoose').Types.ObjectId[]} pool
 * @param {number} workerIndexOneBased 1..N
 */
function buildSeedWorkerAvailability() {
  return [1, 2, 3, 4, 5, 6].map((day_of_week) => ({
    day_of_week,
    active: true,
    start_time: SEED_WORK_START,
    end_time: SEED_WORK_END,
  }));
}

/**
 * @param {import('mongoose').Types.ObjectId} workerId
 */
async function ensureWorkerWorkingHours(workerId) {
  await WorkerWorkingHours.findOneAndUpdate(
    { worker_id: workerId },
    {
      worker_id: workerId,
      availability: buildSeedWorkerAvailability(),
    },
    { upsert: true, new: true, runValidators: true }
  );
}

function pickRoleIdsForWorker(pool, workerIndexOneBased) {
  if (!pool.length) return [];
  const count = pool.length >= ROLES_PER_WORKER_MAX ? ROLES_PER_WORKER_MAX : pool.length;
  const out = [];
  const start = (workerIndexOneBased - 1) % pool.length;
  for (let k = 0; k < count; k += 1) {
    out.push(pool[(start + k) % pool.length]);
  }
  return out;
}

/**
 * @param {{ company: import('mongoose').Document, adminUser: import('mongoose').Document | null }} opts
 */
async function seedDemoWorkers({ company, adminUser }) {
  const companyId = company._id;
  const adminId = adminUser?._id || null;

  const rolePool = await resolveSeedCompanyRolePool(companyId);
  if (rolePool.length < ROLES_PER_WORKER_MIN) {
    logger.warn('Worker seed skipped: need at least 3 company roles', {
      companyId: String(companyId),
      rolePoolSize: rolePool.length,
    });
    return { created: 0, skipped: 0, breakdown: null };
  }

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= WORKER_TOTAL; i += 1) {
    const padded = String(i).padStart(2, '0');
    const email = `worker_${padded}@otlstaffing.dev`;
    const firstName = 'Seed';
    const lastName = `Worker${padded}`;
    const roleIdsForWorker = pickRoleIdsForWorker(rolePool, i);

    const existing = await User.findOne({ company_id: companyId, email });
    if (existing) {
      skipped += 1;
      await ensureWorkerRoles(companyId, existing._id, roleIdsForWorker);
      await ensureWorkerWorkingHours(existing._id);
      continue;
    }

    let spec;
    if (i <= APPROVED_COUNT) {
      spec = {
        status: 'active',
        approved: true,
        approved_by: adminId,
        approved_at: new Date(),
        onboarding_step: 4,
        onboarding_schema_version: 2,
        first_login: false,
        contract_signed: true,
      };
    } else if (i <= APPROVED_COUNT + ONBOARDING_COUNT) {
      const onboardingIndex = i - APPROVED_COUNT;
      const onboarding_step = onboardingIndex <= 3 ? 2 : 3;
      spec = {
        status: 'onboarding',
        approved: false,
        onboarding_step,
        onboarding_schema_version: 2,
        first_login: true,
        contract_signed: false,
      };
    } else {
      spec = {
        status: 'pending_approval',
        approved: false,
        onboarding_step: 0,
        onboarding_schema_version: 2,
        first_login: true,
        contract_signed: false,
      };
    }

    const user = await User.create({
      company_id: companyId,
      email,
      password_hash: WORKER_PASSWORD,
      role: 'worker',
      first_name: firstName,
      last_name: lastName,
      phone: `+1555000${padded}`,
      ...spec,
    });

    await ensureWorkerRoles(companyId, user._id, roleIdsForWorker);
    await ensureWorkerWorkingHours(user._id);
    created += 1;
    logger.info('Seed worker created', { email, status: spec.status, roleCount: roleIdsForWorker.length });
  }

  const breakdown = {
    approved_active: APPROVED_COUNT,
    onboarding_step_2_or_3: ONBOARDING_COUNT,
    pending_approval: WORKER_TOTAL - APPROVED_COUNT - ONBOARDING_COUNT,
  };

  logger.info('Worker seed summary', {
    created,
    skipped,
    totalSlots: WORKER_TOTAL,
    breakdown,
    workerPassword: WORKER_PASSWORD,
    emailPattern: 'seed.worker.01@otlstaffing.local … seed.worker.20@otlstaffing.local',
    rolesPerWorker: `${ROLES_PER_WORKER_MIN}-${ROLES_PER_WORKER_MAX} (from pool of ${rolePool.length})`,
    workingHours: `Mon–Sat ${SEED_WORK_START}–${SEED_WORK_END} (day_of_week 1–6)`,
  });

  return { created, skipped, breakdown };
}

/**
 * Ensure WorkerRole doc has all given company_role_ids (merge, no duplicates).
 * @param {import('mongoose').Types.ObjectId} companyId
 * @param {import('mongoose').Types.ObjectId} workerId
 * @param {import('mongoose').Types.ObjectId[]} companyRoleIds
 */
async function ensureWorkerRoles(companyId, workerId, companyRoleIds) {
  const uniq = [];
  const seen = new Set();
  for (const id of companyRoleIds) {
    const s = String(id);
    if (!seen.has(s)) {
      seen.add(s);
      uniq.push(id);
    }
  }
  const entries = uniq.map((company_role_id) => ({ company_role_id }));

  let doc = await WorkerRole.findOne({ company_id: companyId, worker_id: workerId });
  if (!doc) {
    await WorkerRole.create({
      company_id: companyId,
      worker_id: workerId,
      roles: entries,
    });
    return;
  }

  const existingIds = new Set((doc.roles || []).map((r) => String(r.company_role_id)));
  let changed = false;
  for (const e of entries) {
    if (!existingIds.has(String(e.company_role_id))) {
      doc.roles.push(e);
      existingIds.add(String(e.company_role_id));
      changed = true;
    }
  }
  if (changed) await doc.save();
}

module.exports = {
  seedDemoWorkers,
};
