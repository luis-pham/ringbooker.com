import pino from 'pino';

export type LogContext = {
  requestId?: string;
  shopId?: string;
  callId?: string;
  provider?: string;
  telnyxEventId?: string;
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'apiKey',
      'accessToken',
      'refreshToken',
      'privateKey',
      'signature',
    ],
    remove: true,
  },
});

export function withLogContext(context: LogContext) {
  return logger.child(context);
}

