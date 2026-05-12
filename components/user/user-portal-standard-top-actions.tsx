'use client';

/** Wrapper class for the account shortcut in the portal top bar (theme/notifications alignment). */
export const USER_PORTAL_TOPBAR_ACTIONS_CLASS = 'portal-top-account';

export function UserPortalStandardTopActions() {
  return (
    <a
      className="portal-top-account-btn"
      href="/user/account"
      aria-label="Account"
      title="Account"
    >
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        />
      </svg>
    </a>
  );
}
