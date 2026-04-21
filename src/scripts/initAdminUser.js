require('dotenv').config();
const connectDB = require('../config/database');
const Company = require('../modules/company/Company');
const User = require('../common/models/User');
const logger = require('../config/logger');

const ADMIN_DEFAULTS = {
  name: process.env.ADMIN_NAME || 'OTL Admin',
  email: (process.env.ADMIN_EMAIL || 'admin@otlstaffing.com').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || '12345678',
  companyName: process.env.ADMIN_COMPANY_NAME || 'OTL Staffing',
  companyPhone: process.env.ADMIN_COMPANY_PHONE || '+10000000000'
};

const ensureCompany = async () => {
  let company = await Company.findOne({ name: ADMIN_DEFAULTS.companyName });

  if (!company) {
    company = await Company.create({
      name: ADMIN_DEFAULTS.companyName,
      email: ADMIN_DEFAULTS.email,
      phone: ADMIN_DEFAULTS.companyPhone,
      status: 'active'
    });
    logger.info('Created company for admin initialization', {
      companyName: company.name
    });
  } else {
    logger.info('Using existing company for admin initialization', {
      companyName: company.name
    });
  }

  return company;
};

const upsertAdminUser = async (companyId) => {
  const existingAdmin = await User.findOne({
    email: ADMIN_DEFAULTS.email,
    company_id: companyId
  });

  if (existingAdmin) {
    existingAdmin.name = ADMIN_DEFAULTS.name;
    existingAdmin.role = 'admin';
    existingAdmin.password_hash = ADMIN_DEFAULTS.password;
    existingAdmin.first_login = true;
    existingAdmin.is_active = true;
    await existingAdmin.save();
    return { user: existingAdmin, action: 'updated' };
  }

  const user = await User.create({
    company_id: companyId,
    name: ADMIN_DEFAULTS.name,
    email: ADMIN_DEFAULTS.email,
    password_hash: ADMIN_DEFAULTS.password,
    role: 'admin',
    first_login: true,
    is_active: true
  });

  return { user, action: 'created' };
};

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required in environment');
    }

    await connectDB();

    const company = await ensureCompany();
    const { user, action } = await upsertAdminUser(company._id);

    logger.info('Admin user initialized successfully', {
      action,
      userId: user._id?.toString?.(),
      companyId: user.company_id?.toString?.(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    logger.error('Failed to initialize admin user', {
      message: error.message,
      stack: error.stack
    });
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

run();
