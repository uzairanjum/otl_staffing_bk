const os = require('os');
const tls = require('tls');
const winston = require('winston');
const Transport = require('winston-transport');
require('winston-papertrail').Papertrail;
const config = require('./index');

const LOG_LEVELS = {
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  colors: { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'white' }
};

winston.addColors(LOG_LEVELS.colors);

const baseMeta = {
  service: config.logging.program,
  env: config.env,
  host: os.hostname()
};
const REDACT_KEYS = ['password', 'token', 'authorization', 'secret', 'apiKey', 'apiSecret'];

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const redactValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      const shouldRedact = REDACT_KEYS.some((sensitiveKey) =>
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      );
      return [key, shouldRedact ? '[REDACTED]' : redactValue(nested)];
    })
  );
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(redactValue(meta)) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

const papertrailFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format((info) => redactValue(info))(),
  winston.format.json()
);

class SolarWindsSyslogTransport extends Transport {
  constructor(options = {}) {
    super(options);
    this.host = options.host;
    this.port = options.port;
    this.appName = options.program || 'node-app';
    this.token = options.token;
    this.structuredDataId = options.structuredDataId || '41058';
    this.hostname = os.hostname();
    this.socket = null;
    this.connecting = false;
    this.queue = [];
    this.maxQueueSize = options.maxQueueSize || 500;
  }

  connect() {
    if (this.socket || this.connecting) return;
    this.connecting = true;

    this.socket = tls.connect(
      {
        host: this.host,
        port: this.port,
        servername: this.host
      },
      () => {
        this.connecting = false;
        this.flushQueue();
      }
    );

    this.socket.on('error', (err) => {
      this.connecting = false;
      this.socket = null;
      this.emit('error', err);
    });

    this.socket.on('close', () => {
      this.socket = null;
    });
  }

  flushQueue() {
    if (!this.socket || this.socket.destroyed || this.connecting || this.queue.length === 0) {
      return;
    }

    const buffered = this.queue.splice(0, this.queue.length);
    for (const line of buffered) {
      this.socket.write(line);
    }
  }

  levelToPri(level) {
    // facility=user(1)=8 + severity
    const severityMap = { error: 3, warn: 4, info: 6, http: 6, debug: 7 };
    return 8 + (severityMap[level] ?? 6);
  }

  escapeStructuredValue(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\]/g, '\\]');
  }

  formatMessage(info) {
    const pri = this.levelToPri(info.level);
    const timestamp = new Date().toISOString();
    const msgid = '-';
    const procid = process.pid;
    const sdToken = this.escapeStructuredValue(this.token);
    const sd = `[${sdToken}@${this.structuredDataId}]`;

    const payload = redactValue({
      level: info.level,
      message: info.message,
      ...Object.fromEntries(
        Object.entries(info).filter(([key]) => !['level', 'message'].includes(key))
      )
    });

    return `<${pri}>1 ${timestamp} ${this.hostname} ${this.appName} ${procid} ${msgid} ${sd} ${JSON.stringify(payload)}`;
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    this.connect();

    const line = `${this.formatMessage(info)}\n`;
    if (!this.socket || this.socket.destroyed || this.connecting) {
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift();
      }
      this.queue.push(line);
      if (callback) callback();
      return;
    }

    try {
      this.socket.write(line);
    } catch (err) {
      this.emit('error', err);
    }

    if (callback) callback();
  }
}

const transports = [
  new winston.transports.Console({
    level: config.logging.level,
    format: consoleFormat,
    handleExceptions: true
  })
];

if (
  config.logging.papertrail.host &&
  config.logging.papertrail.port &&
  config.logging.papertrail.token
) {
  const solarWindsTransport = new SolarWindsSyslogTransport({
    host: config.logging.papertrail.host,
    port: config.logging.papertrail.port,
    program: config.logging.program,
    level: config.logging.level,
    token: config.logging.papertrail.token,
    structuredDataId: config.logging.papertrail.structuredDataId,
    handleExceptions: true
  });

  solarWindsTransport.on('error', (err) => {
    process.stderr.write(`[SolarWinds] transport error: ${err.message}\n`);
  });

  transports.push(solarWindsTransport);
} else if (config.logging.papertrail.host && config.logging.papertrail.port) {
  // Backward-compatible fallback for classic Papertrail host:port setups.
  const papertrailTransport = new winston.transports.Papertrail({
    host: config.logging.papertrail.host,
    port: config.logging.papertrail.port,
    program: config.logging.program,
    level: config.logging.level,
    format: papertrailFormat,
    handleExceptions: true,
    colorize: false
  });

  papertrailTransport.on('error', (err) => {
    process.stderr.write(`[Papertrail] transport error: ${err.message}\n`);
  });

  transports.push(papertrailTransport);
}

const logger = winston.createLogger({
  levels: LOG_LEVELS.levels,
  level: config.logging.level,
  defaultMeta: baseMeta,
  transports,
  exitOnError: false
});

module.exports = logger;
