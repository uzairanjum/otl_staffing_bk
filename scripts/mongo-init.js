// Initialize MongoDB with application database and user
db = db.getSiblingDB('otl_staffing');

db.createUser({
  user: 'otl_user',
  pwd: process.env.MONGO_APP_PASSWORD || 'otl_password_change_me',
  roles: [
    {
      role: 'readWrite',
      db: 'otl_staffing'
    }
  ]
});

// Create collections with indexes
db.createCollection('users');
db.createCollection('shifts');
db.createCollection('payroll_reports');
db.createCollection('payroll_report_entries');

// Optional: Enable replica set for transactions (requires modified MongoDB startup)
// Uncomment if running single-node replica set
// db.getSiblingDB('admin').runCommand({
//   replSetInitiate: {
//     _id: 'rs0',
//     members: [{ _id: 0, host: 'localhost:27017' }]
//   }
// });

console.log('✅ MongoDB initialization complete');
