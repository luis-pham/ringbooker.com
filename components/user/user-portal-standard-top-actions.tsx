'use client';

/** Matches Overview — outline secondary + dark primary (not purple). */
export const USER_PORTAL_TOPBAR_ACTIONS_CLASS = 'overview-top-actions';

export function UserPortalStandardTopActions() {
  return (
    <>
      <a className="btn" href="/user/settings">
        Settings
      </a>
      <a className="btn" href="/user/knowledge">
        Business Knowledge
      </a>
      <a className="btn user-save" href="/user/bookings">
        View bookings
      </a>
    </>
  );
}
