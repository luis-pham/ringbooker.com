import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

const userSettingsSpecificStyles = String.raw`
.section-stack{display:grid;gap:18px}
.settings-save-footer{
  display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:18px;padding-top:16px;
  border-top:1px solid rgba(15,23,42,.08);flex-wrap:wrap;
}
.card-section{display:grid;gap:16px}
.option-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.calendar-int-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
  gap:14px;
}
.calendar-int-card{
  border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff;
  display:flex;flex-direction:column;gap:10px;min-width:0;transition:.18s ease;
}
.calendar-int-card:hover{transform:translateY(-1px);box-shadow:var(--shadow-soft);border-color:#d8ccff}
.calendar-int-card.connected-active{
  border-color:rgba(139,92,246,.55);
  background:linear-gradient(180deg,#faf7ff 0%,#fff 100%);
  box-shadow:0 0 0 4px rgba(139,92,246,.08);
}
.calendar-int-card.soon{background:#fafafa}
.calendar-int-head{display:flex;align-items:center;gap:12px;min-width:0}
.calendar-int-logo-wrap{
  width:52px;height:52px;border-radius:14px;border:1px solid var(--border);
  background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;
}
.calendar-int-logo-wrap img{width:100%;height:100%;object-fit:contain;padding:7px}
.calendar-int-name{font-size:15px;font-weight:800;letter-spacing:-.02em;line-height:1.2}
.calendar-int-desc{font-size:12px;color:var(--text-gray);line-height:1.55;margin:0;flex:1}
.calendar-int-actions{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  margin-top:18px;padding-top:10px;border-top:1px solid rgba(15,23,42,.06);
}
.integrations-intro-note{margin-bottom:18px}
.integrations-section-heading{
  font-size:15px;font-weight:800;letter-spacing:-.02em;line-height:1.3;
  color:var(--text-dark);text-transform:none;
  margin:28px 0 12px;padding-top:20px;border-top:1px solid var(--border);
}
.integrations-section-heading--first{margin-top:10px;padding-top:0;border-top:none}
.integrations-section-lead{margin:0 0 20px;line-height:1.6;max-width:52rem}
.calendar-int-card--solo{max-width:100%;gap:12px}
.calendar-int-badge{
  display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;
  font-size:11px;font-weight:700;background:#f3f4f6;color:#6b7280;border:1px solid var(--border);
}
.option-card{
  border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff;transition:.18s ease;
  cursor:pointer;display:grid;gap:6px;min-width:0;
}
.option-card:hover{transform:translateY(-1px);box-shadow:var(--shadow-soft);border-color:#d8ccff}
.option-card.active{border-color:rgba(139,92,246,.55);background:linear-gradient(180deg,#faf7ff 0%,#fff 100%);box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.option-card.locked{opacity:.62;cursor:not-allowed;background:#fafafa}
.option-title{font-size:14px;font-weight:800;letter-spacing:-.02em}
.option-copy{font-size:12px;color:var(--text-gray);line-height:1.6}
.preset-pills{display:flex;flex-wrap:wrap;gap:10px}
.preset-pill{
  border:1px solid var(--border);background:#fff;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:700;color:#4b5563;
  cursor:pointer;transition:.18s ease;
}
.preset-pill.active{background:#111827;color:#fff;border-color:#111827}
.preset-pill.locked{opacity:.58;cursor:not-allowed}
.switch-list{display:grid;gap:12px}
.switch-row{
  display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
  border:1px solid #f0f1f3;border-radius:18px;padding:15px 16px;background:#fff;
}
.switch-copy h4{margin:0 0 4px;font-size:14px;letter-spacing:-.02em}
.switch-copy p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.55}
.switch-stack{display:flex;align-items:flex-end;gap:10px;flex-direction:column}
.switch{
  position:relative;display:inline-flex;width:54px;height:31px;border-radius:999px;background:#e5e7eb;
  border:none;padding:0;cursor:pointer;transition:.18s ease;
}
.switch::after{
  content:'';position:absolute;top:4px;left:4px;width:23px;height:23px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(17,24,39,.12);transition:.18s ease;
}
.switch.on{background:var(--purple)}
.switch.on::after{transform:translateX(23px)}
.switch:disabled{opacity:.55;cursor:not-allowed}
.lock-copy{font-size:11px;color:var(--text-light);font-weight:700}
.hint-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hint-copy{font-size:12px;color:var(--text-gray);line-height:1.6}
.subtle-link{color:var(--purple-dark);font-weight:700}
button.subtle-link{font:inherit;border:none;background:none;padding:0;cursor:pointer;text-align:left}
button.subtle-link:hover{text-decoration:underline}
.integrations-path-picker{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 18px}
.integrations-path-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 10px}
.integrations-inline-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;width:100%;margin-top:4px}
.integrations-vagaro-block{margin-top:6px;display:flex;flex-direction:column;gap:22px}
.integrations-vagaro-subhead{display:flex;flex-direction:column;gap:8px}
.integrations-vagaro-subhead .option-title{margin:0}
.integrations-vagaro-subhead-copy{margin:0;line-height:1.55}
.integrations-vagaro-form{gap:18px 22px}
.integrations-vagaro-booking-field{
  grid-column:1/-1;display:flex;flex-direction:column;gap:12px;
  margin-top:6px;padding-top:22px;border-top:1px solid var(--border);
}
.integrations-vagaro-booking-field .hint-copy{display:block;margin-top:-2px}
.integrations-vagaro-booking-field .note{margin:0}
.integrations-vagaro-booking-actions{margin-top:4px}
.integrations-vagaro-status-field{grid-column:1/-1}
.integrations-vagaro-status-field .note{margin-top:4px}
.integrations-vagaro-primary-actions{grid-column:1/-1;margin-top:6px}
.integrations-square-config{margin-top:22px;display:flex;flex-direction:column;gap:18px}
.integrations-square-config .hint-row{align-items:flex-start;gap:14px}
.integrations-square-config .form-grid{margin-top:0}
.tab-strip{
  display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:18px;
}
.tab-button{
  display:flex;flex-direction:row;align-items:flex-start;gap:10px;text-align:left;
  padding:12px 14px;border-radius:8px;border:1px solid var(--border);
  background:#fff;color:var(--text-dark);cursor:pointer;min-width:0;
  box-shadow:none;font:inherit;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.tab-button:hover{
  transform:none;box-shadow:none;
  background:#f9fafb;border-color:#d1d5db;
}
.tab-button:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.tab-button.active{
  background:var(--purple-dark);color:#fff;border-color:var(--purple-dark);
  box-shadow:none;
}
.tab-button.active:hover{
  background:#5609c4;border-color:#5609c4;color:#fff;
}
.tab-button-icon{
  flex-shrink:0;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  background:transparent;color:inherit;border:none;
}
.tab-button-icon svg{display:block;width:20px;height:20px}
.tab-button-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.tab-button strong{font-size:14px;font-weight:600;letter-spacing:-.02em;line-height:1.25}
.tab-button-desc{font-size:12px;line-height:1.5;color:var(--text-gray);font-weight:400}
.tab-button.active .tab-button-desc{color:rgba(255,255,255,.88)}
.business-subtabs{
  display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;
}
.business-subtab{
  border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 14px;
  font-size:13px;font-weight:600;color:#4a4455;cursor:pointer;font:inherit;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
  box-shadow:none;
}
.business-subtab:hover{background:#f9fafb;border-color:#d1d5db;color:var(--text-dark)}
.business-subtab:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.business-subtab.active{
  background:#0d1117;color:#fff;border-color:#0d1117;font-weight:600;
}
.business-subtab.active:hover{background:#161b22;border-color:#161b22;color:#fff}
/* Integrations cards sit on purple-tinted “connected” panels — keep primary CTAs clearly black */
.calendar-int-card .btn.user-save,
.integrations-vagaro-booking-actions .btn.user-save,
.integrations-vagaro-primary-actions .btn.user-save,
.calendar-int-card .integrations-inline-actions .btn.user-save{
  background:#0d1117;color:#fff;border-color:#0d1117;font-weight:600;
}
.calendar-int-card .btn.user-save:hover:not(:disabled),
.integrations-vagaro-booking-actions .btn.user-save:hover:not(:disabled),
.integrations-vagaro-primary-actions .btn.user-save:hover:not(:disabled),
.calendar-int-card .integrations-inline-actions .btn.user-save:hover:not(:disabled){
  background:#161b22;border-color:#161b22;color:#fff;
}
.card-section-form{
  border:none;border-radius:0;padding:0;background:transparent;
}
.hours-grid{
  display:grid;gap:0;
  border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#fff;
}
.hours-row{
  display:grid;grid-template-columns:96px 112px 112px auto;gap:12px;align-items:center;
  padding:12px 14px;background:#fff;border:none;border-radius:0;
  border-bottom:1px solid #f0f1f3;
}
.hours-row:last-child{border-bottom:none}
.hours-row.closed{background:#fafafa}
.hours-day{font-size:13px;font-weight:800}
.inline-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-gray);font-weight:700}
.inline-check input{margin:0}
.services-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.service-chip{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  border:1px solid #f0f1f3;border-radius:18px;padding:14px 15px;background:#fff;
}
.service-copy h4{margin:0 0 4px;font-size:14px}
.service-copy p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.5}
.service-chip.active{border-color:rgba(139,92,246,.45);box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.service-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.small-field{margin-bottom:20px}
.small-field label{display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}
.small-field input,.small-field select{
  width:100%;height:40px;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font:inherit;font-size:14px;line-height:1.5;color:#111827;
}
.small-field input::placeholder{color:#9ca3af;font-size:14px}
.small-field input:disabled,.small-field select:disabled{background:#f9fafb;color:#6b7280;cursor:not-allowed}
.small-field input:focus,.small-field select:focus{border-color:#7c3aed;box-shadow:0 0 0 2px rgba(124,58,237,.15);outline:none}
.small-field select{
  appearance:none;padding-right:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;background-size:16px;
}

/* Services & Hours — SaaS-style layout */
.sh-services-hours-card{padding:0;overflow:hidden}
.sh-panel-head{padding:22px 22px 18px;border-bottom:1px solid var(--border)}
.sh-panel-title{margin:0;font-size:18px;font-weight:780;letter-spacing:-.03em;line-height:1.25;color:var(--text-dark)}
.sh-panel-desc{margin:8px 0 0;font-size:14px;line-height:1.55;color:var(--text-gray);max-width:44rem}
.sh-segments{
  display:flex;gap:6px;padding:12px 16px 14px;
  background:linear-gradient(180deg,#fafafa 0%,#f3f4f6 100%);
  border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.sh-segment{
  border:1px solid transparent;background:transparent;padding:9px 18px;border-radius:10px;
  font:inherit;font-size:13px;font-weight:650;color:var(--text-gray);cursor:pointer;
  transition:background .15s ease,color .15s ease,border-color .15s ease,box-shadow .15s ease;
}
.sh-segment:hover{color:var(--text-dark);background:rgba(255,255,255,.75);border-color:#e5e7eb}
.sh-segment:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.sh-segment.active{
  background:#fff;color:var(--text-dark);border-color:var(--border);
  box-shadow:0 1px 3px rgba(15,23,42,.07);font-weight:750;
}
.sh-form-body{padding:20px 22px 10px}
.sh-catalog-intro{margin:0 0 16px;font-size:13px;line-height:1.55;color:var(--text-gray);max-width:40rem}
.sh-catalog-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(268px,1fr));
  gap:14px;
}
.sh-catalog-card{
  border:1px solid var(--border);border-radius:14px;padding:16px 17px;
  display:flex;flex-direction:column;gap:12px;min-width:0;background:#fff;
  transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
}
.sh-catalog-card:hover{border-color:#d1d5db;box-shadow:0 2px 10px rgba(15,23,42,.05)}
.sh-catalog-card.selected{
  border-color:rgba(139,92,246,.48);
  background:linear-gradient(180deg,#faf7ff 0%,#fff 55%);
  box-shadow:0 0 0 3px rgba(139,92,246,.09);
}
.sh-catalog-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.sh-catalog-name{margin:0;font-size:15px;font-weight:780;letter-spacing:-.02em;line-height:1.25;color:var(--text-dark)}
.sh-catalog-desc{margin:0;font-size:13px;line-height:1.5;color:var(--text-gray)}
.sh-catalog-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
.sh-catalog-badge{
  font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  padding:4px 9px;border-radius:999px;background:#ecfdf5;color:#047857;border:1px solid #bbf7d0;
}
.sh-catalog-badge.off{background:#f9fafb;color:#6b7280;border-color:#e5e7eb}
.sh-catalog-action{
  flex-shrink:0;height:34px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:650;
  border:1px solid var(--border);background:#fff;color:var(--text-dark);cursor:pointer;font:inherit;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.sh-catalog-action:hover{background:#f9fafb;border-color:#d1d5db}
.sh-catalog-action.primary{background:var(--purple-dark);color:#fff;border-color:var(--purple-dark)}
.sh-catalog-action.primary:hover{background:#5609c4;border-color:#5609c4;color:#fff}

.sh-active-section{margin-top:22px;padding-top:22px;border-top:1px solid rgba(15,23,42,.08)}
.sh-active-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.sh-active-label{margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray)}
.sh-active-hint{margin:0;font-size:13px;color:var(--text-gray);line-height:1.45}
.sh-empty{
  padding:22px 18px;border-radius:14px;border:1px dashed #d1d5db;background:#fafafa;
  font-size:14px;line-height:1.55;color:var(--text-gray);text-align:center;
}
.sh-active-table{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff}
.sh-active-thead{
  display:grid;grid-template-columns:minmax(0,1fr) 132px 112px;gap:14px;
  padding:11px 18px;background:#f9fafb;border-bottom:1px solid var(--border);
  font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray);
}
.sh-active-row{
  display:grid;grid-template-columns:minmax(0,1fr) 132px 112px;gap:14px;
  padding:14px 18px;align-items:center;border-bottom:1px solid #f0f1f3;
}
.sh-active-row:last-child{border-bottom:none}
.sh-active-service{font-size:14px;font-weight:750;color:var(--text-dark);letter-spacing:-.02em}
.sh-active-row .small-field{margin-bottom:0}
.sh-active-row .small-field label{font-size:10px;margin-bottom:6px}

.sh-hours-body{padding:20px 22px 12px}
.sh-hours-intro{margin-bottom:18px}
.sh-hours-presets{margin-bottom:18px}
.sh-hours-presets-label{margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-gray)}
.sh-hours-presets .preset-pills{margin-bottom:0}

.sh-hours-wrap{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff}
.sh-hours-thead{
  display:grid;
  grid-template-columns:minmax(108px,1.1fr) minmax(92px,0.95fr) minmax(92px,0.95fr) minmax(120px,auto);
  gap:12px;padding:11px 16px;background:#f9fafb;border-bottom:1px solid var(--border);
  font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray);
}
.sh-hours-wrap .hours-grid{border:none;border-radius:0}
.sh-hours-wrap .hours-row{
  grid-template-columns:minmax(108px,1.1fr) minmax(92px,0.95fr) minmax(92px,0.95fr) minmax(120px,auto);
  padding:12px 16px;border-radius:0;
}
.sh-hours-wrap .hours-row.closed{opacity:.72}
.sh-hours-wrap .hours-day{font-size:13px;font-weight:780;color:var(--text-dark)}
.sh-save-bar{
  padding:16px 22px 20px;border-top:1px solid rgba(15,23,42,.08);
  display:flex;justify-content:flex-end;align-items:center;gap:12px;background:#fafafa;
}

.plan-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;background:#f5f3ff;color:var(--purple-dark);font-size:11px;font-weight:800}
.upgrade-panel{background:linear-gradient(135deg,#f7f3ff,#fff);border:1px dashed rgba(99,14,212,.28)}

html[data-user-theme="dark"] .settings-save-footer{border-top-color:var(--border)}
html[data-user-theme="dark"] .calendar-int-card{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] .calendar-int-card:hover{border-color:#58a6ff;box-shadow:none}
html[data-user-theme="dark"] .calendar-int-card.connected-active{
  border-color:rgba(56,139,253,.45);
  background:linear-gradient(180deg,rgba(56,139,253,.08) 0%,var(--surface-card) 100%);
  box-shadow:0 0 0 4px rgba(56,139,253,.12);
}
html[data-user-theme="dark"] .calendar-int-card.soon{background:#21262d}
html[data-user-theme="dark"] .calendar-int-logo-wrap{background:#0d1117;border-color:var(--border)}
html[data-user-theme="dark"] .integrations-section-heading{color:var(--text-dark);border-top-color:var(--border)}
html[data-user-theme="dark"] .calendar-int-actions{border-top-color:rgba(240,246,252,.08)}
html[data-user-theme="dark"] button.subtle-link{color:#a371f7}
html[data-user-theme="dark"] button.subtle-link:hover{color:#d2a8ff}
html[data-user-theme="dark"] .calendar-int-badge{background:#21262d;color:var(--text-gray);border-color:var(--border)}
html[data-user-theme="dark"] .option-card{background:var(--surface-card)}
html[data-user-theme="dark"] .option-card:hover{border-color:#58a6ff}
html[data-user-theme="dark"] .option-card.active{
  border-color:rgba(56,139,253,.55);
  background:linear-gradient(180deg,rgba(56,139,253,.1) 0%,var(--surface-card) 100%);
}
html[data-user-theme="dark"] .option-card.locked{background:#21262d}
html[data-user-theme="dark"] .preset-pill{background:var(--surface-card);border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .preset-pill.active{background:#58a6ff;color:#fff;border-color:#58a6ff}
html[data-user-theme="dark"] .switch-row{border-color:var(--border);background:var(--surface-card)}
html[data-user-theme="dark"] .switch{background:#30363d}
html[data-user-theme="dark"] .switch::after{background:#f0f6fc}
html[data-user-theme="dark"] .tab-button{background:var(--surface-card);border-color:var(--border);color:var(--text-dark)}
html[data-user-theme="dark"] .tab-button:hover{background:#21262d;border-color:#8b949e}
html[data-user-theme="dark"] .tab-button.active{
  background:rgba(56,139,253,0.15);
  color:#58a6ff;
  border-color:rgba(56,139,253,0.45);
}
html[data-user-theme="dark"] .tab-button.active:hover{
  background:rgba(56,139,253,0.22);
  border-color:#58a6ff;
  color:#79c0ff;
}
html[data-user-theme="dark"] .tab-button.active .tab-button-desc{color:rgba(230,237,243,.85)}
html[data-user-theme="dark"] .business-subtab{background:var(--surface-card);border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .business-subtab:hover{background:#21262d;color:var(--text-dark)}
html[data-user-theme="dark"] .business-subtab.active{
  background:#010409;
  color:#f0f6fc;
  border-color:#30363d;
  font-weight:600;
}
html[data-user-theme="dark"] .business-subtab.active:hover{
  background:#0d1117;
  border-color:#58a6ff;
  color:#f0f6fc;
}
html[data-user-theme="dark"] .calendar-int-card .btn.user-save,
html[data-user-theme="dark"] .integrations-vagaro-booking-actions .btn.user-save,
html[data-user-theme="dark"] .integrations-vagaro-primary-actions .btn.user-save,
html[data-user-theme="dark"] .calendar-int-card .integrations-inline-actions .btn.user-save{
  background:#010409;
  color:#f0f6fc;
  border-color:#30363d;
  font-weight:600;
}
html[data-user-theme="dark"] .calendar-int-card .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .integrations-vagaro-booking-actions .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .integrations-vagaro-primary-actions .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .calendar-int-card .integrations-inline-actions .btn.user-save:hover:not(:disabled){
  background:#0d1117;
  border-color:#58a6ff;
  color:#f0f6fc;
}
html[data-user-theme="dark"] .hours-grid{border-color:var(--border);background:var(--surface-card)}
html[data-user-theme="dark"] .hours-row{background:var(--surface-card);border-bottom-color:var(--border)}
html[data-user-theme="dark"] .hours-row.closed{background:#0d1117}
html[data-user-theme="dark"] .sh-panel-head{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-segments{
  background:linear-gradient(180deg,#0d1117 0%,#161b22 100%);
  border-bottom-color:var(--border);
}
html[data-user-theme="dark"] .sh-segment{color:var(--text-gray)}
html[data-user-theme="dark"] .sh-segment:hover{background:#21262d;border-color:var(--border);color:var(--text-dark)}
html[data-user-theme="dark"] .sh-segment.active{
  background:var(--surface-card);color:var(--text-dark);border-color:var(--border);
  box-shadow:0 1px 3px rgba(0,0,0,.35);
}
html[data-user-theme="dark"] .sh-catalog-card{background:var(--surface-card)}
html[data-user-theme="dark"] .sh-catalog-card:hover{border-color:#58a6ff}
html[data-user-theme="dark"] .sh-catalog-card.selected{
  border-color:rgba(56,139,253,.45);
  background:linear-gradient(180deg,rgba(56,139,253,.1) 0%,var(--surface-card) 100%);
  box-shadow:0 0 0 3px rgba(56,139,253,.12);
}
html[data-user-theme="dark"] .sh-catalog-badge.off{background:#21262d;color:var(--text-gray);border-color:var(--border)}
html[data-user-theme="dark"] .sh-catalog-action{background:var(--surface-card);border-color:var(--border);color:var(--text-dark)}
html[data-user-theme="dark"] .sh-catalog-action:hover{background:#21262d}
html[data-user-theme="dark"] .sh-empty{background:#0d1117;border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .sh-active-section{border-top-color:var(--border)}
html[data-user-theme="dark"] .sh-active-table{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-active-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-active-row{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-wrap{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-save-bar{border-top-color:var(--border);background:#0d1117}
html[data-user-theme="dark"] .sh-active-row .sh-active-service{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-chip{border-color:var(--border);background:var(--surface-card)}
html[data-user-theme="dark"] .service-chip.active{border-color:rgba(56,139,253,.45);box-shadow:0 0 0 4px rgba(56,139,253,.12)}
html[data-user-theme="dark"] .small-field label{color:var(--text-light)}
html[data-user-theme="dark"] .small-field input,
html[data-user-theme="dark"] .small-field select{
  border-color:var(--border);background:#0d1117;color:var(--text-dark);
}
html[data-user-theme="dark"] .small-field input:disabled,
html[data-user-theme="dark"] .small-field select:disabled{background:#21262d;color:var(--text-gray)}
html[data-user-theme="dark"] .small-field input:focus,
html[data-user-theme="dark"] .small-field select:focus{border-color:#58a6ff;box-shadow:0 0 0 2px rgba(88,166,255,.25)}
html[data-user-theme="dark"] .upgrade-panel{
  background:linear-gradient(135deg,rgba(56,139,253,.08),var(--surface-card));
  border-color:rgba(56,139,253,.35);
}

@media (max-width:1200px){
  .option-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:860px){
  .grid-3,.grid-4,.option-grid,.calendar-int-grid,.services-grid,.service-controls{grid-template-columns:1fr}
  .user-app-shell .grid.grid-3,.user-app-shell .grid.grid-4{grid-template-columns:1fr}
  .tab-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .tab-button{flex-direction:column;align-items:center;text-align:center;padding:11px 8px;gap:3px}
  .tab-button-icon{width:30px;height:30px;border-radius:10px}
  .tab-button-icon svg{width:20px;height:20px}
  .tab-button-body{align-items:center;width:100%}
  .tab-button-desc{display:none !important}
  .tab-button strong{font-size:11px;font-weight:750;line-height:1.25}
  .hours-row{grid-template-columns:1fr}
  .business-subtabs{gap:6px}
  .business-subtab{padding:7px 10px;font-size:11px}
  .card-section-form{padding:0}
  .sh-segments{padding:10px 12px}
  .sh-segment{padding:8px 14px;font-size:12px}
  .sh-panel-head{padding:18px 16px 14px}
  .sh-form-body{padding:16px 14px 8px}
  .sh-hours-body{padding:16px 14px 10px}
  .sh-catalog-grid{grid-template-columns:1fr}
  .sh-save-bar{padding:14px 16px 16px}
  .sh-active-thead{display:none}
  .sh-active-row{
    grid-template-columns:1fr;
    gap:12px;
    padding:16px 14px;
  }
  .sh-active-row .sh-active-service{
    padding-bottom:10px;
    margin-bottom:4px;
    border-bottom:1px solid #f0f1f3;
  }
  .sh-hours-thead{display:none}
  .sh-hours-wrap .hours-row{grid-template-columns:1fr}
}
`;

const styles: string[] = [...userDashboardStyles, userSettingsSpecificStyles];

const scripts: string[] = [

];

export const userSettingsStyles = styles;
export const userSettingsScripts = scripts;
export const userSettingsTemplateTitle = "Business settings and AI behavior.";

export const templateTitle = userSettingsTemplateTitle;

export function UserSettingsTemplate() {
  return (
    <UserLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="user-settings"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item active" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Business settings and AI behavior.</h1><p>Control how RingBooker answers calls, what it offers, and when it hands off to you.</p></div>
            <div className="top-actions overview-top-actions"><a className="btn" href="/user/knowledge">Edit business info</a><a className="btn user-save" href="/user/bookings">View bookings</a></div>
          </div>
          <section className="grid grid-2">
            <div className="card">
              <div className="panel-head"><div><h3>Business profile</h3><p className="sub">The information your AI receptionist uses on every call.</p></div></div>
              <div className="form-grid">
                <div className="field"><label>Salon name</label><input defaultValue="Luxe Hair Studio" /></div>
                <div className="field"><label>User phone</label><input defaultValue="+1 (714) 555-0100" /></div>
                <div className="field" style={{gridColumn: '1 / -1'}}><label>Address</label><input defaultValue="123 Main St, Garden Grove, CA 92840" /></div>
                <div className="field"><label>Business number</label><input defaultValue="+1 (714) 555-0199" /></div>
                <div className="field"><label>Timezone</label><select><option>America/Los_Angeles</option></select></div>
                <div className="field" style={{gridColumn: '1 / -1'}}><label>Cancellation policy</label><textarea defaultValue={"Appointments should be canceled at least 2 hours before the scheduled time."} /></div>
              </div>
            </div>
            <div className="card">
              <div className="panel-head"><div><h3>AI call behavior</h3><p className="sub">Keep answers on-brand and escalation safe.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">🎙</div><div><h4>Voice persona</h4><p>Friendly, concise, natural American English</p></div></div><span className="tag purple">Aoede</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">🌐</div><div><h4>User summary language</h4><p>Vietnamese summaries after important calls</p></div></div><span className="tag green">Enabled</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M6 3h7v7M13 3 5 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div><div><h4>Escalate complaints</h4><p>Transfer upset callers to the user immediately</p></div></div><span className="tag green">On</span></div>
              </div>
              <div className="note" style={{marginTop: 16}}>For MVP, RingBooker should avoid promising services, prices, or payment/deposit flows that are not configured here.</div>
            </div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Services and durations</h3><p className="sub">Used for availability checks and booking logic.</p></div></div>
              <table className="table">
                <thead><tr><th>Service</th><th>Duration</th><th>Price</th></tr></thead>
                <tbody>
                  <tr><td>Haircut</td><td>45 min</td><td>$45</td></tr>
                  <tr><td>Color Touch-up</td><td>90 min</td><td>$95</td></tr>
                  <tr><td>Balayage</td><td>150 min</td><td>$180</td></tr>
                  <tr><td>Wash &amp; Blowout</td><td>30 min</td><td>$35</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="panel-head"><div><h3>Hours and routing</h3><p className="sub">Tell RingBooker when to answer calls and when to forward.</p></div></div>
              <table className="table">
                <thead><tr><th>Day</th><th>Open</th><th>Close</th><th>AI handling</th></tr></thead>
                <tbody>
                  <tr><td>Mon–Thu</td><td>9:00 AM</td><td>6:00 PM</td><td>Always on</td></tr>
                  <tr><td>Fri</td><td>9:00 AM</td><td>8:00 PM</td><td>Always on</td></tr>
                  <tr><td>Sat</td><td>9:00 AM</td><td>6:00 PM</td><td>Always on</td></tr>
                  <tr><td>Sun</td><td>Closed</td><td>—</td><td>Voicemail + text back</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
