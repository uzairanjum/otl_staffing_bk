const User = require('../../common/models/User');
const { sendEmail } = require('../../config/email');
const { AppError } = require('../../common/middleware/error.middleware');
const logger = require('../../config/logger');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class AdminService {
  async sendEmailToWorker(companyId, email, subject, body) {
    const normalized = email.toLowerCase().trim();

    const worker = await User.findOne({
      email: normalized,
      company_id: companyId,
      role: 'worker',
    });

    if (!worker) {
      throw new AppError('Worker not found', 404);
    }

    const html = `<div style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(body)}</div>`;

    try {
      await sendEmail(normalized, subject.trim(), html, body);
    } catch (err) {
      logger.error('Admin worker email failed', {
        companyId: companyId?.toString?.() || companyId,
        email: normalized,
        message: err.message
      });
      throw new AppError('Failed to send email', 502);
    }

    return { message: 'Email sent' };
  }
}

module.exports = new AdminService();
