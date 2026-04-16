# OTL Staffing Platform - Database ERD

## Overview

This document shows the Entity-Relationship Diagram (ERD) for the OTL Staffing Platform MongoDB database. All models include a `company_id` field for multi-tenant data isolation.

---

## Core Models

### 1. Company
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `name` | String | Company name |
| `logo_url` | String | Logo image URL |
| `email` | String | Company email (unique) |
| `phone` | String | Contact phone |
| `status` | String | active, inactive, suspended |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:**
- 1:N → Users
- 1:N → Workers
- 1:N → Clients
- 1:N → Jobs
- 1:N → Shifts
- 1:N → Trainings
- 1:N → CompanyRoles
- 1:N → RoleCategories
- 1:N → TrainingCategories

---

### 2. User
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `email` | String | User email (unique per company) |
| `password_hash` | String | Hashed password |
| `role` | String | admin, worker, client_rep |
| `worker_id` | ObjectId | FK → Worker (optional) |
| `client_rep_id` | ObjectId | FK → ClientRepresentative (optional) |
| `refresh_token` | String | JWT refresh token |
| `first_login` | Boolean | First login flag |
| `is_active` | Boolean | Account active status |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:**
- N:1 → Company
- N:1 → Worker (optional)
- N:1 → ClientRepresentative (optional)
- 1:N → FcmTokens
- 1:N → NotificationRecipients
- 1:N → Notifications (created_by)

---

### 3. Worker
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `first_name` | String | First name |
| `last_name` | String | Last name |
| `phone` | String | Phone number |
| `profile_image_url` | String | Profile image URL |
| `status` | String | invited, signed_contract, in_progress, pending_approval, active, inactive |
| `onboarding_step` | Number | 0-8 onboarding progress |
| `contract_signed` | Boolean | Contract signed flag |
| `contract_signed_at` | Date | Contract signed timestamp |
| `approved_by` | ObjectId | FK → User (who approved) |
| `approved_at` | Date | Approval timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:**
- N:1 → Company
- 1:1 → User (via worker_id)
- 1:1 → WorkerAddress
- 1:1 → WorkerBankDetail
- 1:1 → WorkerTaxInfo
- 1:1 → WorkerEmergencyContact
- 1:N → WorkerRoles
- 1:N → WorkerWorkingHours
- 1:N → WorkerFiles
- 1:N → WorkerTrainings
- 1:N → TimeOffRequests
- 1:N → ShiftPositionAssignments
- 1:N → PayrollReports
- 1:N → Reviews
- 1:N → Unassignments

---

### 4. Client
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `name` | String | Client name |
| `email` | String | Client email |
| `phone` | String | Client phone |
| `address` | String | Client address |
| `status` | String | active, inactive |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1 }`

**Relationships:**
- N:1 → Company
- 1:N → ClientRepresentatives
- 1:N → Jobs
- 1:N → Reviews

---

### 5. ClientRepresentative
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `client_id` | ObjectId | FK → Client |
| `company_id` | ObjectId | FK → Company |
| `first_name` | String | First name |
| `last_name` | String | Last name |
| `email` | String | Email (unique per client) |
| `phone` | String | Phone number |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ client_id: 1, email: 1 }` (unique)

**Relationships:**
- N:1 → Client
- N:1 → Company
- 1:1 → User (via client_rep_id)

---

### 6. Job
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `client_id` | ObjectId | FK → Client |
| `name` | String | Job name |
| `description` | String | Job description |
| `status` | String | draft, active, completed, cancelled |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, client_id: 1 }`

**Relationships:**
- N:1 → Company
- N:1 → Client
- 1:N → Shifts

---

### 7. Shift
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `job_id` | ObjectId | FK → Job |
| `name` | String | Shift name |
| `date` | Date | Shift date |
| `start_time` | String | Start time (HH:mm) |
| `end_time` | String | End time (HH:mm) |
| `location` | String | Shift location |
| `status` | String | draft, published, in_progress, completed, cancelled |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, job_id: 1, date: 1 }`

**Relationships:**
- N:1 → Company
- N:1 → Job
- 1:N → ShiftPositions
- 1:N → Reviews

---

### 8. ShiftPosition
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `shift_id` | ObjectId | FK → Shift |
| `company_id` | ObjectId | FK → Company |
| `company_role_id` | ObjectId | FK → CompanyRole |
| `needed_count` | Number | Workers needed (default: 1) |
| `filled_count` | Number | Workers filled (default: 0) |
| `status` | String | open, partially_filled, filled |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ shift_id: 1, company_role_id: 1 }`

**Relationships:**
- N:1 → Shift
- N:1 → Company
- N:1 → CompanyRole
- 1:N → ShiftPositionAssignments
- 1:N → Reviews (shift_position_id)

---

### 9. ShiftPositionAssignment
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `shift_position_id` | ObjectId | FK → ShiftPosition |
| `worker_id` | ObjectId | FK → Worker |
| `company_id` | ObjectId | FK → Company |
| `status` | String | assigned, requested, approved, rejected, unassigned, completed |
| `system_start_time` | Date | System check-in time |
| `system_end_time` | Date | System check-out time |
| `worker_start_time` | Date | Worker check-in time |
| `worker_end_time` | Date | Worker check-out time |
| `client_start_time` | Date | Client check-in time |
| `client_end_time` | Date | Client check-out time |
| `assigned_by` | ObjectId | FK → User |
| `approved_at` | Date | Approval timestamp |
| `is_requested` | Boolean | Requested by worker |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** 
- `{ shift_position_id: 1, worker_id: 1 }` (unique)
- `{ worker_id: 1, status: 1 }`

**Relationships:**
- N:1 → ShiftPosition
- N:1 → Worker
- N:1 → Company
- N:1 → User (assigned_by)
- 1:N → PayrollReportEntries

---

## Worker Sub-Models

### 10. WorkerAddress
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `address_line1` | String | Address line 1 |
| `address_line2` | String | Address line 2 |
| `city` | String | City |
| `state` | String | State |
| `postal_code` | String | Postal code |
| `country` | String | Country (default: USA) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:** N:1 → Worker

---

### 11. WorkerBankDetail
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `bank_name` | String | Bank name |
| `account_name` | String | Account name |
| `account_number` | String | Account number |
| `routing_number` | String | Routing number |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:** N:1 → Worker

---

### 12. WorkerTaxInfo
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `tax_number` | String | Tax identification number |
| `national_id` | String | National ID |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:** N:1 → Worker

---

### 13. WorkerEmergencyContact
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `contact_name` | String | Contact name |
| `relationship` | String | Relationship (spouse, parent, sibling) |
| `phone` | String | Contact phone |
| `email` | String | Contact email |
| `address_line1` | String | Address line 1 |
| `address_line2` | String | Address line 2 |
| `city` | String | City |
| `state` | String | State |
| `postal_code` | String | Postal code |
| `country` | String | Country (default: USA) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:** N:1 → Worker

---

### 14. WorkerRole
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `company_role_id` | ObjectId | FK → CompanyRole |
| `hourly_rate_override` | Number | Custom hourly rate |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, company_role_id: 1 }` (unique)

**Relationships:**
- N:1 → Worker
- N:1 → CompanyRole

---

### 15. WorkerWorkingHours
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `day_of_week` | Number | 0-6 (Sunday-Saturday) |
| `start_time` | String | Start time (HH:mm) |
| `end_time` | String | End time (HH:mm) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, day_of_week: 1 }`

**Relationships:** N:1 → Worker

---

### 16. WorkerFile
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `file_type` | String | nic, driver_license, insurance, other, proof_of_address, ni_utr, driving_license_front, driving_license_back, passport_front, passport_inner, passport_back, profile_photo, dvla_check |
| `file_url` | String | File URL (Cloudinary) |
| `cloudinary_public_id` | String | Cloudinary public ID |
| `uploaded_at` | Date | Upload timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, file_type: 1 }`

**Relationships:** N:1 → Worker

---

## Training Models

### 17. CompanyRole
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `name` | String | Role name |
| `role_category_id` | ObjectId | FK → RoleCategory |
| `default_hourly_rate` | Number | Default hourly rate |
| `description` | String | Role description |
| `is_active` | Boolean | Active status |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, name: 1 }` (unique)

**Relationships:**
- N:1 → Company
- N:1 → RoleCategory
- 1:N → WorkerRoles
- 1:N → ShiftPositions

---

### 18. RoleCategory
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `name` | String | Category name |
| `color` | String | Hex color (#RRGGBB) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, name: 1 }` (unique)

**Relationships:**
- N:1 → Company
- 1:N → CompanyRoles

---

### 19. Training
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `name` | String | Training name |
| `training_category_id` | ObjectId | FK → TrainingCategory |
| `document_required` | Boolean | Document required flag |
| `description` | String | Training description |
| `is_active` | Boolean | Active status |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1 }`

**Relationships:**
- N:1 → Company
- N:1 → TrainingCategory
- 1:N → WorkerTrainings

---

### 20. TrainingCategory
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `name` | String | Category name |
| `color` | String | Hex color (#RRGGBB) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, name: 1 }` (unique)

**Relationships:**
- N:1 → Company
- 1:N → Trainings

---

### 21. WorkerTraining
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `training_id` | ObjectId | FK → Training |
| `status` | String | assigned, in_progress, completed |
| `completed_at` | Date | Completion timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, training_id: 1 }` (unique)

**Relationships:**
- N:1 → Worker
- N:1 → Training

---

## Payroll Models

### 22. PayrollReport
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `company_id` | ObjectId | FK → Company |
| `start_date` | Date | Pay period start |
| `end_date` | Date | Pay period end |
| `status` | String | submitted, under_review, approved, modified, paid |
| `submitted_at` | Date | Submission timestamp |
| `reviewed_by` | ObjectId | FK → User |
| `reviewed_at` | Date | Review timestamp |
| `total_hours` | Number | Total hours worked |
| `total_amount` | Number | Total pay amount |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, start_date: 1, end_date: 1 }`

**Relationships:**
- N:1 → Worker
- N:1 → Company
- N:1 → User (reviewed_by)
- 1:N → PayrollReportEntries

---

### 23. PayrollReportEntry
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `payroll_report_id` | ObjectId | FK → PayrollReport |
| `shift_assignment_id` | ObjectId | FK → ShiftPositionAssignment |
| `external_work_desc` | String | External work description |
| `external_start_time` | Date | External start time |
| `external_end_time` | Date | External end time |
| `external_hourly_rate` | Number | External hourly rate |
| `hours_worked` | Number | Hours worked |
| `hourly_rate` | Number | Hourly rate |
| `total_amount` | Number | Total amount |
| `status` | String | submitted, approved, modified |
| `modified_hours` | Number | Modified hours |
| `modified_rate` | Number | Modified rate |
| `modified_amount` | Number | Modified amount |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ payroll_report_id: 1 }`

**Relationships:**
- N:1 → PayrollReport
- N:1 → ShiftPositionAssignment

---

## Review Model

### 24. Review
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `client_id` | ObjectId | FK → Client |
| `company_id` | ObjectId | FK → Company |
| `worker_id` | ObjectId | FK → Worker |
| `shift_id` | ObjectId | FK → Shift |
| `shift_position_id` | ObjectId | FK → ShiftPosition |
| `rating` | Number | 1-5 star rating |
| `actual_start_time` | Date | Actual shift start |
| `actual_end_time` | Date | Actual shift end |
| `comment` | String | Review comment |
| `created_at` | Date | Creation timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:**
- `{ shift_position_id: 1 }` (unique)
- `{ client_id: 1, shift_id: 1 }`

**Relationships:**
- N:1 → Client
- N:1 → Company
- N:1 → Worker
- N:1 → Shift
- N:1 → ShiftPosition

---

## Notification Models

### 25. Notification
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `type` | String | broadcast, targeted |
| `title` | String | Notification title |
| `message` | String | Notification message |
| `channel` | String | email, push, both |
| `created_by` | ObjectId | FK → User |
| `target_user_ids` | ObjectId[] | FK → User (array) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, created_at: -1 }`

**Relationships:**
- N:1 → Company
- N:1 → User (created_by)
- 1:N → NotificationRecipients

---

### 26. NotificationRecipient
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `notification_id` | ObjectId | FK → Notification |
| `user_id` | ObjectId | FK → User |
| `status` | String | sent, delivered, read |
| `sent_at` | Date | Sent timestamp |
| `delivered_at` | Date | Delivered timestamp |
| `read_at` | Date | Read timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:**
- `{ notification_id: 1, user_id: 1 }` (unique)
- `{ user_id: 1, status: 1 }`

**Relationships:**
- N:1 → Notification
- N:1 → User

---

### 27. FcmToken
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | FK → User |
| `token` | String | Firebase Cloud Messaging token |
| `device_type` | String | android, ios, web |
| `is_active` | Boolean | Active status |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ user_id: 1, token: 1 }` (unique)

**Relationships:** N:1 → User

---

## Time Off & Shift Management

### 28. TimeOffRequest
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `worker_id` | ObjectId | FK → Worker |
| `company_id` | ObjectId | FK → Company |
| `start_date` | Date | Start date |
| `end_date` | Date | End date |
| `reason` | String | Reason for time off |
| `status` | String | active, cancelled |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ worker_id: 1, start_date: 1, end_date: 1 }`

**Relationships:**
- N:1 → Worker
- N:1 → Company

---

### 29. Unassignment
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `assignment_id` | ObjectId | FK → ShiftPositionAssignment |
| `worker_id` | ObjectId | FK → Worker |
| `company_id` | ObjectId | FK → Company |
| `reason` | String | Unassignment reason |
| `unassigned_by` | String | worker, company |
| `unassigned_at` | Date | Unassignment timestamp |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Relationships:**
- N:1 → ShiftPositionAssignment
- N:1 → Worker
- N:1 → Company

---

### 30. CompanyWorkingHours
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `company_id` | ObjectId | FK → Company |
| `day_of_week` | Number | 0-6 (Sunday-Saturday) |
| `start_time` | String | Start time (HH:mm) |
| `end_time` | String | End time (HH:mm) |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `{ company_id: 1, day_of_week: 1 }` (unique)

**Relationships:** N:1 → Company

---

## Entity Relationship Diagram (ASCII)

```
┌─────────────────┐       ┌─────────────────┐
│    Company     │       │     User        │
├─────────────────┤       ├─────────────────┤
│ _id             │◄──────│ company_id (FK) │
│ name            │       │ email           │
│ logo_url        │       │ password_hash   │
│ email           │       │ role            │
│ phone           │       │ worker_id (FK)  │───────────────┐
│ status          │       │ client_rep_id   │───────────────┤
└────────┬────────┘       └────────┬────────┘               │
         │                         │                         │
         │ 1:N                     │ 1:1                    │
         ▼                         ▼                        ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Worker      │       │    Client       │       │ClientRepre-     │
├─────────────────┤       ├─────────────────┤       │sentative        │
│ company_id (FK) │       │ company_id (FK) │       ├─────────────────┤
│ first_name      │       │ name            │       │ client_id (FK)  │
│ last_name       │       │ email           │       │ company_id (FK) │
│ phone           │       │ phone           │       │ first_name      │
│ status          │       │ address         │       │ last_name       │
│ onboarding_step │       │ status          │       │ email           │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │ 1:1                    │ 1:N                     │
         ▼                         ▼                         │
┌─────────────────┐       ┌─────────────────┐                 │
│   WorkerAddress │       │      Job        │                 │
├─────────────────┤       ├─────────────────┤                 │
│ worker_id (FK)  │       │ company_id (FK) │◄────────────────┘
│ address_line1  │       │ client_id (FK)  │
│ city            │       │ name            │
│ state           │       │ description     │
│ postal_code     │       │ status          │
└─────────────────┘       └────────┬────────┘
                                    │
                                    │ 1:N
                                    ▼
                             ┌─────────────────┐
                             │     Shift       │
                             ├─────────────────┤
                             │ company_id (FK) │
                             │ job_id (FK)     │
                             │ name            │
                             │ date            │
                             │ start_time      │
                             │ end_time        │
                             │ location        │
                             │ status          │
                             └────────┬────────┘
                                      │
                                      │ 1:N
                                      ▼
                             ┌─────────────────┐
                             │  ShiftPosition  │
                             ├─────────────────┤
                             │ shift_id (FK)   │
                             │ company_id (FK) │
                             │ company_role_id │
                             │                 │
                             │ needed_count    │
                             │ filled_count    │
                             │ status          │
                             └────────┬────────┘
                                      │
                                      │ 1:N
                                      ▼
                             ┌─────────────────┐
                             │ShiftPosition-   │
                             │Assignment       │
                             ├─────────────────┤
                             │ shift_position  │
                             │ _id (FK)        │
                             │ worker_id (FK)  │
                             │ company_id (FK) │
                             │ status          │
                             │ *times          │
                             └─────────────────┘
```

---

## Complete Relationship Map

| From | To | Type | Description |
|------|-----|------|-------------|
| Company | User | 1:N | Company has many users |
| Company | Worker | 1:N | Company has many workers |
| Company | Client | 1:N | Company has many clients |
| Company | Job | 1:N | Company has many jobs |
| Company | Shift | 1:N | Company has many shifts |
| Company | Training | 1:N | Company has many trainings |
| Company | CompanyRole | 1:N | Company has many roles |
| Company | RoleCategory | 1:N | Company has many role categories |
| Company | TrainingCategory | 1:N | Company has many training categories |
| Company | CompanyWorkingHours | 1:N | Company has weekly working hours |
| User | Company | N:1 | User belongs to company |
| User | Worker | N:1 | User linked to worker (role: worker) |
| User | ClientRepresentative | N:1 | User linked to client rep (role: client_rep) |
| Worker | Company | N:1 | Worker belongs to company |
| Worker | User | 1:1 | Worker has one user account |
| Worker | WorkerAddress | 1:1 | Worker has one address |
| Worker | WorkerBankDetail | 1:1 | Worker has one bank detail |
| Worker | WorkerTaxInfo | 1:1 | Worker has one tax info |
| Worker | WorkerEmergencyContact | 1:1 | Worker has one emergency contact |
| Worker | WorkerRole | 1:N | Worker has many roles |
| Worker | WorkerWorkingHours | 1:N | Worker has weekly availability |
| Worker | WorkerFile | 1:N | Worker has many files |
| Worker | WorkerTraining | 1:N | Worker has many trainings |
| Worker | TimeOffRequest | 1:N | Worker has many time-off requests |
| Worker | ShiftPositionAssignment | 1:N | Worker assigned to many shifts |
| Worker | PayrollReport | 1:N | Worker has many payroll reports |
| Worker | Review | 1:N | Worker has many reviews |
| Worker | Unassignment | 1:N | Worker has many unassignments |
| Client | Company | N:1 | Client belongs to company |
| Client | ClientRepresentative | 1:N | Client has many representatives |
| Client | Job | 1:N | Client has many jobs |
| Client | Review | 1:N | Client has many reviews |
| ClientRepresentative | Client | N:1 | Representative belongs to client |
| ClientRepresentative | Company | N:1 | Representative belongs to company |
| ClientRepresentative | User | 1:1 | Representative has one user account |
| Job | Company | N:1 | Job belongs to company |
| Job | Client | N:1 | Job belongs to client |
| Job | Shift | 1:N | Job has many shifts |
| Shift | Company | N:1 | Shift belongs to company |
| Shift | Job | N:1 | Shift belongs to job |
| Shift | ShiftPosition | 1:N | Shift has many positions |
| Shift | Review | 1:N | Shift has many reviews |
| ShiftPosition | Shift | N:1 | Position belongs to shift |
| ShiftPosition | Company | N:1 | Position belongs to company |
| ShiftPosition | CompanyRole | N:1 | Position requires role |
| ShiftPosition | ShiftPositionAssignment | 1:N | Position has many assignments |
| ShiftPosition | Review | 1:N | Position has one review |
| ShiftPositionAssignment | ShiftPosition | N:1 | Assignment belongs to position |
| ShiftPositionAssignment | Worker | N:1 | Assignment belongs to worker |
| ShiftPositionAssignment | Company | N:1 | Assignment belongs to company |
| ShiftPositionAssignment | User | N:1 | Assignment created by user |
| ShiftPositionAssignment | PayrollReportEntry | 1:N | Assignment has payroll entries |
| CompanyRole | Company | N:1 | Role belongs to company |
| CompanyRole | RoleCategory | N:1 | Role belongs to category |
| CompanyRole | WorkerRole | 1:N | Role assigned to workers |
| CompanyRole | ShiftPosition | 1:N | Role required by positions |
| RoleCategory | Company | N:1 | Category belongs to company |
| RoleCategory | CompanyRole | 1:N | Category has many roles |
| Training | Company | N:1 | Training belongs to company |
| Training | TrainingCategory | N:1 | Training belongs to category |
| Training | WorkerTraining | 1:N | Training assigned to workers |
| TrainingCategory | Company | N:1 | Category belongs to company |
| TrainingCategory | Training | 1:N | Category has many trainings |
| WorkerTraining | Worker | N:1 | Worker's training |
| WorkerTraining | Training | N:1 | Training assigned to worker |
| PayrollReport | Worker | N:1 | Report belongs to worker |
| PayrollReport | Company | N:1 | Report belongs to company |
| PayrollReport | User | N:1 | Report reviewed by user |
| PayrollReport | PayrollReportEntry | 1:N | Report has many entries |
| PayrollReportEntry | PayrollReport | N:1 | Entry belongs to report |
| PayrollReportEntry | ShiftPositionAssignment | N:1 | Entry linked to shift |
| Review | Client | N:1 | Review from client |
| Review | Company | N:1 | Review in company |
| Review | Worker | N:1 | Review about worker |
| Review | Shift | N:1 | Review for shift |
| Review | ShiftPosition | N:1 | Review for position |
| Notification | Company | N:1 | Notification in company |
| Notification | User | N:1 | Notification created by user |
| Notification | NotificationRecipient | 1:N | Notification has many recipients |
| NotificationRecipient | Notification | N:1 | Recipient receives notification |
| NotificationRecipient | User | N:1 | Recipient is user |
| FcmToken | User | N:1 | Token belongs to user |
| TimeOffRequest | Worker | N:1 | Request by worker |
| TimeOffRequest | Company | N:1 | Request in company |
| Unassignment | ShiftPositionAssignment | N:1 | Unassignment of assignment |
| Unassignment | Worker | N:1 | Unassignment by worker |
| Unassignment | Company | N:1 | Unassignment in company |
| CompanyWorkingHours | Company | N:1 | Hours for company |

---

## Database Index Summary

| Collection | Index | Type |
|------------|-------|------|
| Client | `{ company_id: 1 }` | Regular |
| ClientRepresentative | `{ client_id: 1, email: 1 }` | Unique |
| Job | `{ company_id: 1, client_id: 1 }` | Regular |
| Shift | `{ company_id: 1, job_id: 1, date: 1 }` | Regular |
| ShiftPosition | `{ shift_id: 1, company_role_id: 1 }` | Regular |
| ShiftPositionAssignment | `{ shift_position_id: 1, worker_id: 1 }` | Unique |
| ShiftPositionAssignment | `{ worker_id: 1, status: 1 }` | Regular |
| Worker | `{ company_id: 1, email: 1 }` | Regular |
| WorkerAddress | - | - |
| WorkerBankDetail | - | - |
| WorkerTaxInfo | - | - |
| WorkerEmergencyContact | - | - |
| WorkerRole | `{ worker_id: 1, company_role_id: 1 }` | Unique |
| WorkerWorkingHours | `{ worker_id: 1, day_of_week: 1 }` | Regular |
| WorkerFile | `{ worker_id: 1, file_type: 1 }` | Regular |
| WorkerTraining | `{ worker_id: 1, training_id: 1 }` | Unique |
| CompanyRole | `{ company_id: 1, name: 1 }` | Unique |
| RoleCategory | `{ company_id: 1, name: 1 }` | Unique |
| Training | `{ company_id: 1 }` | Regular |
| TrainingCategory | `{ company_id: 1, name: 1 }` | Unique |
| PayrollReport | `{ worker_id: 1, start_date: 1, end_date: 1 }` | Regular |
| PayrollReportEntry | `{ payroll_report_id: 1 }` | Regular |
| Review | `{ shift_position_id: 1 }` | Unique |
| Review | `{ client_id: 1, shift_id: 1 }` | Regular |
| Notification | `{ company_id: 1, created_at: -1 }` | Regular |
| NotificationRecipient | `{ notification_id: 1, user_id: 1 }` | Unique |
| NotificationRecipient | `{ user_id: 1, status: 1 }` | Regular |
| FcmToken | `{ user_id: 1, token: 1 }` | Unique |
| TimeOffRequest | `{ worker_id: 1, start_date: 1, end_date: 1 }` | Regular |
| CompanyWorkingHours | `{ company_id: 1, day_of_week: 1 }` | Unique |
| User | `{ email: 1, company_id: 1 }` | Unique |

---

*Document Version: 1.0*
*Last Updated: April 2026*
