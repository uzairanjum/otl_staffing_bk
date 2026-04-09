const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  worker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker'
  },
  client_rep_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientRepresentative'
  },
  phone: {
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
    enum: ['active', 'inactive'],
    default: 'active'
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

userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  this.password_hash = await bcrypt.hash(this.password_hash, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

userSchema.index({ email: 1, company_id: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
