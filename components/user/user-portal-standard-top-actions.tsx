'use client';

/** Matches Overview — outline secondary + dark primary (not purple). */
export const USER_PORTAL_TOPBAR_ACTIONS_CLASS = 'overview-top-actions';

export function UserPortalStandardTopActions() {
  return (
    <>
      <a className="btn" href="/user/settings">
        Edit business info
      </a>
      <a className="btn user-save" href="/user/bookings">
        View bookings
      </a>
    </>
  );
}
