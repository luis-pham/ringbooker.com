/** Normalize LiveKit HTTP/HTTPS project URL to a WebSocket URL for browser clients. */
export function toLiveKitBrowserWsUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith('wss://') || t.startsWith('ws://')) return t;
  if (t.startsWith('https://')) return `wss://${t.slice('https://'.length)}`;
  if (t.startsWith('http://')) return `ws://${t.slice('http://'.length)}`;
  return t;
}
