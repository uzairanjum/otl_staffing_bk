const authService = require('./auth.service');
const { AppError } = require('../../common/middleware/error.middleware');

const REFRESH_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MS,
  });
}

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      setRefreshCookie(res, result.refreshToken);

      res.json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      next(new AppError(error.message, 401));
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.user._id);
      res.clearCookie('refreshToken');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
      }

      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, 401));
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
      );
      res.json(result);
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async verifyResetToken(req, res, next) {
    try {
      const { token } = req.query;
      const result = await authService.verifyPasswordResetToken(token);
      if (!result.valid) {
        return res.status(400).json(result);
      }
      res.json({ valid: true });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async setPassword(req, res, next) {
    try {
      const { token, password, confirmPassword } = req.body;
      const result = await authService.setPasswordWithLogin(token, password, confirmPassword);

      setRefreshCookie(res, result.refreshToken);

      res.json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);

      setRefreshCookie(res, result.refreshToken);

      res.json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }
}

module.exports = new AuthController();
