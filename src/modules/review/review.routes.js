const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);

router.get('/shifts', requireRole('client_rep'), reviewController.getClientShiftsForReview);
router.post('/', requireRole('client_rep'), validate(schemas.review), reviewController.createReview);

router.get('/', authenticate, requireRole('admin'), reviewController.getReviews);
router.get('/:id', authenticate, requireRole('admin'), reviewController.getReview);

module.exports = router;
