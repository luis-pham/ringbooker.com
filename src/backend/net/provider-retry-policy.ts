export type RetryProfile = {
  retries: number;
  initialDelayMs: number;
  maxDelayMs: number;
};

export const RETRY_POLICIES = {
  telnyxSms: {
    retries: 2,
    initialDelayMs: 250,
    maxDelayMs: 1500,
  },
  telnyxCall: {
    retries: 2,
    initialDelayMs: 300,
    maxDelayMs: 2000,
  },
  googleCalendar: {
    retries: 2,
    initialDelayMs: 200,
    maxDelayMs: 1200,
  },
  paddleApi: {
    retries: 2,
    initialDelayMs: 300,
    maxDelayMs: 2000,
  },
} satisfies Record<string, RetryProfile>;

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
