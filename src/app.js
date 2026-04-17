require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/database');
const config = require('./config');
const { errorMiddleware, notFoundMiddleware } = require('./common/middleware/error.middleware');
const swaggerOptions = require('../swagger.config');

const authRoutes = require('./modules/auth/auth.routes');
const companyRoutes = require('./modules/company/company.routes');
const workerRoutes = require('./modules/worker/worker.routes');
const workerOnboardingRoutes = require('./modules/worker/worker.onboarding.routes');
const workerSelfRoutes = require('./modules/worker/worker.self.routes');
const workerTrainingRoutes = require('./modules/worker/training.routes');
const trainingRoutes = require('./modules/company/training.routes');
const clientRoutes = require('./modules/client/client.routes');
const jobRoutes = require('./modules/job/job.routes');
const shiftRoutes = require('./modules/shift/shift.routes');
const workerShiftsRoutes = require('./modules/shift/worker.shifts.routes');
const payrollRoutes = require('./modules/payroll/payroll.routes');
const reviewRoutes = require('./modules/review/review.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const adminRoutes = require('./modules/admin/admin.routes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const specs = swaggerJsDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true,
    showRequestDuration: true
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { font-size: 2.5em }
  `,
  customSiteTitle: 'OTL Staffing Platform API'
}));

app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/me/onboarding', workerOnboardingRoutes);
app.use('/api/me', workerSelfRoutes);
app.use('/api/workers/trainings', workerTrainingRoutes);
app.use('/api/company/training', trainingRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/me/shifts', workerShiftsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/me/payroll', payrollRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);


// Health endpoint on /
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully');

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.env}`);
      // console.log(`Swagger UI available at http://localhost:${config.port}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
// Admin Email: admin@otlstaffing.com
// Admin Password: Admin123!