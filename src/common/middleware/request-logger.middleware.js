const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const logger = require('../../config/logger');

const safeDecodeAuth = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice(7);
  try {
    // Decode only for logging context to avoid full signature verification on every request.
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      return null;
    }
    return {
      userId: decoded.user_id || null,
      companyId: decoded.company_id || null,
      role: decoded.role || null
    };
  } catch (error) {
    return null;
  }
};

const attachRequestContext = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  req.logContext = {
    requestId,
    method: req.method,
    route: req.originalUrl,
    ip: req.ip
  };

  const decodedAuth = safeDecodeAuth(req.headers.authorization);
  if (decodedAuth) {
    req.logContext.userId = decodedAuth.userId;
    req.logContext.companyId = decodedAuth.companyId;
    req.logContext.role = decodedAuth.role;
  }

  next();
};

morgan.token('request-id', (req) => req.requestId || '-');
morgan.token('user-id', (req) => req.logContext?.userId || req.user?._id?.toString() || '-');
morgan.token('company-id', (req) => req.logContext?.companyId || req.company_id?.toString() || '-');

const morganFormat =
  ':method :url :status :res[content-length] - :response-time ms reqId=:request-id userId=:user-id companyId=:company-id';

const requestLogger = morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.http(message.trim());
    }
  }
});

module.exports = {
  attachRequestContext,
  requestLogger
};
