const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate, requireFirstLoginChange } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route POST /api/auth/login
 * @description Authenticate user and get access token
 * @group Auth - Authentication endpoints
 * @param {string} email.body.required - User email address
 * @param {string} password.body.required - User password
 * @returns {object} 200 - Login successful with access token
 * @returns {object} 401 - Invalid credentials
 * @example request
 * {
 *   "email": "admin@otlstaffing.com",
 *   "password": "Admin123!"
 * }
 * @example response - 200
 * {
 *   "accessToken": "eyJhbGc...",
 *   "user": {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "email": "admin@otlstaffing.com",
 *     "role": "admin",
 *     "first_login": true,
 *     "company_id": "550e8400-e29b-41d4-a716-446655440001"
 *   }
 * }
 */
router.post('/login', validate(schemas.login), authController.login);

/**
 * @route POST /api/auth/logout
 * @description Logout user and clear refresh token
 * @group Auth - Authentication endpoints
 * @security BearerAuth
 * @returns {object} 200 - Logout successful
 * @example response - 200
 * {
 *   "message": "Logged out successfully"
 * }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route POST /api/auth/refresh
 * @description Refresh access token using refresh token
 * @group Auth - Authentication endpoints
 * @returns {object} 200 - New access token
 * @returns {object} 401 - Invalid or expired refresh token
 * @example response - 200
 * {
 *   "accessToken": "eyJhbGc..."
 * }
 */
router.post('/refresh', authController.refresh);

/**
 * @route POST /api/auth/change-password
 * @description Change user password (required on first login)
 * @group Auth - Authentication endpoints
 * @security BearerAuth
 * @param {string} currentPassword.body.required - Current password
 * @param {string} newPassword.body.required - New password (min 8 characters)
 * @returns {object} 200 - Password changed successfully
 * @returns {object} 400 - Current password is incorrect
 * @example request
 * {
 *   "currentPassword": "OldPassword123!",
 *   "newPassword": "NewPassword456!"
 * }
 * @example response - 200
 * {
 *   "message": "Password changed successfully"
 * }
 */
router.post('/change-password', authenticate, requireFirstLoginChange, validate(schemas.changePassword), authController.changePassword);

/**
 * @route POST /api/auth/forgot-password
 * @description Request password reset email
 * @group Auth - Authentication endpoints
 * @param {string} email.body.required - User email address
 * @returns {object} 200 - Reset link sent (if email exists)
 * @example request
 * {
 *   "email": "user@example.com"
 * }
 * @example response - 200
 * {
 *   "message": "If email exists, reset link will be sent"
 * }
 */
router.post('/forgot-password', validate(schemas.resetPassword.optionalKeys('token', 'newPassword')), authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @description Reset password using reset token
 * @group Auth - Authentication endpoints
 * @param {string} token.body.required - Password reset token
 * @param {string} newPassword.body.required - New password (min 8 characters)
 * @returns {object} 200 - Password reset successfully
 * @returns {object} 400 - Invalid or expired token
 * @example request
 * {
 *   "token": "eyJhbGc...",
 *   "newPassword": "NewPassword456!"
 * }
 * @example response - 200
 * {
 *   "message": "Password reset successfully"
 * }
 */
router.post('/reset-password', validate(schemas.resetPassword.optionalKeys('currentPassword')), authController.resetPassword);

module.exports = router;
