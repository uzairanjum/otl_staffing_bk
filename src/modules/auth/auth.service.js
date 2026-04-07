const User = require('../../common/models/User');
const Worker = require('../../modules/worker/Worker');
const jwtUtil = require('../../common/utils/jwt');
const { sendEmailWithTemplate } = require('../../config/email');
const { v4: uuidv4 } = require('uuid');

class AuthService {
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

    const accessToken = jwtUtil.generateAccessToken(
      user._id,
      user.company_id,
      user.role
    );
    const refreshToken = jwtUtil.generateRefreshToken(user._id);

    user.refresh_token = refreshToken;
    await user.save();

    let worker = null;
    let clientRep = null;

    if (user.worker_id) {
      worker = await Worker.findById(user.worker_id);
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        first_login: user.first_login,
        company_id: user.company_id,
        worker: worker ? {
          id: worker._id,
          first_name: worker.first_name,
          last_name: worker.last_name,
          status: worker.status,
          onboarding_step: worker.onboarding_step
        } : null
      }
    };
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

  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return { message: 'If email exists, reset link will be sent' };
    }

    const resetToken = jwtUtil.generatePasswordResetToken(user._id);
    
    await sendEmailWithTemplate(email, 'Password Reset', 'passwordReset', {
      name: user.worker_id ? 
        `${user.worker_id.first_name} ${user.worker_id.last_name}` : 'User',
      resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    });

    return { message: 'If email exists, reset link will be sent' };
  }

  async resetPassword(token, newPassword) {
    const decoded = jwtUtil.verifyPasswordResetToken(token);
    
    const user = await User.findById(decoded.user_id);
    if (!user) {
      throw new Error('Invalid token');
    }

    user.password_hash = newPassword;
    await user.save();

    return { message: 'Password reset successfully' };
  }
}

module.exports = new AuthService();
