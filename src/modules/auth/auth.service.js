const User = require('../../common/models/User');
const jwtUtil = require('../../common/utils/jwt');
const { sendEmailWithTemplate } = require('../../config/email');
const config = require('../../config');
const passwordResetTokenService = require('../../common/services/passwordResetToken.service');
const logger = require('../../config/logger');

class AuthService {
  async buildLoginResult(userLoaded) {
    const accessToken = jwtUtil.generateAccessToken(
      userLoaded._id,
      userLoaded.company_id,
      userLoaded.role
    );
    const refreshToken = jwtUtil.generateRefreshToken(userLoaded._id);

    userLoaded.refresh_token = refreshToken;
    await userLoaded.save();

    let workerPayload = null;
    if (userLoaded.role === 'worker') {
      workerPayload = {
        id: userLoaded._id,
        first_name: userLoaded.first_name,
        last_name: userLoaded.last_name,
        status: userLoaded.status,
        onboarding_step: userLoaded.onboarding_step,
      };
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: userLoaded._id,
        email: userLoaded.email,
        role: userLoaded.role,
        first_login: userLoaded.first_login,
        company_id: userLoaded.company_id,
        worker: workerPayload,
      },
    };
  }

  async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    const userLoaded = await User.findById(user._id);
    return this.buildLoginResult(userLoaded);
  }

  async logout(userId) {
    await User.findByIdAndUpdate(userId, { refresh_token: null });
  }

  async refresh(refreshToken) {
    const decoded = jwtUtil.verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.user_id);
    if (!user || user.refresh_token !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

    const newAccessToken = jwtUtil.generateAccessToken(
      user._id,
      user.company_id,
      user.role
    );

    return { accessToken: newAccessToken };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    user.password_hash = newPassword;
    user.first_login = false;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  logPasswordResetFailure(reason, detail = '') {
    logger.warn('Password reset flow failed attempt', { reason, detail });
  }

  async forgotPassword(email) {
    const normalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalized });

    if (!user) {
      return { message: 'Reset link sent' };
    }

    const rawToken = await passwordResetTokenService.createTokenForUser(user._id);
    const baseUrl = config.passwordReset.frontendUrl.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/auth/set-password?token=${rawToken}`;
    const displayName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.name || 'User';
    const expiryMinutes = config.passwordReset.expiryMinutes;

    await sendEmailWithTemplate(email, 'Password Reset', 'passwordReset', {
      name: displayName,
      resetUrl,
      expiryMinutes,
    });

    return { message: 'Reset link sent' };
  }

  /**
   * Returns { valid: true } or { valid: false, message } (no throw — for HTTP layer).
   */
  async verifyPasswordResetToken(rawToken) {
    const doc = await passwordResetTokenService.findValidTokenDocument(rawToken);
    if (!doc) {
      this.logPasswordResetFailure('invalid_or_expired_or_used', 'verify');
      return { valid: false, message: 'Link expired or invalid' };
    }
    return { valid: true };
  }

  async setPasswordWithLogin(rawToken, password, confirmPassword) {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const doc = await passwordResetTokenService.findValidTokenDocument(rawToken);
    if (!doc) {
      this.logPasswordResetFailure('invalid_or_expired_or_used', 'set-password');
      throw new Error('Link expired or invalid');
    }

    const user = await User.findById(doc.userId);
    if (!user) {
      this.logPasswordResetFailure('user_missing', String(doc.userId));
      throw new Error('Link expired or invalid');
    }

    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    user.password_hash = password;
    user.first_login = false;
    await user.save();

    await passwordResetTokenService.markTokenUsed(doc);

    const userLoaded = await User.findById(user._id);
    return this.buildLoginResult(userLoaded);
  }

  /**
   * Legacy endpoint: same as set-password but only newPassword in body.
   */
  async resetPassword(token, newPassword) {
    return this.setPasswordWithLogin(token, newPassword, newPassword);
  }
}

module.exports = new AuthService();
