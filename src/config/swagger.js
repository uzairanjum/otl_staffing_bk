const config = require('./index');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OTL Staffing Platform API',
      version: '1.0.0',
      description: 'Multi-tenant shift management and staffing platform API documentation',
      contact: {
        name: 'OTL Staffing',
        email: 'support@otlstaffing.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.otlstaffing.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token. Use /auth/login to obtain token.'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'worker', 'client_rep'] },
            first_login: { type: 'boolean' },
            company_id: { type: 'string', format: 'uuid' }
          }
        },
        Worker: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: 'string' },
            profile_image_url: { type: 'string', format: 'url' },
            status: { type: 'string', enum: ['invited', 'onboarding', 'pending_approval', 'active', 'suspended'] },
            onboarding_step: { type: 'integer', minimum: 0, maximum: 7 },
            contract_signed: { type: 'boolean' },
            approved_at: { type: 'string', format: 'date-time' }
          }
        },
        WorkerAddress: {
          type: 'object',
          properties: {
            address_line1: { type: 'string' },
            address_line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' }
          }
        },
        WorkerTaxInfo: {
          type: 'object',
          properties: {
            tax_number: { type: 'string' },
            national_id: { type: 'string' }
          }
        },
        WorkerBankDetail: {
          type: 'object',
          properties: {
            bank_name: { type: 'string' },
            account_name: { type: 'string' },
            account_number: { type: 'string' },
            routing_number: { type: 'string' }
          }
        },
        WorkerEmergencyContact: {
          type: 'object',
          properties: {
            contact_name: { type: 'string' },
            relationship: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            address_line1: { type: 'string' },
            address_line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' }
          }
        },
        WorkerFile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            file_type: { 
              type: 'string', 
              enum: ['nic', 'driver_license', 'insurance', 'other', 'proof_of_address', 'ni_utr', 'driving_license_front', 'driving_license_back', 'passport_front', 'passport_inner', 'passport_back', 'profile_photo', 'dvla_check'] 
            },
            file_url: { type: 'string', format: 'url' },
            uploaded_at: { type: 'string', format: 'date-time' }
          }
        },
        WorkerRole: {
          type: 'object',
          properties: {
            company_role_id: { type: 'string', format: 'uuid' },
            hourly_rate_override: { type: 'number' }
          }
        },
        WorkerWorkingHours: {
          type: 'object',
          properties: {
            day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
            start_time: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
            end_time: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' }
          }
        },
        Company: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            logo_url: { type: 'string', format: 'url' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
          }
        },
        CompanyRole: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            category: { type: 'string' },
            default_hourly_rate: { type: 'number' },
            description: { type: 'string' },
            is_active: { type: 'boolean' }
          }
        },
        CompanyWorkingHours: {
          type: 'object',
          properties: {
            day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
            start_time: { type: 'string' },
            end_time: { type: 'string' }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive'] }
          }
        },
        ClientRepresentative: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' }
          }
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'active', 'completed', 'cancelled'] }
          }
        },
        Shift: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            date: { type: 'string', format: 'date' },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            location: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published', 'in_progress', 'completed', 'cancelled'] }
          }
        },
        ShiftPosition: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shift_id: { type: 'string', format: 'uuid' },
            company_role_id: { type: 'string', format: 'uuid' },
            needed_count: { type: 'integer' },
            filled_count: { type: 'integer' },
            status: { type: 'string', enum: ['open', 'partially_filled', 'filled'] }
          }
        },
        ShiftPositionAssignment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            shift_position_id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed'] },
            system_start_time: { type: 'string', format: 'date-time' },
            system_end_time: { type: 'string', format: 'date-time' },
            worker_start_time: { type: 'string', format: 'date-time' },
            worker_end_time: { type: 'string', format: 'date-time' },
            client_start_time: { type: 'string', format: 'date-time' },
            client_end_time: { type: 'string', format: 'date-time' }
          }
        },
        Training: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            is_active: { type: 'boolean' }
          }
        },
        WorkerTraining: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            training_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['assigned', 'in_progress', 'completed'] },
            completed_at: { type: 'string', format: 'date-time' }
          }
        },
        TimeOffRequest: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            reason: { type: 'string' },
            status: { type: 'string', enum: ['active', 'cancelled'] }
          }
        },
        PayrollReport: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['submitted', 'under_review', 'approved', 'modified', 'paid'] },
            submitted_at: { type: 'string', format: 'date-time' },
            total_hours: { type: 'number' },
            total_amount: { type: 'number' }
          }
        },
        PayrollReportEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            payroll_report_id: { type: 'string', format: 'uuid' },
            shift_assignment_id: { type: 'string', format: 'uuid' },
            external_work_desc: { type: 'string' },
            hours_worked: { type: 'number' },
            hourly_rate: { type: 'number' },
            total_amount: { type: 'number' },
            status: { type: 'string', enum: ['submitted', 'approved', 'modified'] }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            shift_id: { type: 'string', format: 'uuid' },
            shift_position_id: { type: 'string', format: 'uuid' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            actual_start_time: { type: 'string', format: 'date-time' },
            actual_end_time: { type: 'string', format: 'date-time' },
            comment: { type: 'string' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['broadcast', 'targeted'] },
            title: { type: 'string' },
            message: { type: 'string' },
            channel: { type: 'string', enum: ['email', 'push', 'both'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'User email address' },
            password: { type: 'string', format: 'password', description: 'User password' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'JWT access token' },
            user: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                first_login: { type: 'boolean' },
                company_id: { type: 'string' }
              }
            }
          }
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', description: 'Current password' },
            newPassword: { type: 'string', minLength: 8, description: 'New password (min 8 characters)' }
          }
        },
        InviteWorkerRequest: {
          type: 'object',
          required: ['email', 'first_name', 'last_name'],
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: 'string' },
            role_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }
          }
        },
        CompanyStats: {
          type: 'object',
          properties: {
            total_workers: { type: 'integer' },
            active_workers: { type: 'integer' },
            total_clients: { type: 'integer' },
            total_jobs: { type: 'integer' },
            total_shifts: { type: 'integer' },
            upcoming_shifts: { type: 'integer' },
            total_assignments: { type: 'integer' },
            paid_payroll_reports: { type: 'integer' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Unauthorized', message: 'No token provided' }
            }
          }
        },
        ForbiddenError: {
          description: 'User does not have permission to access this resource',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Forbidden', message: 'Insufficient permissions' }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Not Found', message: 'Worker not found' }
            }
          }
        },
        ValidationError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { 
                error: 'Validation failed', 
                errors: [{ field: 'email', message: 'Email is required' }] 
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'error', message: 'Something went wrong' }
            }
          }
        }
      }
    },
    security: [{ BearerAuth: [] }]
  },
  apis: ['./src/modules/**/*.routes.js']
};

module.exports = swaggerOptions;
