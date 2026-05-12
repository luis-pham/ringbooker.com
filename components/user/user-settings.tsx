import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

const userSettingsSpecificStyles = String.raw`
.settings-save-footer{
  display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:18px;padding-top:16px;
  border-top:none;flex-wrap:wrap;
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
.calendar-int-name{font-size:15px;font-weight:500;letter-spacing:-.01em;line-height:1.2}
.calendar-int-desc{font-size:12px;color:var(--text-gray);line-height:1.55;margin:0;flex:1}
.calendar-int-actions{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  margin-top:18px;padding-top:10px;border-top:1px solid rgba(15,23,42,.06);
}
.integrations-intro-note{margin-bottom:18px}
.integrations-section-heading{
  font-size:15px;font-weight:500;letter-spacing:-.01em;line-height:1.3;
  color:var(--text-dark);text-transform:none;
  margin:28px 0 12px;padding-top:20px;border-top:1px solid var(--border);
}
.integrations-section-heading--first{margin-top:10px;padding-top:0;border-top:none}
.integrations-section-lead{margin:0 0 20px;line-height:1.6;max-width:52rem}
.integrations-square-section{
  margin:28px 0 12px;padding-top:20px;border-top:1px solid var(--border);
}
.integrations-square-section--first{margin-top:10px;padding-top:0;border-top:none}
.integrations-square-section-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;min-width:0}
.integrations-square-section-logo{
  width:44px;height:44px;border-radius:12px;flex-shrink:0;
}
.integrations-square-section-logo img{width:100%;height:100%;object-fit:contain;padding:6px}
.integrations-square-section-title{margin:0;font-size:15px;font-weight:500;letter-spacing:-.01em;line-height:1.3;color:var(--text-dark)}
.integrations-square-connect-row{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;
}
.calendar-int-card--solo{max-width:100%;gap:12px}
.calendar-int-card--plain{
  border:none;
  border-radius:0;
  padding:0;
  background:transparent;
  box-shadow:none;
}
.calendar-int-card--plain:hover{
  transform:none;
  box-shadow:none;
  border-color:transparent;
}
.calendar-int-card--plain.connected-active{
  border:none;
  background:transparent;
  box-shadow:none;
}
.calendar-int-badge{
  display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;
  font-size:11px;font-weight:500;background:#f3f4f6;color:#6b7280;border:1px solid var(--border);
}
.option-card{
  border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff;transition:.18s ease;
  cursor:pointer;display:grid;gap:6px;min-width:0;
}
.option-card:hover{transform:translateY(-1px);box-shadow:var(--shadow-soft);border-color:#d8ccff}
.option-card.active{border-color:rgba(139,92,246,.55);background:linear-gradient(180deg,#faf7ff 0%,#fff 100%);box-shadow:0 0 0 4px rgba(139,92,246,.08)}
.option-card.locked{opacity:.62;cursor:not-allowed;background:#fafafa}
.option-card--bare{
  border:none;padding:0;background:transparent;cursor:default;
}
.option-card--bare:hover{transform:none;box-shadow:none}
.option-title{font-size:14px;font-weight:500;letter-spacing:-.01em}
.option-copy{font-size:12px;color:var(--text-gray);line-height:1.6}
.actions-row{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.checkbox-line{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:500;color:var(--text-dark)}
.checkbox-line input{margin:0}
.grid-span-2{grid-column:1/-1}
.grid-5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.metric-card{
  border:1px solid var(--border);border-radius:14px;background:#fff;padding:12px;
  display:grid;gap:3px;min-width:0;
}
.metric-card strong{font-size:18px;font-weight:600;color:var(--text-dark);line-height:1}
.metric-card span{font-size:11px;font-weight:500;color:var(--text-gray);line-height:1.35}
.field-label{display:grid;gap:6px;font-size:12px;font-weight:500;color:#374151}
.field-label input,.field-label select,.field-label textarea{
  width:100%;border:1px solid var(--border);border-radius:10px;background:#fff;padding:10px 12px;
  font:inherit;font-size:14px;color:var(--text-dark);box-sizing:border-box;
}
.field-label textarea{resize:vertical;min-height:42px}
.preset-pills{display:flex;flex-wrap:wrap;gap:10px}
.preset-pill{
  border:1px solid var(--border);background:#fff;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:500;color:#4b5563;
  cursor:pointer;transition:.18s ease;
}
.preset-pill.active{background:#111827;color:#fff;border-color:#111827}
.preset-pill.locked{opacity:.58;cursor:not-allowed}
.switch-list{display:grid;gap:12px}
.switch-row{
  display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
  border:1px solid var(--border);border-radius:16px;padding:15px 16px;background:var(--surface-card);
}
.switch-copy h4{margin:0 0 4px;font-size:14px;letter-spacing:-.02em}
.switch-title-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  width:100%;margin:0 0 4px;box-sizing:border-box;
}
.switch-title-row h4{margin:0;font-size:14px;letter-spacing:-.02em;line-height:1.25}
.switch-copy p{margin:0;color:var(--text-gray);font-size:12px;line-height:1.55}
.field-plan-lock-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  margin-bottom:6px;width:100%;box-sizing:border-box;
}
.field-plan-lock-head label{margin-bottom:0}
.knowledge-plan-lock-badge{flex-shrink:0;white-space:nowrap;align-self:center}
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
.hint-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hint-row .option-title{flex:1;min-width:0}
.hint-copy{font-size:12px;color:var(--text-gray);line-height:1.6}
.subtle-link{color:var(--purple-dark);font-weight:500}
button.subtle-link{font:inherit;border:none;background:none;padding:0;cursor:pointer;text-align:left}
button.subtle-link:hover{text-decoration:underline}
.integrations-path-picker{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 18px}
.integrations-path-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 10px}
.integrations-inline-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;width:100%;margin-top:4px}
.integrations-booking-link-card.calendar-int-card--plain .integrations-booking-link-actions.calendar-int-actions{
  border-top:none;margin-top:0;padding-top:0;
}
.integrations-booking-link-stack{display:grid;gap:10px;width:100%;max-width:min(100%,36rem)}
.integrations-booking-link-field{margin-bottom:0}
.integrations-booking-link-card > .integrations-booking-link-field{margin-bottom:12px}
@media (min-width:861px){
  .integrations-booking-link-card .integrations-booking-link-field select,
  .integrations-booking-link-card .integrations-booking-link-field input{
    width:100%;max-width:min(100%,420px);box-sizing:border-box;
  }
  .integrations-vagaro-form .field input:not([type="checkbox"]):not([type="radio"]),
  .integrations-vagaro-form .field select{
    width:100%;max-width:min(100%,420px);box-sizing:border-box;
  }
}
.integrations-vagaro-block{margin-top:6px;display:flex;flex-direction:column;gap:22px}
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
  display:flex;flex-direction:row;align-items:center;gap:10px;text-align:left;
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
.tab-button-body{display:flex;align-items:center;min-width:0}
.tab-button strong{font-size:14px;font-weight:600;letter-spacing:-.02em;line-height:1.25}
/* Knowledge: desktop = underline tabs like /user/calls; mobile = original icon grid (see .knowledge-tabs-*) */
.knowledge-tabs-desktop-only{display:none}
.knowledge-tabs-mobile-only{display:block}
@media (min-width:861px){
  .knowledge-tabs-desktop-only{display:block}
  .knowledge-tabs-mobile-only{display:none !important}
}
.knowledge-portal-tab-bar{margin-bottom:18px;min-width:0}
.business-subtabs.calls-filter-tabs{
  display:flex;gap:18px;flex-wrap:nowrap;align-items:flex-end;
  margin-bottom:0;border-bottom:1px solid var(--border);
  overflow-x:auto;overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior-x:contain;
  scrollbar-width:none;
}
.business-subtabs.calls-filter-tabs::-webkit-scrollbar{display:none}
.business-subtabs.calls-filter-tabs .business-subtab{
  flex:0 0 auto;white-space:nowrap;
  appearance:none;background:transparent;border:none;border-radius:0;margin:0;
  padding:12px 0 9px;font-size:14px;line-height:1.35;font-weight:500;color:var(--text-gray);
  cursor:pointer;font:inherit;box-shadow:none;border-bottom:2px solid transparent;
  transition:color .15s ease,border-color .15s ease,font-weight .15s ease;
}
/* Neutral tab hovers must win over generic .business-subtab pill styles (same as /user/calls) */
.business-subtabs.calls-filter-tabs .business-subtab:hover{
  color:var(--text-dark);
  background:transparent;
  border-color:transparent;
}
.business-subtabs.calls-filter-tabs .business-subtab:focus-visible{
  outline:2px solid var(--purple-dark);outline-offset:3px;
}
.business-subtabs.calls-filter-tabs .business-subtab.active{
  color:var(--purple-dark);font-weight:500;letter-spacing:-.01em;border-bottom-color:var(--purple-dark);
}
.business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  color:var(--purple-dark);
  background:transparent;
  border-color:transparent;
}
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
.knowledge-tab-panel-head{
  align-items:flex-start;
  margin-bottom:12px;
}
.knowledge-tab-panel-head h3{
  margin:0;
  font-size:20px;
  font-weight:600;
  letter-spacing:-.02em;
  color:var(--text-dark);
}
.knowledge-tab-panel-head .sub{
  margin-top:6px;
}
/* Integrations cards sit on purple-tinted “connected” panels — keep primary CTAs clearly black */
.calendar-int-card .btn.user-save,
.integrations-vagaro-booking-actions .btn.user-save,
.integrations-vagaro-primary-actions .btn.user-save,
.calendar-int-card .integrations-inline-actions .btn.user-save,
.integrations-primary-button{
  background:#0d1117;color:#fff;border-color:#0d1117;font-weight:600;
}
.calendar-int-card .btn.user-save:hover:not(:disabled),
.integrations-vagaro-booking-actions .btn.user-save:hover:not(:disabled),
.integrations-vagaro-primary-actions .btn.user-save:hover:not(:disabled),
.calendar-int-card .integrations-inline-actions .btn.user-save:hover:not(:disabled),
.integrations-primary-button:hover:not(:disabled){
  background:#161b22;border-color:#161b22;color:#fff;
}
.card-section-form{
  border:none;border-radius:0;padding:0;background:transparent;
}
.settings-tab-content-frame{
  width:100%;
  box-sizing:border-box;
}
.settings-business-profile-layout{
  display:grid;
  grid-template-columns:minmax(0,1fr) 340px;
  gap:32px;
  align-items:start;
}
.settings-business-profile-form{min-width:0}
.settings-business-profile-helper{
  display:flex;
  flex-direction:column;
  gap:14px;
  min-width:0;
}
.settings-helper-card{
  border:1px solid var(--border);
  border-radius:14px;
  background:#fff;
  padding:20px;
}
.settings-helper-card h4{
  margin:0 0 12px;
  font-size:15px;
  font-weight:600;
  letter-spacing:-.01em;
  color:var(--text-dark);
}
.settings-helper-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}
.settings-helper-list li{
  position:relative;
  padding-left:16px;
  color:var(--text-gray);
  font-size:13px;
  line-height:1.5;
}
.settings-helper-list li::before{
  content:'';
  position:absolute;
  left:0;
  top:.52em;
  width:7px;
  height:7px;
  border-radius:999px;
  background:var(--purple-dark);
}
.settings-helper-progress-label{
  margin:0 0 8px;
  font-size:13px;
  color:var(--text-dark);
  font-weight:600;
}
.settings-helper-progress-track{
  height:8px;
  border-radius:999px;
  background:#ede9fe;
  overflow:hidden;
  margin-bottom:12px;
}
.settings-helper-progress-fill{
  display:block;
  height:100%;
  border-radius:999px;
  background:var(--purple-dark);
}
.settings-helper-checklist{display:grid;border-top:1px solid #f0f1f3}
.settings-helper-checklist > div{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 0;
  border-bottom:1px solid #f0f1f3;
  font-size:12px;
  line-height:1.45;
}
.settings-helper-checklist > div:last-child{border-bottom:none}
.settings-helper-checklist > div > span:first-child{color:var(--text-gray)}
.settings-helper-checklist > div.done > span:last-child{color:#047857;font-weight:600}
.settings-helper-checklist > div.warn > span:last-child{color:#b45309;font-weight:600}
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
.hours-day{font-size:13px;font-weight:500}
.inline-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-gray);font-weight:500}
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
.small-field label{display:block;font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
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

/* Services & Hours — catalog, active services table, weekly grid */
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
.sh-catalog-name{margin:0;font-size:15px;font-weight:500;letter-spacing:-.01em;line-height:1.25;color:var(--text-dark)}
.sh-catalog-desc{margin:0;font-size:13px;line-height:1.5;color:var(--text-gray)}
.sh-catalog-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
.sh-catalog-badge{
  font-size:11px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;
  padding:4px 9px;border-radius:999px;background:#ecfdf5;color:#047857;border:1px solid #bbf7d0;
}
.sh-catalog-badge.off{background:#f9fafb;color:#6b7280;border-color:#e5e7eb}
.sh-catalog-action{
  flex-shrink:0;height:34px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:500;
  border:1px solid var(--border);background:#fff;color:var(--text-dark);cursor:pointer;font:inherit;
  transition:background .15s ease,border-color .15s ease,color .15s ease;
}
.sh-catalog-action:hover{background:#f9fafb;border-color:#d1d5db}
.sh-catalog-action.primary{background:var(--purple-dark);color:#fff;border-color:var(--purple-dark)}
.sh-catalog-action.primary:hover{background:#5609c4;border-color:#5609c4;color:#fff}

.sh-active-section{margin-top:22px;padding-top:22px;border-top:1px solid rgba(15,23,42,.08)}
.sh-active-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.sh-active-label{margin:0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray)}
.sh-active-hint{margin:0;font-size:13px;color:var(--text-gray);line-height:1.45}
.sh-empty{
  padding:22px 18px;border-radius:14px;border:1px dashed #d1d5db;background:#fafafa;
  font-size:14px;line-height:1.55;color:var(--text-gray);text-align:center;
}
.faq-empty-state p{margin:0}
.faq-empty-state .faq-empty-cta{margin-top:16px;margin-bottom:0}
.staff-empty{
  display:grid;justify-items:center;gap:8px;padding:42px 22px;margin-bottom:8px;
  background:#fff;border:1px dashed #d1d5db;border-radius:16px;color:var(--text-gray);
}
.staff-empty-icon{color:#9ca3af;opacity:.7;line-height:0}
.staff-empty strong{font-size:18px;font-weight:600;letter-spacing:-.02em;color:#3f3f46}
.staff-empty p{margin:0 0 14px;font-size:16px;line-height:1.45;color:#52525b}
.staff-empty-add{justify-self:center;margin-top:16px}
.staff-card{
  background:#fff;border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden;
  transition:border-color .15s ease,opacity .15s ease,box-shadow .15s ease;
}
.staff-card:hover{border-color:#d1d5db;box-shadow:0 2px 10px rgba(15,23,42,.04)}
.staff-card.inactive{opacity:.58}
.staff-card-main{
  display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;outline:none;
}
.staff-card-main:focus-visible{box-shadow:0 0 0 3px rgba(139,92,246,.18)}
.staff-avatar{
  width:38px;height:38px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:14px;font-weight:600;flex-shrink:0;
}
.staff-avatar-1{background:#7c3aed}
.staff-avatar-2{background:#0ea5e9}
.staff-avatar-3{background:#10b981}
.staff-avatar-4{background:#f59e0b}
.staff-info{flex:1;min-width:0}
.staff-name{font-size:15px;font-weight:500;color:var(--text-dark);letter-spacing:-.01em}
.staff-name span{font-size:12px;font-weight:500;color:var(--text-gray)}
.staff-role{font-size:13px;color:var(--text-gray);margin-top:2px}
.staff-spec-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.staff-spec{padding:3px 8px;background:#f5f3ee;border-radius:999px;font-size:12px;color:#52525b}
.staff-card-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
.staff-section-toolbar{display:flex;justify-content:flex-end;margin-bottom:14px}
.staff-toggle{
  width:36px;height:20px;border-radius:999px;border:0;position:relative;cursor:pointer;flex-shrink:0;
  transition:background .15s ease;
}
.staff-toggle.on{background:var(--purple-dark)}
.staff-toggle.off{background:#d4d4d8}
.staff-toggle::after{
  content:'';position:absolute;top:2px;width:16px;height:16px;border-radius:999px;background:#fff;
  transition:left .15s ease;
}
.staff-toggle.on::after{left:18px}
.staff-toggle.off::after{left:2px}
.staff-chevron{font-size:18px;line-height:1;color:var(--text-gray);width:18px;text-align:center}
.staff-card-detail{
  border-top:1px solid var(--border);padding:16px;background:#fafafa;
}
.staff-card-detail .form-grid{margin:0}
.staff-detail-actions{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.sh-active-table{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff}
.sh-active-thead{
  display:grid;grid-template-columns:minmax(0,1fr) 132px 112px;gap:14px;
  padding:11px 18px;background:#f9fafb;border-bottom:1px solid var(--border);
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray);
}
.sh-active-row{
  display:grid;grid-template-columns:minmax(0,1fr) 132px 112px;gap:14px;
  padding:14px 18px;align-items:center;border-bottom:1px solid #f0f1f3;
}
.sh-active-row:last-child{border-bottom:none}
.sh-active-service{font-size:14px;font-weight:500;color:var(--text-dark);letter-spacing:-.01em}
.sh-active-row .small-field{margin-bottom:0}
.sh-active-row .small-field label{font-size:10px;margin-bottom:6px}

.service-catalog-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:nowrap}
.service-catalog-heading h3{margin:0 0 6px;font-size:20px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark)}
.service-catalog-actions{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto}
.service-catalog-actions .btn{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.service-catalog-actions .btn svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.service-group-list{display:grid;gap:16px}
.service-group-card{border:1px solid var(--border);border-radius:16px;background:var(--surface-card);overflow:hidden}
.service-group-card summary{cursor:pointer;list-style:none;padding:15px 17px;background:#f9fafb;border-bottom:1px solid var(--border)}
.service-group-card summary::-webkit-details-marker{display:none}
.service-group-card summary div{display:flex;align-items:center;justify-content:space-between;gap:14px}
.service-group-card summary strong{font-size:16px;font-weight:600;color:var(--text-dark);letter-spacing:-.02em}
.service-group-card summary span{font-size:13px;color:var(--text-gray);font-weight:500}
.service-group-card summary div strong{margin-right:auto}
.service-group-body{display:grid;gap:0;padding:28px 24px 20px}
.service-group-card--compact{
  border:1px solid var(--border);
  border-radius:16px;
  box-shadow:none;
}
.service-group-card--compact summary{
  padding:18px 24px;
  background:#f9fafb;
  border-bottom:1px solid var(--border);
}
.service-group-card--compact summary div{gap:12px}
.service-group-summary-inner{width:100%}
.service-group-card--compact summary strong{
  font-size:15px;
  font-weight:600;
  line-height:1.25;
  letter-spacing:-.02em;
  color:var(--text-dark);
}
.service-group-card--compact summary span{
  font-size:13px;
  font-weight:500;
  line-height:1.25;
  color:var(--text-gray);
}
.service-group-count{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
.service-group-count svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;transition:transform .16s ease}
.service-group-card[open] .service-group-count svg{transform:rotate(180deg)}
.service-group-card--compact .service-group-body{
  padding:26px 24px 20px;
  background:#fff;
}
.service-item-card{display:grid;gap:14px;border:1px solid rgba(15,23,42,.08);border-radius:16px;padding:15px;background:#fff}
.service-item-card.archived{opacity:.62;background:#f9fafb}
.service-item-head{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(180px,.8fr);gap:14px}
.service-item-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.service-summary-item{border-bottom:1px solid var(--border)}
.service-summary-item:last-of-type{border-bottom:0}
.service-summary-item.archived{opacity:.62}
.service-summary-row{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;align-items:center;gap:14px;padding:11px 0}
.service-summary-name{font-size:15px;font-weight:500;color:#000;letter-spacing:-.01em}
.service-summary-meta{font-size:13px;font-weight:500;color:#3f3f46;white-space:nowrap;text-align:right}
.service-edit-icon{width:30px;height:30px;border:0;background:transparent;color:var(--text-gray);display:inline-flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer}
.service-edit-icon:hover{background:#f3f4f6;color:var(--text-dark)}
.service-edit-icon svg{stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.service-inline-editor{display:grid;gap:14px;margin:8px 0 18px;padding:16px;border:1px solid var(--border);border-radius:16px;background:#fff}
.service-group-card .service-group-add-service{margin-top:16px}
.service-variants-editor{display:grid;gap:10px;margin-top:6px}
.service-variant-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 90px 130px auto;gap:8px;align-items:center}
.service-variant-row input,.service-variant-row select{min-height:38px}
.field-help{margin:0 0 8px;color:var(--text-muted);font-size:13px;line-height:1.4}
@media(max-width:760px){.service-variant-row{grid-template-columns:1fr 1fr}.service-variant-row .subtle-link{justify-self:start}}
.inline-check{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--text-dark)}
.inline-check input{width:16px;height:16px}
.service-catalog-note{font-size:13px;line-height:1.55;color:var(--text-gray);padding:12px 14px;background:#f9fafb;border:1px solid var(--border);border-radius:12px}
.service-catalog-empty{text-align:left}

.sh-hours-intro{margin-bottom:18px}
.sh-hours-presets{margin-bottom:18px}
.sh-hours-presets-label{margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray)}
.sh-hours-presets .preset-pills{margin-bottom:0}

.sh-hours-wrap{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#fff}
.sh-hours-thead{
  display:grid;
  grid-template-columns:minmax(108px,1.1fr) minmax(92px,0.95fr) minmax(92px,0.95fr) minmax(120px,auto);
  gap:12px;padding:11px 16px;background:#f9fafb;border-bottom:1px solid var(--border);
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-gray);
}
.sh-hours-wrap .hours-grid{border:none;border-radius:inherit}
.sh-hours-wrap .hours-row{
  grid-template-columns:minmax(108px,1.1fr) minmax(92px,0.95fr) minmax(92px,0.95fr) minmax(120px,auto);
  padding:12px 16px;border-radius:0;align-items:center;
}
.sh-hours-wrap .hours-row.closed{opacity:.72}
.sh-hours-wrap .hours-day{font-size:13px;font-weight:500;color:var(--text-dark)}
.sh-hours-wrap .small-field{margin-bottom:0}
.sh-hours-wrap .small-field label{display:none}
@media (min-width:1024px){
  .card-section-form > .settings-tab-content-frame{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
  }
  .integrations-main-frame{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
  }
  .knowledge-portal-main .card-section-form > .settings-tab-content-frame{
    width:100%;
    max-width:100%;
    box-sizing:border-box;
  }
  .knowledge-portal-main .page-title p{
    max-width:none;
    white-space:nowrap;
  }
}
@media (min-width:861px){
  .service-item-head.service-item-head--catalog-pair{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:16px;
  }
}

.plan-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;background:#f5f3ff;color:var(--purple-dark);font-size:11px;font-weight:500}
.upgrade-panel{background:linear-gradient(135deg,#f7f3ff,#fff);border:1px dashed rgba(99,14,212,.28)}

html[data-user-theme="dark"] .settings-save-footer{border-top:none}
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
html[data-user-theme="dark"] .calendar-int-card--plain,
html[data-user-theme="dark"] .calendar-int-card--plain:hover,
html[data-user-theme="dark"] .calendar-int-card--plain.connected-active{
  background:transparent;
  border-color:transparent;
  box-shadow:none;
}
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
html[data-user-theme="dark"] .option-card--bare{background:transparent}
html[data-user-theme="dark"] .option-card--bare:hover{border-color:transparent}
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
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab{color:var(--text-gray)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab:hover{
  color:var(--text-dark);
  background:transparent;
  border-color:transparent;
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active{
  color:var(--purple-dark);border-bottom-color:var(--purple-dark);
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  color:var(--purple-dark);
  background:transparent;
  border-color:transparent;
  border-bottom-color:var(--purple-dark);
}
html[data-user-theme="dark"] .business-subtab{background:var(--surface-card);border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .business-subtab:hover{background:#21262d;color:var(--text-dark)}
html[data-user-theme="dark"] .business-subtab.active{
  background:#1f6feb;
  color:#fff;
  border-color:#1f6feb;
  font-weight:600;
}
html[data-user-theme="dark"] .business-subtab.active:hover{
  background:#8957e5;
  border-color:#8957e5;
  color:#fff;
}
html[data-user-theme="dark"] .calendar-int-card .btn.user-save,
html[data-user-theme="dark"] .integrations-vagaro-booking-actions .btn.user-save,
html[data-user-theme="dark"] .integrations-vagaro-primary-actions .btn.user-save,
html[data-user-theme="dark"] .calendar-int-card .integrations-inline-actions .btn.user-save,
html[data-user-theme="dark"] .integrations-primary-button{
  background:#1f6feb;
  color:#fff;
  border-color:#1f6feb;
  font-weight:600;
}
html[data-user-theme="dark"] .calendar-int-card .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .integrations-vagaro-booking-actions .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .integrations-vagaro-primary-actions .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .calendar-int-card .integrations-inline-actions .btn.user-save:hover:not(:disabled),
html[data-user-theme="dark"] .integrations-primary-button:hover:not(:disabled){
  background:#8957e5;
  border-color:#8957e5;
  color:#fff;
}
html[data-user-theme="dark"] .hours-grid{border-color:var(--border);background:var(--surface-card)}
html[data-user-theme="dark"] .hours-row{background:var(--surface-card);border-bottom-color:var(--border)}
html[data-user-theme="dark"] .hours-row.closed{background:#0d1117}
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
html[data-user-theme="dark"] .settings-helper-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .settings-helper-progress-track{background:rgba(99,14,212,.24)}
html[data-user-theme="dark"] .settings-helper-checklist{border-top-color:var(--border)}
html[data-user-theme="dark"] .settings-helper-checklist > div{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .settings-helper-checklist > div.done > span:last-child{color:#3fb950}
html[data-user-theme="dark"] .settings-helper-checklist > div.warn > span:last-child{color:#d29922}
html[data-user-theme="dark"] .staff-empty{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .staff-empty strong{color:var(--text-dark)}
html[data-user-theme="dark"] .staff-empty p{color:var(--text-gray)}
html[data-user-theme="dark"] .staff-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .staff-card:hover{border-color:#58a6ff;box-shadow:none}
html[data-user-theme="dark"] .staff-spec{background:#21262d;color:var(--text-gray)}
html[data-user-theme="dark"] .staff-card-detail{background:#0d1117;border-top-color:var(--border)}
html[data-user-theme="dark"] .sh-active-section{border-top-color:var(--border)}
html[data-user-theme="dark"] .sh-active-table{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-active-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-active-row{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-wrap{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-active-row .sh-active-service{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .service-group-card summary{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact{border-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact summary{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact summary strong{color:var(--text-dark)}
html[data-user-theme="dark"] .service-group-card--compact summary span{color:var(--text-gray)}
html[data-user-theme="dark"] .service-group-card--compact summary div::before{background:#0d1117;border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .service-group-card--compact .service-group-body{background:var(--surface-card)}
html[data-user-theme="dark"] .service-item-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .service-item-card.archived{background:#161b22}
html[data-user-theme="dark"] .service-summary-name{color:var(--text-dark)}
html[data-user-theme="dark"] .service-summary-meta{color:var(--text-gray)}
html[data-user-theme="dark"] .service-inline-editor{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .service-catalog-note{background:#161b22;border-color:var(--border)}
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
  .integrations-portal-main .topbar{
    margin:0 0 10px;
    padding:8px 18px 6px;
    min-height:auto;
  }
  .settings-business-profile-layout{grid-template-columns:1fr}
  .settings-business-profile-helper{display:none}
  .grid-3,.grid-4,.grid-5,.option-grid,.calendar-int-grid,.services-grid,.service-controls{grid-template-columns:1fr}
  .user-app-shell .grid.grid-3,.user-app-shell .grid.grid-4,.user-app-shell .grid.grid-5{grid-template-columns:1fr}
  .tab-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .tab-button{
    flex-direction:column;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:11px 10px;
    gap:4px;
  }
  .tab-button-icon{width:30px;height:30px;border-radius:10px}
  .tab-button-icon svg{width:20px;height:20px}
  .tab-button-body{
    align-items:center;
    justify-content:center;
    width:100%;
    text-align:center;
  }
  .tab-button-body strong{
    display:block;
    width:100%;
    text-align:center;
  }
  .tab-button strong{font-size:11px;font-weight:600;line-height:1.25}
  .hours-row{grid-template-columns:1fr}
  .business-subtabs:not(.calls-filter-tabs){
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    flex-wrap:unset;
  }
  .business-subtabs:not(.calls-filter-tabs):has(> :nth-child(3):last-child) > .business-subtab:nth-child(3){
    grid-column:1 / -1;
  }
  .business-subtabs:not(.calls-filter-tabs) > .business-subtab{
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:10px 12px;
    font-size:12px;
    font-weight:650;
    min-width:0;
    width:100%;
    box-sizing:border-box;
  }
  /* Underline filter tabs (Calls / Knowledge desktop): horizontal row, compact chips */
  .business-subtabs.calls-filter-tabs{
    display:flex!important;
    flex-direction:row!important;
    flex-wrap:nowrap!important;
    align-items:flex-end!important;
    gap:12px!important;
    width:100%!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    -webkit-overflow-scrolling:touch!important;
    scrollbar-width:none!important;
  }
  .business-subtabs.calls-filter-tabs::-webkit-scrollbar{display:none}
  .business-subtabs.calls-filter-tabs .business-subtab{
    flex:0 0 auto!important;
    width:auto!important;
    max-width:none!important;
    padding:12px 0 9px!important;
    border:none!important;
    border-radius:0!important;
    background:transparent!important;
    border-bottom:2px solid transparent!important;
    font-size:14px!important;
    font-weight:500!important;
    text-align:left!important;
    justify-content:flex-start!important;
  }
  .business-subtabs.calls-filter-tabs .business-subtab.active{
    border-bottom-color:var(--purple-dark)!important;
    color:var(--purple-dark)!important;
    font-weight:500!important;
  }
  .knowledge-portal-main .knowledge-tabs-mobile-only.tab-strip{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:10px!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    box-sizing:border-box!important;
  }
  .knowledge-portal-main .knowledge-tabs-mobile-only .tab-button{
    min-width:0!important;
    width:100%!important;
    max-width:100%!important;
    box-sizing:border-box!important;
  }
  .user-app-shell .settings-save-footer{
    flex-direction:column;
    align-items:stretch;
    justify-content:flex-start;
  }
  .user-app-shell .settings-save-footer > .btn,
  .user-app-shell .settings-save-footer > button.btn{
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
  .user-app-shell .actions-row{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .actions-row > .btn,
  .user-app-shell .actions-row > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .integrations-inline-actions{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .integrations-inline-actions > .btn,
  .user-app-shell .integrations-inline-actions > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .integrations-vagaro-booking-actions,
  .user-app-shell .integrations-vagaro-primary-actions{
    display:flex;
    flex-direction:column;
    align-items:stretch;
    gap:10px;
  }
  .user-app-shell .integrations-vagaro-booking-actions .btn,
  .user-app-shell .integrations-vagaro-booking-actions button.btn,
  .user-app-shell .integrations-vagaro-primary-actions .btn,
  .user-app-shell .integrations-vagaro-primary-actions button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .calendar-int-actions{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .calendar-int-actions > .btn,
  .user-app-shell .calendar-int-actions > a.btn,
  .user-app-shell .calendar-int-actions > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .integrations-square-connect-row{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .integrations-square-connect-row > .btn,
  .user-app-shell .integrations-square-connect-row > a.btn,
  .user-app-shell .integrations-square-connect-row > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .user-app-shell .integrations-path-picker{
    flex-direction:column;
    align-items:stretch;
  }
  .user-app-shell .integrations-path-picker > .btn,
  .user-app-shell .integrations-path-picker > button.btn{
    width:100%;
    box-sizing:border-box;
    justify-content:center;
    min-height:48px;
    height:auto;
  }
  .card-section-form{padding:0}
  .sh-catalog-grid{grid-template-columns:1fr}
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
  .service-catalog-heading{display:grid;gap:12px}
  .service-catalog-actions{display:grid;grid-template-columns:1fr;width:100%}
  .service-item-head{grid-template-columns:1fr}
  .sh-hours-thead{display:none}
  .sh-hours-wrap{border:none;border-radius:0;background:transparent;overflow:visible}
  .sh-hours-wrap .hours-grid{display:grid;gap:18px;background:transparent}
  .sh-hours-wrap .hours-row{
    grid-template-columns:minmax(0,1fr) minmax(0,1fr) 64px;
    grid-template-areas:
      "day day day"
      "open close closed";
    gap:8px 10px;
    padding:0;
    border-bottom:none;
    background:transparent;
  }
  .sh-hours-wrap .hours-day{grid-area:day;min-width:0}
  .sh-hours-wrap .hours-row .small-field:nth-of-type(1){grid-area:open}
  .sh-hours-wrap .hours-row .small-field:nth-of-type(2){grid-area:close}
  .sh-hours-wrap .small-field label{display:block}
  .sh-hours-wrap .small-field{margin-bottom:0}
  .sh-hours-wrap .hours-row .inline-check{
    grid-area:closed;
    display:grid;
    grid-template-rows:auto 40px;
    align-items:end;
    justify-items:center;
    gap:8px;
    margin:0;
    min-width:0;
  }
  .sh-hours-wrap .hours-row .inline-check input{align-self:center}
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
