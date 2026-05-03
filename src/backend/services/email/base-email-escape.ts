/** Escape text for HTML text nodes (not inside raw trusted tags). */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for use inside double-quoted HTML attributes. */
export function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value);
}

export function isAbsoluteHttpOrHttpsUrl(raw: string): boolean {
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
