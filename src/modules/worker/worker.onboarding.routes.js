const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');

/**
 * @swagger
 * /api/me/onboarding/status:
 *   get:
 *     summary: Get onboarding status
 *     description: Get current onboarding progress and step number
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 onboarding_step:
 *                   type: number
 *                 contract_signed:
 *                   type: boolean
 *                 completed_steps:
 *                   type: array
 *                   items:
 *                     type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/onboarding/status', workerController.getOnboardingStatus);

/**
 * @swagger
 * /api/me/onboarding/contract:
 *   put:
 *     summary: Sign employment contract
 *     description: Sign contract by typing full legal name (Step 0)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnboardingContract'
 *     responses:
 *       200:
 *         description: Contract signed successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put('/onboarding/contract', workerController.submitContract);

/**
 * @swagger
 * /api/me/onboarding/step-{step}:
 *   put:
 *     summary: Submit onboarding step
 *     description: Submit onboarding data for a specific step (1-7)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: step
 *         required: true
 *         schema:
 *           type: string
 *           enum: [1, 2, 3, 4, 5, 6, 7]
 *         description: Onboarding step number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/OnboardingStep1'
 *               - $ref: '#/components/schemas/OnboardingStep2'
 *               - $ref: '#/components/schemas/OnboardingStep3'
 *               - $ref: '#/components/schemas/OnboardingStep4'
 *               - $ref: '#/components/schemas/OnboardingStep5'
 *           example:
 *             first_name: John
 *             last_name: Doe
 *             phone: +1234567890
 *             address_line1: 123 Main Street
 *             city: New York
 *             state: NY
 *             postal_code: 10001
 *             country: USA
 *     responses:
 *       200:
 *         description: Onboarding step submitted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put('/onboarding/step-:step', workerController.updateOnboardingStep);

module.exports = router;
