const path = require('path');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OTL Staffing Platform API',
      version: '1.0.0',
      description: 'Multi-tenant shift management and staffing platform API',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:{port}',
        description: 'Local development server',
        variables: {
          port: {
            default: '5000'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        }
      },
      schemas: {
        Login: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@company.com'
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123'
            }
          }
        },
        ChangePassword: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              format: 'password'
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              example: 'newpassword123'
            }
          }
        },
        ForgotPassword: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@company.com'
            }
          }
        },
        ResetPassword: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: {
              type: 'string',
              example: 'reset-token-from-email'
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              example: 'newpassword123'
            }
          }
        },
        InviteWorker: {
          type: 'object',
          required: ['email', 'first_name', 'last_name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'worker@company.com'
            },
            first_name: {
              type: 'string',
              example: 'John'
            },
            last_name: {
              type: 'string',
              example: 'Doe'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            role_ids: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['role-id-1', 'role-id-2']
            }
          }
        },
        CompanyUpdate: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Acme Staffing'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contact@acme.com'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            logo_url: {
              type: 'string',
              format: 'url'
            }
          }
        },
        CompanyRole: {
          type: 'object',
          required: ['name', 'role_category_id'],
          properties: {
            name: {
              type: 'string',
              example: 'Server'
            },
            role_category_id: {
              type: 'string',
              example: 'category-id'
            },
            category: {
              type: 'string'
            },
            default_hourly_rate: {
              type: 'number',
              example: 15.00
            },
            description: {
              type: 'string',
              example: 'Food service server'
            }
          }
        },
        RoleCategory: {
          type: 'object',
          required: ['name', 'color'],
          properties: {
            name: {
              type: 'string',
              example: 'Food Service'
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-F]{6}$',
              example: '#FF5733'
            }
          }
        },
        TrainingCategory: {
          type: 'object',
          required: ['name', 'color'],
          properties: {
            name: {
              type: 'string',
              example: 'Safety'
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-F]{6}$',
              example: '#FF5733'
            }
          }
        },
        Client: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              example: 'Acme Restaurant'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contact@acmerestaurant.com'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            address: {
              type: 'string',
              example: '123 Main St, New York, NY 10001'
            }
          }
        },
        ClientRepresentative: {
          type: 'object',
          required: ['first_name', 'last_name', 'email'],
          properties: {
            first_name: {
              type: 'string',
              example: 'Jane'
            },
            last_name: {
              type: 'string',
              example: 'Smith'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane@acmerestaurant.com'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            }
          }
        },
        Job: {
          type: 'object',
          required: ['client_id', 'name'],
          properties: {
            client_id: {
              type: 'string',
              example: 'client-id'
            },
            name: {
              type: 'string',
              example: 'Weekend Event Staffing'
            },
            description: {
              type: 'string',
              example: 'Staff for corporate event on Saturday'
            }
          }
        },
        Shift: {
          type: 'object',
          required: ['job_id', 'name', 'date', 'start_time', 'end_time'],
          properties: {
            job_id: {
              type: 'string',
              example: 'job-id'
            },
            name: {
              type: 'string',
              example: 'Saturday Dinner Shift'
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2026-04-15'
            },
            start_time: {
              type: 'string',
              example: '17:00'
            },
            end_time: {
              type: 'string',
              example: '23:00'
            },
            location: {
              type: 'string',
              example: '123 Event Venue, New York, NY'
            }
          }
        },
        ShiftPosition: {
          type: 'object',
          required: ['company_role_id'],
          properties: {
            company_role_id: {
              type: 'string',
              example: 'role-id'
            },
            needed_count: {
              type: 'number',
              default: 1,
              example: 3
            }
          }
        },
        TimeOff: {
          type: 'object',
          required: ['start_date', 'end_date'],
          properties: {
            start_date: {
              type: 'string',
              format: 'date',
              example: '2026-04-20'
            },
            end_date: {
              type: 'string',
              format: 'date',
              example: '2026-04-22'
            },
            reason: {
              type: 'string',
              example: 'Family vacation'
            }
          }
        },
        PayrollReport: {
          type: 'object',
          required: ['start_date', 'end_date'],
          properties: {
            start_date: {
              type: 'string',
              format: 'date',
              example: '2026-04-01'
            },
            end_date: {
              type: 'string',
              format: 'date',
              example: '2026-04-14'
            },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  shift_assignment_id: {
                    type: 'string'
                  },
                  external_work_desc: {
                    type: 'string'
                  },
                  external_start_time: {
                    type: 'string',
                    format: 'date-time'
                  },
                  external_end_time: {
                    type: 'string',
                    format: 'date-time'
                  },
                  external_hourly_rate: {
                    type: 'number'
                  },
                  hours_worked: {
                    type: 'number'
                  },
                  hourly_rate: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        Review: {
          type: 'object',
          required: ['shift_position_id', 'rating'],
          properties: {
            shift_position_id: {
              type: 'string',
              example: 'position-id'
            },
            rating: {
              type: 'number',
              minimum: 1,
              maximum: 5,
              example: 5
            },
            actual_start_time: {
              type: 'string',
              format: 'date-time'
            },
            actual_end_time: {
              type: 'string',
              format: 'date-time'
            },
            comment: {
              type: 'string',
              example: 'Great worker, very professional!'
            }
          }
        },
        Notification: {
          type: 'object',
          required: ['type', 'title', 'message'],
          properties: {
            type: {
              type: 'string',
              enum: ['broadcast', 'targeted'],
              example: 'broadcast'
            },
            title: {
              type: 'string',
              example: 'New Shift Available'
            },
            message: {
              type: 'string',
              example: 'A new shift has been posted at Acme Restaurant'
            },
            channel: {
              type: 'string',
              enum: ['email', 'push', 'both'],
              default: 'both'
            },
            target_user_ids: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        Training: {
          type: 'object',
          required: ['name', 'training_category_id'],
          properties: {
            name: {
              type: 'string',
              example: 'Food Safety Certification'
            },
            training_category_id: {
              type: 'string',
              example: 'category-id'
            },
            category: {
              type: 'string'
            },
            description: {
              type: 'string',
              example: 'Required food handling certification'
            }
          }
        },
        OnboardingContract: {
          type: 'object',
          required: ['legal_name'],
          properties: {
            legal_name: {
              type: 'string',
              example: 'John Michael Doe'
            }
          }
        },
        OnboardingStep1: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
              example: 'John'
            },
            last_name: {
              type: 'string',
              example: 'Doe'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            profile_image: {
              type: 'string',
              format: 'binary'
            },
            address_line1: {
              type: 'string',
              example: '123 Main Street'
            },
            address_line2: {
              type: 'string',
              example: 'Apt 4B'
            },
            city: {
              type: 'string',
              example: 'New York'
            },
            state: {
              type: 'string',
              example: 'NY'
            },
            postal_code: {
              type: 'string',
              example: '10001'
            },
            country: {
              type: 'string',
              example: 'USA'
            }
          }
        },
        OnboardingStep2: {
          type: 'object',
          properties: {
            tax_number: {
              type: 'string',
              example: '123-45-6789'
            },
            national_id: {
              type: 'string',
              example: 'ID123456789'
            },
            bank_name: {
              type: 'string',
              example: 'Chase Bank'
            },
            account_name: {
              type: 'string',
              example: 'John Doe'
            },
            account_number: {
              type: 'string',
              example: '1234567890'
            },
            routing_number: {
              type: 'string',
              example: '021000021'
            }
          }
        },
        OnboardingStep3: {
          type: 'object',
          properties: {
            contact_name: {
              type: 'string',
              example: 'Jane Doe'
            },
            relationship: {
              type: 'string',
              example: 'Spouse'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane@email.com'
            }
          }
        },
        OnboardingStep4: {
          type: 'object',
          properties: {
            roles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role_id: {
                    type: 'string'
                  },
                  hourly_rate: {
                    type: 'number'
                  }
                }
              }
            }
          }
        },
        OnboardingStep5: {
          type: 'object',
          properties: {
            availability: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day_of_week: {
                    type: 'number',
                    example: 1
                  },
                  start_time: {
                    type: 'string',
                    example: '09:00'
                  },
                  end_time: {
                    type: 'string',
                    example: '17:00'
                  }
                }
              }
            }
          }
        },
        FcmToken: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              example: 'firebase-cloud-messaging-token'
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Unauthorized'
                  }
                }
              }
            }
          }
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Forbidden'
                  }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Not Found - Resource does not exist',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Not Found'
                  }
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation Error - Invalid request body',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Validation failed'
                  },
                  errors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: {
                          type: 'string'
                        },
                        message: {
                          type: 'string'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Internal Server Error'
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints'
      },
      {
        name: 'Company',
        description: 'Company management endpoints'
      },
      {
        name: 'Workers',
        description: 'Worker management endpoints (Admin)'
      },
      {
        name: 'Onboarding',
        description: 'Worker onboarding endpoints'
      },
      {
        name: 'Worker Self-Service',
        description: 'Worker self-service endpoints'
      },
      {
        name: 'Shifts',
        description: 'Shift management endpoints (Admin)'
      },
      {
        name: 'Worker Shifts',
        description: 'Worker-facing shift endpoints'
      },
      {
        name: 'Training',
        description: 'Training management endpoints'
      },
      {
        name: 'Clients',
        description: 'Client management endpoints'
      },
      {
        name: 'Jobs',
        description: 'Job management endpoints'
      },
      {
        name: 'Payroll',
        description: 'Payroll management endpoints (Admin)'
      },
      {
        name: 'Worker Payroll',
        description: 'Worker payroll endpoints'
      },
      {
        name: 'Reviews',
        description: 'Review endpoints'
      },
      {
        name: 'Notifications',
        description: 'Notification endpoints'
      }
    ]
  },
  apis: [
    path.join(__dirname, 'src/modules/**/*.routes.js'),
    path.join(__dirname, 'src/modules/**/*.js')
  ]
};

module.exports = swaggerOptions;
