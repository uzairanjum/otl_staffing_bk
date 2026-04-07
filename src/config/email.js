const nodemailer = require('nodemailer');
const config = require('./index');

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

    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Email send error: ${error.message}`);
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
      <p><strong>Temporary Password:</strong> ${data.tempPassword}</p>
      <p>Please login and change your password on first login.</p>
      <p><a href="${data.loginUrl}">Click here to login</a></p>
    `,
    passwordReset: `
      <h2>Password Reset Request</h2>
      <p>Hello ${data.name},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${data.resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
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
    invitation: `Welcome to OTL Staffing. You have been invited. Email: ${data.email}, Temp Password: ${data.tempPassword}. Login at ${data.loginUrl}`,
    passwordReset: `Reset your password at ${data.resetUrl}. This link will expire in 1 hour.`,
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
