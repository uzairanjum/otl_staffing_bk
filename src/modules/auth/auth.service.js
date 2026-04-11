const User = require('../../common/models/User');
const jwtUtil = require('../../common/utils/jwt');
const { sendEmailWithTemplate } = require('../../config/email');

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

    const userLoaded = await User.findById(user._id);
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

    const displayName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.name || 'User';
    await sendEmailWithTemplate(email, 'Password Reset', 'passwordReset', {
      name: displayName,
      resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
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
