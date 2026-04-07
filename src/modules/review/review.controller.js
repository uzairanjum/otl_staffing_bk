const reviewService = require('./review.service');
const { AppError } = require('../../common/middleware/error.middleware');

class ReviewController {
  async createReview(req, res, next) {
    try {
      const review = await reviewService.createReview(
        req.user.client_rep_id,
        req.company_id,
        req.body
      );
      res.status(201).json(review);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getClientShiftsForReview(req, res, next) {
    try {
      const shifts = await reviewService.getClientShiftsForReview(
        req.user.client_rep_id,
        req.company_id
      );
      res.json(shifts);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getReviews(req, res, next) {
    try {
      const reviews = await reviewService.getReviews(req.company_id, req.query);
      res.json(reviews);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getReview(req, res, next) {
    try {
      const review = await reviewService.getReview(req.params.id, req.company_id);
      res.json(review);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new ReviewController();
