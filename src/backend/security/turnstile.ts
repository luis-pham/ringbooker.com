type TurnstileVerifyResult = {
  success: boolean;
  'error-codes'?: string[];
};

export async function verifyTurnstileToken(input: {
  token: string;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return input.token === 'dev-turnstile-bypass' ? { ok: true } : { ok: false, reason: 'turnstile_token_required' };
    }
    return { ok: false, reason: 'turnstile_not_configured' };
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', input.token);
  if (input.ip) {
    form.set('remoteip', input.ip);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  }).catch(() => null);

  if (!response) {
    return { ok: false, reason: 'turnstile_network_error' };
  }
  if (!response.ok) {
    return { ok: false, reason: `turnstile_http_${response.status}` };
  }

  const body = (await response.json().catch(() => null)) as TurnstileVerifyResult | null;
  if (!body?.success) {
    const errorCode = body?.['error-codes']?.[0];
    return { ok: false, reason: errorCode ?? 'turnstile_verification_failed' };
  }

  return { ok: true };
}
