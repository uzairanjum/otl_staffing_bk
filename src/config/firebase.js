const admin = require('firebase-admin');
const config = require('./index');
const logger = require('./logger');

const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const serviceAccount = {
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey?.replace(/\\n/g, '\n'),
      clientEmail: config.firebase.clientEmail
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin;
};

const sendFCM = async (token, title, body, data = {}) => {
  try {
    initializeFirebase();
    
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token
    };

    const response = await admin.messaging().send(message);
    logger.info('FCM sent successfully', { messageId: response });
    return response;
  } catch (error) {
    logger.error('FCM send failed', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

const sendMulticastFCM = async (tokens, title, body, data = {}) => {
  try {
    initializeFirebase();
    
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info('FCM multicast result', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });
    return response;
  } catch (error) {
    logger.error('FCM multicast failed', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  sendFCM,
  sendMulticastFCM
};
