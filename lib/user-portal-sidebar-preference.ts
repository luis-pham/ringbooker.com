export const USER_SIDEBAR_COLLAPSED_KEY = 'user-sidebar-collapsed';

export function readUserSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(USER_SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyUserSidebarCollapsed(collapsed: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('user-sidebar-collapsed', collapsed);
}

export function persistUserSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(USER_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
