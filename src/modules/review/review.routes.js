const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/reviews/shifts
 * @description Get shifts available for client review (within 3 days of completion)
 * @group Reviews - Client review management
 * @security BearerAuth
 * @returns {array} 200 - List of shifts eligible for review
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Evening Security Shift",
 *     "date": "2024-02-12",
 *     "location": "Convention Center",
 *     "status": "completed",
 *     "positions": [
 *       {
 *         "id": "...",
 *         "company_role_id": { "name": "Security" },
 *         "needed_count": 3,
 *         "filled_count": 3
 *       }
 *     ]
 *   }
 * ]
 */
router.use(authenticate);

/**
 * @route POST /api/reviews
 * @description Submit a review for a completed shift position
 * @group Reviews - Client review management
 * @security BearerAuth
 * @param {string} shift_position_id.body.required - Position ID to review
 * @param {number} rating.body.required - Rating (1-5 stars)
 * @param {string} actual_start_time.body - Actual shift start time
 * @param {string} actual_end_time.body - Actual shift end time
 * @param {string} comment.body - Optional comment
 * @returns {object} 201 - Review submitted
 * @returns {object} 400 - Review window closed or already reviewed
 * @example request
 * {
 *   "shift_position_id": "550e8400-e29b-41d4-a716-446655440001",
 *   "rating": 5,
 *   "actual_start_time": "2024-02-12T18:00:00Z",
 *   "actual_end_time": "2024-02-12T23:00:00Z",
 *   "comment": "Great work, very professional!"
 * }
 */
router.get('/shifts', requireRole('client_rep'), reviewController.getClientShiftsForReview);
router.post('/', requireRole('client_rep'), validate(schemas.review), reviewController.createReview);

/**
 * @route GET /api/reviews
 * @description Get all reviews (admin only)
 * @group Reviews - Client review management
 * @security BearerAuth
 * @param {string} worker_id.query - Filter by worker
 * @param {string} shift_id.query - Filter by shift
 * @returns {array} 200 - List of all reviews
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "worker_id": { "first_name": "John", "last_name": "Doe" },
 *     "shift_id": { "name": "Evening Shift" },
 *     "rating": 5,
 *     "comment": "Excellent worker!",
 *     "created_at": "2024-02-15T10:00:00.000Z"
 *   }
 * ]
 */
router.get('/', authenticate, requireRole('admin'), reviewController.getReviews);

/**
 * @route GET /api/reviews/:id
 * @description Get review details (admin only)
 * @group Reviews - Client review management
 * @security BearerAuth
 * @param {string} id.path.required - Review ID
 * @returns {object} 200 - Review details
 */
router.get('/:id', authenticate, requireRole('admin'), reviewController.getReview);

module.exports = router;
