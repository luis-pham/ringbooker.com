/** Domain part of an email for structured logs (no full address). */
export function emailRecipientDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 0 || at === trimmed.length - 1) return 'unknown';
  const domain = trimmed.slice(at + 1);
  return domain.length > 0 ? domain : 'unknown';
}

/** Domain from a From header like `Name <user@domain.com>` or plain address. */
export function emailAddressDomain(fromAddress: string): string {
  const trimmed = fromAddress.trim();
  const angle = /<([^>]+)>/.exec(trimmed);
  const email = (angle?.[1] ?? trimmed).trim();
  return emailRecipientDomain(email);
}
