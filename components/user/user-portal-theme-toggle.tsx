'use client';

import { useUserTheme } from '@/components/user/user-theme-context';

export function UserPortalThemeToggle() {
  const { theme, toggleTheme } = useUserTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className="user-theme-toggle"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
          <circle cx={12} cy={12} r={4} fill="none" stroke="currentColor" strokeWidth={2} />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
