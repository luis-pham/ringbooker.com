/** Matches `PUBLIC_DEMO_REALTIME_BLOCKED.demo_duration_limit_reached` on the backend. */
export const DIRECT_REALTIME_DEMO_DURATION_MESSAGE =
  'This demo session has reached the 5-minute limit. You can start a new demo in a moment.';

export function userMessageForDirectDemoRealtimeJson(
  status: number,
  body: Record<string, unknown>,
): string {
  if (typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message.trim();
  }
  if (status === 403) {
    return 'Captcha verification failed. Please try again.';
  }
  if (status >= 500) {
    return "We couldn't connect to the voice demo. Please try again in a moment.";
  }
  return 'Something went wrong starting the demo. Please try again.';
}
