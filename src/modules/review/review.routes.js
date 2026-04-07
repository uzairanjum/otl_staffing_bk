const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @swagger
 * /api/reviews/shifts:
 *   get:
 *     summary: Get shifts for review
 *     description: Get completed shifts eligible for review (within 3-day window)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shifts to review
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.use(authenticate);

router.get('/shifts', requireRole('client_rep'), reviewController.getClientShiftsForReview);

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Submit review
 *     description: Submit a review for a worker after shift completion
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Review'
 *     responses:
 *       201:
 *         description: Review submitted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 * 
 *   get:
 *     summary: List reviews
 *     description: Get all reviews (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviews
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', requireRole('client_rep'), validate(schemas.review), reviewController.createReview);
router.get('/', authenticate, requireRole('admin'), reviewController.getReviews);

/**
 * @swagger
 * /api/reviews/{id}:
 *   get:
 *     summary: Get review
 *     description: Get review details (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, requireRole('admin'), reviewController.getReview);

module.exports = router;
