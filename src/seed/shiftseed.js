'use strict';

const Shift = require('../modules/shift/Shift');
const Job = require('../modules/job/Job');
const User = require('../common/models/User');
const CompanyRole = require('../modules/company/CompanyRole');
const shiftService = require('../modules/shift/shift.service');
const logger = require('../config/logger');

const DRAFT_COUNT = 10;
const PUBLISHED_COUNT = 10;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** UTC calendar day (00:00:00) for the same calendar day as `d`. */
function utcCalendarDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** ISO 8601 for API-shaped payloads (matches HTTP JSON date strings). */
function iso(d) {
  return new Date(d).toISOString();
}

/**
 * @param {Date} anchorUtcMidnight
 * @param {number} dayOffset
 * @param {0|1|2} windowKind 0 = single day, 1 = two-day, 2 = three-day
 */
function buildShiftWindow(anchorUtcMidnight, dayOffset, windowKind) {
  const base = new Date(anchorUtcMidnight);
  base.setUTCDate(base.getUTCDate() + dayOffset);

  if (windowKind === 0) {
    const start = new Date(base);
    start.setUTCHours(14, 0, 0, 0);
    const end = new Date(base);
    end.setUTCHours(22, 0, 0, 0);
    return { start, end, isMultiDay: false };
  }
  if (windowKind === 1) {
    const start = new Date(base);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(base);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(18, 0, 0, 0);
    return { start, end, isMultiDay: true };
  }
  const start = new Date(base);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(base);
  end.setUTCDate(end.getUTCDate() + 2);
  end.setUTCHours(17, 0, 0, 0);
  return { start, end, isMultiDay: true };
}

function assignmentSlice(shiftStart, shiftEnd, workerId, assignedBy, withWorker) {
  const spanMs = Math.min(8 * 3600000, shiftEnd.getTime() - shiftStart.getTime());
  const slotEnd = new Date(shiftStart.getTime() + spanMs);
  const systemStart = new Date(shiftStart);
  const systemEnd = slotEnd;
  const calendarDay = utcCalendarDay(shiftStart);

  const row = {
    system_date: iso(systemStart),
    system_start_time: iso(systemStart),
    system_end_time: iso(systemEnd),
    client_date: iso(calendarDay),
    client_start_time: iso(systemStart),
    client_end_time: iso(systemEnd),
    worker_date: iso(calendarDay),
    worker_start_time: iso(systemStart),
    worker_end_time: iso(systemEnd),
    status: withWorker ? 'assigned' : 'unassigned',
  };
  if (withWorker && workerId) {
    row.worker_id = workerId;
    row.assigned_by = assignedBy;

  }
  return row;
}

/**
 * @param {{ company: import('mongoose').Document, adminUser: import('mongoose').Document | null }} opts
 */
async function seedDemoShifts({ company, adminUser }) {
  const companyId = company._id;
  const actorUserId = adminUser?._id || undefined;

  const jobs = await Job.find({ company_id: companyId, status: 'active' }).select('_id client_id name').lean();
  if (jobs.length === 0) {
    logger.warn('Shift seed skipped: no active jobs');
    return { created: 0, skipped: 0 };
  }

  const roleDocs = await CompanyRole.find({ company_id: companyId, is_active: true }).sort({ name: 1 }).limit(8).lean();
  if (roleDocs.length < 3) {
    logger.warn('Shift seed skipped: need at least 3 company roles');
    return { created: 0, skipped: 0 };
  }

  const workers = await User.find({
    company_id: companyId,
    role: 'worker',
    email: { $regex: /^worker\_0[1-8]@otlstaffing\.dev$/ },
  })
    .select('_id email')
    .sort({ email: 1 })
    .lean();

  const repByClient = new Map();
  const reps = await User.find({
    company_id: companyId,
    role: 'client_rep',
    email: { $regex: /^seed\.rep\./ },
  })
    .select('_id client_id')
    .lean();
  for (const r of reps) {
    if (r.client_id) repByClient.set(String(r.client_id), r._id);
  }

  const anchor = new Date();
  anchor.setUTCHours(0, 0, 0, 0);

  const specs = [];
  for (let n = 1; n <= DRAFT_COUNT; n += 1) {
    specs.push({
      key: `draft-${pad2(n)}`,
      status: 'draft',
      seq: n - 1,
    });
  }
  for (let n = 1; n <= PUBLISHED_COUNT; n += 1) {
    specs.push({
      key: `pub-${pad2(n)}`,
      status: 'published',
      seq: DRAFT_COUNT + n - 1,
    });
  }

  let created = 0;
  let skipped = 0;

  for (const spec of specs) {
    const exists = await Shift.findOne({ company_id: companyId, notes: `SEED_KEY=${spec.key}` });
    if (exists) {
      skipped += 1;
      continue;
    }

    const job = jobs[spec.seq % jobs.length];
    const dayOffset = spec.seq % 15;
    const windowKind = spec.seq % 3;
    const { start, end, isMultiDay } = buildShiftWindow(anchor, dayOffset, windowKind);

    const clientRepId = repByClient.get(String(job.client_id)) || null;
    const wA = workers[spec.seq % Math.max(workers.length, 1)]?._id;
    const wB = workers[(spec.seq + 1) % Math.max(workers.length, 1)]?._id;

    const r0 = roleDocs[spec.seq % roleDocs.length]._id;
    const r1 = roleDocs[(spec.seq + 1) % roleDocs.length]._id;
    const r2 = roleDocs[(spec.seq + 2) % roleDocs.length]._id;
    const r3 = roleDocs[(spec.seq + 3) % roleDocs.length]._id;

    const positionDefs = [
      { company_role_id: r0, needed_count: 1, pay_rate: 18, break_time: 'No Break' },
      { company_role_id: r1, needed_count: 1, pay_rate: 17, break_time: 'No Break' },
      { company_role_id: r2, needed_count: 2, pay_rate: 19, break_time: '30 min' },
      { company_role_id: r3, needed_count: 1, pay_rate: 16, break_time: 'No Break' },
    ];

    /** One assignment row per needed slot; mirrors previous mix (wA/wB + unassigned). */
    function assignmentsForPositionLine(lineIndex) {
      if (lineIndex === 0) {
        return [wA ? assignmentSlice(start, end, wA, actorUserId, true) : assignmentSlice(start, end, null, actorUserId, false)];
      }
      if (lineIndex === 1) {
        return [assignmentSlice(start, end, null, actorUserId, false)];
      }
      if (lineIndex === 2) {
        if (wA) {
          return [
            assignmentSlice(start, end, wA, actorUserId, true),
            assignmentSlice(start, end, null, actorUserId, false),
          ];
        }
        return [
          assignmentSlice(start, end, null, actorUserId, false),
          assignmentSlice(start, end, null, actorUserId, false),
        ];
      }
      return [wB ? assignmentSlice(start, end, wB, actorUserId, true) : assignmentSlice(start, end, null, actorUserId, false)];
    }

    const positions = positionDefs.map((def, lineIndex) => ({
      company_role_id: def.company_role_id,
      needed_count: def.needed_count,
      pay_rate: def.pay_rate,
      break_time: def.break_time,
      assignments: assignmentsForPositionLine(lineIndex),
    }));

    const label = spec.status === 'draft' ? 'Draft' : 'Published';
    const payload = {
      client_id: job.client_id,
      job_id: job._id,
      client_rep_id: clientRepId,
      name: `Seed ${label} Shift ${spec.key} (${job.name})`,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      isMultiDay,
      location: `Seed venue — ${isMultiDay ? 'multi-day' : 'single-day'} slot`,
      status: spec.status,
      notes: `SEED_KEY=${spec.key}`,
      required_approval: true,
      positions,
    };

    try {
      await shiftService.createShift(companyId, payload, { actorUserId });
      created += 1;
      logger.info('Seed shift created', { key: spec.key, status: spec.status, isMultiDay });
    } catch (err) {
      logger.error('Seed shift failed', { key: spec.key, message: err.message });
    }
  }

  logger.info('Shift seed summary', {
    created,
    skipped,
    expectedTotal: DRAFT_COUNT + PUBLISHED_COUNT,
    dateRangeNote: 'UTC days anchored today + offsets 0..14',
  });

  return { created, skipped };
}

module.exports = {
  seedDemoShifts,
};
