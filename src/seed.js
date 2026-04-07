require('dotenv').config();
const connectDB = require('./config/database');
const Company = require('./modules/company/Company');
const User = require('./common/models/User');
const { v4: uuidv4 } = require('uuid');

const seedCompany = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    const existingCompany = await Company.findOne({ name: 'OTL Staffing' });
    if (existingCompany) {
      console.log('Company already exists');
      process.exit(0);
    }

    const company = await Company.create({
      name: 'OTL Staffing',
      email: 'admin@otlstaffing.com',
      phone: '+1234567890',
      status: 'active'
    });
    console.log('Company created:', company.name);

    const adminPassword = 'Admin123!';
    const adminUser = await User.create({
      company_id: company._id,
      email: 'admin@otlstaffing.com',
      password_hash: adminPassword,
      role: 'admin',
      first_login: true
    });
    console.log('Admin user created:', adminUser.email);
    console.log('Temporary password:', adminPassword);

    // const CompanyRole = require('./modules/company/CompanyRole');
    // const roles = [
    //   { name: 'General Staff', category: 'general', default_hourly_rate: 15 },
    //   { name: 'Security', category: 'security', default_hourly_rate: 20 },
    //   { name: 'Event Coordinator', category: 'event', default_hourly_rate: 25 },
    //   { name: 'Catering Staff', category: 'catering', default_hourly_rate: 16 },
    //   { name: 'Setup Crew', category: 'labor', default_hourly_rate: 18 }
    // ];

    // for (const role of roles) {
    //   await CompanyRole.create({
    //     company_id: company._id,
    //     ...role
    //   });
    // }
    // console.log('Company roles created:', roles.length);

    const CompanyWorkingHours = require('./modules/company/CompanyWorkingHours');
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
