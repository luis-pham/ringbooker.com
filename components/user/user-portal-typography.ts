/** Shared link + typography tokens for the user portal (visual only). */
export const userPortalTypographyStyles = String.raw`
:root{
  --color-text-info:var(--purple-dark);
  --color-text-secondary:var(--text-gray);
  --color-text-primary:var(--text-dark);
}

/* ─── Link types ─── */
a.user-link,
button.user-link,
.user-link,
.rb-account-link,
a.rb-account-link,
button.rb-account-link,
a.link:not(.btn):not(.nav-item):not(.carrier-link),
.portal-notif-refresh,
.overview-status-action,
.gl-guide-link,
.gl-gate-item a,
.overview-rail-health-detail a,
.overview-rail-step-title a{
  color:var(--color-text-info);
  font-weight:500;
  font-size:14px;
  text-decoration:none;
  cursor:pointer;
}
button.user-link,
button.rb-account-link,
.portal-notif-refresh,
.gl-inline-link{
  font:inherit;
  border:none;
  background:none;
  padding:0;
}
a.user-link:hover,
button.user-link:hover,
.user-link:hover,
.rb-account-link:hover,
a.rb-account-link:hover,
button.rb-account-link:hover,
a.link:not(.btn):not(.nav-item):not(.carrier-link):hover,
.portal-notif-refresh:hover,
.overview-status-action:hover,
.gl-guide-link:hover,
.gl-inline-link:hover,
.gl-gate-item a:hover,
.overview-rail-health-detail a:hover,
.overview-rail-step-title a:hover{
  text-decoration:underline;
}

a.user-link--subtle,
button.user-link--subtle,
.user-link--subtle,
.subtle-link,
button.subtle-link,
a.subtle-link:not(.user-link),
.gl-later-link,
.onb-help-link,
.rb-account-btn-ghost,
button.rb-account-btn-ghost{
  color:var(--color-text-secondary);
  font-weight:400;
  font-size:13px;
  text-decoration:none;
  cursor:pointer;
}
button.user-link--subtle,
button.subtle-link,
.subtle-link,
.gl-later-link,
.onb-help-link,
.rb-account-btn-ghost,
button.rb-account-btn-ghost{
  font:inherit;
  border:none;
  background:none;
  padding:0;
}
a.user-link--subtle:hover,
button.user-link--subtle:hover,
.user-link--subtle:hover,
.subtle-link:hover,
button.subtle-link:hover,
a.subtle-link:not(.user-link):hover,
.gl-later-link:hover,
.onb-help-link:hover,
.rb-account-btn-ghost:hover:not(:disabled),
button.rb-account-btn-ghost:hover:not(:disabled){
  text-decoration:underline;
  color:var(--color-text-primary);
}

.sidebar-logout{
  font-size:14px;
  font-weight:500;
}

/* ─── Page typography ─── */
.page-title h1{
  font-size:22px;
  font-weight:500;
  letter-spacing:-.02em;
  line-height:1.25;
  color:var(--color-text-primary);
}
.page-title p{
  font-size:14px;
  color:var(--color-text-secondary);
}
.card h3,
.panel-head h3,
.rb-account-card-head h2,
.service-catalog-heading h3{
  font-size:18px;
  font-weight:500;
  letter-spacing:-.02em;
  line-height:1.3;
  color:var(--color-text-primary);
}
.card p.sub,
.panel-head .sub,
.panel-head p.sub{
  font-size:14px;
  color:var(--color-text-secondary);
  line-height:1.55;
}
.field input,
.field textarea,
.field select,
.small-field input,
.small-field select,
.rb-account-row dd{
  font-size:15px;
  font-weight:400;
}
.table td,
.list-item,
.item-main h4,
.bookings-client-name,
.overview-rail-call-main{
  font-size:14px;
  font-weight:400;
}
.tag{
  font-size:12px;
}
.btn{
  font-size:14px;
  font-weight:500;
}

/* ─── Section labels (sentence case) ─── */
.user-section-label,
.nav-label,
.rb-account-panel-title,
.rb-account-row dt,
.rb-account-subsection-title,
.overview-rail-recent-title,
.quick-access-card-title,
.stat-label,
.sh-active-label,
.sh-active-thead,
.sh-hours-presets-label,
.billing-status-card .bst-label,
.field label,
.field .handoff-section-label,
.handoff-section-label,
.small-field label,
.onb-field label,
.onb-section-title,
.onb-step3-section-label,
.cf-label,
.gl-section-label,
.calls-table th,
.bookings-table th,
.table th,
.meta-tile strong,
.brand-tagline{
  font-size:12px;
  font-weight:500;
  color:var(--color-text-secondary);
  letter-spacing:normal;
  text-transform:none;
}

/* ─── Sidebar nav ─── */
.nav-item{
  font-size:14px;
  font-weight:500;
}
.nav-item.active{
  color:var(--color-text-info);
  font-weight:500;
}

html[data-user-theme="dark"] a.user-link,
html[data-user-theme="dark"] button.user-link,
html[data-user-theme="dark"] .user-link,
html[data-user-theme="dark"] .rb-account-link,
html[data-user-theme="dark"] a.rb-account-link,
html[data-user-theme="dark"] button.rb-account-link,
html[data-user-theme="dark"] a.link:not(.btn):not(.nav-item),
html[data-user-theme="dark"] .portal-notif-refresh,
html[data-user-theme="dark"] .overview-status-action,
html[data-user-theme="dark"] .gl-guide-link,
html[data-user-theme="dark"] .gl-inline-link{
  color:var(--color-text-info);
}
html[data-user-theme="dark"] .subtle-link,
html[data-user-theme="dark"] button.subtle-link,
html[data-user-theme="dark"] a.subtle-link:not(.user-link),
html[data-user-theme="dark"] .user-link--subtle,
html[data-user-theme="dark"] button.user-link--subtle{
  color:var(--color-text-secondary);
}
html[data-user-theme="dark"] .subtle-link:hover,
html[data-user-theme="dark"] button.subtle-link:hover,
html[data-user-theme="dark"] a.subtle-link:not(.user-link):hover,
html[data-user-theme="dark"] .user-link--subtle:hover,
html[data-user-theme="dark"] button.user-link--subtle:hover{
  color:var(--color-text-primary);
}
`;
