const admin = require('firebase-admin');
const config = require('./index');

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
    console.log('FCM sent successfully:', response);
    return response;
  } catch (error) {
    console.error('FCM send error:', error.message);
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
    console.log(`FCM sent: ${response.successCount} success, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    console.error('FCM multicast error:', error.message);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  sendFCM,
  sendMulticastFCM
};
