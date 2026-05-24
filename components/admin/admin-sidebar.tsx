'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';

import { AdminSidebarShellControls } from '@/components/admin/admin-shell-preferences';
import {
  IconBilling,
  IconBlog,
  IconDemo,
  IconFolder,
  IconHealth,
  IconLeafCalls,
  IconLeads,
  IconMegaphone,
  IconOverview,
  IconPhone,
  IconShop,
  IconSliders,
  IconUsers,
} from '@/components/admin/admin-sidebar-icons';

type NavItem = { href: string; label: string };

type NavGroup = { id: string; label: string; items: NavItem[] };

type FlatNavItem = { href: string; label: string; icon: ComponentType };

const FLAT_NAV: FlatNavItem[] = [
  { href: '/admin', label: 'Overview', icon: IconOverview },
  { href: '/admin/shops', label: 'Business Acc', icon: IconShop },
];

const GROUPS: NavGroup[] = [
  {
    id: 'calls',
    label: 'Calls',
    items: [
      { href: '/admin/calls', label: 'Calls & incidents' },
      { href: '/admin/demos', label: 'Demo calls' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { href: '/admin/leads', label: 'Leads' },
      { href: '/admin/blog', label: 'Blog' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/admin/billing', label: 'Billing' },
      { href: '/admin/users', label: 'Users & roles' },
      { href: '/admin/system-health', label: 'System health' },
    ],
  },
];

const GROUP_ICON: Record<string, ComponentType> = {
  calls: IconPhone,
  marketing: IconMegaphone,
  system: IconSliders,
};

const ITEM_ICON: Record<string, ComponentType> = {
  '/admin/calls': IconLeafCalls,
  '/admin/demos': IconDemo,
  '/admin/leads': IconLeads,
  '/admin/blog': IconBlog,
  '/admin/billing': IconBilling,
  '/admin/users': IconUsers,
  '/admin/system-health': IconHealth,
};

function isActiveHref(href: string, pathname: string): boolean {
  const p = pathname || '';
  if (href === '/admin') return p === '/admin' || p === '/admin/';
  if (href === '/admin/shops') return p.startsWith('/admin/shops');
  if (href === '/admin/blog') return p.startsWith('/admin/blog');
  return p === href || p.startsWith(`${href}/`);
}

function defaultOpenForPath(pathname: string): Record<string, boolean> {
  const p = pathname || '';
  const next: Record<string, boolean> = {};
  if (p.startsWith('/admin/calls') || p.startsWith('/admin/demos')) next.calls = true;
  else if (p.startsWith('/admin/leads') || p.startsWith('/admin/blog')) next.marketing = true;
  else if (
    p.startsWith('/admin/billing') ||
    p.startsWith('/admin/users') ||
    p.startsWith('/admin/system-health')
  ) {
    next.system = true;
  }
  return next;
}

function GroupGlyph({ groupId }: { groupId: string }) {
  const Cmp = GROUP_ICON[groupId] ?? IconFolder;
  return <Cmp />;
}

function ItemGlyph({ href }: { href: string }) {
  const Cmp = ITEM_ICON[href] ?? IconFolder;
  return <Cmp />;
}

export function AdminSidebar() {
  const pathname = usePathname() ?? '';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => defaultOpenForPath(pathname));

  useEffect(() => {
    setOpenGroups((prev) => {
      const d = defaultOpenForPath(pathname);
      const next = { ...prev };
      for (const key of Object.keys(d)) {
        if (d[key]) next[key] = true;
      }
      return next;
    });
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-ripple r3" />
          <div className="brand-ripple r2" />
          <div className="brand-core">
            <svg viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </div>
        </div>
        <span>RingBooker Admin</span>
      </div>
      <div className="nav-label">Backoffice</div>
      <div className="nav-groups">
        <div className="nav-flat">
          {FLAT_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={isActiveHref(item.href, pathname) ? 'nav-item active' : 'nav-item'}
              >
                <div className="nav-icon" aria-hidden>
                  <Icon />
                </div>
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
        {GROUPS.map((group) => {
          const open = Boolean(openGroups[group.id]);
          const hasActive = group.items.some((item) => isActiveHref(item.href, pathname));
          return (
            <div key={group.id} className={`nav-group${open ? ' open' : ''}${hasActive ? ' has-active' : ''}`}>
              <button
                type="button"
                className="nav-group-toggle"
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
              >
                <div className="nav-icon nav-icon--group" aria-hidden>
                  <GroupGlyph groupId={group.id} />
                </div>
                <span className="nav-group-title">{group.label}</span>
                <span className="nav-group-chevron" aria-hidden>
                  <svg viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
              </button>
              {open ? (
                <div className="nav-sub">
                  {group.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className={isActiveHref(item.href, pathname) ? 'nav-sub-item active' : 'nav-sub-item'}
                    >
                      <div className="nav-icon nav-icon--sub" aria-hidden>
                        <ItemGlyph href={item.href} />
                      </div>
                      <span className="nav-sub-label">{item.label}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <AdminSidebarShellControls />
    </aside>
  );
}
