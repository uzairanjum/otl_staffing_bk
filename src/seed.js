require('dotenv').config();
const connectDB = require('./config/database');
const Company = require('./modules/company/Company');
const User = require('./common/models/User');
const CompanyWorkingHours = require('./modules/company/CompanyWorkingHours');
const RoleCategory = require('./modules/company/RoleCategory');
const CompanyRole = require('./modules/company/CompanyRole');
const TrainingCategory = require('./modules/company/TrainingCategory');
const Training = require('./modules/company/Training');

const seedCompany = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    let company = await Company.findOne({ name: 'OTL Staffing' });
    
    if (!company) {
      company = await Company.create({
        name: 'OTL Staffing',
        email: 'admin@otlstaffing.com',
        phone: '+1234567890',
        status: 'active'
      });
      console.log('Company created:', company.name);
    } else {
      console.log('Company already exists:', company.name);
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
      console.log('Admin user created:', 'admin@otlstaffing.com');
      console.log('Temporary password:', adminPassword);
    } else {
      console.log('Admin user already exists');
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
      console.log('Default working hours created');
    } else {
      console.log('Working hours already exist');
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
        console.log(`Role category created: ${cat.name}`);
      } else {
        console.log(`Role category already exists: ${cat.name}`);
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
        console.log(`Company role created: ${role.name}`);
      } else {
        console.log(`Company role already exists: ${role.name}`);
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
        console.log(`Training category created: ${cat.name}`);
      } else {
        console.log(`Training category already exists: ${cat.name}`);
      }
      createdTrainingCategories[cat.name] = existingCat._id;
    }

    const trainings = [
      { 
        name: 'OSHA Safety', 
        category: 'Safety', 
        description: 'Occupational Safety and Health Administration safety training',
        document_required: true
      },
      { 
        name: 'Food Safety Certification', 
        category: 'Food Handling', 
        description: 'Food safety best practices certification',
        document_required: true
      },
      { 
        name: 'ServSafe Certification', 
        category: 'Food Handling', 
        description: 'ServSafe food handler certification',
        document_required: true
      },
      { 
        name: 'TIPS Certification', 
        category: 'Food Handling', 
        description: 'Training for Intervention Procedures certification',
        document_required: true
      },
      { 
        name: 'Customer Service Excellence', 
        category: 'Customer Service', 
        description: 'Customer service skills and best practices',
        document_required: false
      },
      { 
        name: 'Conflict Resolution', 
        category: 'Customer Service', 
        description: 'Conflict de-escalation and resolution training',
        document_required: false
      },
      { 
        name: 'POS System Training', 
        category: 'Equipment', 
        description: 'Point of sale system operation training',
        document_required: false
      },
      { 
        name: 'Alcohol Service Training', 
        category: 'Food Handling', 
        description: 'Responsible alcohol service training',
        document_required: true
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
          is_active: true
        });
        console.log(`Training created: ${training.name}`);
      } else {
        console.log(`Training already exists: ${training.name}`);
      }
    }

    console.log('\n=== Seed Complete ===');
    console.log('Company: OTL Staffing');
    console.log('Admin Email: admin@otlstaffing.com');
    console.log('Admin Password: Admin123!');
    console.log('=====================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedCompany();
