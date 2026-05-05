/** Lightweight UA hints for admin analytics — no external services. */
export function parseDemoUserAgentHints(userAgent: string | null | undefined): {
  browser: string | null;
  deviceType: string | null;
} {
  const ua = userAgent?.trim();
  if (!ua) return { browser: null, deviceType: null };
  const mobile = /Mobile|Android|iPhone|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  let browser: string | null = null;
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  return {
    browser,
    deviceType: mobile ? 'mobile' : 'desktop',
  };
}
