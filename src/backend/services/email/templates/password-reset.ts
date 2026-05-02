function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPasswordResetEmail(params: {
  resetUrl: string;
  role: 'user' | 'admin';
}): { subject: string; text: string; html: string } {
  const isAdmin = params.role === 'admin';
  const subject = isAdmin ? 'Reset your RingBooker admin password' : 'Reset your RingBooker password';
  const intro = isAdmin
    ? 'We received a request to reset the password for your RingBooker admin account.'
    : 'We received a request to reset the password for your RingBooker account.';
  const text = [
    intro,
    '',
    'Click the link below (valid for 30 minutes):',
    params.resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    '— RingBooker',
  ].join('\n');

  const href = escapeHtmlAttr(params.resetUrl);
  const displayUrl = escapeHtmlAttr(params.resetUrl);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">${subject}</h2>
      <p style="margin:0 0 16px">${intro}</p>
      <p style="margin:0 0 16px"><a href="${href}" style="color:#7c3aed;font-weight:700">Reset password</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Or paste this URL into your browser:</p>
      <p style="margin:0 0 16px;font-size:13px;word-break:break-all;color:#475569">${displayUrl}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}
