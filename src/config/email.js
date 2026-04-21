const nodemailer = require('nodemailer');
const config = require('./index');
const logger = require('./logger');

const expiryLine = (data) => {
  const m = data.expiryMinutes ?? config.passwordReset?.expiryMinutes ?? 15;
  return `This link will expire in ${m} minute${m === 1 ? '' : 's'}.`;
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
};

const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
      to,
      subject,
      html,
      text
    });

    logger.info('Email sent', {
      messageId: info.messageId,
      to,
      subject
    });
    return info;
  } catch (error) {
    logger.error('Email send failed', {
      message: error.message,
      stack: error.stack,
      to,
      subject
    });
    throw error;
  }
};

const sendEmailWithTemplate = async (to, subject, template, data) => {
  const html = generateTemplate(template, data);
  const text = generateText(template, data);
  return sendEmail(to, subject, html, text);
};

const generateTemplate = (template, data) => {
  const templates = {
    invitation: `
      <h2>Welcome to OTL Staffing</h2>
      <p>Hello ${data.name},</p>
      <p>You have been invited to join OTL Staffing Platform.</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p>Set your password using the secure link below (one-time use):</p>
      <p><a href="${data.setPasswordUrl}">Set your password</a></p>
      <p>${expiryLine(data)}</p>
      <p>After setting your password you will be signed in automatically.</p>
    `,
    passwordReset: `
      <h2>Password Reset Request</h2>
      <p>Hello ${data.name},</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${data.resetUrl}">Set password</a></p>
      <p>${expiryLine(data)}</p>
    `,
    shiftAssigned: `
      <h2>Shift Assigned</h2>
      <p>Hello ${data.name},</p>
      <p>You have been assigned to a new shift:</p>
      <p><strong>Shift:</strong> ${data.shiftName}</p>
      <p><strong>Date:</strong> ${data.date}</p>
      <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
      <p><strong>Location:</strong> ${data.location}</p>
    `,
    notification: `
      <h2>${data.title}</h2>
      <p>Hello ${data.name},</p>
      <p>${data.message}</p>
    `
  };
  
  return templates[template] || '<p>Email content</p>';
};

const generateText = (template, data) => {
  const texts = {
    invitation: `Welcome to OTL Staffing. Set your password: ${data.setPasswordUrl}. ${expiryLine(data)}`,
    passwordReset: `Set your password at ${data.resetUrl}. ${expiryLine(data)}`,
    shiftAssigned: `You have been assigned to shift: ${data.shiftName} on ${data.date} from ${data.startTime} to ${data.endTime} at ${data.location}`,
    notification: `${data.title}: ${data.message}`
  };
  
  return texts[template] || 'Email notification';
};

module.exports = {
  sendEmail,
  sendEmailWithTemplate,
  generateTemplate,
  generateText
};
