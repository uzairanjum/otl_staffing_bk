const adminService = require('./admin.service');
const { AppError } = require('../../common/middleware/error.middleware');

class AdminController {
  async sendEmail(req, res, next) {
    try {
      const { email, subject, body } = req.body;
      const result = await adminService.sendEmailToWorker(
        req.company_id,
        email,
        subject,
        body
      );
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      next(new AppError(error.message || 'Failed to send email', 500));
    }
  }
}

module.exports = new AdminController();
