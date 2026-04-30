'use client';

import type { ReactNode } from 'react';

type UserPortalTopbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function UserPortalTopbar({ title, subtitle, actions }: UserPortalTopbarProps) {
  return (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="top-actions">{actions}</div> : null}
    </div>
  );
}
