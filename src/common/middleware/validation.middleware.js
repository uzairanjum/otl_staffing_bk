const Joi = require('joi');

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

  inviteWorker: Joi.object({
    email: Joi.string().email().required(),
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    phone: Joi.string(),
    role_ids: Joi.array().items(Joi.string())
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
    description: Joi.string()
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
    address: Joi.string()
  }),

  clientRepresentative: Joi.object({
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string()
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
    description: Joi.string()
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
  schemas
};
