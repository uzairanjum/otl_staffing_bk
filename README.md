# OTL Staffing Platform

Multi-tenant shift management and staffing platform built with Node.js, Express, and MongoDB.

## Features

- **Multi-tenant Architecture** - Collection-level tenant isolation
- **Worker Management** - Invitation, onboarding (8 steps), approval workflow
- **Shift Management** - Jobs, shifts, positions, assignments
- **Training System** - Assign and track worker training
- **Payroll** - Bi-weekly reports with approval workflow
- **Client Reviews** - 3-day review window after shifts
- **Notifications** - Broadcast & targeted with email + FCM push
- **JWT Authentication** - Access + refresh tokens
- **File Uploads** - Cloudinary integration
- **API Documentation** - Swagger UI

## Prerequisites

- Node.js 18+
- MongoDB 6.0+
- Cloudinary account (for file uploads)
- SMTP email credentials
- Firebase project (for push notifications)

## Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Seed database (creates company + admin)
npm run seed

# Start server
npm start
```

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/otl_staffing

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=OTL Staffing

# Firebase Admin (FCM)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

## Running the Project

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Default Credentials (after seeding)

- **Email:** admin@otlstaffing.com
- **Password:** Admin123!

## API Documentation

Once the server is running:

- **Swagger UI:** http://localhost:3000/api-docs
- **JSON Spec:** http://localhost:3000/api-docs.json
- **Health Check:** http://localhost:3000/health

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset password

### Company (Admin)
- `GET /api/company` - Get company details
- `PUT /api/company` - Update company
- `GET /api/company/roles` - Get roles
- `POST /api/company/roles` - Create role
- `GET /api/company/stats` - Get stats

### Workers (Admin)
- `POST /api/workers` - Invite worker
- `GET /api/workers` - List workers
- `GET /api/workers/:id` - Get worker
- `PUT /api/workers/:id/approve` - Approve worker
- `PUT /api/workers/:id/inactive` - Mark worker inactive

### Onboarding (Worker)
- `GET /api/me/onboarding/status` - Get status
- `PUT /api/me/onboarding/contract` - Accept contract
- `PUT /api/me/onboarding/step-1` - Basic info + address
- `PUT /api/me/onboarding/step-2` - Tax + bank details
- `PUT /api/me/onboarding/step-3` - Emergency contact
- `PUT /api/me/onboarding/step-4` - Role + rate
- `PUT /api/me/onboarding/step-5` - Working hours
- `PUT /api/me/onboarding/step-6` - Upload documents
- `PUT /api/me/onboarding/step-7` - Training completion

### Self Service (Worker)
- `POST /api/me/time-off` - Request time off
- `GET /api/me/time-off` - Get time offs
- `GET /api/me/shifts/open` - Get open shifts
- `GET /api/me/shifts/assigned` - Get assigned
- `POST /api/me/shifts/:id/request` - Request shift

### Training (Admin)
- `GET /api/training` - List trainings
- `POST /api/training` - Create training
- `POST /api/training/:id/assign/:workerId` - Assign training

### Clients (Admin)
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `POST /api/clients/:id/representatives` - Add rep

### Jobs (Admin)
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job

### Shifts (Admin)
- `GET /api/shifts` - List shifts
- `POST /api/shifts` - Create shift
- `POST /api/shifts/:id/publish` - Publish shift
- `POST /api/shifts/:id/positions` - Add position
- `POST /api/shifts/:id/positions/:posId/assign` - Assign worker

### Payroll
- `POST /api/me/payroll/reports` - Submit report
- `GET /api/payroll/reports` - List reports (Admin)
- `PUT /api/payroll/reports/:id/approve` - Approve
- `PUT /api/payroll/reports/:id/paid` - Mark paid

### Reviews (Client Rep)
- `GET /api/reviews/shifts` - Get shifts for review
- `POST /api/reviews` - Submit review

### Notifications
- `GET /api/notifications/me` - My notifications
- `POST /api/notifications` - Send notification (Admin)

## Project Structure

```
src/
├── config/              # Configuration files
│   ├── database.js      # MongoDB connection
│   ├── cloudinary.js   # Cloudinary config
│   ├── email.js        # Email service
│   ├── firebase.js     # FCM config
│   └── swagger.js     # OpenAPI config
├── common/
│   ├── models/         # User model
│   └── middleware/    # Auth, error, validation
├── modules/
│   ├── auth/          # Authentication
│   ├── company/       # Company management
│   ├── worker/        # Workers + onboarding
│   ├── training/      # Training
│   ├── client/        # Clients
│   ├── job/           # Jobs
│   ├── shift/         # Shifts + assignments
│   ├── payroll/       # Payroll
│   ├── review/        # Reviews
│   └── notification/ # Notifications
├── app.js             # Express app
└── seed.js           # Database seeder
```

## License

ISC
