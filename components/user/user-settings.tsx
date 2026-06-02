import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';
import { userPortalTypographyStyles } from '@/components/user/user-portal-typography';

const userSettingsSpecificStyles = String.raw`
html{
  --warning-text:#b45309;
  --success-text:#16a34a;
  --danger-text:#dc2626;
}
html[data-user-theme="dark"]{
  --warning-text:#d29922;
  --success-text:#3fb950;
  --danger-text:#f85149;
}
.settings-save-footer{
  display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:18px;padding-top:16px;
  border-top:none;flex-wrap:wrap;
}
.settings-save-footer > .btn.user-save,
.settings-save-footer > button.btn.user-save{
  min-height:48px;height:auto;padding:14px 18px;font-size:15px;font-weight:500;line-height:1.2;box-sizing:border-box;
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
.calendar-int-card:hover{
  transform:none;
  box-shadow:none;
  background:var(--bg-gray);
  border-color:var(--border);
}
.calendar-int-card.connected-active:hover{
  background:var(--bg-gray);
  border-color:rgba(139,92,246,.5);
  box-shadow:none;
}
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
.knowledge-lang-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.knowledge-lang-chip{
  display:inline-flex;align-items:center;gap:6px;
  border:1.5px solid var(--color-border-tertiary,#e2e8f0);border-radius:20px;
  padding:7px 14px;background:transparent;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:13px;font-weight:400;cursor:pointer;font:inherit;
  transition:border-color .15s ease,color .15s ease;
}
.knowledge-lang-chip.active{
  border-color:#534AB7;color:#3C3489;font-weight:500;background:transparent;
}
.knowledge-lang-chip.required:disabled{opacity:1;cursor:default}
.knowledge-lang-chip-check{
  width:14px;height:14px;border-radius:3px;flex-shrink:0;
  border:1.5px solid var(--color-border-secondary,#d1d5db);
  box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
}
.knowledge-lang-chip.active .knowledge-lang-chip-check{
  border-color:#534AB7;background:#534AB7;border-width:0;
}
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
.settings-sms-grid{display:grid;gap:16px}
.settings-sms-panel{
  border:0;border-radius:0;background:#fff;padding:20px 0 0;display:grid;gap:12px;
}
.settings-sms-panel > h4{
  margin:0;color:#374151;font-size:12px;font-weight:700;letter-spacing:.08em;
}
.settings-sms-panel .field{margin:0}
.ai-behavior-shell.card{
  border:none;
  background:transparent;
  padding:0;
}
.ai-behavior-tab{
  display:grid;
  gap:16px;
}
.ai-behavior-tab .card{
  border:none;
  background:transparent;
  padding:0;
}
.ai-behavior-section-card{
  border:.5px solid var(--color-border-tertiary,var(--border));
  border-radius:var(--border-radius-lg,14px);
  background:var(--color-background-primary,var(--surface-card,#fff));
  overflow:hidden;
  box-sizing:border-box;
}
.ai-behavior-field{
  padding:12px 14px;
  box-sizing:border-box;
}
.ai-behavior-field + .ai-behavior-field{
  border-top:.5px solid var(--color-border-tertiary,var(--border));
}
.ai-behavior-toggle-row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
}
.ai-behavior-toggle-row .switch{
  flex-shrink:0;
  margin-top:2px;
}
.ai-behavior-toggle-row.locked .ai-behavior-copy{
  opacity:.62;
}
.ai-behavior-toggle-row--inline-control{
  align-items:center;
}
.ai-behavior-copy{
  min-width:0;
  flex:1 1 auto;
}
.ai-behavior-copy h4,
.ai-behavior-returning-head h4{
  margin:0 0 4px;
  font-size:14px;
  font-weight:600;
  letter-spacing:-.01em;
  color:var(--color-text-primary,var(--text-dark));
}
.ai-behavior-copy p,
.ai-behavior-sub{
  margin:0;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:12px;
  line-height:1.55;
}
.ai-behavior-title-row,
.ai-behavior-returning-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  min-width:0;
}
.ai-behavior-field-label,
.ai-behavior-tab .field label.ai-behavior-field-label{
  display:block;
  margin:0 0 6px;
  font-size:11px;
  font-weight:500;
  color:var(--color-text-secondary,var(--text-gray));
  text-transform:none;
  letter-spacing:0;
}
.ai-behavior-tab .field{
  margin:0;
}
.ai-behavior-tab .field input,
.ai-behavior-tab .field select,
.ai-behavior-tab .field textarea{
  font-size:16px;
  border:.5px solid var(--color-border-secondary,var(--border));
  border-radius:var(--border-radius-md,10px);
}
.ai-behavior-tab .field textarea{
  min-height:96px;
}
.ai-behavior-chip-row{
  gap:8px;
}
.ai-behavior-tab .ai-behavior-chip-row .preset-pill.active{
  background:#111;
  color:#fff;
  border-color:#111;
}
.ai-behavior-radio-group{
  display:grid;
  gap:8px;
}
.ai-behavior-radio-option{
  display:flex;
  align-items:center;
  gap:9px;
  width:100%;
  border:.5px solid var(--color-border-secondary,var(--border));
  border-radius:var(--border-radius-md,10px);
  background:var(--color-background-primary,var(--surface-card,#fff));
  color:var(--color-text-primary,var(--text-dark));
  padding:10px 12px;
  font:inherit;
  font-size:13px;
  text-align:left;
  cursor:pointer;
}
.ai-behavior-radio-option > span{
  width:14px;
  height:14px;
  border-radius:999px;
  border:1.5px solid var(--color-border-secondary,var(--border));
  box-sizing:border-box;
  flex-shrink:0;
}
.ai-behavior-radio-option.active{
  border-color:#111;
}
.ai-behavior-radio-option.active > span{
  border:4px solid #111;
}
.ai-behavior-success,
.ai-behavior-warning{
  margin:0 0 6px;
  font-size:12px;
  line-height:1.45;
}
.ai-behavior-success{color:var(--success-text,#16a34a)}
.ai-behavior-warning{color:var(--warning-text,#b45309)}
.ai-behavior-error{
  color:var(--danger-text,#dc2626);
  font-size:12px;
}
.ai-behavior-inline-actions{
  margin-top:12px;
}
.ai-behavior-pro-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  border:.5px solid #C0DD97;
  border-radius:999px;
  background:#EAF3DE;
  color:#3B6D11;
  padding:4px 9px;
  font-size:11px;
  font-weight:600;
  line-height:1;
}
.ai-behavior-group{
  display:grid;
  gap:8px;
}
.ai-behavior-group-label{
  color:var(--color-text-secondary,var(--text-gray));
  font-size:11px;
  font-weight:500;
  margin-bottom:0;
  text-transform:uppercase;
}
.ai-behavior-info-row{
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:12px;
  line-height:1.45;
}
.ai-behavior-info-row svg{
  flex-shrink:0;
}
.ai-behavior-inline-control{
  display:flex;
  align-items:center;
  gap:6px;
  flex-shrink:0;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:12px;
  font-weight:500;
  white-space:nowrap;
}
.ai-behavior-inline-control select,
.ai-behavior-inline-control input{
  width:auto;
  min-height:32px;
  padding:6px 10px;
  border:.5px solid var(--color-border-secondary,var(--border));
  border-radius:var(--border-radius-md,10px);
  background:var(--color-background-primary,var(--surface-card,#fff));
  color:var(--color-text-primary,var(--text-dark));
  font:inherit;
  font-size:13px;
  line-height:1.2;
  box-sizing:border-box;
}
.ai-behavior-inline-control input[type="time"]{
  width:100px;
}
.ai-behavior-time-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}
.ai-behavior-caption{
  border-top:.5px solid var(--color-border-tertiary,var(--border));
  margin:0;
  padding:12px 14px;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:12px;
  line-height:1.5;
}
.ai-behavior-save-footer{
  display:flex;
  justify-content:flex-end;
  padding:0;
}
.ai-behavior-save-footer.settings-save-footer > .btn.user-save{
  padding:10px 24px;
}
.ai-behavior-quiet-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
}
.ai-behavior-quiet-time-group{
  display:flex;
  align-items:center;
  gap:6px;
  flex-shrink:0;
}
.ai-behavior-quiet-time-item{
  display:flex;
  align-items:center;
  gap:6px;
  color:var(--color-text-secondary,var(--text-gray));
  font-size:12px;
  font-weight:500;
  white-space:nowrap;
}
.ai-behavior-quiet-time-item input{
  width:100px;
  min-height:32px;
  padding:6px 10px;
  border:.5px solid var(--color-border-secondary,var(--border));
  border-radius:var(--border-radius-md,10px);
  background:var(--color-background-primary,var(--surface-card,#fff));
  color:var(--color-text-primary,var(--text-dark));
  font:inherit;
  font-size:13px;
  line-height:1.2;
  box-sizing:border-box;
}
.ai-behavior-quiet-arrow{
  color:var(--color-text-secondary,var(--text-gray));
  font-size:14px;
  line-height:1;
}
@media (max-width:860px){
  .ai-behavior-toggle-row--inline-control,
  .ai-behavior-quiet-row,
  .ai-behavior-quiet-time-group{
    flex-wrap:wrap;
  }
  .ai-behavior-inline-control select,
  .ai-behavior-inline-control input,
  .ai-behavior-quiet-time-item input{
    font-size:16px;
  }
  .ai-behavior-save-footer{
    justify-content:stretch;
  }
  .user-app-shell .ai-behavior-save-footer.settings-save-footer > .btn.user-save{
    width:100%;
    padding:12px;
  }
  .ai-behavior-time-grid{
    grid-template-columns:1fr;
  }
}
.hint-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hint-row .option-title{flex:1;min-width:0}
.hint-copy{font-size:12px;color:var(--text-gray);line-height:1.6}
/* Link styles: user-portal-typography.ts (.user-link / .user-link--subtle / .subtle-link) */
.remove-link{display:inline-flex;align-items:center;justify-content:center;gap:6px}
.remove-link svg{flex-shrink:0}
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
.integrations-redesign{display:grid;gap:18px}
.integrations-redesign-head{margin-bottom:0}
.integrations-flow-stack{display:grid;gap:16px}
.integrations-flow-title{margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark)}
.integrations-flow-sub{margin-top:6px!important;margin-bottom:0!important}
.integrations-method-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.integration-method-card{
  border:1px solid var(--border);background:var(--surface-card);border-radius:12px;
  padding:14px;display:flex;align-items:flex-start;gap:12px;text-align:left;cursor:pointer;
  font:inherit;color:var(--text-dark);transition:background .15s ease,border-color .15s ease;
}
.integration-method-card:hover{background:var(--bg-gray);border-color:var(--border)}
.integration-method-card:disabled{cursor:not-allowed;opacity:.72}
.integration-method-icon{
  width:44px;height:44px;border-radius:14px;background:transparent;
  display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
  color:var(--color-text-secondary,var(--text-gray));
}
.integration-method-card[aria-pressed="true"] .integration-method-icon{
  color:var(--starter-method-selected-icon,#534AB7);
}
.integration-method-loading{margin-left:auto;animation:integration-spin .9s linear infinite;color:var(--text-gray)}
@keyframes integration-spin{to{transform:rotate(360deg)}}
.integration-method-card strong{display:block;font-size:14px;font-weight:600;letter-spacing:-.02em}
.integration-method-card small{display:block;margin-top:4px;font-size:12px;line-height:1.45;color:var(--text-gray)}
.integrations-later-link,.integrations-back-link{justify-self:start}
.integrations-app-section{display:grid;gap:10px}
.integrations-app-section h4{margin:0;font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark)}
.integrations-app-section p.sub{margin:4px 0 0}
.integration-section-badge{
  display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 8px;
  font-size:11px;font-weight:700;line-height:1;
}
.integration-section-badge--teal{background:#9FE1CB;color:#085041}
.integration-section-badge--gray{background:#D3D1C7;color:#444441}
.integrations-app-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.integrations-app-grid--link{grid-template-columns:repeat(5,minmax(0,1fr))}
.integration-app-card{
  position:relative;min-height:104px;border:1px solid var(--border);background:var(--surface-card);
  border-radius:12px;padding:12px;display:grid;gap:10px;text-align:left;cursor:pointer;font:inherit;
  color:var(--text-dark);transition:background .15s ease,border-color .15s ease;
}
.integration-app-card:hover{background:var(--bg-gray);border-color:var(--border)}
.integration-app-card.selected{border-color:var(--purple-dark);background:var(--purple-ultra)}
.integration-app-card.selected:hover{background:var(--purple-ultra);border-color:var(--purple-dark)}
.integration-app-card.soon{opacity:.72}
.integration-app-logo{
  width:38px;height:38px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;line-height:1;flex-shrink:0;
}
.integration-app-logo--image{
  background:#fff;border:1px solid var(--border);overflow:hidden;padding:0;
}
.integration-app-logo--image img{
  width:100%;height:100%;object-fit:contain;padding:5px;box-sizing:border-box;display:block;
}
.integration-app-copy{display:grid;gap:4px;min-width:0}
.integration-app-copy strong{font-size:13px;font-weight:500;line-height:1.25}
.integration-app-copy small{font-size:11px;color:var(--text-gray);line-height:1.25}
.integration-app-badge{
  justify-self:start;display:inline-flex;align-items:center;border:1px solid var(--border);
  background:#f3f4f6;color:var(--text-gray);border-radius:999px;padding:3px 8px;font-size:10.5px;font-weight:500;
}
.integration-app-badge.connected{background:#ecfdf5;border-color:#bbf7d0;color:#047857}
.integration-config-panel{
  border:1px solid var(--border);background:var(--surface-card);border-radius:12px;padding:16px;
  display:grid;gap:14px;
}
.integration-config-head{display:flex;align-items:center;gap:12px}
.integration-config-head h4{margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark)}
.integration-config-head .btn{margin-left:auto}
.integration-status-line{display:inline-flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:var(--text-gray)}
.integration-status-dot{width:8px;height:8px;border-radius:999px;background:#d1d5db;display:inline-block}
.integration-status-dot.connected{background:#16a34a}
.integration-status-dot.warning{background:#dc2626}
.integration-config-body{display:grid;gap:12px}
.integration-info-box,.integration-success-box{
  border:1px solid var(--border);border-radius:10px;padding:12px;font-size:13px;line-height:1.55;color:var(--text-gray);
  background:#f9fafb;
}
.integration-success-box{border-color:#bbf7d0;background:#ecfdf5;color:#047857}
.integration-config-field{max-width:520px}
.integration-checkbox-row{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5;color:var(--text-gray)}
.integration-checkbox-row input{margin-top:2px}
.integration-saved-url{word-break:break-word}
.integration-error-note{color:#b91c1c}
.integration-confirm-card{
  border:1px solid var(--border);background:#f9fafb;border-radius:12px;padding:16px;display:grid;gap:6px;
}
.integration-confirm-card.success{border-color:#bbf7d0;background:#ecfdf5}
.integration-confirm-card strong{font-size:14px;font-weight:600;color:var(--text-dark)}
.integration-confirm-card p{margin:0;font-size:13px;line-height:1.6;color:var(--text-gray)}
.integration-confirm-actions{margin-top:8px}
.integration-divider{
  border:0;
  border-top:1px solid var(--border);
  margin:8px 0;
}
.integration-configured-card{
  border:1px solid var(--border);
  background:var(--surface-card);
  border-radius:12px;
  overflow:hidden;
}
.integration-configured-main{
  display:flex;
  align-items:center;
  gap:12px;
  padding:16px;
}
.integration-configured-copy{
  display:grid;
  gap:4px;
  min-width:0;
  flex:1;
}
.integration-configured-title-row{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
.integration-configured-title-row strong{
  font-size:14px;
  font-weight:600;
  color:var(--text-dark);
}
.integration-configured-url-row{
  border-top:1px solid var(--border);
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 16px;
  color:var(--text-gray);
}
.integration-configured-url-text{
  flex:1;
  min-width:0;
  overflow-wrap:anywhere;
  color:var(--text-dark);
  font-size:13px;
}
.integration-configured-url-edit{
  display:flex;
  align-items:center;
  gap:10px;
  flex:1;
  min-width:0;
}
.integration-configured-url-edit input{
  flex:1;
  min-width:0;
}
.integration-app-logo--generic{
  background:transparent;
  color:var(--purple-dark);
  width:44px;height:44px;border-radius:14px;
}
.integration-upgrade-banner{
  padding:0;
  overflow:hidden;
}
.integration-upgrade-banner-inner{
  background:var(--starter-upgrade-banner-bg);
  padding:18px 20px;
}
.integration-upgrade-banner-row{
  justify-content:space-between;
  align-items:center;
}
.integration-upgrade-banner-copy{
  flex:1;
  min-width:0;
}
.integration-upgrade-banner strong{color:var(--text-dark)}
.integration-upgrade-banner-sub{
  margin:4px 0 0;
}
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
/* Knowledge: underline tabs like /user/calls (all breakpoints; horizontal scroll on narrow) */
.knowledge-portal-tab-bar{margin-bottom:32px;min-width:0;border-bottom:1.5px solid var(--border)}
/* Underline tabs — match /user/billing (Overview / Plans / History) */
.business-subtabs.calls-filter-tabs{
  display:flex;
  align-items:flex-end;
  flex-wrap:nowrap;
  gap:24px;
  margin-bottom:0;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior-x:contain;
  scrollbar-width:none;
}
.business-subtabs.calls-filter-tabs::-webkit-scrollbar{display:none}
.business-subtabs.calls-filter-tabs .business-subtab{
  flex:0 0 auto;
  white-space:nowrap;
  appearance:none;
  background:transparent;
  border:none;
  border-radius:0;
  margin:0;
  padding:0 0 10px;
  color:var(--text-gray);
  cursor:pointer;
  font:inherit;
  font-size:14px;
  font-weight:500;
  line-height:1.35;
  box-shadow:none;
  border-bottom:2px solid transparent;
  transition:color .15s ease,border-color .15s ease;
}
.business-subtabs.calls-filter-tabs .business-subtab:hover{
  color:var(--text-dark);
  background:transparent;
}
.business-subtabs.calls-filter-tabs .business-subtab:focus-visible{
  outline:2px solid var(--purple-dark);
  outline-offset:3px;
}
.business-subtabs.calls-filter-tabs .business-subtab.active{
  color:var(--text-dark);
  font-weight:500;
  border-bottom-color:var(--text-dark);
}
.business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  color:var(--text-dark);
  background:transparent;
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
.small-field label{display:block;margin-bottom:5px}
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
.sh-active-label{margin:0}
.sh-active-hint{margin:0;font-size:13px;color:var(--text-gray);line-height:1.45}
.sh-empty{
  padding:22px 18px;border-radius:14px;border:1px dashed #d1d5db;background:#fafafa;
  font-size:14px;line-height:1.55;color:var(--text-gray);text-align:center;
}
.faq-empty-state p{margin:0}
.faq-empty-state .faq-empty-cta{margin-top:16px;margin-bottom:0}
.faq-policies-card.card,
.faq-policies-card .stat-card{
  background:var(--surface-page,#f6f7fb);
  border:0;
  padding:0;
}
.faq-policies-form .option-card{cursor:default;display:grid;gap:0}
.faq-policies-form .option-card:hover{transform:none;box-shadow:none;border-color:var(--border)}
.faq-policies-form .option-card > .service-catalog-heading{
  display:grid;gap:12px;align-items:stretch;margin-bottom:0;
}
.faq-policies-form .option-card > .service-catalog-heading .service-catalog-actions{
  width:100%;margin-left:0;display:grid;grid-template-columns:1fr;
}
.faq-policies-form .option-card > .service-catalog-heading .service-catalog-actions .btn,
.faq-policies-form .option-card > .service-catalog-heading .faq-add-cta{
  width:100%;justify-content:center;min-height:48px;box-sizing:border-box;
}
.faq-policies-form .faq-item-list{display:grid;gap:12px;margin-top:12px}
.faq-policies-form .faq-item-list .staff-card{margin-bottom:0}
.faq-policies-form .faq-item-list .staff-card-detail{padding:14px 16px 16px}
.faq-policies-form .faq-item-list .actions-row{margin-top:0}
.faq-policies-form .faq-item-list .subtle-link{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px}
.faq-policies-form > .settings-save-footer{
  position:sticky;bottom:0;z-index:24;
  margin-top:18px;padding:12px 0 calc(12px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,rgba(255,255,255,0) 0%,var(--surface-page,#f6f7fb) 28%);
}
html[data-user-theme="dark"] .faq-policies-form > .settings-save-footer{
  background:linear-gradient(180deg,rgba(13,17,23,0) 0%,var(--surface-page,#0d1117) 28%);
}
.staff-empty{
  display:grid;justify-items:center;gap:8px;padding:42px 22px;margin-bottom:8px;
  background:#fff;border:1px dashed #d1d5db;border-radius:16px;color:var(--text-gray);
}
.staff-empty-icon{color:#9ca3af;opacity:.7;line-height:0}
.staff-empty strong{font-size:18px;font-weight:600;letter-spacing:-.02em;color:#3f3f46}
.staff-empty p{margin:0 0 14px;font-size:16px;line-height:1.45;color:#52525b}
.staff-empty-add{justify-self:center;margin-top:16px}
.staff-card{
  background:var(--surface-card);border:0.5px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;
  transition:border-color .15s ease,opacity .15s ease;
}
.staff-card--button{display:block;width:100%;padding:0;text-align:left;color:inherit;font:inherit;cursor:pointer}
.staff-card:hover{border-color:#d1d5db}
.staff-card.inactive{opacity:.55}
.staff-card-main{
  display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 16px;
}
.staff-info{display:flex;flex:1;min-width:0;flex-direction:column;gap:6px}
.staff-name{font-size:15px;font-weight:500;color:var(--text-dark);letter-spacing:-.01em;line-height:1.3}
.staff-role{font-size:13px;color:var(--text-gray);line-height:1.35}
.staff-spec-tags{display:flex;flex-wrap:wrap;gap:5px}
.staff-spec{padding:3px 8px;border-radius:999px;font-size:12px;font-weight:500;line-height:1.25}
.staff-spec--services{background:#f5f3ee;color:#52525b}
.staff-spec--sync.is-synced{background:#ecfdf5;color:#16a34a}
.staff-spec--sync.is-not-synced{background:#fef2f2;color:#dc2626}
.staff-card-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.staff-card-side::before{content:'';order:2;width:1px;height:18px}
.staff-status-control{order:1;display:flex;align-items:center;justify-content:flex-end;gap:8px;min-height:20px}
.staff-status-label{font-size:13px;font-weight:500;line-height:20px;color:var(--text-gray)}
.staff-card-actions{order:3;display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:30px}
.staff-card-action-btn{padding:0}
.staff-card-action-label{display:none}
.staff-action-divider{width:1px;height:20px;background:var(--border);flex-shrink:0}
.staff-toggle{
  width:36px;height:20px;border-radius:999px;border:0;position:relative;cursor:pointer;flex-shrink:0;
  transition:background .15s ease;
}
.staff-toggle.on{background:#534AB7}
.staff-toggle.off{background:#d4d4d8}
.staff-toggle::after{
  content:'';position:absolute;top:2px;width:16px;height:16px;border-radius:999px;background:#fff;
  transition:left .15s ease;
}
.staff-toggle.on::after{left:18px}
.staff-toggle.off::after{left:2px}
.staff-toggle:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.staff-card-detail{
  border-top:1px solid var(--border);padding:16px;background:#fafafa;
}
.staff-card-detail .form-grid{margin:0}
.staff-card-detail .field-full{grid-column:1/-1}
.staff-detail-actions{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.staff-detail-actions span{color:var(--text-gray);font-size:13px}
@media(max-width:860px){
  .staff-card-main{
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    gap:0;
    padding:0;
  }
  .staff-info{
    grid-column:1;
    grid-row:1;
    padding:14px 12px 12px 16px;
  }
  .staff-card-side{display:contents}
  .staff-card-side::before{display:none}
  .staff-status-control{
    grid-column:2;
    grid-row:1;
    align-self:start;
    justify-self:end;
    padding:14px 16px 0 8px;
  }
  .staff-card-actions{
    grid-column:1 / -1;
    display:flex;
    width:100%;
    min-height:48px;
    border-top:1px solid var(--border);
    gap:0;
  }
  .staff-card-actions .staff-card-action-btn{
    flex:1;
    width:auto;
    height:48px;
    border-radius:0;
    gap:6px;
    color:var(--text-dark);
    font:inherit;
    font-size:13px;
    font-weight:600;
  }
  .staff-card-action-btn:hover{background:#f9fafb}
  .staff-card-action-label{display:inline}
  .staff-action-divider{display:none}
  .staff-card-actions .staff-card-action-btn--edit{border-left:1px solid var(--border)}
  .staff-detail-actions{align-items:flex-start;flex-direction:column;gap:8px}
}
.handoff-phone-section{padding:20px 0 4px;border-top:1px solid var(--border);margin-top:14px}
.handoff-transfer-phone{margin-bottom:20px}
.field .handoff-section-label{
  margin-bottom:8px;line-height:1.35;
}
.handoff-availability{margin:0;padding-top:20px;border-top:1px solid var(--border)}
.handoff-availability--custom{margin-bottom:16px}
.handoff-radio-group{display:grid;gap:14px;margin-top:12px}
.field .handoff-radio-option{
  display:flex;align-items:center;gap:10px;margin:0;color:var(--text-dark);cursor:pointer;
  font-size:14px;font-weight:400;line-height:1.4;letter-spacing:0;text-transform:none;
}
.field .handoff-radio-option input[type="radio"]{
  accent-color:var(--purple-dark);appearance:auto;width:18px;height:18px;min-height:0;flex:0 0 18px;
  padding:0;margin:0;border:0;box-shadow:none;background:transparent;
}
.field .handoff-radio-option input[type="radio"]:focus{outline:2px solid rgba(124,58,237,.28);outline-offset:2px;box-shadow:none}
.handoff-custom-hours{margin:0 0 16px}
.handoff-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:15px}
.sh-active-table{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:#fff}
.sh-active-thead{
  display:grid;grid-template-columns:minmax(0,1fr) 132px 112px;gap:14px;
  padding:11px 18px;background:#f9fafb;border-bottom:1px solid var(--border);
  color:var(--text-gray);
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
.service-catalog-heading h3{margin:0 0 6px;font-size:18px;font-weight:600;letter-spacing:-.02em;color:var(--text-dark);line-height:1.25}
.service-catalog-actions{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto}
.service-catalog-actions .btn{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.service-catalog-actions .btn svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.staff-empty .service-catalog-actions,
.faq-empty-state .service-catalog-actions{
  width:100%;max-width:280px;margin-left:auto;margin-right:auto;justify-items:stretch;
}
.staff-empty .service-catalog-actions{margin-top:16px}
.faq-empty-state .service-catalog-actions{margin-top:0}
.faq-empty-state .service-catalog-actions .faq-empty-cta{margin-top:0}
.service-group-list{display:grid;gap:16px}
.service-group-card{border:1px solid var(--border);border-radius:14px;background:var(--surface-card);overflow:hidden}
.service-group-card summary{cursor:pointer;list-style:none;padding:15px 17px;background:#f9fafb;border-bottom:1px solid var(--border)}
.service-group-card summary::-webkit-details-marker{display:none}
.service-group-card summary div{display:flex;align-items:center;justify-content:space-between;gap:14px}
.service-group-card summary strong{
  font-size:15px;font-weight:500;color:var(--text-dark);letter-spacing:-.01em;line-height:1.25;
}
.service-group-card summary span{font-size:13px;color:var(--text-gray);font-weight:400;line-height:1.25}
.service-group-card summary div strong{margin-right:auto}
.service-group-body{display:grid;gap:0;padding:28px 24px 20px}
.service-group-card--compact{
  border:1px solid var(--border);
  border-radius:14px;
  box-shadow:none;
}
.service-group-card--compact summary{
  padding:16px 18px;
  background:#f9fafb;
  border-bottom:1px solid var(--border);
}
.service-group-card--compact summary div{gap:12px}
.service-group-summary-inner{
  width:100%;
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.service-group-title-with-rename{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
  flex:1;
}
.service-group-title-with-rename strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.service-group-rename-btn{
  flex-shrink:0;
  width:30px;
  height:30px;
  border:0;
  background:transparent;
  color:var(--text-gray);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:8px;
  cursor:pointer;
}
.service-group-rename-btn:hover{
  background:#f3f4f6;
  color:var(--text-dark);
}
.service-group-rename-btn svg{
  stroke:currentColor;
  stroke-width:1.8;
  fill:none;
  stroke-linecap:round;
  stroke-linejoin:round;
}
.service-group-card--compact summary strong{
  font-size:15px;
  font-weight:500;
  line-height:1.25;
  letter-spacing:-.01em;
  color:var(--text-dark);
}
.service-group-card--compact summary span,
.service-group-card--compact .service-group-count{
  font-size:13px;
  font-weight:400;
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
.service-item-card{display:grid;gap:14px;border:1px solid rgba(15,23,42,.08);border-radius:14px;padding:15px;background:#fff}
.service-item-card.archived{opacity:.62;background:#f9fafb}
.service-item-head{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(180px,.8fr);gap:14px}
.service-item-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.service-item-footer--catalog-inline{
  flex-direction:column;
  align-items:stretch;
  gap:10px;
}
.service-item-footer--catalog-inline > .flex{width:100%}
.service-summary-item{border-bottom:1px solid var(--border)}
.service-summary-item:last-of-type{border-bottom:0}
.service-summary-item.archived{opacity:.62}
.service-summary-row{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;align-items:center;gap:14px;padding:11px 0}
.service-summary-name{font-size:14px;font-weight:500;color:var(--text-dark);letter-spacing:-.01em;line-height:1.3}
.service-summary-meta{font-size:13px;font-weight:400;color:var(--text-gray);white-space:nowrap;text-align:right;line-height:1.3}
.knowledge-portal-main .service-duration-warn{
  color:#f59e0b;
  font-size:13px;
  line-height:1;
  display:inline-block;
  vertical-align:middle;
}
.knowledge-portal-main .service-summary-meta .service-duration-warn{
  font-size:14px;
}
.service-edit-icon{width:30px;height:30px;border:0;background:transparent;color:var(--text-gray);display:inline-flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer}
.service-edit-icon:hover{background:#f3f4f6;color:var(--text-dark)}
.service-edit-icon svg{stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.service-inline-editor{display:grid;gap:14px;margin:8px 0 18px;padding:16px;border:1px solid var(--border);border-radius:14px;background:#fff}
.knowledge-portal-main .service-inline-editor .field label{
  text-transform:none;
  letter-spacing:-0.01em;
}
.knowledge-portal-main .service-name-edit-hint{
  margin:4px 0 0;
  font-size:11px;
  color:#9ca3af;
  line-height:1.35;
}
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
.sh-hours-presets-label{margin:0 0 10px}
.sh-hours-presets .preset-pills{margin-bottom:0}

.sh-hours-wrap{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#fff}
.sh-hours-thead{
  display:grid;
  grid-template-columns:minmax(108px,1.1fr) minmax(92px,0.95fr) minmax(92px,0.95fr) minmax(120px,auto);
  gap:12px;padding:11px 16px;background:#f9fafb;border-bottom:1px solid var(--border);
  color:var(--text-gray);
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
.sh-hours-wrap .hours-closed-cell{
  display:flex;align-items:center;justify-content:flex-end;gap:10px;
  font-size:12px;color:var(--text-gray);font-weight:500;min-width:0;
}
.sh-hours-wrap .hours-closed-label{white-space:nowrap}
.sh-hours-wrap .hours-closed-toggle{
  position:relative;flex-shrink:0;width:40px;height:24px;border-radius:12px;
  border:0;padding:0;margin:0;background:#e5e7eb;cursor:pointer;
  transition:background .15s ease;box-sizing:border-box;
}
.sh-hours-wrap .hours-closed-toggle::after{
  content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;
  background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.14);transition:transform .15s ease;
}
.sh-hours-wrap .hours-closed-toggle[aria-checked="true"]{background:#7c3aed}
.sh-hours-wrap .hours-closed-toggle[aria-checked="true"]::after{transform:translateX(16px)}
.sh-hours-wrap .hours-closed-toggle:focus-visible{outline:2px solid var(--purple-dark);outline-offset:2px}
.sh-hours-wrap .hours-row.closed .hours-field-open select,
.sh-hours-wrap .hours-row.closed .hours-field-close select{
  opacity:.3;pointer-events:none;
}
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
  .knowledge-portal-main .service-inline-editor--catalog-mobile,
  .knowledge-portal-main .service-inline-editor--legacy-mobile{
    display:none!important;
  }
  .knowledge-portal-main .service-summary-row--clickable{
    cursor:pointer;
    border-radius:6px;
    margin:0 -6px;
    padding:11px 6px;
  }
  .knowledge-portal-main .service-summary-row--clickable:hover{
    background:#fafafa;
  }
  .knowledge-portal-main .service-summary-row .service-edit-icon{
    opacity:0;
    transition:opacity .15s ease,background .15s ease,color .15s ease;
  }
  .knowledge-portal-main .service-summary-row--clickable:hover .service-edit-icon{
    opacity:1;
    background:#f3f4f6;
    color:var(--text-dark);
  }
  .knowledge-portal-main .service-group-rename-btn{
    opacity:0;
    transition:opacity .15s ease,background .15s ease,color .15s ease;
  }
  .knowledge-portal-main .service-group-card--compact summary:hover .service-group-rename-btn{
    opacity:1;
    background:#f3f4f6;
    color:var(--text-dark);
  }
  /* Services tab (desktop): list row name truncation + untitled emphasis */
  .knowledge-portal-main .service-summary-name{
    display:flex;
    align-items:center;
    gap:6px;
    min-width:0;
    flex:1;
    max-width:480px;
  }
  .knowledge-portal-main .service-summary-name-inner{
    display:flex;
    align-items:center;
    gap:6px;
    min-width:0;
    flex:1;
    max-width:100%;
  }
  .knowledge-portal-main .service-summary-name-text{
    min-width:0;
    flex:1;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .knowledge-portal-main .service-summary-name--untitled .service-summary-name-text{
    color:#dc2626;
    font-style:italic;
  }
  html[data-user-theme="dark"] .knowledge-portal-main .service-summary-row--clickable:hover{
    background:#161b22;
  }
}
@media (max-width:860px){
  .knowledge-portal-main .service-summary-name--untitled .service-summary-name-text{
    color:inherit;
    font-style:normal;
  }
  .knowledge-portal-main .service-group-rename-btn{
    opacity:1;
  }
}

/* Add/rename service group sheet (classes shared with onboarding-add-group-sheet) */
.onb-sheet-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.4);
  z-index:200;
  display:flex;
  align-items:flex-end;
  font-family:inherit;
}
.onb-sheet{
  background:#fff;
  border-radius:20px 20px 0 0;
  padding:20px 20px 40px;
  width:100%;
  max-height:90vh;
  overflow:auto;
  box-sizing:border-box;
  font-family:inherit;
}
.onb-sheet-handle{width:36px;height:4px;background:#e5e7eb;border-radius:2px;margin:0 auto 20px}
.onb-sheet-title{font-size:15px;font-weight:600;color:var(--text-dark);margin-bottom:16px;font-family:inherit}
.onb-sheet-field{margin-bottom:0}
.onb-sheet-label{font-size:11px;font-weight:500;color:var(--text-gray);margin-bottom:5px;font-family:inherit}
.onb-sheet-input{
  width:100%;
  font-size:16px;
  padding:12px 14px;
  border:1px solid var(--border);
  border-radius:10px;
  font-family:inherit;
  color:var(--text-dark);
  outline:none;
  box-sizing:border-box;
  background:var(--surface-card);
}
.onb-sheet-input:focus{border-color:var(--purple-dark)}
.onb-sheet-actions{display:flex;gap:10px;margin-top:16px}
.onb-sheet-remove{
  display:inline-flex;
  align-items:center;
  gap:6px;
  align-self:center;
  margin-right:auto;
  padding:13px 0;
  border:none;
  background:transparent;
  color:var(--danger-text);
  font-size:14px;
  font-weight:600;
  cursor:pointer;
  font-family:inherit;
}
.onb-sheet-remove:disabled{opacity:.45;cursor:not-allowed}
.onb-sheet-cancel{
  align-items:center;
  box-sizing:border-box;
  display:inline-flex;
  flex:1 1 0;
  justify-content:center;
  min-height:48px;
  min-width:0;
  padding:13px;
  border:1px solid var(--border);
  border-radius:10px;
  font-size:14px;
  color:var(--text-gray);
  background:var(--surface-card);
  cursor:pointer;
  font-family:inherit;
}
.onb-sheet-save{
  align-items:center;
  box-sizing:border-box;
  display:inline-flex;
  flex:1 1 0;
  justify-content:center;
  min-height:48px;
  min-width:0;
  padding:13px;
  border:none;
  border-radius:10px;
  font-size:14px;
  font-weight:500;
  color:#fff;
  background:var(--text-dark);
  cursor:pointer;
  font-family:inherit;
}
.onb-sheet-save:disabled{background:#d1d5db;cursor:not-allowed}
@media (min-width:768px){
  .onb-sheet-overlay{align-items:center;justify-content:center}
  .onb-sheet{border-radius:14px;max-width:420px;padding:24px;width:100%}
  .onb-sheet-handle{display:none}
}
html[data-user-theme="dark"] .onb-sheet{background:var(--surface-card)}
html[data-user-theme="dark"] .onb-sheet-title{color:var(--text-dark)}
html[data-user-theme="dark"] .onb-sheet-input{background:#0d1117;border-color:var(--border);color:var(--text-dark)}
html[data-user-theme="dark"] .onb-sheet-cancel{background:var(--surface-card);border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .onb-sheet-save{background:#1f6feb}

/* Knowledge mobile bottom sheet: title row + scroll body + bottom alignment override (≤860px) */
@media (max-width:860px){
  .onb-sheet-overlay.rb-bottom-sheet-overlay{
    align-items:flex-end!important;
    justify-content:center;
  }
}
.rb-bottom-sheet-overlay{z-index:210}
.onb-sheet.rb-bottom-sheet-root{
  display:flex;
  flex-direction:column;
  max-height:90vh;
  overflow:hidden;
  padding-bottom:calc(20px + env(safe-area-inset-bottom, 0px));
  animation:rb-bottom-sheet-enter .3s ease forwards;
}
@keyframes rb-bottom-sheet-enter{
  from{transform:translateY(100%);opacity:.92}
  to{transform:translateY(0);opacity:1}
}
.rb-bottom-sheet-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  flex-shrink:0;
  margin-bottom:2px;
}
.rb-bottom-sheet-head .onb-sheet-title{
  margin:0;
  flex:1;
  min-width:0;
  text-align:left;
  line-height:1.3;
}
.rb-bottom-sheet-close{
  flex-shrink:0;
  width:34px;
  height:34px;
  border:0;
  border-radius:8px;
  background:transparent;
  color:var(--text-gray);
  cursor:pointer;
  font-size:18px;
  line-height:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.rb-bottom-sheet-close:hover{background:var(--bg-gray);color:var(--text-dark)}
.rb-bottom-sheet-body{
  flex:1;
  min-height:0;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  padding-top:6px;
}
.rb-bottom-sheet-body:has(.rb-bottom-sheet-shell){
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.rb-bottom-sheet-shell{
  display:flex;
  flex-direction:column;
  flex:1;
  min-height:0;
}
.rb-bottom-sheet-scroll{
  flex:1;
  min-height:0;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  padding-bottom:4px;
}
.rb-bottom-sheet-footer{
  align-items:center;
  background:var(--surface-card,#fff);
  border-top:1px solid var(--border);
  display:flex;
  flex-shrink:0;
  gap:10px;
  justify-content:flex-end;
  padding:14px 0 0;
  margin-top:12px;
  position:sticky;
  bottom:0;
  z-index:2;
}
.rb-bottom-sheet-footer--split{justify-content:space-between;flex-wrap:wrap;gap:12px}
.rb-bottom-sheet-footer-note{
  margin:0 auto 0 0;
  flex:1;
  min-width:0;
  font-size:13px;
  line-height:1.45;
}
.rb-bottom-sheet-footer-actions{display:flex;gap:10px;align-items:center;flex-shrink:0;margin-left:auto}
.rb-bottom-sheet-footer .onb-sheet-cancel,
.rb-bottom-sheet-footer .onb-sheet-save{
  flex:0 0 126px;
  min-width:126px;
  width:126px;
}
html[data-user-theme="dark"] .rb-bottom-sheet-footer{background:var(--surface-card)}
@media (max-width:860px){
  .rb-bottom-sheet-footer{padding-top:12px;margin-top:10px}
  .rb-bottom-sheet-footer--split .rb-bottom-sheet-footer-actions{width:100%;justify-content:stretch}
  .rb-bottom-sheet-footer--split .rb-bottom-sheet-footer-actions .onb-sheet-cancel,
  .rb-bottom-sheet-footer--split .rb-bottom-sheet-footer-actions .onb-sheet-save{
    flex:1 1 0;
    min-height:48px;
    min-width:0;
    width:auto;
    justify-content:center;
  }
}
.knowledge-address-sheet-trigger{
  width:100%;
  text-align:left;
  min-height:44px;
  padding:12px 14px;
  border:1px solid var(--border);
  border-radius:10px;
  background:var(--surface-card);
  font:inherit;
  font-size:16px;
  color:var(--text-dark);
  cursor:pointer;
  box-sizing:border-box;
}
.knowledge-address-sheet-trigger--placeholder{color:var(--text-gray)}
html[data-user-theme="dark"] .knowledge-address-sheet-trigger{background:#0d1117}

/* Catalog / legacy service editor: native <dialog> + panel */
.catalog-service-dialog{
  border:none;
  padding:0;
  margin:0;
  background:transparent;
}
/* Fill viewport and flex-center the panel (avoids left offset from default dialog sizing) */
.catalog-service-dialog[open]{
  display:flex;
  align-items:center;
  justify-content:center;
  position:fixed;
  inset:0;
  width:100%;
  max-width:100vw;
  height:100%;
  max-height:100dvh;
  box-sizing:border-box;
}
.catalog-service-dialog::backdrop{
  background:rgba(0,0,0,.35);
}
.catalog-service-dialog-panel{
  display:flex;
  flex-direction:column;
  flex-shrink:0;
  width:680px;
  max-width:95vw;
  max-height:88vh;
  background:#fff;
  border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.15);
  overflow:hidden;
}
@keyframes catalog-service-dialog-enter{
  from{opacity:0;transform:scale(.97) translateY(8px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
.catalog-service-dialog[open] .catalog-service-dialog-panel{
  animation:catalog-service-dialog-enter .2s ease forwards;
}
.catalog-service-dialog-header{
  display:flex;
  align-items:center;
  gap:14px;
  padding:18px 20px;
  border-bottom:1px solid var(--border);
  font-size:15px;
  font-weight:600;
  color:var(--text-dark);
  flex-shrink:0;
}
.catalog-service-dialog-header-main{
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
  flex:1;
}
.catalog-service-dialog-header-name{
  min-width:0;
  flex:1;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.catalog-service-dialog-header-name--untitled{
  color:#dc2626;
  font-style:italic;
}
.catalog-service-dialog-header-meta{
  flex-shrink:0;
  font-size:13px;
  font-weight:500;
  color:var(--text-gray);
  text-align:right;
  white-space:nowrap;
  max-width:min(240px,46vw);
  overflow:hidden;
  text-overflow:ellipsis;
}
.catalog-service-dialog-header .service-duration-warn--header{
  font-size:14px;
  color:#f59e0b;
}
.catalog-service-dialog-close{
  flex-shrink:0;
  width:34px;
  height:34px;
  border:0;
  border-radius:8px;
  background:transparent;
  color:var(--text-gray);
  cursor:pointer;
  font-size:18px;
  line-height:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.catalog-service-dialog-close:hover{
  background:#f3f4f6;
  color:var(--text-dark);
}
.catalog-service-dialog-body{
  padding:16px 20px;
  overflow-y:auto;
  flex:1;
  min-height:0;
}
.catalog-service-dialog-grid{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.catalog-service-dialog-grid--desktop{
  gap:12px;
}
.catalog-service-dialog-desktop-row1{
  display:grid;
  grid-template-columns:minmax(0,2fr) minmax(0,1fr);
  gap:16px;
  align-items:start;
}
.catalog-service-dialog-desktop-row3{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:16px;
  align-items:start;
}
.catalog-service-dialog-desktop-row4{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:16px;
  align-items:start;
}
.catalog-service-dialog-desc-field textarea{
  min-height:52px;
  box-sizing:border-box;
}
.catalog-service-dialog-bookable--body{
  display:flex;
  align-items:center;
  gap:8px;
  margin:0;
  cursor:pointer;
  font-size:13px;
  color:var(--text-dark);
}
.catalog-service-dialog-row1,
.catalog-service-dialog-row-price{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}
.catalog-service-dialog-row-desc textarea,
.catalog-service-dialog-row-notes textarea{
  min-height:0;
}
.catalog-service-dialog-variants-box{
  background:#f9fafb;
  border:1px solid var(--border);
  border-radius:8px;
  padding:12px 14px;
}
.catalog-service-dialog-variants-title{
  margin:0 0 4px;
  font-size:12px;
  font-weight:500;
  color:var(--text-dark);
}
.catalog-service-dialog-variants-sub{
  margin:0 0 8px;
  font-size:11px;
  line-height:1.4;
  color:var(--text-gray);
}
.catalog-service-dialog-add-option{
  width:100%;
  margin-top:4px;
  padding:10px 12px;
  border:1px dashed var(--border);
  border-radius:8px;
  background:transparent;
  color:var(--purple-dark);
  font-size:14px;
  font-weight:500;
  cursor:pointer;
}
.catalog-service-dialog-add-option:hover{
  background:rgba(99,14,212,.06);
}
.catalog-service-dialog-error{
  margin:12px 0 0;
  font-size:13px;
  color:#dc2626;
}
.catalog-service-dialog-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:12px;
  border-top:1px solid var(--border);
  padding:14px 20px;
  flex-shrink:0;
}
.catalog-service-dialog-footer--edit-service{
  flex-direction:column;
  align-items:stretch;
  gap:10px;
}
.catalog-service-dialog-footer-cta-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  width:100%;
  padding-top:12px;
  margin-top:2px;
  border-top:1px solid var(--border);
  flex-wrap:wrap;
}
.catalog-service-dialog-footer-cta-row .catalog-service-dialog-footer-actions{
  margin-left:0;
}
.catalog-service-dialog-bookable{
  margin:0;
  flex-shrink:0;
}
.catalog-service-dialog-footer-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  flex-wrap:wrap;
  gap:10px;
  margin-left:auto;
}
.catalog-service-dialog-footer-actions .btn{
  box-sizing:border-box;
  justify-content:center;
  min-height:48px;
  width:136px;
}
.catalog-service-dialog-footer-spacer{
  flex:1;
  min-width:0;
}
.catalog-service-dialog-link-remove.subtle-link,
.catalog-service-dialog-link-remove{
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:#dc2626!important;
}
.catalog-service-dialog-btn-cancel{
  background:transparent!important;
  border:1px solid var(--border)!important;
  color:var(--text-dark)!important;
}
.catalog-service-dialog-esc-hint{
  margin-left:6px;
  font-size:12px;
  font-weight:400;
  color:var(--text-gray);
}
.service-editor-drawer-overlay{
  position:fixed;
  inset:0;
  z-index:70;
  display:flex;
  align-items:stretch;
  justify-content:flex-end;
  background:rgba(0,0,0,.35);
}
.service-editor-drawer-panel{
  width:min(640px,100vw);
  height:100vh;
  max-width:100vw;
  background:#fff;
  box-shadow:-18px 0 40px rgba(17,24,39,.18);
  display:flex;
  flex-direction:column;
  animation:service-editor-drawer-enter .2s ease forwards;
}
.service-editor-drawer-panel--legacy{
  width:min(460px,100vw);
}
@keyframes service-editor-drawer-enter{
  from{transform:translateX(100%)}
  to{transform:translateX(0)}
}
.service-editor-drawer-header,
.service-editor-drawer-footer{
  flex-shrink:0;
}
.service-editor-drawer-body{
  flex:1;
  min-height:0;
  overflow-y:auto;
}
.service-editor-drawer-panel .catalog-service-dialog-row2{
  display:grid;
  gap:16px;
}
.service-editor-drawer-panel .catalog-service-dialog-row3{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:16px;
  align-items:start;
}
.service-editor-drawer-footer .catalog-service-dialog-footer-actions{
  margin-left:0;
}
html[data-user-theme="dark"] .catalog-service-dialog-panel{
  background:var(--surface-card);
  box-shadow:0 20px 60px rgba(0,0,0,.45);
}
html[data-user-theme="dark"] .service-editor-drawer-panel{
  background:var(--surface-card);
  box-shadow:-18px 0 40px rgba(0,0,0,.45);
}
html[data-user-theme="dark"] .catalog-service-dialog-header{
  border-bottom-color:var(--border);
}
html[data-user-theme="dark"] .catalog-service-dialog-footer{
  border-top-color:var(--border);
}
html[data-user-theme="dark"] .catalog-service-dialog-footer-cta-row{
  border-top-color:var(--border);
}
html[data-user-theme="dark"] .catalog-service-dialog-variants-box{
  background:#161b22;
  border-color:var(--border);
}
html[data-user-theme="dark"] .catalog-service-dialog-close:hover{
  background:#21262d;
}

.plan-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;background:#f5f3ff;color:var(--purple-dark);font-size:11px;font-weight:500}
.upgrade-panel{background:linear-gradient(135deg,#f7f3ff,#fff);border:1px dashed rgba(99,14,212,.28)}

html[data-user-theme="dark"] .settings-save-footer{border-top:none}
html[data-user-theme="dark"] .calendar-int-card{
  background:var(--surface-card);
  border-color:var(--border);
}
html[data-user-theme="dark"] .calendar-int-card:hover{
  background:var(--bg-gray);
  border-color:var(--border);
  transform:none;
  box-shadow:none;
}
html[data-user-theme="dark"] .calendar-int-card.connected-active:hover{
  background:var(--bg-gray);
  border-color:rgba(56,139,253,.5);
  box-shadow:none;
}
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
html[data-user-theme="dark"] .calendar-int-badge{background:#21262d;color:var(--text-gray);border-color:var(--border)}
html[data-user-theme="dark"] .knowledge-tab-panel-head h3{color:var(--text-dark)}
html[data-user-theme="dark"] .knowledge-tab-panel-head .sub{color:var(--text-gray)}
html[data-user-theme="dark"] .integrations-redesign-head h3,
html[data-user-theme="dark"] .integrations-flow-title,
html[data-user-theme="dark"] .integrations-app-section h4,
html[data-user-theme="dark"] .integration-config-head h4,
html[data-user-theme="dark"] .integration-app-copy strong,
html[data-user-theme="dark"] .integration-method-card strong,
html[data-user-theme="dark"] .integration-confirm-card strong{
  color:var(--text-dark);
}
html[data-user-theme="dark"] .integrations-redesign-head .sub,
html[data-user-theme="dark"] .integrations-flow-sub,
html[data-user-theme="dark"] .integrations-app-section p.sub,
html[data-user-theme="dark"] .integration-app-copy small,
html[data-user-theme="dark"] .integration-method-card small,
html[data-user-theme="dark"] .integration-confirm-card p{
  color:var(--text-gray);
}
html[data-user-theme="dark"] .integration-info-box,
html[data-user-theme="dark"] .integration-confirm-card,
html[data-user-theme="dark"] .integration-configured-card{
  background:var(--bg-gray);
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .integration-configured-url-row{
  border-top-color:var(--border);
}
html[data-user-theme="dark"] .integration-app-logo--generic{
  background:transparent;
  color:var(--purple-dark);
}
html[data-user-theme="dark"] .integration-method-icon,
html[data-user-theme="dark"] .integration-method-card[aria-pressed="true"] .integration-method-icon{
  color:var(--purple-dark);
}
html[data-user-theme="dark"] .integration-success-box,
html[data-user-theme="dark"] .integration-confirm-card.success,
html[data-user-theme="dark"] .integration-app-badge.connected{
  background:rgba(35,134,54,.16);
  border-color:rgba(63,185,80,.38);
  color:#3fb950;
}
html[data-user-theme="dark"] .integration-app-badge{
  background:#21262d;
  border-color:var(--border);
  color:var(--text-gray);
}
html[data-user-theme="dark"] .integration-method-card:hover{background:var(--bg-gray);border-color:var(--border)}
html[data-user-theme="dark"] .integration-app-card:hover:not(.selected){background:var(--bg-gray);border-color:var(--border)}
html[data-user-theme="dark"] .integration-app-logo--image{background:#0d1117;border-color:var(--border)}
html[data-user-theme="dark"] .integration-section-badge--teal{background:rgba(63,185,80,.18);color:#7ee787}
html[data-user-theme="dark"] .integration-section-badge--gray{background:#30363d;color:#c9d1d9}
html[data-user-theme="dark"] .integration-app-card.selected:hover{
  background:rgba(56,139,253,.12);
  border-color:rgba(56,139,253,.55);
}
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
html[data-user-theme="dark"] .knowledge-lang-chip.active{
  border-color:#AFA9EC;color:#AFA9EC;background:transparent;
}
html[data-user-theme="dark"] .knowledge-lang-chip.active .knowledge-lang-chip-check{
  background:#534AB7;border-color:#534AB7;
}
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
html[data-user-theme="dark"] .knowledge-portal-tab-bar{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab{color:var(--text-gray)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab:hover{color:var(--text-dark)}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active{
  color:var(--text-dark);border-bottom-color:var(--text-dark);
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  color:var(--text-dark);
  background:transparent;
  border-bottom-color:var(--text-dark);
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
/* Underline tabs (/user/calls style): global dark .business-subtab pill rules must not apply */
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab{
  background:transparent;
  border:none;
  border-radius:0;
  box-shadow:none;
  border-bottom:2px solid transparent;
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab:hover{
  background:transparent;
}
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active,
html[data-user-theme="dark"] .business-subtabs.calls-filter-tabs .business-subtab.active:hover{
  background:transparent;
  border:none;
  border-radius:0;
  border-bottom:2px solid var(--text-dark);
  color:var(--text-dark);
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
html[data-user-theme="dark"] .staff-card:hover{border-color:#58a6ff}
html[data-user-theme="dark"] .staff-spec--services{background:#21262d;color:var(--text-gray)}
html[data-user-theme="dark"] .staff-spec--sync.is-synced{background:rgba(35,134,54,.18);color:#3fb950}
html[data-user-theme="dark"] .staff-spec--sync.is-not-synced{background:rgba(248,81,73,.12);color:#f85149}
html[data-user-theme="dark"] .staff-card-action-btn{color:var(--text-gray)}
html[data-user-theme="dark"] .staff-card-action-btn:hover{background:#21262d;color:var(--text-dark)}
html[data-user-theme="dark"] .staff-action-divider{background:var(--border)}
html[data-user-theme="dark"] .staff-card-detail{background:#0d1117;border-top-color:var(--border)}
html[data-user-theme="dark"] .sh-active-section{border-top-color:var(--border)}
html[data-user-theme="dark"] .sh-active-table{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-active-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-active-row{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-wrap{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-thead{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .sh-hours-wrap .hours-closed-toggle{background:#30363d}
html[data-user-theme="dark"] .sh-hours-wrap .hours-closed-toggle::after{background:#f0f6fc}
html[data-user-theme="dark"] .sh-hours-wrap .hours-closed-toggle[aria-checked="true"]{background:#8957e5}
html[data-user-theme="dark"] .sh-active-row .sh-active-service{border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .service-group-card summary{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact{border-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact summary{background:#161b22;border-bottom-color:var(--border)}
html[data-user-theme="dark"] .service-group-card--compact summary strong{color:var(--text-dark)}
html[data-user-theme="dark"] .service-group-card--compact summary span,
html[data-user-theme="dark"] .service-group-card--compact .service-group-count{color:var(--text-gray)}
html[data-user-theme="dark"] .service-group-card--compact summary div::before{background:#0d1117;border-color:var(--border);color:var(--text-gray)}
html[data-user-theme="dark"] .service-group-card--compact .service-group-body{background:var(--surface-card)}
html[data-user-theme="dark"] .service-item-card{background:var(--surface-card);border-color:var(--border)}
html[data-user-theme="dark"] .service-item-card.archived{background:#161b22}
html[data-user-theme="dark"] .service-summary-name{color:var(--text-dark)}
html[data-user-theme="dark"] .knowledge-portal-main .service-summary-name--untitled .service-summary-name-text{color:#f87171}
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
html[data-user-theme="dark"] .plan-chip{
  background:rgba(56,139,253,0.12);
  color:#79c0ff;
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
  .business-subtabs:not(.calls-filter-tabs):has(> :nth-child(3):last-child){
    grid-template-columns:repeat(3,minmax(0,1fr));
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
  /* Knowledge underline tabs — same metrics as billing on narrow screens */
  .business-subtabs.calls-filter-tabs{
    display:flex!important;
    flex-direction:row!important;
    flex-wrap:nowrap!important;
    align-items:flex-end!important;
    gap:24px!important;
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
    padding:0 0 10px!important;
    line-height:1.35!important;
    border:none!important;
    border-radius:0!important;
    background:transparent!important;
    border-bottom:2px solid transparent!important;
    color:var(--text-gray);
    text-align:left!important;
    justify-content:flex-start!important;
    cursor:pointer!important;
    font:inherit!important;
    font-size:14px!important;
    font-weight:500!important;
  }
  .business-subtabs.calls-filter-tabs .business-subtab.active{
    border-bottom-color:var(--text-dark)!important;
    color:var(--text-dark)!important;
    font-weight:500!important;
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
  .integrations-method-grid{grid-template-columns:1fr}
  .integrations-app-grid--sync{grid-template-columns:repeat(2,minmax(0,1fr))}
  .integrations-app-grid--link{grid-template-columns:repeat(2,minmax(0,1fr))}
  .integration-app-card{min-height:92px;padding:10px}
  .integration-app-logo{width:32px;height:32px;border-radius:8px;font-size:11px}
  .integration-app-logo--image img{padding:4px}
  .integration-config-head{align-items:flex-start;flex-wrap:wrap}
  .integration-config-head .btn{margin-left:0}
  .integration-configured-main,
  .integration-configured-url-row,
  .integration-configured-url-edit{
    align-items:stretch;
    flex-direction:column;
  }
  .integration-configured-main .btn,
  .integration-configured-url-row .btn,
  .integration-configured-url-edit .btn{
    width:100%;
    justify-content:center;
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
  .service-catalog-actions{display:grid;grid-template-columns:1fr;width:100%;margin-left:0}
  .service-catalog-actions .btn{width:100%;justify-content:center}
  .service-catalog-actions--mobile-full{
    width:100%;
    justify-items:stretch;
  }
  .service-catalog-actions--mobile-full .service-group-add-cta,
  .service-catalog-actions--mobile-full .faq-add-cta{
    width:100%;
    min-height:48px;
    box-sizing:border-box;
    justify-content:center;
  }
  .knowledge-portal-main .panel-head.service-catalog-heading{align-items:stretch}
  .staff-empty .service-catalog-actions,
  .faq-empty-state .service-catalog-actions{width:100%;max-width:none;margin-top:16px}
  .faq-empty-state .service-catalog-actions .faq-empty-cta{width:100%;justify-content:center}
  .staff-empty .service-catalog-actions .staff-empty-add{width:100%;justify-content:center}
  .faq-policies-card.card,
  .faq-policies-card .stat-card,
  .faq-policies-card .grid.grid-3 > .stat-card,
  .faq-policies-card .grid.grid-4 > .stat-card{
    background:var(--surface-page,#f6f7fb);
    border:0;
    padding:0;
  }
  .faq-policies-form .option-card{padding:12px 14px}
  .faq-policies-form .preset-pill{min-height:44px;box-sizing:border-box}
  .faq-policies-form .field input,
  .faq-policies-form .field textarea{font-size:16px}
  .service-item-head{grid-template-columns:1fr}
  .sh-hours-thead{display:none}
  .sh-hours-wrap{border:none;border-radius:0;background:transparent;overflow:visible}
  .sh-hours-wrap .hours-grid{display:grid;gap:18px;background:transparent}
  .sh-hours-wrap .hours-row{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    grid-template-rows:auto auto;
    gap:8px 10px;
    padding:0;
    border-bottom:none;
    background:transparent;
  }
  .sh-hours-wrap .hours-day{
    grid-column:1;
    grid-row:1;
    align-self:center;
    min-width:0;
  }
  .sh-hours-wrap .hours-closed-cell{
    grid-column:2;
    grid-row:1;
    justify-self:end;
    align-self:center;
  }
  .sh-hours-wrap .hours-field-open{
    grid-column:1;
    grid-row:2;
  }
  .sh-hours-wrap .hours-field-close{
    grid-column:2;
    grid-row:2;
  }
  .sh-hours-wrap .small-field label{display:block}
  .sh-hours-wrap .small-field{margin-bottom:0}
}
`;

const styles: string[] = [...userDashboardStyles, userSettingsSpecificStyles, userPortalTypographyStyles];

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
