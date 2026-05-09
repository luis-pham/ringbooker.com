const ACCOUNT_NAV_PANEL_KEY = 'rb_account_nav_panel_v1';

export type CachedAccountNavPanel = {
  email?: string;
  shopName?: string;
  userName?: string;
  plan?: string;
  subscriptionStatus?: string | null;
};

export function readCachedAccountNavPanel(): CachedAccountNavPanel | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACCOUNT_NAV_PANEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAccountNavPanel;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedAccountNavPanel(data: CachedAccountNavPanel): void {
  try {
    sessionStorage.setItem(ACCOUNT_NAV_PANEL_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
