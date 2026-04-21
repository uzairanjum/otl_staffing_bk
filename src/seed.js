require('dotenv').config();
const connectDB = require('./config/database');
const Company = require('./modules/company/Company');
const User = require('./common/models/User');
const CompanyWorkingHours = require('./modules/company/CompanyWorkingHours');
const RoleCategory = require('./modules/company/RoleCategory');
const CompanyRole = require('./modules/company/CompanyRole');
const TrainingCategory = require('./modules/company/TrainingCategory');
const Training = require('./modules/company/Training');
const logger = require('./config/logger');

const seedCompany = async () => {
  try {
    await connectDB();
    logger.info('Connected to database');

    let company = await Company.findOne({ name: 'OTL Staffing' });
    
    if (!company) {
      company = await Company.create({
        name: 'OTL Staffing',
        email: 'admin@otlstaffing.com',
        phone: '+1234567890',
        status: 'active'
      });
      logger.info('Company created', { companyName: company.name });
    } else {
      logger.info('Company already exists', { companyName: company.name });
    }

    const adminPassword = 'Admin123!';
    const existingUser = await User.findOne({ email: 'admin@otlstaffing.com' });
    
    if (!existingUser) {
      await User.create({
        company_id: company._id,
        email: 'admin@otlstaffing.com',
        password_hash: adminPassword,
        role: 'admin',
        first_login: true
      });
      logger.info('Admin user created', { email: 'admin@otlstaffing.com' });
      logger.warn('Temporary admin password generated', {
        email: 'admin@otlstaffing.com',
        requiresPasswordChange: true
      });
    } else {
      logger.info('Admin user already exists', { email: 'admin@otlstaffing.com' });
    }

    const existingWorkingHours = await CompanyWorkingHours.findOne({ company_id: company._id });
    if (!existingWorkingHours) {
      const defaultHours = [
        { day_of_week: 0, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 4, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 5, start_time: '09:00', end_time: '17:00' },
        { day_of_week: 6, start_time: '09:00', end_time: '17:00' }
      ];

      await CompanyWorkingHours.insertMany(
        defaultHours.map(h => ({ ...h, company_id: company._id }))
      );
      logger.info('Default working hours created');
    } else {
      logger.info('Working hours already exist');
    }

    const roleCategories = [
      { name: 'Food Service', color: '#FF6B6B' },
      { name: 'Bartending', color: '#4ECDC4' },
      { name: 'Event Staff', color: '#45B7D1' },
      { name: 'Security', color: '#96CEB4' },
      { name: 'Cleaning', color: '#FFEAA7' },
      { name: 'General Labor', color: '#DDA0DD' }
    ];

    const createdRoleCategories = {};
    for (const cat of roleCategories) {
      let existingCat = await RoleCategory.findOne({ company_id: company._id, name: cat.name });
      if (!existingCat) {
        existingCat = await RoleCategory.create({ ...cat, company_id: company._id });
        logger.info('Role category created', { roleCategory: cat.name });
      } else {
        logger.info('Role category already exists', { roleCategory: cat.name });
      }
      createdRoleCategories[cat.name] = existingCat._id;
    }

    const companyRoles = [
      { name: 'Server', role_category: 'Food Service', default_hourly_rate: 15, description: 'Food and beverage server' },
      { name: 'Line Cook', role_category: 'Food Service', default_hourly_rate: 18, description: 'Kitchen line cook' },
      { name: 'Dishwasher', role_category: 'Food Service', default_hourly_rate: 14, description: 'Dish washing staff' },
      { name: 'Bartender', role_category: 'Bartending', default_hourly_rate: 18, description: 'Bartender' },
      { name: 'Barback', role_category: 'Bartending', default_hourly_rate: 14, description: 'Bar back staff' },
      { name: 'Event Setup', role_category: 'Event Staff', default_hourly_rate: 16, description: 'Event setup crew' },
      { name: 'Event Coordinator', role_category: 'Event Staff', default_hourly_rate: 20, description: 'Event coordination' },
      { name: 'Security Guard', role_category: 'Security', default_hourly_rate: 18, description: 'Security personnel' },
      { name: 'Housekeeper', role_category: 'Cleaning', default_hourly_rate: 15, description: 'Housekeeping staff' },
      { name: 'Porter', role_category: 'General Labor', default_hourly_rate: 14, description: 'General porter duties' }
    ];

    for (const role of companyRoles) {
      let existingRole = await CompanyRole.findOne({ company_id: company._id, name: role.name });
      if (!existingRole) {
        await CompanyRole.create({
          name: role.name,
          company_id: company._id,
          role_category_id: createdRoleCategories[role.role_category],
          default_hourly_rate: role.default_hourly_rate,
          description: role.description,
          is_active: true
        });
        logger.info('Company role created', { roleName: role.name });
      } else {
        logger.info('Company role already exists', { roleName: role.name });
      }
    }

    const trainingCategories = [
      { name: 'Safety', color: '#FF6B6B' },
      { name: 'Food Handling', color: '#4ECDC4' },
      { name: 'Customer Service', color: '#45B7D1' },
      { name: 'Equipment', color: '#96CEB4' }
    ];

    const createdTrainingCategories = {};
    for (const cat of trainingCategories) {
      let existingCat = await TrainingCategory.findOne({ company_id: company._id, name: cat.name });
      if (!existingCat) {
        existingCat = await TrainingCategory.create({ ...cat, company_id: company._id });
        logger.info('Training category created', { trainingCategory: cat.name });
      } else {
        logger.info('Training category already exists', { trainingCategory: cat.name });
      }
      createdTrainingCategories[cat.name] = existingCat._id;
    }

    const trainings = [
      { 
        name: 'OSHA Safety', 
        category: 'Safety', 
        description: 'Occupational Safety and Health Administration safety training',
        document_required: true,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'Food Safety Certification', 
        category: 'Food Handling', 
        description: 'Food safety best practices certification',
        document_required: true,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'ServSafe Certification', 
        category: 'Food Handling', 
        description: 'ServSafe food handler certification',
        document_required: true,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'TIPS Certification', 
        category: 'Food Handling', 
        description: 'Training for Intervention Procedures certification',
        document_required: true,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'Customer Service Excellence', 
        category: 'Customer Service', 
        description: 'Customer service skills and best practices',
        document_required: false,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'Conflict Resolution', 
        category: 'Customer Service', 
        description: 'Conflict de-escalation and resolution training',
        document_required: false,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'POS System Training', 
        category: 'Equipment', 
        description: 'Point of sale system operation training',
        document_required: false,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      },
      { 
        name: 'Alcohol Service Training', 
        category: 'Food Handling', 
        description: 'Responsible alcohol service training',
        document_required: true,
        expiry: new Date('2026-12-31'),
        validity: '2 yr'
      }
    ];

    for (const training of trainings) {
      let existingTraining = await Training.findOne({ company_id: company._id, name: training.name });
      if (!existingTraining) {
        await Training.create({
          name: training.name,
          company_id: company._id,
          training_category_id: createdTrainingCategories[training.category],
          description: training.description,
          document_required: training.document_required,
          expiry: training.expiry,
          validity: training.validity,
          is_active: true
        });
        logger.info('Training created', { trainingName: training.name });
      } else {
        logger.info('Training already exists', { trainingName: training.name });
      }
    }

    logger.info('Seed complete', {
      company: 'OTL Staffing',
      adminEmail: 'admin@otlstaffing.com'
    });

    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

seedCompany();
