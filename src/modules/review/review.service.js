const Review = require('./Review');
const Shift = require('../shift/Shift');
const ShiftPosition = require('../shift/ShiftPosition');
const { AppError } = require('../../common/middleware/error.middleware');

class ReviewService {
  async createReview(clientRepId, companyId, data) {
    const shift = await Shift.findOne({ _id: data.shift_id, company_id: companyId }).lean();
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    const shiftEndDate = shift.end_time ? new Date(shift.end_time) : new Date(shift.date);
    
    const threeDaysLater = new Date(shiftEndDate);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    if (new Date() > threeDaysLater) {
      throw new AppError('Review window closed (3 days after shift end)', 400);
    }

    const existingReview = await Review.findOne({
      shift_position_id: data.shift_position_id,
      client_id: shift.client_id
    }).lean();

    if (existingReview) {
      throw new AppError('Review already submitted for this position', 400);
    }

    const review = await Review.create({
      client_id: shift.client_id,
      company_id: companyId,
      worker_id: data.worker_id,
      shift_id: data.shift_id,
      shift_position_id: data.shift_position_id,
      rating: data.rating,
      actual_start_time: data.actual_start_time,
      actual_end_time: data.actual_end_time,
      comment: data.comment
    });

    return review;
  }

  async getClientShiftsForReview(clientRepId, companyId) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const shifts = await Shift.find({
      company_id: companyId,
      status: 'completed',
      date: { $gte: threeDaysAgo }
    }).populate('job_id').lean();

    const shiftIds = shifts.map(s => s._id);
    const positions = await ShiftPosition.find({ shift_id: { $in: shiftIds } }).lean();
    const positionIds = positions.map(p => p._id);

    const reviewedPositionIds = await Review.distinct('shift_position_id', {
      shift_id: { $in: shiftIds }
    });

    const reviewedSet = new Set(reviewedPositionIds.map(String));
    const positionsForReview = positions.filter(
      p => !reviewedSet.has(String(p._id))
    );

    const shiftMap = new Map(shifts.map(s => [s._id.toString(), s]));
    const positionMap = new Map(positions.map(p => [p._id.toString(), p]));

    const shiftsWithPositions = shifts.filter(shift => {
      const shiftPositions = positionsForReview.filter(
        p => p.shift_id.toString() === shift._id.toString()
      );
      return shiftPositions.length > 0;
    }).map(shift => ({
      ...shift,
      positions: positionsForReview.filter(
        p => p.shift_id.toString() === shift._id.toString()
      )
    }));

    return shiftsWithPositions;
  }

  async getReviews(companyId, filters = {}) {
    const query = { company_id: companyId };
    if (filters.worker_id) {
      query.worker_id = filters.worker_id;
    }
    if (filters.shift_id) {
      query.shift_id = filters.shift_id;
    }
    return Review.find(query)
      .populate('worker_id', 'first_name last_name email')
      .populate('shift_id', 'name date location status')
      .populate('client_id', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getReview(reviewId, companyId) {
    const review = await Review.findOne({ _id: reviewId, company_id: companyId })
      .populate('worker_id', 'first_name last_name email')
      .populate('shift_id', 'name date location status')
      .populate('client_id', 'name email')
      .populate('shift_position_id')
      .lean();

    if (!review) {
      throw new AppError('Review not found', 404);
    }
    return review;
  }
}

module.exports = new ReviewService();
