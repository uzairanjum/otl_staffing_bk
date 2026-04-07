const mongoose = require('mongoose');

const roleCategorySchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true,
    match: /^#[0-9A-F]{6}$/i
  }
}, {
  timestamps: true
});

roleCategorySchema.index({ company_id: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RoleCategory', roleCategorySchema);
