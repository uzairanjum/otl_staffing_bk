const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');
const adminController = require('./admin.controller');

/**
 * @swagger
 * /api/admin/send-email:
 *   post:
 *     summary: Send email to a worker (same company)
 *     description: Admin only. JWT Bearer required. Recipient must be a worker in the admin's company.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminSendEmail'
 *     responses:
 *       200:
 *         description: Email sent
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Worker not found for this company
 *       502:
 *         description: SMTP or mail delivery failed
 */
router.post(
  '/send-email',
  authenticate,
  requireRole('admin'),
  validate(schemas.adminSendEmail),
  adminController.sendEmail.bind(adminController)
);

module.exports = router;
