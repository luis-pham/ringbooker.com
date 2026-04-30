'use client';

import type { ReactNode } from 'react';

type UserPortalTopbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  actionsClassName?: string;
};

export function UserPortalTopbar({ title, subtitle, actions, actionsClassName }: UserPortalTopbarProps) {
  return (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className={`top-actions${actionsClassName ? ` ${actionsClassName}` : ''}`}>{actions}</div> : null}
    </div>
  );
}
