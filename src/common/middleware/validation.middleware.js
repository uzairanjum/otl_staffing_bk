const Joi = require('joi');
const WorkerFileModel = require('../../modules/worker/WorkerFile');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({ 
        error: 'Validation failed', 
        errors 
      });
    }
    
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  }),

  setPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),

  verifyTokenQuery: Joi.object({
    token: Joi.string().required()
  }),

  adminSendEmail: Joi.object({
    email: Joi.string().email().required(),
    subject: Joi.string().trim().min(1).max(200).required(),
    body: Joi.string().trim().min(1).max(50000).required(),
  }),

  inviteWorker: Joi.object({
    email: Joi.string().email().required(),
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    phone: Joi.string().allow('', null),
    role_ids: Joi.array().items(Joi.string()).default([]),
    role_assignments: Joi.array()
      .items(
        Joi.object({
          company_role_id: Joi.string().required(),
          hourly_rate_override: Joi.number().optional(),
        })
      )
      .default([]),
    additional_training_ids: Joi.array().items(Joi.string()).default([]),
    send_invite: Joi.boolean().default(true),
  }),

  workerOnboardingBasicInfo: Joi.object({
    contract_signature_name: Joi.string().trim().allow('').optional(),
    employment_contract_text: Joi.string().max(100000).allow('').optional(),
    first_name: Joi.string().trim().required(),
    last_name: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().allow('', null),
    address: Joi.object({
      address_line1: Joi.string().allow('', null),
      address_line2: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      postal_code: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
    }).default({}),
    emergency_contact: Joi.object({
      contact_name: Joi.string().allow('', null),
      phone: Joi.string().allow('', null),
      relationship: Joi.string().allow('', null),
      address: Joi.object({
        address_line1: Joi.string().allow('', null),
        address_line2: Joi.string().allow('', null),
        city: Joi.string().allow('', null),
        state: Joi.string().allow('', null),
        postal_code: Joi.string().allow('', null),
        country: Joi.string().allow('', null),
      }).optional(),
    }).optional(),
    tax_bank: Joi.object({
      national_id: Joi.string().allow('', null),
      tax_number: Joi.string().allow('', null),
      bank_name: Joi.string().allow('', null),
      account_name: Joi.string().allow('', null),
      account_number: Joi.string().allow('', null),
      routing_number: Joi.string().allow('', null),
    }).optional(),
  }),
  workerOnboardingWorkingHours: Joi.object({
    availability: Joi.array()
      .items(
        Joi.object({
          day_of_week: Joi.number().integer().min(0).max(6).required(),
          active: Joi.boolean().default(true),
          start_time: Joi.when('active', {
            is: false,
            then: Joi.string().trim().allow('', null).optional(),
            otherwise: Joi.string().trim().required(),
          }),
          end_time: Joi.when('active', {
            is: false,
            then: Joi.string().trim().allow('', null).optional(),
            otherwise: Joi.string().trim().required(),
          }),
        })
      )
      .default([]),
    notes: Joi.string().allow('', null),
    entries: Joi.array()
      .items(
        Joi.object({
          date: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).required(),
          from: Joi.string().trim().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
          to: Joi.string().trim().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        })
      )
      .default([]),
  }),
  workerOnboardingDocumentsTrainings: Joi.object({}),
  workerOnboardingComplete: Joi.object({}),

  workerFileUpload: Joi.object({
    file_type: Joi.string()
      .valid(...WorkerFileModel.FILE_TYPES)
      .required(),
    file_url: Joi.string().required(),
    cloudinary_public_id: Joi.string().allow('', null),
    dvla_code: Joi.string().allow('', null),
    dvla_date: Joi.alternatives().try(Joi.date(), Joi.string().allow(''), Joi.valid(null)),
  }),

  workerFileMeta: Joi.object({
    dvla_code: Joi.string().allow('', null),
    dvla_date: Joi.alternatives().try(
      Joi.number().integer(),
      Joi.date(),
      Joi.string().allow(''),
      Joi.valid(null)
    ),
  }),

  companyUpdate: Joi.object({
    name: Joi.string(),
    email: Joi.string().email(),
    phone: Joi.string(),
    logo_url: Joi.string()
  }),

  companyRole: Joi.object({
    name: Joi.string().required(),
    role_category_id: Joi.string().required(),
    category: Joi.string(),
    default_hourly_rate: Joi.number().min(0),
    description: Joi.string().allow(''),
    required_training_ids: Joi.array().items(Joi.string()).default([]),
    is_active: Joi.boolean()
  }),

  roleCategory: Joi.object({
    name: Joi.string().required(),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required()
  }),

  trainingCategory: Joi.object({
    name: Joi.string().required(),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required()
  }),

  client: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email(),
    phone: Joi.string(),
    organization: Joi.string().allow(''),
    address: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    website: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive')
  }),

  clientRepresentative: Joi.object({
    first_name: Joi.string(),
    last_name: Joi.string(),
    name: Joi.string(),
    email: Joi.string().email().required(),
    phone: Joi.string().allow(''),
    address: Joi.string().allow(''),
    representativerole: Joi.string().allow('')
  }),

  clientWithDetails: Joi.object({
    client: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().allow(''),
      phone: Joi.string().allow(''),
      organization: Joi.string().allow(''),
      address: Joi.string().allow(''),
      notes: Joi.string().allow(''),
      website: Joi.string().allow(''),
      status: Joi.string().valid('active', 'inactive').default('active'),
      color: Joi.string().allow('')
    }).required(),
    representatives: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().allow(''),
        address: Joi.string().allow(''),
        representativerole: Joi.string().allow('')
      })
    ).min(1).required(),
    jobs: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        location: Joi.string().allow(''),
        color: Joi.string().allow(''),
        status: Joi.string()
          .valid('draft', 'active', 'inactive', 'completed', 'cancelled')
          .default('draft')
      })
    ).default([])
  }),

  clientWithDetailsUpdate: Joi.object({
    client: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().allow(''),
      phone: Joi.string().allow(''),
      organization: Joi.string().allow(''),
      address: Joi.string().allow(''),
      notes: Joi.string().allow(''),
      color: Joi.string().allow(''),
      website: Joi.string().allow(''),
      status: Joi.string().valid('active', 'inactive').default('active')
    }).required(),
    representatives: Joi.array().items(
      Joi.object({
        id: Joi.string(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().allow(''),
        address: Joi.string().allow(''),
        representativerole: Joi.string().allow('')
      })
    ).min(1).required(),
    jobs: Joi.array().items(
      Joi.object({
        id: Joi.string(),
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        location: Joi.string().allow(''),
        color: Joi.string().allow(''),
        status: Joi.string()
          .valid('draft', 'active', 'inactive', 'completed', 'cancelled')
          .default('draft')
      })
    ).default([])
  }),

  job: Joi.object({
    client_id: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string(),
    location: Joi.string().allow(''),
    status: Joi.string()
      .valid('draft', 'active', 'inactive', 'completed', 'cancelled')
      .default('draft')
  }),

  shift: Joi.object({
    client_id: Joi.string().required(),
    job_id: Joi.string().required(),
    name: Joi.string().trim().required(),
    client_rep_id: Joi.string().allow('', null),
    start_time: Joi.date().required(),
    end_time: Joi.date().required(),
    isMultiDay: Joi.boolean().default(false),
    location: Joi.string().allow('', null),
    status: Joi.string().valid('draft', 'published', 'in_progress', 'completed', 'cancelled').default('draft'),
    notes: Joi.string().allow('', null),
    required_approval: Joi.boolean().default(true),
    positions: Joi.array().items(
      Joi.object({
        company_role_id: Joi.string().required(),
        needed_count: Joi.number().min(1).default(1),
        pay_rate: Joi.number().min(0).default(0),
        break_time: Joi.string().allow('').default('No Break'),
        assignments: Joi.array().items(
          Joi.object({
            worker_id: Joi.string().allow('', null),
            system_date: Joi.date().required(),
            system_start_time: Joi.date().required(),
            system_end_time: Joi.date().required(),
            worker_date: Joi.date().allow(null),
            worker_start_time: Joi.date().allow(null),
            worker_end_time: Joi.date().allow(null),
            client_date: Joi.date().allow(null),
            client_start_time: Joi.date().allow(null),
            client_end_time: Joi.date().allow(null),
            status: Joi.string().valid('assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed').default('assigned')
          })
        ).default([])
      })
    ).min(1).required()
  }),
  shiftUpdate: Joi.object({
    client_id: Joi.string(),
    job_id: Joi.string(),
    name: Joi.string().trim(),
    client_rep_id: Joi.string().allow('', null),
    start_time: Joi.date(),
    end_time: Joi.date(),
    isMultiDay: Joi.boolean(),
    location: Joi.string().allow('', null),
    status: Joi.string().valid('draft', 'published', 'in_progress', 'completed', 'cancelled'),
    notes: Joi.string().allow('', null),
    required_approval: Joi.boolean(),
    positions: Joi.array().items(
      Joi.object({
        company_role_id: Joi.string().required(),
        needed_count: Joi.number().min(1).default(1),
        pay_rate: Joi.number().min(0).default(0),
        break_time: Joi.string().allow('').default('No Break'),
        assignments: Joi.array().items(
          Joi.object({
            worker_id: Joi.string().allow('', null),
            system_date: Joi.date().required(),
            system_start_time: Joi.date().required(),
            system_end_time: Joi.date().required(),
            worker_date: Joi.date().allow(null),
            worker_start_time: Joi.date().allow(null),
            worker_end_time: Joi.date().allow(null),
            client_date: Joi.date().allow(null),
            client_start_time: Joi.date().allow(null),
            client_end_time: Joi.date().allow(null),
            status: Joi.string().valid('assigned', 'requested', 'approved', 'rejected', 'unassigned', 'completed').default('assigned')
          })
        ).default([])
      })
    )
  }).min(1),

  shiftPosition: Joi.object({
    company_role_id: Joi.string().required(),
    needed_count: Joi.number().min(1).default(1),
    pay_rate: Joi.number().min(0).default(0),
    break_time: Joi.string().allow('').default('No Break')
  }),
  shiftPositionUpdate: Joi.object({
    company_role_id: Joi.string(),
    needed_count: Joi.number().min(1),
    pay_rate: Joi.number().min(0),
    break_time: Joi.string().allow(''),
    status: Joi.string().valid('open', 'partially_filled', 'filled')
  }).min(1),
  shiftTemplateCreate: Joi.object({
    name: Joi.string().trim().required(),
    positions: Joi.array()
      .items(
        Joi.object({
          company_role_id: Joi.string().required(),
          needed_count: Joi.number().min(1).required(),
          pay_rate: Joi.number().min(0).default(0),
          break_time: Joi.string().allow('').default('No Break'),
        })
      )
      .min(1)
      .required(),
  }),
  shiftTemplateUpdate: Joi.object({
    name: Joi.string().trim().required(),
    positions: Joi.array()
      .items(
        Joi.object({
          company_role_id: Joi.string().required(),
          needed_count: Joi.number().min(1).required(),
          pay_rate: Joi.number().min(0).default(0),
          break_time: Joi.string().allow('').default('No Break'),
        })
      )
      .min(1)
      .required(),
  }),

  timeOff: Joi.object({
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
    reason: Joi.string()
  }),

  payrollReport: Joi.object({
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
    entries: Joi.array().items(Joi.object({
      shift_assignment_id: Joi.string(),
      external_work_desc: Joi.string(),
      external_start_time: Joi.date(),
      external_end_time: Joi.date(),
      external_hourly_rate: Joi.number(),
      hours_worked: Joi.number(),
      hourly_rate: Joi.number()
    }))
  }),

  review: Joi.object({
    shift_position_id: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    actual_start_time: Joi.date(),
    actual_end_time: Joi.date(),
    comment: Joi.string()
  }),

  notification: Joi.object({
    type: Joi.string().valid('broadcast', 'targeted').required(),
    title: Joi.string().required(),
    message: Joi.string().required(),
    channel: Joi.string().valid('email', 'push', 'both').default('both'),
    target_user_ids: Joi.array().items(Joi.string())
  }),

  training: Joi.object({
    name: Joi.string().required(),
    training_category_id: Joi.string().required(),
    category: Joi.string(),
    description: Joi.string().allow(''),
    expiry: Joi.alternatives().try(Joi.date(), Joi.string()).required(),
    validity: Joi.string().required(),
    document_required: Joi.boolean().required(),
    is_active: Joi.boolean().required()
  }),

  onboardingStep3: Joi.object({
    contact_name: Joi.string(),
    relationship: Joi.string(),
    phone: Joi.string(),
    email: Joi.string().email(),
    address_line1: Joi.string(),
    address_line2: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    postal_code: Joi.string(),
    country: Joi.string()
  })
};

module.exports = {
  validate,
  validateQuery,
  schemas
};
