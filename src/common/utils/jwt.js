const jwt = require('jsonwebtoken');
const config = require('../../config');

const generateAccessToken = (userId, companyId, role) => {
  return jwt.sign(
    { user_id: userId, company_id: companyId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { user_id: userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

const generatePasswordResetToken = (userId) => {
  return jwt.sign(
    { user_id: userId, type: 'password_reset' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
};

const verifyPasswordResetToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken
};
