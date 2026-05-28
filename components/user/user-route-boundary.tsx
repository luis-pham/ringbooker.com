'use client';

import { Fragment, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type UserRouteBoundaryProps = {
  children: ReactNode;
};

export function UserRouteBoundary({ children }: UserRouteBoundaryProps) {
  const pathname = usePathname() ?? '/user';
  return <Fragment key={pathname}>{children}</Fragment>;
}
