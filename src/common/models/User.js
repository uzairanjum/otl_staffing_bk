const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const WORKER_STATUSES = ['invited', 'onboarding', 'pending_approval', 'active', 'inactive'];
const STAFF_STATUSES = ['active', 'inactive'];

const userSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  name: {
    type: String,
    trim: true
  },
  first_name: {
    type: String,
    trim: true
  },
  last_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'worker', 'client_rep'],
    required: true
  },
  client_rep_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientRepresentative'
  },
  phone: {
    type: String
  },
  profile_image_url: {
    type: String
  },
  address: {
    type: String
  },
  representativerole: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: true
  },
  onboarding_step: {
    type: Number,
    min: 0,
    max: 8,
    default: 0
  },
  contract_signed: {
    type: Boolean,
    default: false
  },
  contract_signed_at: {
    type: Date
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  refresh_token: {
    type: String
  },
  first_login: {
    type: Boolean,
    default: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

userSchema.pre('validate', function(next) {
  if (this.role === 'worker') {
    if (!this.status) {
      this.status = 'invited';
    }
    if (!WORKER_STATUSES.includes(this.status)) {
      return next(new Error(`Invalid worker status: ${this.status}`));
    }
  } else {
    if (!this.status) {
      this.status = 'active';
    }
    if (!STAFF_STATUSES.includes(this.status)) {
      return next(new Error(`Invalid user status for role ${this.role}: ${this.status}`));
    }
  }
  next();
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  this.password_hash = await bcrypt.hash(this.password_hash, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

userSchema.index({ email: 1, company_id: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema, 'users');
