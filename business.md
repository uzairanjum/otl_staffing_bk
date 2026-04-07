# OTL Staffing Platform - Business Documentation

## 1. Business Overview

### 1.1 Platform Purpose

The OTL Staffing Platform is a comprehensive, multi-tenant shift management and staffing application designed to digitize and automate the entire lifecycle of staffing operations. The platform enables companies to manage workers, shifts, clients, jobs, training, payroll, and client reviews within a unified system.

### 1.2 Multi-Tenant Architecture

The platform implements a sophisticated multi-tenant architecture where:

- All data is stored in a single MongoDB database
- Data isolation is maintained at the collection level using the `company_id` field
- Each company operates within its own isolated data space
- Users can only access data belonging to their company

### 1.3 Target Users

- **Staffing Agencies**: Companies that provide hourly workers to other businesses
- **Companies with Hourly Workers**: Organizations that manage shift-based workforce

---

## 2. User Roles & Permissions

### 2.1 Admin

The admin user has full control over company operations:

- Manage company configuration (roles, training categories, working hours)
- Invite and manage workers
- Create and manage clients and their representatives
- Create jobs and shifts
- Assign workers to shifts
- Review and approve payroll reports
- Create and assign training programs
- View all reviews
- Send notifications (broadcast or targeted)

### 2.2 Worker

The worker user is the hourly staff member:

- Complete 8-step onboarding process
- View and request open shifts
- Work assigned shifts
- Submit bi-weekly payroll reports
- Request time off
- Upload documents (training certificates, ID documents)
- Receive notifications

### 2.3 Client Representative

The client rep is the contact person at the client company:

- View assigned client's shifts
- Mark shifts as completed
- Leave reviews for workers (1-5 star rating with comments)
- Access limited to client's own shifts only

---

## 3. Actor Flows - Detailed

### 3.1 Admin User Flow

#### Authentication

1. Navigate to login page
2. Enter email and password
3. Receive JWT access token + refresh token
4. If first login, must change password
5. Access dashboard with company statistics

#### Worker Management Flow

**Inviting a Worker:**
1. Navigate to Workers section
2. Click "Invite Worker"
3. Enter worker's email and basic information
4. System creates Worker record (status: `invited`)
5. System creates User account with temporary password
6. System sends invitation email with login credentials
7. Worker completes onboarding and awaits approval

**Approving a Worker:**
1. Navigate to Workers list
2. Filter by workers with `pending_approval` status
3. Review worker's completed onboarding data (address, bank details, tax info, documents)
4. Click "Approve"
5. System updates Worker status to `active`
6. System records `approved_by` and `approved_at`
7. Worker receives notification of approval

**Suspending a Worker:**
1. Navigate to worker's profile
2. Click "Suspend"
3. System updates Worker status to `suspended`
4. Worker cannot login or be assigned to new shifts

#### Shift Management Flow

**Creating a Job:**
1. Navigate to Jobs section
2. Click "Create Job"
3. Select existing Client
4. Enter job name and description
5. Job is created and linked to client

**Creating a Shift:**
1. Navigate to Shifts section
2. Click "Create Shift"
3. Select existing Job
4. Enter shift details:
   - Shift name
   - Date
   - Start time
   - End time
   - Location
5. Shift created with status `draft`

**Adding Positions to Shift:**
1. Open shift details
2. Click "Add Position"
3. Select company role (e.g., "Server", "Cook", "Bartender")
4. Enter needed count (number of workers required)
5. Position created with status `open`

**Publishing a Shift:**
1. Open shift details
2. Click "Publish"
3. Shift status changes to `published`
4. Workers can now view and request open positions
5. Position status updates to `partially_filled` or `filled` based on assignments

**Assigning Workers:**
There are two ways to assign workers:

**Method A - Direct Assignment:**
1. Open position details
2. Click "Assign Worker"
3. Select available worker (filtered by role match, availability, no conflicts)
4. Worker receives notification
5. Worker status changes to `assigned`

**Method B - Approve Worker Request:**
1. Worker submits request for position
2. Admin views list of requests for position
3. Click "Approve" or "Reject"
4. If approved, worker status changes to `approved`
5. Worker receives notification

**Completing a Shift:**
1. Shift reaches end time
2. Admin or Client Rep marks shift as `completed`
3. System records actual start/end times
4. 3-day review window begins for Client Rep

#### Payroll Management Flow

1. Navigate to Payroll section
2. View list of submitted reports (status: `submitted`)
3. Click on report to review details:
   - Worker information
   - Date range (bi-weekly)
   - Hours worked
   - Total amount
4. Choose action:
   - **Approve**: Status changes to `approved`, worker can be paid
   - **Modify**: Status changes to `modified`, worker must resubmit
   - **Mark as Paid**: Status changes to `paid`

#### Training Management Flow

**Creating Training:**
1. Navigate to Training section
2. Click "Create Training"
3. Enter training name
4. Select training category
5. Enter description
6. Training created

**Assigning Training to Worker:**
1. Open training details
2. Click "Assign Worker"
3. Select worker(s)
4. Workers receive notification
5. Worker training status: `assigned`

**Worker Completes Training:**
1. Worker uploads training completion documents
2. Admin reviews documents
3. Admin marks training as complete
4. Worker training status: `completed`
5. Completed timestamp recorded

#### Client Management Flow

1. Navigate to Clients section
2. Click "Create Client"
3. Enter client details (name, email, phone, address)
4. Click "Add Representative"
5. Enter representative details (name, email, phone)
6. Representative receives login credentials

#### Notification Flow

1. Navigate to Notifications section
2. Click "Send Notification"
3. Choose type:
   - **Broadcast**: Send to all company workers
   - **Targeted**: Send to specific workers
4. Enter title and body
5. System sends via:
   - Email (SMTP)
   - Firebase Cloud Messaging (push notification)
6. Recipients receive notification in-app

---

### 3.2 Worker User Flow

#### Authentication & Setup

**First Login:**
1. Receive invitation email with temporary password
2. Navigate to login page
3. Enter email and temporary password
4. System prompts to change password
5. Enter new password (must meet security requirements)
6. Login successful, redirect to onboarding

#### Onboarding Process (8 Steps)

The onboarding process ensures all required worker information is collected before approval.

**Step 0: Sign Contract**
- Worker must type their full legal name
- This serves as digital signature
- System records `contract_signed: true` and `contract_signed_at` timestamp

**Step 1: Basic Information & Address**
- First name, Last name
- Phone number
- Profile image (upload)
- Address:
  - Address line 1
  - Address line 2
  - City
  - State
  - Postal code
  - Country

**Step 2: Tax Information & Bank Details**
- Tax identification number
- National ID
- Bank name
- Account name
- Account number
- Routing number

**Step 3: Emergency Contact**
- Contact name
- Contact phone
- Relationship (e.g., spouse, parent, sibling)

**Step 4: Roles & Hourly Rate**
- Select assigned roles from company-defined roles
- Set hourly rate (can use company default or custom override)
- Worker can be assigned multiple roles

**Step 5: Weekly Availability**
- Set working hours for each day of the week
- Specify start time and end time for each day
- Can mark days as unavailable

**Step 6: Document Uploads**
- Upload required documents:
  - ID verification
  - Tax documents
  - certifications
- Files stored in Cloudinary

**Step 7: Training Completion**
- Complete required training programs assigned by admin
- Upload training completion certificates

**After Onboarding:**
1. Worker submits completed onboarding
2. Status changes to `pending_approval`
3. Wait for admin approval
4. Upon approval, status changes to `active`
5. Worker can now view and request shifts

#### Shift Work Flow

**Viewing Open Shifts:**
1. Navigate to "Open Shifts"
2. System filters shifts based on:
   - Shift is published
   - Worker has matching role
   - Position is open
   - Worker is available (no time-off conflicts)
3. Worker sees list of available shifts with positions

**Requesting a Shift:**
1. Open shift details
2. Click on desired position
3. Click "Request Position"
4. System creates request (status: `requested`)
5. Admin receives notification
6. Admin approves or rejects request

**Completing a Shift:**
1. Worker arrives at shift location
2. Worker checks in (system records actual start time)
3. Shift progresses to `in_progress`
4. At shift end, worker checks out (system records actual end time)
5. Admin or Client Rep marks shift as `completed`

**Unassigning from Shift:**
1. Navigate to assigned shifts
2. Click "Unassign"
3. System checks: Must have 3+ hours advance notice
4. If eligible, worker is unassigned
5. Position becomes available for other workers

#### Payroll Flow

**Submitting Payroll Report:**
1. Navigate to Payroll section
2. Click "Submit Report"
3. Select bi-weekly date range
4. Enter hours worked each day
5. System calculates total hours and amount
6. Submit report (status: `submitted`)

**Viewing Report Status:**
- `submitted`: Awaiting admin review
- `under_review`: Admin is reviewing
- `approved`: Report approved, awaiting payment
- `modified`: Admin requested changes, must resubmit
- `paid`: Payment processed

#### Time Off Flow

**Requesting Time Off:**
1. Navigate to Time Off section
2. Click "Request Time Off"
3. Select start date
4. Select end date
5. Enter reason
6. Submit request

**Viewing Time Off Status:**
- `pending`: Awaiting admin approval
- `approved`: Time off approved
- `rejected`: Request denied
- `cancelled`: Worker cancelled pending request

**Canceling Time Off:**
1. Navigate to Time Off history
2. Find pending request
3. Click "Cancel"
4. Request status changes to `cancelled`

---

### 3.3 Client Representative User Flow

#### Authentication

1. Navigate to login page
2. Enter email and password
3. Receive JWT access token + refresh token
4. Redirected to client dashboard

#### Viewing Client Shifts

1. Dashboard shows all shifts for assigned client
2. Shifts displayed with:
   - Date and time
   - Location
   - Assigned workers
   - Status

#### Completing a Shift

1. Navigate to client's scheduled shifts
2. Find shift that has ended or is ending
3. Click "Mark as Completed"
4. Shift status changes to `completed`
5. 3-day review window begins

#### Leaving a Review

**Review Window:**
- Client Rep has 3 days after shift completion to leave a review
- After 3 days, review period expires

**Leaving a Review:**
1. Navigate to "Shifts to Review"
2. Select shift
3. Rate worker (1-5 stars)
4. Add optional comment
5. Submit review
6. Review is recorded and visible to admin

**Review Content:**
- Rating (1-5 scale)
- Optional comment
- Timestamp
- Linked to worker, shift, client, and position

---

## 4. API Endpoints Summary

### 4.1 Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout and invalidate refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/change-password` | Change password (requires auth) |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### 4.2 Company (`/api/company`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company` | Get company details |
| PUT | `/api/company` | Update company info |
| GET | `/api/company/roles` | List company roles |
| POST | `/api/company/roles` | Create role |
| PUT | `/api/company/roles/:id` | Update role |
| DELETE | `/api/company/roles/:id` | Delete role |
| GET | `/api/company/role-categories` | List role categories |
| POST | `/api/company/role-categories` | Create role category |
| PUT | `/api/company/role-categories/:id` | Update role category |
| DELETE | `/api/company/role-categories/:id` | Delete role category |
| GET | `/api/company/training-categories` | List training categories |
| POST | `/api/company/training-categories` | Create training category |
| PUT | `/api/company/training-categories/:id` | Update training category |
| DELETE | `/api/company/training-categories/:id` | Delete training category |
| GET | `/api/company/working-hours` | Get standard working hours |
| PUT | `/api/company/working-hours` | Update working hours |
| GET | `/api/company/stats` | Get company statistics |

### 4.3 Workers (`/api/workers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workers` | Invite new worker |
| GET | `/api/workers` | List workers (with filters) |
| GET | `/api/workers/:id` | Get worker details |
| PUT | `/api/workers/:id` | Update worker |
| PUT | `/api/workers/:id/approve` | Approve worker |
| PUT | `/api/workers/:id/suspend` | Suspend worker |
| GET | `/api/workers/:id/files` | List worker files |
| POST | `/api/workers/:id/files` | Upload worker file |
| DELETE | `/api/workers/files/:fileId` | Delete worker file |
| GET | `/api/workers/:id/time-off` | List worker time-off requests |

### 4.4 Worker Onboarding (`/api/me/onboarding`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me/onboarding/status` | Get onboarding progress |
| PUT | `/api/me/onboarding/contract` | Sign contract (Step 0) |
| PUT | `/api/me/onboarding/step-1` | Submit basic info + address (Step 1) |
| PUT | `/api/me/onboarding/step-2` | Submit tax + bank info (Step 2) |
| PUT | `/api/me/onboarding/step-3` | Submit emergency contact (Step 3) |
| PUT | `/api/me/onboarding/step-4` | Submit roles + rate (Step 4) |
| PUT | `/api/me/onboarding/step-5` | Submit availability (Step 5) |
| PUT | `/api/me/onboarding/step-6` | Upload documents (Step 6) |
| PUT | `/api/me/onboarding/step-7` | Complete training (Step 7) |

### 4.5 Worker Self-Service (`/api/me`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/me/time-off` | Request time off |
| GET | `/api/me/time-off` | Get time-off history |
| DELETE | `/api/me/time-off/:id` | Cancel time-off request |

### 4.6 Training (`/api/training`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/training` | List all training programs |
| POST | `/api/training` | Create training program |
| PUT | `/api/training/:id` | Update training |
| DELETE | `/api/training/:id` | Delete training |
| POST | `/api/training/:id/assign/:workerId` | Assign training to worker |
| PUT | `/api/training/:id/assign/:workerId` | Update worker training status |
| POST | `/api/training/:id/assign/:workerId/documents` | Upload training documents |
| GET | `/api/training/worker/:workerId` | Get worker's training |

### 4.7 Clients (`/api/clients`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| GET | `/api/clients/:id` | Get client details |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |
| GET | `/api/clients/:id/representatives` | List representatives |
| POST | `/api/clients/:id/representatives` | Add representative |
| PUT | `/api/clients/:id/representatives/:repId` | Update representative |
| DELETE | `/api/clients/:id/representatives/:repId` | Delete representative |

### 4.8 Jobs (`/api/jobs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs |
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/:id` | Get job details |
| PUT | `/api/jobs/:id` | Update job |
| DELETE | `/api/jobs/:id` | Delete job |

### 4.9 Shifts (`/api/shifts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shifts` | List shifts (with filters) |
| POST | `/api/shifts` | Create shift |
| GET | `/api/shifts/:id` | Get shift details |
| PUT | `/api/shifts/:id` | Update shift |
| DELETE | `/api/shifts/:id` | Cancel shift |
| POST | `/api/shifts/:id/publish` | Publish shift |

### 4.10 Shift Positions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shifts/:shiftId/positions` | Add position to shift |
| PUT | `/api/shifts/:shiftId/positions/:positionId` | Update position |
| DELETE | `/api/shifts/:shiftId/positions/:positionId` | Delete position |

### 4.11 Position Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shifts/:shiftId/positions/:positionId/requests` | List worker requests |
| POST | `/api/shifts/:shiftId/positions/:positionId/requests/:workerId/approve` | Approve request |
| POST | `/api/shifts/:shiftId/positions/:positionId/requests/:workerId/reject` | Reject request |

### 4.12 Position Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shifts/:shiftId/positions/:positionId/assign` | Assign worker to position |
| POST | `/api/shifts/:shiftId/positions/:positionId/unassign` | Unassign worker |

### 4.13 Worker Shifts (`/api/me/shifts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me/shifts/open` | List open shifts (worker view) |
| GET | `/api/me/shifts/assigned` | List assigned shifts |
| GET | `/api/me/shifts/upcoming` | List upcoming shifts |
| POST | `/api/me/shifts/:shiftId/positions/:positionId/request` | Request position |
| POST | `/api/me/shifts/:shiftId/positions/:positionId/unassign` | Unassign self |

### 4.14 Payroll

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payroll/reports` | List all reports (admin) |
| GET | `/api/payroll/reports/:id` | Get report details |
| PUT | `/api/payroll/reports/:id/approve` | Approve report |
| PUT | `/api/payroll/reports/:id/modify` | Request modifications |
| PUT | `/api/payroll/reports/:id/paid` | Mark as paid |

### 4.15 Worker Payroll (`/api/me/payroll`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/me/payroll/reports` | Submit payroll report |
| GET | `/api/me/payroll/reports` | View submitted reports |

### 4.16 Reviews (`/api/reviews`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews/shifts` | List shifts eligible for review (client_rep) |
| POST | `/api/reviews` | Submit review |
| GET | `/api/reviews` | List all reviews (admin) |
| GET | `/api/reviews/:id` | Get review details |

### 4.17 Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/me` | Get my notifications |
| PUT | `/api/notifications/me/:id/read` | Mark as read |
| POST | `/api/notifications/me/fcm-token` | Register FCM token |
| DELETE | `/api/notifications/me/fcm-token` | Remove FCM token |
| POST | `/api/notifications` | Send notification (admin) |
| GET | `/api/notifications` | List sent notifications (admin) |

---

## 5. Database Schema Overview

### 5.1 Core Models

| Model | Description |
|-------|-------------|
| **User** | Authentication and role management |
| **Company** | Tenant organization |
| **Worker** | Employee/worker information |
| **Client** | Client business entity |
| **ClientRepresentative** | Contact person at client |
| **Job** | Work assignment linked to client |
| **Shift** | Scheduled work shift |
| **ShiftPosition** | Required position within shift |
| **ShiftPositionAssignment** | Worker assignment to position |
| **Training** | Training program |
| **WorkerTraining** | Worker's training record |
| **PayrollReport** | Bi-weekly payroll submission |
| **Review** | Client review of worker |
| **Notification** | System notification |

### 5.2 Key Relationships

```
Company (1)
  ├── Users (Many)
  ├── Workers (Many)
  ├── Clients (Many)
  │     └── ClientRepresentatives (Many)
  ├── Jobs (Many)
  ├── Shifts (Many)
  │     └── ShiftPositions (Many)
  │           └── ShiftPositionAssignments (Many) → Workers
  ├── Trainings (Many)
  │     └── WorkerTrainings (Many) → Workers
  ├── PayrollReports (Many) → Workers
  └── Reviews (Many)
```

### 5.3 Multi-Tenant Isolation

All models include a `company_id` field that:
- Links to the Company model
- Enables collection-level data isolation
- Is required for all operations
- Is automatically set based on authenticated user

---

## 6. Technology Stack

### 6.1 Backend

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web application framework |
| MongoDB | Primary database |
| Mongoose | MongoDB object modeling |

### 6.2 Authentication & Security

| Technology | Purpose |
|------------|---------|
| JWT (jsonwebtoken) | Access and refresh tokens |
| bcrypt | Password hashing |
| cookie-parser | HTTP cookie handling |
| helmet | Security headers |
| cors | Cross-origin resource sharing |

### 6.3 External Integrations

| Technology | Purpose |
|------------|---------|
| Cloudinary | File and image storage |
| Firebase Admin | Push notifications (FCM) |
| Nodemailer | Email sending (SMTP) |

### 6.4 Utilities

| Technology | Purpose |
|------------|---------|
| dotenv | Environment variables |
| Joi | Input validation |
| multer | File upload handling |
| uuid | Unique identifier generation |

---

## 7. Business Workflows Summary

### 7.1 Worker Lifecycle

```
Invited → Onboarding (8 steps) → Pending Approval → Active → Suspended
```

### 7.2 Shift Lifecycle

```
Draft → Published → In Progress → Completed → Review Window (3 days) → Expired
```

### 7.3 Payroll Lifecycle

```
Submitted → Under Review → Approved/Modified → Paid
```

### 7.4 Training Lifecycle

```
Created → Assigned to Worker → In Progress → Completed
```

---

*Document Version: 1.0*
*Last Updated: April 2026*
