/** localStorage key for `/user` portal light/dark preference (also referenced by inline bootstrap script). */
export const USER_PORTAL_THEME_STORAGE_KEY = 'rb_user_portal_theme';

export type UserPortalTheme = 'light' | 'dark';

/**
 * Runs synchronously in <head> before paint so `/user/*` first paint respects stored theme
 * (avoids white flash before React hydrates). Scoped to pathname `/user` so marketing pages stay unchanged.
 */
export function getUserPortalThemeBootstrapInlineScript(): string {
  const k = JSON.stringify(USER_PORTAL_THEME_STORAGE_KEY);
  return `(function(){try{var p=typeof location!=="undefined"?location.pathname:"";if(!p||!(p==="/user"||p.indexOf("/user/")===0))return;var t=localStorage.getItem(${k});if(t==="dark"){document.documentElement.setAttribute("data-user-theme","dark");document.documentElement.style.colorScheme="dark"}else if(t==="light"){document.documentElement.setAttribute("data-user-theme","light")}}catch(e){}})();`;
}
