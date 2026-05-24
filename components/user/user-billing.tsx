import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

export const userBillingStyles: string[] = [
  ...userDashboardStyles,
  String.raw`
.billing-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
.billing-status-card{
  background:#fff;border:1px solid var(--border);border-radius:22px;box-shadow:none;
  padding:22px;min-width:0;min-height:100%;display:flex;flex-direction:column;gap:6px;
}
.billing-status-card .bst-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light)}
.billing-status-card .bst-value{font-size:17px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark);line-height:1.25}
.billing-status-card .bst-meta{font-size:12px;color:var(--text-gray);line-height:1.45;margin-top:auto}
.billing-alert-strip{
  display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  padding:14px 18px;border-radius:18px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;font-size:13px;line-height:1.5;margin-bottom:16px
}
.billing-alert-strip p{margin:0;flex:1;min-width:200px}
.tag.gray{background:#f3f4f6;color:#4b5563}
.pricing-mini{
  width:100%;
  max-width:980px;
  margin:0 auto;
  display:flex;
  justify-content:center;
  align-items:stretch;
  gap:20px;
  flex-wrap:wrap;
}
.price-mini{
  display:flex;flex-direction:column;min-height:100%;padding:20px 18px;border-radius:20px;border:1px solid var(--border);background:#fff;
  flex:0 1 240px;min-width:300px;max-width:300px;width:100%;
}
.price-mini.featured{border-color:var(--purple);border-width:2px;box-shadow:none}
.price-mini .price-mini-body{flex:1}
.price-mini .price-mini-cta{margin-top:auto;padding-top:14px}
.price-mini .amt{font-size:28px;margin:8px 0 10px}
.price-mini ul{
  margin:0;
  padding:0;
  list-style:none;
  font-size:12.5px;
  display:grid;
  gap:8px;
}
.price-mini ul li{
  display:flex;
  align-items:flex-start;
  gap:10px;
  color:var(--text-gray);
  line-height:1.55;
}
.price-mini ul li::before{
  content:'';
  width:16px;
  height:16px;
  flex-shrink:0;
  margin-top:1px;
  border-radius:999px;
  border:1px solid rgba(4,120,87,.28);
  background:#ecfdf5;
  box-sizing:border-box;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 8.3 6.7 11 12 5.7' stroke='%23047857' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;
  background-position:center;
  background-size:12px 12px;
}
.billing-history-compact .panel-head{margin-bottom:10px}
.billing-history-compact .table th,.billing-history-compact .table td{padding:10px 0;font-size:13px}
.plan-includes-list{
  margin:0;
  padding:0;
  list-style:none;
  color:var(--text-gray);
  font-size:13px;
  line-height:1.65;
  display:grid;
  gap:8px;
}
.plan-includes-list li{
  display:flex;
  align-items:flex-start;
  gap:10px;
}
.plan-includes-list li::before{
  content:'';
  width:6px;
  height:6px;
  border-radius:999px;
  background:var(--purple-dark);
  flex-shrink:0;
  margin-top:6px;
}
.plan-includes-foot{font-size:12px;color:var(--text-light);margin-top:14px;line-height:1.5}
.billing-plan-includes-card{width:100%;max-width:100%;margin:0;box-sizing:border-box}
.footer-inline{margin-top:14px}

.billing-subtabs.business-subtabs{
  display:flex;
  align-items:flex-end;
  flex-wrap:nowrap;
  gap:24px;
  margin-top:0;
  margin-bottom:18px;
  padding-bottom:0;
  border-bottom:1.5px solid #e5e7eb;
  overflow-x:auto;
  scrollbar-width:none;
  -webkit-overflow-scrolling:touch;
}
.billing-subtabs.business-subtabs::-webkit-scrollbar{display:none}
.billing-subtabs.business-subtabs .business-subtab{
  flex:0 0 auto;
  appearance:none;
  background:transparent;
  border:none;
  border-radius:0;
  margin:0;
  padding:0 0 10px;
  color:#6b7280;
  white-space:nowrap;
  cursor:pointer;
  font:inherit;
  font-size:14px;
  font-weight:500;
  line-height:1.35;
  border-bottom:2px solid transparent;
  transition:color .15s ease,border-color .15s ease;
  box-shadow:none;
}
.billing-subtabs.business-subtabs .business-subtab:hover{color:var(--text-dark)}
.billing-subtabs.business-subtabs .business-subtab:focus-visible{
  outline:2px solid var(--purple-dark);
  outline-offset:3px;
}
.billing-subtabs.business-subtabs .business-subtab.active{
  color:#111;
  font-weight:500;
  border-bottom-color:#111;
}
.billing-subtabs.business-subtabs .business-subtab.active:hover{color:#111}
.billing-tab-panels{display:flex;flex-direction:column;gap:0}

.billing-trial-cta{
  display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;
  padding:18px 20px;border-radius:18px;border:1px solid var(--border);
  background:var(--surface-card);margin-bottom:16px;
}
.billing-trial-cta__copy{flex:1 1 220px;min-width:0}
.billing-trial-cta__copy h3{margin:0 0 6px;font-size:17px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark);line-height:1.25}
.billing-trial-cta__copy p{margin:0;font-size:13px;line-height:1.5;color:var(--text-gray)}
.billing-trial-cta__toggle{flex:0 0 auto;display:flex;align-items:center;gap:0}
.billing-cycle-pill{
  display:inline-flex;border-radius:999px;border:1px solid var(--border);overflow:hidden;background:var(--surface-page);
}
.billing-cycle-pill button{
  appearance:none;border:0;background:transparent;margin:0;
  padding:8px 14px;font:inherit;font-size:13px;font-weight:600;color:var(--text-gray);cursor:pointer;white-space:nowrap;
}
.billing-cycle-pill button:hover{color:var(--text-dark)}
.billing-cycle-pill button[data-active="true"]{
  background:var(--purple-ultra);color:var(--purple-dark);
}
.billing-cycle-pill button:disabled{opacity:.45;cursor:not-allowed}
.billing-trial-cta__action{flex:0 0 auto}

.billing-overview-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}
.billing-action-card{
  border:1px solid var(--border);border-radius:18px;background:var(--surface-card);
  padding:18px 18px 16px;display:flex;flex-direction:column;gap:10px;min-width:0;
}
.billing-action-card__head{min-width:0}
.billing-action-card__head h3{margin:0;font-size:16px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark);line-height:1.25}
.billing-action-card__head .sub{margin:4px 0 0;font-size:13px;line-height:1.5;color:var(--text-gray)}
.billing-action-card__actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:4px}

.billing-overview-note{
  display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:14px;
  background:var(--surface-page);border:1px solid var(--border);font-size:12.5px;line-height:1.5;color:var(--text-gray);margin-bottom:16px;
}
.billing-overview-note__icon{flex-shrink:0;font-size:14px;line-height:1.4;margin-top:1px}

.billing-plans-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.billing-plans-head p{margin:0;font-size:13px;color:var(--text-gray)}
.billing-plans-grid{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-bottom:16px;
}
.billing-plan-card{
  border:1px solid var(--border);border-radius:20px;background:var(--surface-card);
  padding:18px 16px 16px;display:flex;flex-direction:column;min-height:100%;min-width:0;
}
.billing-plan-card--current{border-color:var(--purple);border-width:2px;box-shadow:none}
.billing-plan-card__badge-row{min-height:22px;margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.billing-plan-card h4{margin:0;font-size:16px;font-weight:600;color:var(--text-dark)}
.billing-plan-card__desc{margin:6px 0 0;font-size:13px;line-height:1.45;color:var(--text-gray)}
.billing-plan-card__price{margin:12px 0 4px;font-size:26px;font-weight:650;letter-spacing:-.03em;color:var(--text-dark);line-height:1.1}
.billing-plan-card__price-note{margin:0 0 12px;font-size:12px;color:var(--text-light)}
.billing-plan-card__feats{margin:0;padding:0;list-style:none;display:grid;gap:7px;flex:1}
.billing-plan-card__feats li{
  display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.45;color:var(--text-gray);
}
.billing-plan-card__feats li[data-included="false"]{opacity:.55;text-decoration:line-through}
.billing-plan-card__feats li::before{
  content:'';width:14px;height:14px;flex-shrink:0;margin-top:2px;border-radius:999px;
  border:1px solid rgba(63,185,80,0.35);background:rgba(63,185,80,0.12);
  box-sizing:border-box;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 8.3 6.7 11 12 5.7' stroke='%23047857' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:center;background-size:11px 11px;
}
.billing-plan-card__feats li[data-included="false"]::before{
  border-color:var(--border);background:var(--surface-page);background-image:none;
}
.billing-plan-card__cta{margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
.billing-plan-card--feats-compact .billing-plan-card__feats{gap:3px}
.billing-plan-card--feats-compact .billing-plan-card__feats li{line-height:1.3}
.billing-plan-card--feats-compact .billing-plan-card__feats li::before{margin-top:1px}

html[data-user-theme="dark"] .billing-plan-card__feats li[data-included="false"]::before{background:var(--surface-card)}

@media (max-width:1200px){
  .billing-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pricing-mini{max-width:100%}
  .billing-plans-grid{grid-template-columns:1fr}
  .billing-trial-cta{flex-direction:column;align-items:stretch}
  /* Row layout uses flex-basis 220px on the inline axis; in column mode that becomes height and leaves a large blank band under the subtitle. */
  .billing-trial-cta__copy{flex:0 1 auto}
  .billing-trial-cta__action{width:100%}
  .billing-trial-cta__action .btn{width:100%;justify-content:center}
}
@media (max-width:860px){
  .billing-status-grid{grid-template-columns:1fr}
  .billing-overview-actions{grid-template-columns:1fr}
  .billing-subtabs.business-subtabs{
    gap:24px;
    flex-wrap:nowrap;
    overflow-x:auto;
    scrollbar-width:none;
    -webkit-overflow-scrolling:touch;
    border-bottom:1.5px solid var(--border);
  }
  .billing-subtabs.business-subtabs::-webkit-scrollbar{display:none}
  .billing-subtabs.business-subtabs .business-subtab{
    flex:0 0 auto;
    padding:0 0 10px;
    color:var(--text-gray);
    cursor:pointer;
    font:inherit;
    font-size:14px;
    font-weight:500;
    line-height:1.35;
  }
  .billing-subtabs.business-subtabs .business-subtab.active{
    color:var(--text-dark);
    border-bottom-color:var(--text-dark);
  }
  /* Stack plan cards full-width so horizontal inset matches .card sections above (no centered narrow column). */
  .pricing-mini{
    flex-direction:column;
    align-items:stretch;
    justify-content:flex-start;
    gap:14px;
  }
  .price-mini{
    flex:1 1 auto;
    width:100%;
    max-width:100%;
    min-width:0;
    box-sizing:border-box;
  }
  .billing-alert-strip{
    flex-direction:column;
    align-items:stretch;
    gap:12px;
  }
  .billing-alert-strip .btn,
  .billing-alert-strip a.btn,
  .billing-alert-strip button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .billing-alert-strip > div{
    max-width:100%;
  }
  .billing-alert-strip > div[style]{
    display:flex !important;
    flex-direction:column !important;
    align-items:stretch !important;
    justify-content:flex-start !important;
    width:100%;
    gap:10px;
  }
}

html[data-user-theme="dark"] .billing-status-card{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] .billing-alert-strip{
  background:rgba(187,128,9,0.12);
  border-color:rgba(187,128,9,0.35);
  color:#e3b341;
}
html[data-user-theme="dark"] .tag.gray{background:#21262d;color:var(--text-gray)}
html[data-user-theme="dark"] .price-mini{background:var(--surface-card)}
html[data-user-theme="dark"] .price-mini ul li::before{
  border-color:rgba(63,185,80,.4);
  background-color:rgba(63,185,80,.14);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 8.3 6.7 11 12 5.7' stroke='%233fb950' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
html[data-user-theme="dark"] .billing-subtabs.business-subtabs{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .billing-subtabs.business-subtabs .business-subtab{color:var(--text-gray)}
html[data-user-theme="dark"] .billing-subtabs.business-subtabs .business-subtab:hover{color:var(--text-dark)}
html[data-user-theme="dark"] .billing-subtabs.business-subtabs .business-subtab.active{
  color:var(--text-dark);
  border-bottom-color:var(--text-dark);
}
html[data-user-theme="dark"] .billing-subtabs.business-subtabs .business-subtab.active:hover{
  color:var(--text-dark);
  border-bottom-color:var(--text-dark);
}
`,
];

export const userBillingScripts: string[] = [

];

export const userBillingTemplateTitle = "Billing, plan, and growth options.";

export function UserBillingTemplate() {
  return (
    <UserLayout
      styles={userBillingStyles}
      scripts={userBillingScripts}
      scriptPrefix="user-billing"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item active" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Billing, plan, and growth options.</h1><p>Manage your RingBooker subscription and see what is included in your current plan.</p></div>
            <div className="top-actions portal-top-account">
              <a className="portal-top-account-btn" href="/user/account" aria-label="Account" title="Account">
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
            </div>
          </div>
          <section className="card billing-banner">
            <div><span className="tag purple">Professional plan</span><h3 style={{fontSize: 30, marginTop: 14, marginBottom: 8, letterSpacing: '-1px'}}>Your AI phone agent is active and renewing monthly.</h3><p>Billing for your salon subscription runs through Paddle. Customer booking deposits are not enabled in this MVP.</p></div>
            <div><div className="metric" style={{fontSize: 44}}>$149<span style={{fontSize: 15, fontWeight: 600, letterSpacing: 0}}> / month</span></div><div className="metric-sub" style={{color: 'rgba(255,255,255,.72)', marginTop: 6}}>Next renewal: May 8, 2026</div><div style={{marginTop: 16}}><span className="tag green">Paid</span></div></div>
          </section>
          <section className="pricing-mini" style={{marginTop: 18}}>
            <div className="price-mini"><h4>Starter</h4><div className="amt">$79</div><ul><li>Up to 100 captured calls per billing period</li><li>Forwarded call answering</li><li>Booking request capture</li><li>Optional missed-call text back where enabled</li><li>Basic call logs and summaries</li></ul></div>
            <div className="price-mini featured"><span className="tag purple">Current plan</span><h4 style={{marginTop: 10}}>Professional</h4><div className="amt">$149</div><ul><li>Up to 300 captured calls per billing period</li><li>Reminder and review SMS where configured</li><li>Returning caller notes</li><li>Bilingual answering where configured</li><li>Owner transfer</li></ul></div>
            <div className="price-mini"><h4>Custom</h4><div className="amt">Let’s talk</div><ul><li>Custom captured call volume</li><li>Managed routing and integrations</li><li>Multi-location support</li><li>Implementation support</li></ul></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Billing history</h3><p className="sub">Recent subscription charges.</p></div></div>
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Apr 8, 2026</td><td>Professional plan</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Mar 8, 2026</td><td>Professional plan</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                  <tr><td>Feb 8, 2026</td><td>Trial converted</td><td>$149</td><td><span className="tag green">Paid</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>What your plan covers</h3><p className="sub">Clear scope for this MVP version.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">☎</div><div><h4>Phone agent subscription</h4><p>Your salon’s monthly RingBooker billing</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">SMS</div><div><h4>Confirmation and reminder messaging</h4><p>Included in your active subscription flow</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">MVP</div><div><h4>No customer deposit flow yet</h4><p>Paddle is for salon billing, not end-customer appointment payments</p></div></div></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
