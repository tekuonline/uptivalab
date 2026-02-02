import pino, { Logger } from 'pino';

// Sensitive field patterns to redact from logs
const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credentials',
  'key',
  'pass',
  'auth',
];

// Redact sensitive data from objects
const redactSensitive = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern));
    
    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

// Create logger instance
export const logger: Logger = pino.default({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]'
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      // Redact sensitive headers
      headers: redactSensitive(req.headers),
    }),
    res: pino.stdSerializers.res,
  }
});

// Convenience methods with context
export const log = {
  info: (msg: string, context?: any) => logger.info(redactSensitive(context || {}), msg),
  warn: (msg: string, context?: any) => logger.warn(redactSensitive(context || {}), msg),
  error: (msg: string, context?: any) => logger.error(redactSensitive(context || {}), msg),
  debug: (msg: string, context?: any) => logger.debug(redactSensitive(context || {}), msg),
};
