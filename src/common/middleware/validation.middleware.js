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
    first_name: Joi.string().trim().required(),
    last_name: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().required(),
    address: Joi.object({
      address_line1: Joi.string().allow('', null),
      address_line2: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      postal_code: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
    }).required(),
  }),

  workerOnboardingEmergencyContact: Joi.object({
    contact_name: Joi.string().trim().required(),
    phone: Joi.string().trim().required(),
    relationship: Joi.string().trim().required(),
    address: Joi.object({
      address_line1: Joi.string().allow('', null),
      address_line2: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      state: Joi.string().allow('', null),
      postal_code: Joi.string().allow('', null),
      country: Joi.string().allow('', null),
    }),
    address_line1: Joi.string().allow('', null),
    address_line2: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    postal_code: Joi.string().allow('', null),
    country: Joi.string().allow('', null),
  }).or('address', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'),

  workerOnboardingTaxBank: Joi.object({
    national_id: Joi.string().trim().required(),
    tax_number: Joi.string().trim().allow('', null),
    bank_name: Joi.string().trim().required(),
    account_name: Joi.string().trim().required(),
    account_number: Joi.string().trim().required(),
    routing_number: Joi.string().trim().required(),
  }),

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
      status: Joi.string().valid('active', 'inactive').default('active')
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
        status: Joi.string().valid('draft', 'active', 'completed', 'cancelled')
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
        status: Joi.string().valid('draft', 'active', 'completed', 'cancelled')
      })
    ).default([])
  }),

  job: Joi.object({
    client_id: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string()
  }),

  shift: Joi.object({
    job_id: Joi.string().required(),
    name: Joi.string().required(),
    date: Joi.date().required(),
    start_time: Joi.string().required(),
    end_time: Joi.string().required(),
    location: Joi.string()
  }),

  shiftPosition: Joi.object({
    company_role_id: Joi.string().required(),
    needed_count: Joi.number().min(1).default(1)
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
