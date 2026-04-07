const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate, requireFirstLoginChange } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.post('/login', validate(schemas.login), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.post('/change-password', authenticate, requireFirstLoginChange, validate(schemas.changePassword), authController.changePassword);
router.post('/forgot-password', validate(schemas.resetPassword.optionalKeys('token', 'newPassword')), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword.optionalKeys('currentPassword')), authController.resetPassword);

module.exports = router;
