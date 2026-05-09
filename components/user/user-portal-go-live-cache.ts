const GO_LIVE_NAV_CACHE_KEY = 'rb_portal_show_go_live';

export function readCachedGoLiveNavVisible(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GO_LIVE_NAV_CACHE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* private mode / quota */
  }
  return null;
}

export function writeCachedGoLiveNavVisible(show: boolean): void {
  try {
    sessionStorage.setItem(GO_LIVE_NAV_CACHE_KEY, show ? '1' : '0');
  } catch {
    /* ignore */
  }
}
