const logger = require('../../config/logger');
const KNOWN_NOISY_404_PREFIXES = ['/.well-known/', '/favicon.ico'];

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMiddleware = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  const requestContext = req?.logContext || {};

  const route = req?.originalUrl || '';
  const isKnownNoisy404 =
    err.statusCode === 404 &&
    KNOWN_NOISY_404_PREFIXES.some((prefix) => route.startsWith(prefix));

  const logMethod = isKnownNoisy404 ? logger.warn.bind(logger) : logger.error.bind(logger);
  const logMessage = isKnownNoisy404 ? 'Expected probe/not-found request' : 'Request failed';

  logMethod(logMessage, {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    status: err.status,
    isOperational: Boolean(err.isOperational),
    method: req?.method,
    route,
    ip: req?.ip,
    requestId: requestContext.requestId,
    userId: requestContext.userId || req?.user?._id?.toString(),
    companyId: requestContext.companyId || req?.company_id?.toString()
  });

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
    }
  }
};

const notFoundMiddleware = (req, res, next) => {
  const err = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(err);
};

module.exports = {
  AppError,
  errorMiddleware,
  notFoundMiddleware
};
