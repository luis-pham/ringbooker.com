import { UserLayout } from '@/components/user/user-layout';
import { userPortalTypographyStyles } from '@/components/user/user-portal-typography';

const styles: string[] = [
  String.raw`
:root{
  --purple:#630ed4;
  --purple-dark:#630ed4;
  --purple-light:#EDE9FE;
  --purple-ultra:#F5F3FF;
  --surface-page:#f8f9fa;
  --surface-card:#ffffff;
  --sidebar-outline:#ccc3d8;
  --text-dark:#191c1d;
  --text-gray:#6B7280;
  --text-light:#9CA3AF;
  --bg:#fff;
  --bg-gray:#F9FAFB;
  --border:#e5e7eb;
  --green:#10B981;
  --orange:#F59E0B;
  --red:#EF4444;
  --red-deep:#ba1a1a;
  --success-text:#047857;
  --warning-text:#92400e;
  --danger-text:#b91c1c;
  --blue:#3B82F6;
  --secondary-accent:#4648d4;
  --sidebar-width:256px;
  --r-pill:999px;
  --r-xl:28px;
  --r-lg:24px;
  --r-md:16px;
  --r-sm:12px;
  --shadow:none;
  --shadow-soft:none;
  --card-shadow-material:none;
}
*{box-sizing:border-box}
html{scrollbar-gutter:stable;background:var(--surface-page)}
body{
  margin:0;
  min-height:100vh;
  font-family:inherit;
  color:var(--text-dark);
  background:var(--surface-page);
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
a{text-decoration:none;color:inherit}
button,input,select,textarea{font:inherit}
.app-shell{display:grid;grid-template-columns:var(--sidebar-width) minmax(0,1fr);min-height:100vh}
.sidebar{
  position:sticky;top:0;height:100vh;overflow:hidden;
  display:flex;flex-direction:column;
  background:var(--surface-card);
  border-right:1px solid var(--border);
  padding:24px 16px 22px;
}
.sidebar-inner{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
}
.sidebar-body{
  flex:1;
  min-height:0;
  overflow-x:hidden;
  overflow-y:auto;
  display:flex;
  flex-direction:column;
}
.sidebar-body::-webkit-scrollbar{width:5px}
.sidebar-body::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:999px}
.sidebar-footer{
  flex-shrink:0;
  margin-top:auto;
  padding-top:16px;
  border-top:1px solid var(--border);
}
.sidebar-logout{
  display:flex;align-items:center;gap:12px;width:100%;
  padding:10px 12px;border-radius:10px;border:none;background:transparent;
  font:inherit;font-weight:500;font-size:13px;color:#4a4455;
  cursor:pointer;text-align:left;
  transition:background .15s ease,color .15s ease;
}
.sidebar-logout:hover{background:#fef2f2;color:var(--red-deep)}
.sidebar-logout svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;flex-shrink:0}
.sidebar-footer-controls{margin-bottom:10px}
.sidebar-collapse-btn{
  display:flex;align-items:center;gap:10px;width:100%;
  padding:9px 10px;border-radius:10px;border:1px solid var(--border);
  background:var(--bg-gray);color:#4a4455;font:inherit;font-size:13px;font-weight:500;
  text-align:left;cursor:pointer;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.sidebar-collapse-btn:hover{background:#f3f4f6;border-color:#d1d5db;color:var(--text-dark)}
.sidebar-collapse-btn svg{width:17px;height:17px;flex-shrink:0}
.brand{
  display:flex;align-items:center;gap:12px;
  margin-bottom:22px;
}
.brand-mobile-actions{display:none;margin-left:auto;align-items:center;gap:8px}
.brand-text{display:flex;flex-direction:column;gap:2px;min-width:0;justify-content:center}
.brand-title{
  font-weight:600;font-size:18px;letter-spacing:-.02em;
  color:#111827;line-height:1.2;
}
.brand-tagline{
  margin:0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-light);line-height:1.3;
}
.brand-mark{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.brand-ripple{position:absolute;border-radius:50%;background:var(--purple)}
.brand-ripple.r3{width:38px;height:38px;opacity:.1}
.brand-ripple.r2{width:30px;height:30px;opacity:.18}
.brand-core{
  position:relative;z-index:1;
  width:24px;height:24px;border-radius:50%;
  background:var(--purple);
  display:flex;align-items:center;justify-content:center;
  box-shadow:none;
}
.brand-core svg{width:13px;height:13px;fill:#fff}
.nav-section{margin-top:6px}
.nav-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-light);font-weight:600;padding:0 10px 10px}
.nav-list{display:flex;flex-direction:column;gap:6px}
.nav-item{
  display:flex;align-items:center;gap:12px;
  padding:10px 12px;border-radius:10px;color:#4a4455;
  font-weight:500;font-size:13px;transition:background .15s ease,color .15s ease;
}
.nav-item:hover{background:#e7e8e9;color:var(--text-dark)}
.nav-item.active{
  background:transparent;
  color:var(--purple-dark);
  font-weight:600;
  letter-spacing:-.01em;
}
.nav-item.active:hover{background:#f3f4f6;color:var(--purple-dark)}
.nav-icon{
  width:34px;height:34px;border-radius:10px;background:transparent;border:none;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.nav-icon svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none}
.nav-item.active .nav-icon svg{stroke-width:2.35}
.nav-attention-dot{
  width:7px;height:7px;border-radius:999px;background:#ef4444;
  display:inline-flex;flex-shrink:0;margin-left:-4px;box-shadow:0 0 0 3px rgba(239,68,68,.14);
}
.nav-go-live-placeholder{pointer-events:none;opacity:.72}
.nav-go-live-placeholder-track{display:block;width:100%;box-sizing:border-box;padding:0 2px}
.nav-go-live-placeholder-bar{
  display:block;height:13px;border-radius:7px;width:100%;
  background:linear-gradient(90deg,#eef0f2 0%,#dfe3e8 45%,#eef0f2 90%);
  background-size:200% 100%;
  animation:rb-go-live-nav-shimmer 1.15s ease-in-out infinite;
}
html[data-user-theme="dark"] .nav-go-live-placeholder-bar{
  background:linear-gradient(90deg,#21262d 0%,#30363d 45%,#21262d 90%);
  background-size:200% 100%;
}
.sidebar-spacer{flex:1}

.main{padding:0;padding-bottom:34px;min-width:0;background:var(--surface-page)}
.page-content{
  width:100%;
  margin:0 auto;
  padding:24px 24px;
  box-sizing:border-box;
}
@media (min-width:1281px){
  .page-content.page-overview,
  .page-content.page-calls,
  .page-content.page-bookings,
  .page-content.page-billing,
  .page-content.page-more,
  .page-content.page-knowledge{max-width:1100px;}
  .page-content.page-business-profile,
  .page-content.page-hours,
  .page-content.page-staff,
  .page-content.page-policies,
  .page-content.page-ai-behavior,
  .page-content.page-services,
  .page-content.page-account{max-width:960px;}
  .page-content.page-go-live,
  .page-content.page-integrations{max-width:960px;}
}
@media (max-width:1280px) and (min-width:1025px){
  .app-shell .main > .page-content{padding:24px 20px;}
  .page-content.page-overview,
  .page-content.page-calls,
  .page-content.page-bookings,
  .page-content.page-billing,
  .page-content.page-more,
  .page-content.page-knowledge{max-width:1100px;}
  .page-content.page-business-profile,
  .page-content.page-hours,
  .page-content.page-staff,
  .page-content.page-policies,
  .page-content.page-ai-behavior,
  .page-content.page-services,
  .page-content.page-account{max-width:960px;}
  .page-content.page-go-live,
  .page-content.page-integrations{max-width:960px;}
}
@media (max-width:1024px){
  .app-shell .main > .page-content{
    max-width:100% !important;
    padding:20px 16px;
  }
}
@media (max-width:768px){
  .app-shell .main > .page-content{
    padding:16px;
  }
}
/* Portal: match /user/knowledge spacing from topbar to page body. */
.user-app-shell .main > .page-content{
  padding-top:48px;
}
.user-app-shell .main > .page-content.page-overview,
.user-app-shell .main > .page-content.page-bookings,
.user-app-shell .main > .page-content.page-go-live,
.user-app-shell .main > .page-content.page-more{
  padding-top:48px;
}
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:18px;
  flex-wrap:wrap;
  position:relative;z-index:1;
  min-height:64px;
  background:var(--surface-page);
  border-bottom:1px solid var(--border);
  box-shadow:none;
}
.app-shell .main > .topbar{
  width:100%;
  box-sizing:border-box;
  margin:0;
  padding:12px 24px;
}
@media (max-width:1280px){
  .app-shell .main > .topbar{
    padding:12px 20px;
  }
}
@media (max-width:1024px){
  .app-shell .main > .topbar{
    padding:12px 16px;
  }
}
@media (max-width:768px){
  .app-shell .main > .topbar{
    padding:12px 16px;
  }
}
.page-title h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-.02em;line-height:1.25;color:var(--purple-dark)}
.page-title p{margin:6px 0 0;color:var(--text-gray);font-size:15px;line-height:1.55;max-width:760px}
.top-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.top-actions.portal-top-account{gap:0}
.portal-top-account-btn{
  display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;padding:0;border-radius:8px;
  border:1px solid var(--border);background:var(--surface-card);
  color:var(--text-gray);cursor:pointer;text-decoration:none;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
  box-sizing:border-box;
}
.portal-top-account-btn:hover{
  background:#f9fafb;border-color:#d1d5db;color:var(--text-dark);
}
.portal-top-account-btn:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.portal-top-account-dd{position:relative;display:inline-flex;vertical-align:middle}
.portal-top-account-menu{
  position:absolute;right:0;top:calc(100% + 10px);min-width:168px;
  opacity:0;pointer-events:none;transition:opacity .15s ease,transform .15s ease;
  transform:translateY(-4px);z-index:90;
}
.portal-top-account-menu.open{opacity:1;pointer-events:all;transform:translateY(0)}
.portal-top-account-menu-inner{
  background:var(--surface-card);border:1px solid var(--border);border-radius:12px;
  box-shadow:0 14px 42px rgba(15,23,42,.14);overflow:hidden;padding:6px;
}
.portal-top-account-menu-item{
  display:flex;align-items:center;width:100%;padding:10px 12px;border-radius:8px;
  font:inherit;font-size:13px;font-weight:500;color:var(--text-dark);text-decoration:none;
  background:none;border:none;cursor:pointer;text-align:left;line-height:1.3;
  transition:background .14s ease,color .14s ease;
}
.portal-top-account-menu-item:hover{
  background:var(--bg-gray);color:var(--text-dark);
}
.portal-top-account-menu-item--logout{color:var(--text-gray)}
.portal-top-account-menu-item--logout:hover{background:#fef2f2;color:var(--red-deep)}
.topbar-trailing{
  display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  margin-left:auto;
}
.topbar-user-chip{
  display:flex;align-items:center;gap:12px;
  margin-left:0;padding-left:20px;border-left:1px solid var(--border);
}
.topbar-user-chip-meta{text-align:right;display:none}
.topbar-user-chip-name{margin:0;font-size:14px;font-weight:600;color:var(--text-dark)}
.topbar-user-chip-sub{margin:2px 0 0;font-size:12px;color:var(--text-gray)}
.topbar-user-chip-avatar{
  width:40px;height:40px;border-radius:999px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:600;
  background:linear-gradient(135deg,#f5f3ff,#ede9fe);
  color:#5b21b6;border:1px solid #ddd6fe;
}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:9px;
  height:36px;padding:8px 16px;border-radius:8px;font-weight:500;font-size:13px;
  border:1px solid var(--border);background:#fff;color:var(--text-dark);
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.btn:hover{transform:none;box-shadow:none;background:#f9fafb;border-color:#d1d5db}
.btn.purple{background:var(--purple-dark);color:#fff;border-color:var(--purple-dark)}
.btn.purple:hover{background:#5609c4;border-color:#5609c4;color:#fff}
.btn.dark{background:#111827;color:#fff;border-color:#111827}
.btn.user-save{
  background:#0d1117;color:#fff;border-color:#0d1117;font-weight:500;
}
.btn.user-save:hover:not(:disabled){
  background:#161b22;border-color:#161b22;color:#fff;
}
.btn.user-save:disabled{opacity:.55;cursor:not-allowed}
.user-theme-toggle{
  display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;padding:0;border-radius:8px;
  border:1px solid var(--border);background:var(--surface-card);
  color:var(--text-gray);cursor:pointer;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.user-theme-toggle:hover{
  background:#f9fafb;border-color:#d1d5db;color:var(--text-dark);
}
.user-theme-toggle:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}

.portal-notif{position:relative;display:inline-flex;vertical-align:middle}
.portal-notif-trigger{
  position:relative;
  display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;padding:0;border-radius:8px;
  border:1px solid var(--border);background:var(--surface-card);
  color:var(--text-gray);cursor:pointer;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.portal-notif-trigger:hover{
  background:#f9fafb;border-color:#d1d5db;color:var(--text-dark);
}
.portal-notif-trigger:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.portal-notif-badge{
  position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;
  border-radius:999px;background:#b91c1c;color:#fff;font-size:10px;font-weight:600;
  display:flex;align-items:center;justify-content:center;line-height:1;
  border:2px solid var(--surface-page);
}
.portal-notif-panel{
  position:absolute;right:0;top:calc(100% + 10px);width:min(380px,calc(100vw - 36px));
  background:var(--surface-card);border:1px solid var(--border);border-radius:12px;
  box-shadow:0 14px 42px rgba(15,23,42,.14);z-index:80;overflow:hidden;
}
.portal-notif-panel-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;border-bottom:1px solid var(--border);
  font-size:13px;color:var(--text-dark);
}
.portal-notif-refresh{
  font:inherit;font-size:12px;border:none;background:none;padding:0;cursor:pointer;
}
.portal-notif-refresh:hover{text-decoration:underline}
.portal-notif-list{max-height:min(420px,70vh);overflow-y:auto;padding:8px}
.portal-notif-empty{margin:14px 12px;font-size:13px;color:var(--text-gray);line-height:1.55}
.portal-notif-item{
  display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:10px;margin-bottom:4px;
  text-decoration:none;color:inherit;border:1px solid transparent;
  transition:background .18s ease,border-color .18s ease;
}
.portal-notif-item:last-child{margin-bottom:0}
.portal-notif-item-text{display:flex;flex-direction:column;gap:4px;min-width:0}
.portal-notif-title{font-size:13px;font-weight:500;color:var(--text-dark);line-height:1.35}
.portal-notif-body{font-size:12px;color:var(--text-gray);line-height:1.5}
.portal-notif-item--critical{background:rgba(220,38,38,.06)}
.portal-notif-item--critical:hover{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.14)}
.portal-notif-item--warn{background:rgba(245,158,11,.07)}
.portal-notif-item--warn:hover{background:rgba(245,158,11,.11);border-color:rgba(245,158,11,.18)}
.portal-notif-item--info{background:rgba(100,116,139,.07)}
.portal-notif-item--info:hover{background:rgba(100,116,139,.11);border-color:rgba(100,116,139,.16)}
.email-verification-banner{
  position:sticky;top:0;z-index:40;
  display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;
  padding:10px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;
  color:#92400e;font-size:13px;font-weight:500;
}
.email-verification-banner button{
  border:1px solid #f59e0b;background:#fff;color:#92400e;border-radius:999px;
  padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;
}
.email-verification-banner button:disabled{opacity:.6;cursor:not-allowed}
.email-verification-banner small{font-size:12px;color:#b45309}

.grid{display:grid;gap:18px}
.grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.kpi-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:18px}
.call-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:18px}
.call-grid-phase-simple{grid-template-columns:1fr}
.overview-page{margin-bottom:8px}
.overview-grid{display:grid;grid-template-columns:1fr minmax(280px,320px);gap:16px;align-items:start}.overview-grid--full{grid-template-columns:1fr}
.overview-banner{display:flex;align-items:center;gap:16px;padding:12px 20px;border-radius:12px;margin-bottom:16px;background:#fff;border:1px solid #e5e7eb}
.overview-banner.post-live{background:#f0fdf4;border-color:#bbf7d0}
.banner-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.banner-dot.amber{background:#f59e0b}
.overview-banner.pre-live .banner-dot.amber{display:none}
.banner-dot.green{background:#16a34a;box-shadow:0 0 0 3px #dcfce7}
.banner-dot.pulse{animation:overviewBannerPulse 2s infinite}
@keyframes overviewBannerPulse{
  0%,100%{box-shadow:0 0 0 3px #dcfce7}
  50%{box-shadow:0 0 0 6px #dcfce7}
}
@keyframes overviewBannerPulseDark{
  0%,100%{box-shadow:0 0 0 3px rgba(46,160,67,.38)}
  50%{box-shadow:0 0 0 6px rgba(46,160,67,.2)}
}
.banner-text{flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.banner-title{font-size:13px;font-weight:500;color:#111}
.banner-sub{font-size:12px;color:#6b7280}
.banner-action-needed{display:inline-flex;align-items:center;gap:8px;border-radius:999px;background:#FFF3E0;color:#B45309;font-size:12px;font-weight:700;line-height:1;padding:7px 12px;white-space:nowrap;flex-shrink:0}
.banner-action-needed-dot{width:8px;height:8px;border-radius:999px;background:#F59E0B;flex-shrink:0}
.overview-banner.post-live .banner-title{color:#15803d}
.overview-banner.post-live .banner-sub{color:#16a34a;opacity:.8}
.banner-actions{display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap}
.btn-ghost-sm{padding:7px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;color:#374151;background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn-primary-sm{padding:7px 16px;background:#111;border:none;border-radius:8px;font-size:13px;font-weight:500;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.overview-banner-footnote{font-size:12px;color:#b45309;margin:-8px 0 14px;padding:0 4px}
.overview-banner-test-status{font-size:12px;color:var(--text-gray);margin:0}
.overview-bk-nudge{
  display:flex;flex-direction:row;align-items:center;gap:12px;flex-wrap:wrap;
  margin-bottom:16px;padding:12px 16px;border-radius:var(--r-sm);
  background:var(--surface-card);border:1px solid var(--border);
}
.overview-bk-nudge__icon{font-size:16px;line-height:1;flex-shrink:0}
.overview-bk-nudge__text{flex:1;margin:0;font-size:13px;color:var(--text-dark);line-height:1.45;min-width:140px}
.overview-bk-nudge__cta{flex-shrink:0}
.overview-bk-nudge-dismiss{
  flex-shrink:0;width:32px;height:32px;border-radius:8px;border:1px solid var(--border);
  background:transparent;color:var(--text-gray);cursor:pointer;font-size:14px;line-height:1;
  display:inline-flex;align-items:center;justify-content:center;padding:0;font-family:inherit;
}
.overview-bk-nudge-dismiss:hover{color:var(--text-dark);background:var(--bg-gray)}
@media (max-width:359px){
  .overview-bk-nudge{align-items:stretch}
  .overview-bk-nudge__cta{width:100%;justify-content:center;text-align:center}
}
.quick-access-card-title{
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-light);margin:0 0 12px;
}
.overview-quick-access-item:hover .sc-name{color:var(--text-dark)}
.overview-quick-access-card .sc-icon{
  width:34px;height:34px;border-radius:10px;background:transparent;
  color:#4a4455;
}
.overview-quick-access-card .sc-icon svg{
  width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;
}
.overview-quick-access-item:hover .sc-icon{color:var(--text-dark)}
.overview-system-status-card .card-sub{margin-bottom:4px}
.overview-status-list{margin-top:4px}
.overview-status-row{
  display:flex;align-items:center;gap:12px;padding:12px 0;
  border-bottom:1px solid #f0f1f3;
}
.overview-status-row--last{border-bottom:none}
.overview-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.overview-status-dot--ok{background:#10b981}
.overview-status-dot--warn{background:#f59e0b}
.overview-status-dot--neutral{background:#d1d5db}
.overview-status-main{flex:1;min-width:0}
.overview-status-label{font-size:13px;font-weight:500;color:var(--text-dark)}
.overview-status-desc{font-size:12px;color:var(--text-gray);margin-top:2px;line-height:1.45}
.overview-status-action{
  flex-shrink:0;font-size:14px;
  white-space:nowrap;padding:6px 0 6px 8px;
}
.overview-status-action:hover{text-decoration:underline}
.overview-status-zero-calls{
  margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--text-gray);
  padding:12px 14px;border-radius:8px;background:var(--bg-gray);
}
.overview-status-recent{margin-top:16px;padding-top:16px;border-top:1px solid #f0f1f3}
.stat-label{
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-light);margin:-2px 0 8px;
}
.grid.grid-4.overview-stats-grid{gap:10px;margin-top:20px}
.usage-captured-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.usage-captured-title{margin:0;font-size:15px;font-weight:500;letter-spacing:-.01em;color:var(--text-dark)}
.usage-captured-summary{font-size:13px;font-weight:500;color:var(--text-dark);text-align:right;max-width:52%;line-height:1.35}
.usage-captured-footer{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap}
.usage-captured-footer-main{font-size:12px;color:var(--text-gray);line-height:1.5;min-width:0}
.usage-captured-reset{font-size:12px;color:var(--text-light);flex-shrink:0}
.usage-captured-warn{margin-top:10px;margin-bottom:0}
.usage-captured-warn--over{color:#b91c1c}
.usage-captured-warn--near{color:#92400e}
.checklist-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
.overview-go-live-checklist{width:100%}
.checklist-card .card-title{font-size:14px;font-weight:600;color:#111;margin-bottom:3px}
.checklist-card .card-sub{font-size:12px;color:#6b7280;margin-bottom:16px}
.overview-go-live-checklist .card-title{margin-bottom:8px}
.overview-go-live-checklist .card-sub{margin-bottom:12px}
.cl-progress{display:grid;gap:7px;margin-bottom:12px}
.cl-progress-label{font-size:12px;font-weight:600;line-height:1;color:#047857}
.cl-progress-track{height:6px;border-radius:999px;background:#d1fae5;overflow:hidden}
.cl-progress-fill{height:100%;border-radius:999px;background:#10B981;transition:width .2s ease}
.cl-item{display:flex;align-items:center;gap:12px;min-height:52px;padding:10px;border-bottom:1px solid #f9fafb;border-radius:8px;cursor:pointer;transition:background .15s ease,opacity .1s;text-decoration:none;color:inherit}
.cl-item:last-child{border:none}
.cl-item:hover{background:#fafafa}
.cl-item--active{background:#F5F2FF}
.cl-item--active:hover{background:#F5F2FF}
.cl-item--locked{cursor:default;opacity:.58;pointer-events:none}
.cl-circle{width:28px;height:28px;border-radius:50%;border:1.5px solid #D0CBF0;background:#fff;color:#8b86a3;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:12px;font-weight:700;line-height:1}
.cl-circle.active{border-color:#5C3AC7;background:#5C3AC7;color:#fff;box-shadow:0 0 0 4px #EDE9F8}
.cl-circle.done{border-color:#10B981;background:#10B981;color:#fff}
.cl-circle.locked{border-color:#D0CBF0;background:#fff;color:#8b86a3;box-shadow:none}
.cl-body{flex:1;min-width:0}
.cl-name-row{display:flex;align-items:center;gap:8px;justify-content:space-between;min-width:0}
.cl-name{font-size:13px;font-weight:500;color:#111;margin-bottom:1px;min-width:0}
.cl-item--active .cl-name{color:#3D2494;font-weight:600}
.cl-item--locked .cl-name,.cl-item--locked .cl-desc{color:#9ca3af}
.cl-desc{font-size:12px;color:#6b7280}
.cl-arrow{color:#d1d5db;font-size:16px;flex-shrink:0;line-height:1.2}
.cl-action-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#FFF3E0;color:#B45309;font-size:11px;font-weight:600;line-height:1;padding:5px 8px;white-space:nowrap;flex-shrink:0}
.cl-action-badge-dot{width:6px;height:6px;border-radius:999px;background:#F59E0B;animation:clAmberPulse 1.4s ease-in-out infinite;box-shadow:0 0 0 0 rgba(245,158,11,.42)}
@keyframes clAmberPulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(245,158,11,.42)}70%{transform:scale(.82);box-shadow:0 0 0 5px rgba(245,158,11,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(245,158,11,0)}}
.shortcuts-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
.shortcuts-card .card-title{font-size:14px;font-weight:600;color:#111;margin-bottom:12px}
.sc-item{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #f3f4f6;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:border-color .15s;text-decoration:none;color:inherit}
.sc-item:last-child{margin-bottom:0}
.sc-item:hover{border-color:#e5e7eb}
.sc-icon{width:32px;height:32px;border-radius:8px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7c3aed}
.sc-body{flex:1;min-width:0}
.sc-name{font-size:13px;font-weight:500;color:#111}
.sc-desc{font-size:11px;color:#6b7280;margin-top:1px}
.sc-go{color:#d1d5db;font-size:16px;flex-shrink:0}
.quick-actions-card .card-title{font-size:14px;font-weight:600;color:#111;margin-bottom:12px}
.overview-rail-mount .overview-rail-card.card{border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px}
.overview-rail-mount .overview-rail-health{border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-top:0}
.overview-rail-mount .overview-rail-health-row{padding:5px 0;border:none}
.overview-rail-mount .overview-rail-health-row:not(:last-child){border-bottom:1px solid #f9fafb}
.overview-rail-mount .overview-rail-dot{width:6px;height:6px}
.overview-rail-mount .overview-rail-health-label{font-size:12px;color:#374151}
.overview-rail-mount .overview-rail-health-detail{font-size:12px;color:#9ca3af;margin-top:0}
.overview-rail-mount .overview-rail-health-detail a{font-size:11px;text-decoration:underline;text-underline-offset:2px}
.overview-rail-mount .overview-rail-recent{margin-top:0;padding-top:0;border-top:none;padding-bottom:14px;border-bottom:1px solid #f3f4f6}
.overview-rail-mount .overview-rail-recent-title{font-size:11px;margin-bottom:8px}
.overview-rail-mount .overview-rail-call{padding:6px 0;border:none;border-radius:0;border-bottom:1px solid #f9fafb;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.overview-rail-mount .overview-rail-call:last-child{border-bottom:none}
.overview-rail-mount .overview-rail-call-main{font-size:12px}
.overview-rail-mount .overview-rail-call-sub{font-size:11px;width:100%}
.overview-rail-mount .overview-rail-tip{background:#f5f3ff;border-radius:8px;padding:10px 12px;font-size:12px;color:#6b21a8;line-height:1.5;margin-top:0}
@media (max-width:768px){
  .overview-grid{grid-template-columns:1fr}
  .overview-go-live-checklist{max-width:none}
  .cl-item{min-height:60px;padding:11px 10px}
  .cl-circle{width:26px;height:26px;font-size:11px}
  .cl-progress-label{font-size:11px}
  .cl-name-row{align-items:flex-start;flex-direction:column;gap:5px}
}
.overview-rail-card.soft h3{margin:0 0 6px}
.overview-rail-checklist{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.overview-rail-step{display:flex;gap:12px;align-items:flex-start}
.overview-rail-step-mark{
  flex-shrink:0;width:22px;height:22px;border-radius:999px;border:2px solid var(--border);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1;
}
.overview-rail-step.done .overview-rail-step-mark{background:#ecfdf5;border-color:#bbf7d0;color:#047857}
.overview-rail-step.done .overview-rail-step-mark::after{content:'✓'}
.overview-rail-step-title{font-size:14px;font-weight:500;letter-spacing:-.02em;line-height:1.35;margin:0}
.overview-rail-step-title a{color:inherit;text-decoration:none}
.overview-rail-step-title a:hover{text-decoration:underline;color:var(--user-link-color)}
.overview-rail-step-meta{font-size:12px;color:var(--text-gray);margin:4px 0 0;line-height:1.45}
.overview-rail-health{display:flex;flex-direction:column;margin-top:4px}
.overview-rail-health-row{
  display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;padding:12px 0;border-bottom:1px solid #f0f1f3;
}
.overview-rail-health-row:last-child{border-bottom:none}
.overview-rail-health-main{min-width:0}
.overview-rail-health-label{font-size:13px;font-weight:500;color:var(--text-dark);display:flex;align-items:center;gap:8px}
.overview-rail-health-detail{font-size:12px;color:var(--text-gray);margin-top:4px;line-height:1.45}
.overview-rail-health-detail a{text-decoration:none}
.overview-rail-health-detail a:hover{text-decoration:underline}
.overview-rail-dot{width:8px;height:8px;border-radius:999px;flex-shrink:0}
.overview-rail-dot.ok{background:#10b981}
.overview-rail-dot.warn{background:#f59e0b}
.overview-rail-dot.neutral{background:#d1d5db}
.overview-rail-recent{margin-top:18px;padding-top:16px;border-top:1px solid #f0f1f3}
.overview-rail-recent-title{margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-light)}
.overview-rail-calls{display:flex;flex-direction:column;gap:10px}
.overview-rail-call{
  padding:12px 14px;border:1px solid #f0f1f3;border-radius:16px;background:#fff;
  display:block;color:inherit;text-decoration:none;transition:border-color .15s ease,background .15s ease;
}
.overview-rail-call:hover{border-color:#c4b5fd;background:#fafafa}
.overview-rail-call-main{font-size:13px;font-weight:500;color:var(--text-dark);line-height:1.35}
.overview-rail-call-sub{font-size:12px;color:var(--text-gray);margin-top:4px;line-height:1.45}
.overview-rail-tip{margin-top:14px;font-size:12px;color:var(--text-gray);line-height:1.55}
.forward-guide-card{border-left:4px solid #c4b5fd}
.forward-guide-intro{margin:0 0 14px;font-size:13px;color:var(--text-gray);line-height:1.65}
.forward-num{
  display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;
  background:#f5f3ff;border:1px solid #e9d5ff;font-weight:600;font-size:15px;letter-spacing:.02em;color:#4c1d95;margin-bottom:14px;
}
.carrier-links{display:flex;flex-direction:column;gap:10px}
a.carrier-link{
  display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;border-radius:16px;border:1px solid #f0f1f3;
  background:#fff;text-decoration:none;color:inherit;transition:.15s ease;
}
a.carrier-link:hover{border-color:#c4b5fd;box-shadow:none;background:#fafafa}
.carrier-link-row{display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px}
a.carrier-link strong{font-size:14px;letter-spacing:-.02em;color:#111827}
.carrier-hint{font-size:12px;color:var(--text-gray);line-height:1.45}
.carrier-hint-single{display:block;margin-top:2px}
.carrier-callcenter-tip{margin-top:12px;padding:12px 14px;border-radius:16px;border:1px dashed #e5e7eb;background:#fafafa}
.carrier-tip-line{margin:0;font-size:12.5px;line-height:1.55;color:var(--text-gray)}
.ext-ico{
  width:12px;height:12px;
  display:inline-flex;align-items:center;justify-content:center;
  color:var(--text-light);flex-shrink:0;
}
.ext-ico svg{display:block;width:12px;height:12px}
.forward-guide-disclaimer{margin:14px 0 0;font-size:11px;color:var(--text-light);line-height:1.5}

.card,.stat-card{
  background:var(--surface-card);border:1px solid var(--border);
  border-radius:12px;box-shadow:none;padding:22px;min-width:0;
}
.section-stack{display:grid;gap:18px}
.card.soft{background:linear-gradient(180deg,#fff 0%,#fcfbff 100%)}
.card h3{margin:0 0 6px;font-size:15px;font-weight:500;letter-spacing:-.01em}
.card p.sub{margin:0 0 18px;color:var(--text-gray);font-size:13px;line-height:1.6}
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
.go-live-setup-status{border-radius:22px}
.go-live-setup-status--next{border-color:#bfdbfe;background:#eff6ff}
.go-live-setup-status--next .go-live-setup-status__lead{color:#1e3a8a}
.go-live-setup-status--next .go-live-setup-status__badge--next{color:#1e40af;border-color:#bfdbfe;background:#fff}
.go-live-setup-status--live{border-color:#bbf7d0;background:#f0fdf4}
.go-live-setup-status--live .go-live-setup-status__lead{color:#166534}
.go-live-setup-status--live .go-live-setup-status__badge--live{color:#166534;border-color:#bbf7d0;background:#fff}
.go-live-setup-status--blocked{border-color:#fecaca;background:#fef2f2}
.go-live-setup-status--blocked .go-live-setup-status__lead{color:#991b1b}
.go-live-setup-status--blocked .go-live-setup-status__badge--blocked{color:#991b1b;border-color:#fecaca;background:#fff}
.go-live-setup-status--ready{border-color:#c4b5fd;background:#faf5ff}
.go-live-setup-status--ready .go-live-setup-status__lead{color:#5b21b6}
.go-live-setup-status--ready .go-live-setup-status__badge--ready{color:#5b21b6;border-color:#c4b5fd;background:#fff}
.stat-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.stat-icon{
  width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:transparent;
}
.stat-icon svg{width:22px;height:22px;stroke:var(--purple-dark);stroke-width:2;fill:none}
.stat-value{font-size:32px;font-weight:600;letter-spacing:-1px}
.stat-meta{font-size:13px;color:var(--text-gray);line-height:1.55}
.tag{display:inline-flex;align-items:center;gap:6px;padding:6px;border-radius:999px;font-size:11px;font-weight:500}
.tag.green{background:#ecfdf5;color:#047857}
.tag.purple{background:#f5f3ff;color:var(--purple-dark)}
.tag.blue{background:#eff6ff;color:#1d4ed8}
.tag.gray{background:#f3f4f6;color:#4b5563}
.tag.orange{background:#fff7ed;color:#c2410c}
.tag.red{background:#fef2f2;color:#b91c1c}
.dashboard-banner-go-live{
  border-color:#bfdbfe !important;
  background:#eff6ff !important;
}
.card.enterprise-managed-card{
  background:#eff6ff;
  border-color:#bfdbfe;
}
.usage-progress-track{
  height:6px;border-radius:20px;margin-top:10px;overflow:hidden;
  background-color:#7feab8;
  border:0;
  box-shadow:none;
}
.usage-progress-fill{
  height:100%;min-width:0;border-radius:999px;
  transition:width .4s ease,filter .2s ease;
  box-shadow:inset 0 -1px 0 rgba(0,0,0,.06);
}
.usage-progress-fill--ok{background:#9ca3af}
.usage-progress-fill--near{background:#6b7280}
.usage-progress-fill--over{background:#4b5563}
.usage-captured-card--near{border-color:#fcd34d !important}
.usage-captured-card--over{border-color:#fca5a5 !important}
.badge-right{padding:6px 10px;border-radius:999px;background:#111827;color:#fff;font-size:11px;font-weight:500;white-space:nowrap}

.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:14px 0;border-bottom:1px solid #f0f1f3;text-align:left;font-size:13.5px;vertical-align:top}
.table th{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light)}
.table tr:last-child td{border-bottom:none}

.list{display:flex;flex-direction:column;gap:12px}
.list-item{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 16px;border:1px solid #f0f1f3;border-radius:18px;background:#fff;min-width:0;
}
.item-main{display:flex;align-items:center;gap:12px;min-width:0}
.avatar{
  width:42px;height:42px;border-radius:14px;background:transparent;
  display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--purple-dark);flex-shrink:0;
}
.avatar.quick-avatar--bookings{background:transparent;color:#6d28d9}
.avatar.quick-avatar--calls{background:transparent;color:#1d4ed8}
.avatar.quick-avatar--settings{background:transparent;color:#b45309}
.avatar.quick-avatar--bookings svg,.avatar.quick-avatar--calls svg,.avatar.quick-avatar--settings svg{
  display:block;width:22px;height:22px;flex-shrink:0;
}
.item-main h4{margin:0 0 3px;font-size:14px;letter-spacing:-.02em}
.item-main p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.5}
.metric{font-weight:600;font-size:20px;letter-spacing:-.7px}
.metric-sub{font-size:12px;color:var(--text-gray)}
.note{
  padding:14px 16px;border-radius:18px;background:#f9fafb;border:1px solid var(--border);
  color:var(--text-gray);font-size:13px;line-height:1.6;
}

.call-live{
  background:linear-gradient(145deg,#1a0533,#2d1b69 50%,#1a0d3a);
  color:#fff;position:relative;overflow:hidden;
}
.call-live::before{
  content:'';position:absolute;right:-80px;top:-80px;width:240px;height:240px;border-radius:50%;
  background:rgba(255,255,255,.06)
}
.live-label{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:rgba(16,185,129,.14);color:#86efac;font-size:11px;font-weight:500;margin-bottom:12px}
.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:none}
.live-name{font-size:24px;font-weight:600;letter-spacing:-.6px;margin:0 0 5px}
.live-copy{color:rgba(255,255,255,.72);font-size:13px;line-height:1.7}
.subtitle-box{margin-top:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px}
.subtitle-box .mini{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.48);font-weight:600;margin-bottom:4px}
.subtitle-box p{margin:0;color:#fff;font-size:13px;line-height:1.6}
.wave{display:flex;align-items:flex-end;gap:4px;height:56px;margin-top:18px}
.wave span{width:5px;background:rgba(196,181,253,.92);border-radius:999px;animation:w 1s ease-in-out infinite}
.wave span:nth-child(odd){animation-delay:.12s}
.wave span:nth-child(3n){animation-delay:.22s}
.wave span:nth-child(1){height:24px}.wave span:nth-child(2){height:42px}.wave span:nth-child(3){height:34px}.wave span:nth-child(4){height:50px}.wave span:nth-child(5){height:28px}.wave span:nth-child(6){height:45px}.wave span:nth-child(7){height:20px}.wave span:nth-child(8){height:38px}.wave span:nth-child(9){height:30px}
@keyframes w{0%,100%{transform:scaleY(.45);opacity:.45}50%{transform:scaleY(1);opacity:1}}

.progress-list{display:flex;flex-direction:column;gap:14px;margin-top:10px}
.progress-item{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;font-size:13px}
.bar{height:10px;background:#f3f4f6;border-radius:999px;overflow:hidden}
.bar > span{display:block;height:100%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);border-radius:999px}

.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.field{margin-bottom:20px}
.field label{display:block;font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
.field input,.field textarea,.field select{
  width:100%;height:40px;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;
  color:#111827;outline:none;font:inherit;font-size:14px;line-height:1.5;
}
.field input::placeholder,.field textarea::placeholder{color:#9ca3af;font-size:14px}
.field input:disabled,.field textarea:disabled,.field select:disabled{background:#f9fafb;color:#6b7280;cursor:not-allowed}
.field input:focus,.field textarea:focus,.field select:focus{border-color:#7c3aed;box-shadow:none;outline:1px solid rgba(124,58,237,.35);outline-offset:0}
.field textarea{height:auto;min-height:80px;resize:vertical;padding:10px 12px}
.field select{appearance:none;padding-right:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:16px}

.billing-banner{
  display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:18px;align-items:center;
  background:linear-gradient(135deg,#111827,#2b3445);color:#fff
}
.billing-banner p{color:rgba(255,255,255,.72)}
.pricing-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.price-mini{border:1px solid var(--border);border-radius:20px;padding:18px;background:#fff}
.price-mini.featured{border-color:var(--purple);border-width:2px;box-shadow:none}
.price-mini h4{margin:0 0 4px}
.price-mini .amt{font-size:32px;font-weight:600;letter-spacing:-1px;margin:10px 0 12px}
.price-mini ul{margin:0;padding-left:18px;color:var(--text-gray);font-size:12.5px;line-height:1.7}

.footer-inline{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:18px;color:var(--text-light);font-size:12px}

html[data-user-theme="dark"]{color-scheme:dark}
html[data-user-theme="dark"],
html[data-user-theme="dark"] body{
  background:#0d1117;
  color:#e6edf3;
}
html[data-user-theme="dark"] .user-app-shell{
  --purple:#58a6ff;
  --purple-dark:#58a6ff;
  --purple-light:rgba(56,139,253,0.14);
  --purple-ultra:rgba(56,139,253,0.08);
  --secondary-accent:#4a8fd4;
  --surface-page:#0d1117;
  --surface-card:#161b22;
  --text-dark:#e6edf3;
  --text-gray:#8b949e;
  --text-light:#6e7681;
  --border:#30363d;
  --bg:#161b22;
  --bg-gray:#21262d;
  --success-text:#3fb950;
  --warning-text:#e3b341;
  --danger-text:#f85149;
}
html[data-user-theme="dark"] .user-app-shell .page-title h1,
html[data-user-theme="dark"] .user-app-shell .panel-head h3{
  color:var(--text-dark);
}
html[data-user-theme="dark"] .user-app-shell .page-title p,
html[data-user-theme="dark"] .user-app-shell .panel-head .sub,
html[data-user-theme="dark"] .user-app-shell .panel-head p.sub{
  color:var(--text-gray);
}
html[data-user-theme="dark"] .sidebar-body::-webkit-scrollbar-thumb{background:#484f58}
html[data-user-theme="dark"] .nav-item{color:#8b949e}
html[data-user-theme="dark"] .nav-item:hover{background:#21262d;color:#e6edf3}
html[data-user-theme="dark"] .nav-item.active{
  background:rgba(56,139,253,0.15);
  color:#58a6ff;
}
html[data-user-theme="dark"] .nav-item.active:hover{
  background:rgba(56,139,253,0.22);
  color:#79c0ff;
}
html[data-user-theme="dark"] .user-app-shell .brand-title{color:#fff}
html[data-user-theme="dark"] .sidebar-logout{color:#8b949e}
html[data-user-theme="dark"] .btn{
  background:#21262d;
  border-color:var(--border);
  color:var(--text-dark);
}
html[data-user-theme="dark"] .btn:hover{
  background:#30363d;
  border-color:#8b949e;
  color:var(--text-dark);
}
html[data-user-theme="dark"] .btn.purple{
  background:#1f6feb;
  border-color:#1f6feb;
  color:#fff;
}
html[data-user-theme="dark"] .btn.purple:hover{
  background:#388bfd;
  border-color:#388bfd;
  color:#fff;
}
html[data-user-theme="dark"] .btn.user-save{
  background:#1f6feb;
  color:#fff;
  border-color:#1f6feb;
}
html[data-user-theme="dark"] .btn.user-save:hover:not(:disabled){
  background:#8957e5;
  border-color:#8957e5;
  color:#fff;
}
html[data-user-theme="dark"] .user-theme-toggle{
  background:var(--surface-card);
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .user-theme-toggle:hover{
  background:#21262d;
  color:var(--text-dark);
  border-color:#8b949e;
}
html[data-user-theme="dark"] .portal-notif-trigger{
  background:var(--surface-card);
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .portal-notif-trigger:hover{
  background:#21262d;
  border-color:#8b949e;
  color:var(--text-dark);
}
html[data-user-theme="dark"] .portal-top-account-btn{
  background:var(--surface-card);
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .portal-top-account-btn:hover{
  background:#21262d;
  border-color:#8b949e;
  color:var(--text-dark);
}
html[data-user-theme="dark"] .portal-top-account-menu-inner{
  box-shadow:0 16px 48px rgba(0,0,0,.45);
}
html[data-user-theme="dark"] .portal-top-account-menu-item:hover{
  background:#21262d;
}
html[data-user-theme="dark"] .portal-top-account-menu-item--logout{color:var(--text-gray)}
html[data-user-theme="dark"] .portal-top-account-menu-item--logout:hover{
  background:rgba(248,81,73,.12);
  color:#f85149;
}
html[data-user-theme="dark"] .portal-notif-badge{
  border-color:var(--surface-page);
  background:#da3633;
}
html[data-user-theme="dark"] .portal-notif-panel{
  box-shadow:0 16px 48px rgba(0,0,0,.45);
}
html[data-user-theme="dark"] .portal-notif-panel-head{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .portal-notif-title{color:var(--text-dark)}
html[data-user-theme="dark"] .portal-notif-body{color:var(--text-gray)}
html[data-user-theme="dark"] .portal-notif-item--critical{background:rgba(248,81,73,.1)}
html[data-user-theme="dark"] .portal-notif-item--critical:hover{background:rgba(248,81,73,.16);border-color:rgba(248,81,73,.28)}
html[data-user-theme="dark"] .portal-notif-item--warn{background:rgba(210,153,34,.1)}
html[data-user-theme="dark"] .portal-notif-item--warn:hover{background:rgba(210,153,34,.16);border-color:rgba(210,153,34,.26)}
html[data-user-theme="dark"] .portal-notif-item--info{background:rgba(139,148,158,.1)}
html[data-user-theme="dark"] .portal-notif-item--info:hover{background:rgba(139,148,158,.15);border-color:rgba(139,148,158,.22)}

html[data-user-theme="dark"] .topbar-user-chip-avatar{
  background:rgba(56,139,253,0.12);
  color:#58a6ff;
  border-color:#30363d;
}
html[data-user-theme="dark"] .card.soft{background:#161b22}
html[data-user-theme="dark"] .go-live-setup-status,
html[data-user-theme="dark"] .go-live-setup-status--next,
html[data-user-theme="dark"] .go-live-setup-status--live,
html[data-user-theme="dark"] .go-live-setup-status--blocked,
html[data-user-theme="dark"] .go-live-setup-status--ready{
  background:var(--surface-card);
  border-color:var(--border);
  box-shadow:none;
}
html[data-user-theme="dark"] .go-live-setup-status--live{box-shadow:inset 4px 0 0 #3fb950}
html[data-user-theme="dark"] .go-live-setup-status--blocked{box-shadow:inset 4px 0 0 #f85149}
html[data-user-theme="dark"] .go-live-setup-status--ready{box-shadow:inset 4px 0 0 #a371f7}
html[data-user-theme="dark"] .go-live-setup-status__lead{color:var(--text-gray)}
html[data-user-theme="dark"] .go-live-setup-status__badge,
html[data-user-theme="dark"] .go-live-setup-status__badge--next,
html[data-user-theme="dark"] .go-live-setup-status__badge--live,
html[data-user-theme="dark"] .go-live-setup-status__badge--blocked,
html[data-user-theme="dark"] .go-live-setup-status__badge--ready{
  background:#21262d;
  border-color:var(--border);
  color:var(--text-dark);
}
html[data-user-theme="dark"] .list-item{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] .table th,
html[data-user-theme="dark"] .table td{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .field label{color:var(--text-light)}
html[data-user-theme="dark"] .field input,
html[data-user-theme="dark"] .field textarea,
html[data-user-theme="dark"] .field select{
  background:#0d1117;
  border-color:var(--border);
  color:var(--text-dark);
}
html[data-user-theme="dark"] .field input:focus,
html[data-user-theme="dark"] .field textarea:focus,
html[data-user-theme="dark"] .field select:focus{
  border-color:#58a6ff;
  outline:1px solid rgba(88,166,255,0.45);
  outline-offset:0;
}
html[data-user-theme="dark"] .note{
  background:#21262d;
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .bar{background:#21262d}
html[data-user-theme="dark"] .bar > span{
  background:linear-gradient(90deg,#1f6feb,#79c0ff);
}
html[data-user-theme="dark"] .tag.purple{
  background:rgba(56,139,253,0.12);
  color:#79c0ff;
}
html[data-user-theme="dark"] .tag.green{background:rgba(35,134,54,0.15);color:#3fb950}
html[data-user-theme="dark"] .tag.blue{background:rgba(56,139,253,0.14);color:#79c0ff}
html[data-user-theme="dark"] .tag.gray{background:#30363d;color:#8b949e}
html[data-user-theme="dark"] .tag.orange{background:rgba(187,128,9,0.15);color:#d29922}
html[data-user-theme="dark"] .tag.red{background:rgba(248,81,73,0.12);color:#f85149}
html[data-user-theme="dark"] .dashboard-banner-go-live{
  border-color:#6e40c9 !important;
  background:linear-gradient(180deg,rgba(110,64,201,.18) 0%,rgba(88,28,135,.12) 100%) !important;
}
html[data-user-theme="dark"] .card.enterprise-managed-card{
  border-color:rgba(56,139,253,.38);
  background:rgba(56,139,253,.1);
}
html[data-user-theme="dark"] .usage-progress-track{
  background:#7feab8;border:0;
  box-shadow:none;
}
html[data-user-theme="dark"] .usage-progress-fill--ok{background:#9ca3af}
html[data-user-theme="dark"] .usage-progress-fill--near{background:#6b7280}
html[data-user-theme="dark"] .usage-progress-fill--over{background:#4b5563}
html[data-user-theme="dark"] .usage-captured-card--near{border-color:rgba(210,153,34,.45) !important}
html[data-user-theme="dark"] .usage-captured-card--over{border-color:rgba(248,81,73,.45) !important}
html[data-user-theme="dark"] .overview-bk-nudge{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .overview-bk-nudge__text{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-bk-nudge-dismiss{border-color:var(--border);color:var(--text-light)}
html[data-user-theme="dark"] .overview-banner{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] .overview-banner.pre-live{
  background:rgba(187,128,9,.12);
  border-color:rgba(210,153,34,.38);
}
html[data-user-theme="dark"] .overview-banner.pre-live .banner-title{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-banner.pre-live .banner-sub{color:var(--text-gray)}
html[data-user-theme="dark"] .overview-banner.post-live{
  background:rgba(35,134,54,.14);
  border-color:rgba(46,160,67,.42);
}
html[data-user-theme="dark"] .overview-banner.post-live .banner-title{color:#3fb950}
html[data-user-theme="dark"] .overview-banner.post-live .banner-sub{color:var(--text-gray);opacity:1}
html[data-user-theme="dark"] .overview-banner-footnote{color:#d29922}
html[data-user-theme="dark"] .banner-dot.green{
  box-shadow:0 0 0 3px rgba(46,160,67,.38);
}
html[data-user-theme="dark"] .banner-dot.green.pulse{animation-name:overviewBannerPulseDark}
html[data-user-theme="dark"] .overview-left > .checklist-card{
  background:var(--surface-card);
  border-color:var(--border);
  box-shadow:none;
}
html[data-user-theme="dark"] .overview-left > .checklist-card .card-title{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-left > .checklist-card .card-sub{color:var(--text-gray)}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-progress-label{color:#3fb950}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-progress-track{background:rgba(35,134,54,.16)}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-progress-fill{background:#3fb950}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-item{
  border-bottom-color:var(--border);
  background:transparent;
}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-item:hover{
  background:var(--bg-gray);
}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-name{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-desc{color:var(--text-gray)}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-arrow{color:var(--text-light)}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-circle{border-color:#484f58}
html[data-user-theme="dark"] .overview-left > .checklist-card .cl-circle.done{
  border-color:#3fb950;
  background:rgba(35,134,54,.2);
  color:#3fb950;
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-item--active{
  background:rgba(35,134,54,.14);
  box-shadow:inset 4px 0 0 #3fb950;
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-item--active:hover{
  background:rgba(35,134,54,.2);
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-item--active .cl-name{
  color:#3fb950;
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-circle{
  border-color:#484f58;
  background:#0d1117;
  color:var(--text-light);
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-circle.active{
  border-color:#3fb950;
  background:rgba(35,134,54,.28);
  color:#3fb950;
  box-shadow:0 0 0 4px rgba(35,134,54,.16);
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-circle.done{
  border-color:#3fb950;
  background:#3fb950;
  color:#0d1117;
}
html[data-user-theme="dark"] .overview-left > .overview-go-live-checklist .cl-circle.locked{
  border-color:#484f58;
  background:#0d1117;
  color:var(--text-light);
}
html[data-user-theme="dark"] .overview-system-status-card.checklist-card,
html[data-user-theme="dark"] .overview-quick-access-card.shortcuts-card{
  background:var(--surface-card);
  border-color:var(--border);
  box-shadow:none;
}
html[data-user-theme="dark"] .overview-system-status-card.checklist-card .card-title{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-system-status-card.checklist-card .card-sub{color:var(--text-gray)}
html[data-user-theme="dark"] .overview-quick-access-card .sc-item{
  border-color:var(--border);
  background:transparent;
}
html[data-user-theme="dark"] .overview-quick-access-card .sc-item:hover{
  border-color:#58a6ff;
  background:#21262d;
}
html[data-user-theme="dark"] .overview-quick-access-card .sc-name{color:var(--text-dark)}
html[data-user-theme="dark"] .overview-quick-access-card .sc-desc{color:var(--text-gray)}
html[data-user-theme="dark"] .overview-quick-access-card .sc-go{color:var(--text-light)}
html[data-user-theme="dark"] .overview-status-row{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .overview-status-zero-calls{background:#21262d;color:var(--text-gray)}
html[data-user-theme="dark"] .overview-status-recent{border-top-color:var(--border)}
html[data-user-theme="dark"] .overview-quick-access-card .sc-icon{color:#8b949e}
html[data-user-theme="dark"] .overview-quick-access-item:hover .sc-icon,
html[data-user-theme="dark"] .overview-quick-access-item:hover .sc-name{color:#e6edf3}
html[data-user-theme="dark"] .stat-icon svg{stroke:var(--purple-dark)}
html[data-user-theme="dark"] .forward-num{
  background:rgba(56,139,253,0.1);
  border-color:#30363d;
  color:#79c0ff;
}
html[data-user-theme="dark"] a.carrier-link{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] a.carrier-link:hover{
  background:#21262d;
  border-color:#58a6ff;
}
html[data-user-theme="dark"] a.carrier-link strong{color:var(--text-dark)}
html[data-user-theme="dark"] .carrier-callcenter-tip{
  background:#0d1117;
  border-color:var(--border);
}
html[data-user-theme="dark"] .overview-rail-health-row{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .overview-rail-recent{border-top-color:var(--border)}
html[data-user-theme="dark"] .overview-rail-call{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .overview-rail-call:hover{border-color:#58a6ff;background:#21262d}
html[data-user-theme="dark"] .overview-rail-step.done .overview-rail-step-mark{
  background:rgba(35,134,54,0.15);border-color:rgba(63,185,80,.45);color:#3fb950;
}
html[data-user-theme="dark"] .overview-rail-dot.neutral{background:#484f58}
html[data-user-theme="dark"] .price-mini{background:var(--surface-card)}
html[data-user-theme="dark"] .plan-chip{
  background:rgba(56,139,253,0.12);
  color:#79c0ff;
}
html[data-user-theme="dark"] .rb-account-action:hover{background:#21262d}
html[data-user-theme="dark"] .rb-account-callout{background:#21262d;border-color:var(--border)}
html[data-user-theme="dark"] .rb-account-plan-pill{background:rgba(56,139,253,0.12);color:#79c0ff}
html[data-user-theme="dark"] .nav-attention-dot{background:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,.16)}
html[data-user-theme="dark"] .sidebar-collapse-btn{background:#21262d;border-color:var(--border);color:#8b949e}
html[data-user-theme="dark"] .sidebar-collapse-btn:hover{background:#30363d;color:var(--text-dark)}
.user-portal-sidebar-tooltip{
  position:fixed;
  transform:translateY(-50%);
  background:#111827;
  color:#fff;
  border-radius:8px;
  padding:6px 10px;
  font-size:12px;
  font-weight:500;
  line-height:1.2;
  white-space:nowrap;
  z-index:220;
  box-shadow:0 8px 24px rgba(0,0,0,.2);
  pointer-events:none;
}
html[data-user-theme="dark"] .user-portal-sidebar-tooltip{
  background:#f0f6fc;
  color:#0d1117;
  box-shadow:0 8px 24px rgba(0,0,0,.45);
}

@media (max-width:1200px){
  .grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .kpi-row,.call-grid,.billing-banner,.pricing-mini{grid-template-columns:1fr}
}
@media (min-width:861px){
  .user-app-shell{
    display:block;
    padding-left:var(--portal-sidebar-width,var(--sidebar-width));
    min-height:100vh;
    transition:padding-left .2s ease;
  }
  .topbar-user-chip-meta{display:block}
  /* Desktop portal: only the sidebar stays fixed; topbar scrolls with page content. */
  .user-app-shell .sidebar{
    position:fixed;
    inset:0 auto 0 0;
    width:var(--portal-sidebar-width,var(--sidebar-width));
    height:100dvh;
    z-index:40;
    overflow-x:hidden;
    overflow-y:auto;
    overscroll-behavior-y:contain;
    -webkit-overflow-scrolling:touch;
    transition:width .2s ease,padding .2s ease;
  }
  html.user-sidebar-collapsed{
    --portal-sidebar-width:88px;
  }
  html.user-sidebar-collapsed .user-app-shell .sidebar,
  html.user-sidebar-collapsed .user-app-shell .sidebar .sidebar-inner,
  html.user-sidebar-collapsed .user-app-shell .sidebar .sidebar-body,
  html.user-sidebar-collapsed .user-app-shell .sidebar .sidebar-footer{overflow:visible}
  html.user-sidebar-collapsed .user-app-shell .sidebar .sidebar-body{
    overflow-x:visible;
    overflow-y:auto;
  }
  html.user-sidebar-collapsed .user-app-shell .sidebar{padding:18px 12px}
  html.user-sidebar-collapsed .brand-title,
  html.user-sidebar-collapsed .brand-tagline,
  html.user-sidebar-collapsed .nav-item-label,
  html.user-sidebar-collapsed .nav-label,
  html.user-sidebar-collapsed .sidebar-logout span,
  html.user-sidebar-collapsed .sidebar-collapse-label{display:none}
  html.user-sidebar-collapsed .brand-text{display:none}
  html.user-sidebar-collapsed .brand{justify-content:center;margin-bottom:18px}
  html.user-sidebar-collapsed .nav-item{
    justify-content:center;padding:10px;position:relative;overflow:visible;
  }
  html.user-sidebar-collapsed .nav-item .nav-attention-dot,
  html.user-sidebar-collapsed .nav-item .nav-item-badge{
    position:absolute;top:6px;right:6px;margin-left:0;z-index:3;
    box-shadow:0 0 0 2px var(--surface-card);
  }
  html.user-sidebar-collapsed .nav-item .nav-attention-dot{
    display:inline-flex;
  }
  html.user-sidebar-collapsed .nav-item .nav-item-badge{
    display:inline-flex !important;
    min-width:16px;height:16px;padding:0 4px;
    font-size:9px;line-height:1;
  }
  html.user-sidebar-collapsed .nav-icon{margin:0}
  html.user-sidebar-collapsed .sidebar-collapse-btn,
  html.user-sidebar-collapsed .sidebar-logout{
    justify-content:center;padding:10px;position:relative;overflow:visible;
  }
  html.user-sidebar-collapsed .nav-go-live-placeholder{padding:10px}
}
@media (max-width:860px){
  .user-app-shell{
    align-content:start;
    grid-auto-rows:max-content;
  }
  .user-app-shell .sidebar,
  .user-app-shell .main{
    align-self:start;
    width:100%;
  }
  .main{padding:0;padding-bottom:calc(18px + 76px + env(safe-area-inset-bottom, 0px))}
  .user-app-shell .main > .page-content{padding-top:24px;}
  .user-app-shell .main > .page-content.page-overview,
  .user-app-shell .main > .page-content.page-bookings,
  .user-app-shell .main > .page-content.page-go-live,
  .user-app-shell .main > .page-content.page-more{padding-top:24px;}
  /* Overview go-live banner: stack like Go Live card CTAs on mobile */
  .user-app-shell .overview-banner{
    flex-direction:column;
    align-items:stretch;
    gap:12px;
  }
  .user-app-shell .overview-banner.pre-live .banner-dot.amber{display:none}
  .user-app-shell .overview-banner.pre-live .banner-action-needed{
    align-self:flex-start;
    font-size:13px;
    padding:10px 16px;
  }
  .user-app-shell .overview-banner.pre-live .banner-text{
    flex-direction:column;
    align-items:flex-start;
    gap:8px;
  }
  .user-app-shell .overview-banner .banner-text{width:100%}
  .user-app-shell .overview-banner .banner-actions.portal-card-actions{width:100%}
  .app-shell .main > .topbar{margin:0;padding:12px 18px;border-bottom:none}
  .grid-2,.form-grid{grid-template-columns:1fr}
  .grid.grid-3,.grid.grid-4{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
  }
  .grid.grid-3.calls-insights-grid{
    grid-template-columns:1fr;
  }
  .grid.grid-3 > .stat-card,.grid.grid-4 > .stat-card{
    padding:11px 11px 12px;
    border-radius:16px;
    box-shadow:none;
  }
  .grid.grid-3 .stat-top,.grid.grid-4 .stat-top{
    margin-bottom:7px;
    gap:6px;
    align-items:flex-start;
  }
  .grid.grid-3 .stat-icon,.grid.grid-4 .stat-icon{
    width:32px;height:32px;border-radius:10px;flex-shrink:0;
  }
  .grid.grid-3 .stat-icon svg,.grid.grid-4 .stat-icon svg{width:16px;height:16px}
  .grid.grid-3 .stat-value,.grid.grid-4 .stat-value{
    font-size:21px;
    font-weight:600;
    letter-spacing:-.45px;
    line-height:1.1;
  }
  .grid.grid-3 .stat-meta,.grid.grid-4 .stat-meta{
    font-size:10.5px;
    line-height:1.3;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .grid.grid-3 .tag,.grid.grid-4 .tag{
    padding:6px;
    font-size:9px;
    max-width:100%;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .topbar{align-items:flex-start;flex-direction:column}
  .topbar-trailing{
    width:100%;
    margin-left:0;
    justify-content:flex-start;
    gap:10px;
  }
  .topbar-trailing > .portal-notif,
  .topbar-trailing > .user-theme-toggle,
  .topbar-trailing > .top-actions.portal-top-account{display:none}
  .topbar-user-chip{display:none !important}
  /* Card section headers: marketing-style full-width black CTAs on mobile (not topbar shortcuts). */
  .user-app-shell .panel-head{
    flex-direction:column;
    align-items:stretch;
    gap:12px;
  }
  .user-app-shell .panel-head > .btn,
  .user-app-shell .panel-head > a.btn,
  .user-app-shell .panel-head > button.btn{
    width:100%;
    justify-content:center;
    box-sizing:border-box;
    order:3;
    min-height:48px;
    height:auto;
    padding:14px 22px;
    border-radius:999px;
    font-size:15px;
    font-weight:500;
    line-height:1.2;
    text-align:center;
    background:#111827;
    color:#fff;
    border:1px solid #111827;
    box-shadow:none;
  }
  .user-app-shell .panel-head > .btn:hover,
  .user-app-shell .panel-head > a.btn:hover,
  .user-app-shell .panel-head > button.btn:hover:not(:disabled){
    background:#1f2937;
    border-color:#1f2937;
    color:#fff;
  }
  .user-app-shell .panel-head > .btn.user-save,
  .user-app-shell .panel-head > a.btn.user-save,
  .user-app-shell .panel-head > button.btn.user-save{
    background:#111827;
    color:#fff;
    border-color:#111827;
  }
  .user-app-shell .panel-head > .btn.user-save:hover:not(:disabled),
  .user-app-shell .panel-head > a.btn.user-save:hover:not(:disabled),
  .user-app-shell .panel-head > button.btn.user-save:hover:not(:disabled){
    background:#1f2937;
    border-color:#1f2937;
    color:#fff;
  }
  .user-app-shell .panel-head > .badge-right{align-self:flex-start;order:2}
  .user-app-shell .card .dashboard-card-actions{
    flex-direction:column;
    align-items:stretch !important;
    gap:10px !important;
  }
  .user-app-shell .card .dashboard-card-actions > .btn,
  .user-app-shell .card .dashboard-card-actions > a.btn,
  .user-app-shell .card .dashboard-card-actions > button.btn{
    width:100%;
    min-height:48px;
    height:auto;
    justify-content:center;
    box-sizing:border-box;
    padding:14px 18px;
    border-radius:8px;
    font-size:15px;
    font-weight:500;
    line-height:1.2;
    text-align:center;
    box-shadow:none;
  }
  /* Primary action rows inside cards (Go Live, Billing enterprise CTAs, etc.) */
  .user-app-shell .portal-card-actions{
    display:flex !important;
    flex-direction:column !important;
    align-items:stretch !important;
    gap:10px !important;
  }
  .user-app-shell .portal-card-actions > .btn,
  .user-app-shell .portal-card-actions > a.btn,
  .user-app-shell .portal-card-actions > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
    padding:14px 18px;
    font-size:15px;
    font-weight:500;
    line-height:1.2;
  }
  .user-app-shell .price-mini-cta{
    display:flex;
    flex-direction:column;
    align-items:stretch;
    gap:10px;
  }
  .user-app-shell .price-mini-cta > .btn,
  .user-app-shell .price-mini-cta > a.btn,
  .user-app-shell .price-mini-cta > span.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
    padding:14px 18px;
    font-size:15px;
    font-weight:500;
    line-height:1.2;
  }
  /* Billing overview / body CTAs not in panel-head or portal-card-actions */
  .user-app-shell .card button.btn.user-save,
  .user-app-shell .card a.btn.user-save{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .card > a.btn{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell [aria-label='Billing interval']{
    display:flex !important;
    flex-direction:column !important;
    align-items:stretch !important;
    width:100%;
    gap:8px;
  }
  .user-app-shell [aria-label='Billing interval'] > button{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .rb-account-inline-actions{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .rb-account-inline-actions > .btn,
  .user-app-shell .rb-account-inline-actions > .btn.user-save,
  .user-app-shell .rb-account-inline-actions > button.rb-account-btn-ghost{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .page-title h1{font-size:20px}
  .page-title p{color:#111827}
  .app-shell{grid-template-columns:1fr}
  .user-app-shell{padding-left:0}
  .sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border);overflow:visible}
  .sidebar-inner{min-height:auto}
  .sidebar-spacer{display:none}
  .user-app-shell .sidebar-footer{display:none !important}
  .user-app-shell .sidebar-footer-controls{display:none !important}
  .user-app-shell .sidebar-body{flex:none;min-height:0;overflow:visible}
  .brand{width:100%;margin-bottom:0}
  .brand-title,.brand-tagline{display:block}
  .brand-mobile-actions{display:flex}
  .portal-notif-panel{
    position:fixed;
    left:10px;
    right:10px;
    width:auto;
    max-width:none;
    top:calc(env(safe-area-inset-top, 0px) + 72px);
    z-index:200;
  }
  .user-app-shell .nav-section{display:none !important}
}
@media (max-width:860px){
  html[data-user-theme="dark"] .page-title p{color:var(--text-gray)}
  html[data-user-theme="dark"] .user-app-shell .panel-head > .btn,
  html[data-user-theme="dark"] .user-app-shell .panel-head > a.btn,
  html[data-user-theme="dark"] .user-app-shell .panel-head > button.btn{
    background:#0d1117;
    color:#f0f6fc;
    border-color:#30363d;
  }
  html[data-user-theme="dark"] .user-app-shell .panel-head > .btn:hover,
  html[data-user-theme="dark"] .user-app-shell .panel-head > a.btn:hover,
  html[data-user-theme="dark"] .user-app-shell .panel-head > button.btn:hover:not(:disabled){
    background:#21262d;
    border-color:#8b949e;
    color:#f0f6fc;
  }
}
`,
];

const scripts: string[] = [

];

export const userDashboardStyles = [...styles, userPortalTypographyStyles];
export const userDashboardScripts = scripts;
export const templateTitle = 'Overview';

export function UserDashboardTemplate() {
  return (
    <UserLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="user-dashboard"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><div className="brand-text"><span className="brand-title">RingBooker</span></div></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item active" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Overview</h1><p>Track calls, bookings, and reminders.</p></div>
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
          <div className="page-content page-overview">
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">+18% this week</span></div><div className="stat-value">142</div><div className="stat-meta">Calls answered by RingBooker</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">31 booked</span></div><div className="stat-value">76%</div><div className="stat-meta">Call-to-booking conversion</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">9 pending replies</span></div><div className="stat-value">54</div><div className="stat-meta">SMS confirmations and reminders sent</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">Recovered value</span></div><div className="stat-value">$3.4k</div><div className="stat-meta">Estimated monthly value from answered calls</div></div>
          </section>
          <section className="call-grid" style={{marginTop: 18}}>
            <div className="card call-live">
              <div className="live-label"><span className="dot" /> Live right now</div>
              <div className="live-name">RingBooker is handling a call</div>
              <div className="live-copy">Incoming customer wants a color + trim on Thursday afternoon. AI is checking the calendar and preferred stylist availability.</div>
              <div className="subtitle-box"><div className="mini">Live subtitle</div><p>“I can help with that. Thursday at 2:30 PM is open with Sophia. Would you like me to book it for you?”</p></div>
              <div className="wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Today’s performance</h3><p className="sub">Where bookings are coming from.</p></div><span className="badge-right">Updated 2 min ago</span></div>
              <div className="progress-list">
                <div className="progress-item"><strong>New callers</strong><div className="bar"><span style={{width: '68%'}} /></div><span>34</span></div>
                <div className="progress-item"><strong>Returning VIPs</strong><div className="bar"><span style={{width: '44%'}} /></div><span>12</span></div>
                <div className="progress-item"><strong>Missed-call recovery</strong><div className="bar"><span style={{width: '76%'}} /></div><span>19</span></div>
                <div className="progress-item"><strong>Booked after hours</strong><div className="bar"><span style={{width: '59%'}} /></div><span>16</span></div>
              </div>
            </div>
          </section>
          <section className="kpi-row" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Upcoming bookings</h3><p className="sub">The next appointments RingBooker has placed on your calendar.</p></div><a className="btn" href="/user/bookings">Open all</a></div>
              <table className="table">
                <thead><tr><th>Client</th><th>Service</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Emma L.</td><td>Balayage + Trim</td><td>Today · 2:30 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                  <tr><td>Jasmine T.</td><td>Gel Manicure</td><td>Today · 4:00 PM</td><td><span className="tag purple">Booked by AI</span></td></tr>
                  <tr><td>Nicole V.</td><td>Hair Color</td><td>Tomorrow · 10:00 AM</td><td><span className="tag orange">Reminder sent</span></td></tr>
                  <tr><td>Grace H.</td><td>Pedicure</td><td>Tomorrow · 1:15 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="panel-head"><div><h3>Messages &amp; follow-ups</h3><p className="sub">Recent SMS activity from your AI phone agent.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">EV</div><div><h4>Reminder sent to Emma</h4><p>“See you tomorrow at 2:30 PM at Luxe Hair Studio.”</p></div></div><span className="tag green">Delivered</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">JT</div><div><h4>Missed-call text back</h4><p>Caller replied YES and requested a callback.</p></div></div><span className="tag orange">Pending</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">NH</div><div><h4>Booking confirmation</h4><p>Saturday at 10:00 AM · Sophia · Hair Color</p></div></div><span className="tag purple">Sent by AI</span></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
          </div>
        </main>
      </div>

    </UserLayout>
  );
}
