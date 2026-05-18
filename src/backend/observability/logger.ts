import pino from 'pino';

export type LogContext = {
  requestId?: string;
  shopId?: string;
  callId?: string;
  /** Correlation id across Telnyx Call Control + OpenAI SIP (when present). */
  rbCallId?: string;
  provider?: string;
  telnyxEventId?: string;
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.set-cookie',
      'headers.authorization',
      'headers.cookie',
      'headers.set-cookie',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'privateKey',
      'private_key',
      'clientSecret',
      'client_secret',
      'ephemeralToken',
      'ephemeral_token',
      'authorization',
      'cookie',
      'signature',
      'paddle-signature',
    ],
    remove: true,
  },
});

export function withLogContext(context: LogContext) {
  return logger.child(context);
}
