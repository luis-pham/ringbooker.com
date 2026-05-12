import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

const callsPortalStyles = String.raw`
.page-calls{max-width:1100px;margin:0 auto;width:100%}
.calls-error{margin-bottom:16px;color:#b91c1c;font-size:13px}
.calls-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:28px}
.calls-metric-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;min-height:84px}
.calls-metric-card p{margin:0 0 4px;font-size:13px;color:#6b7280;line-height:1.35}
.calls-metric-card strong{display:block;font-size:24px;line-height:1;font-weight:600;letter-spacing:-.02em;color:#111}
.calls-stat-icon{width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:#111}
.calls-stat-icon--blue{background:#dbeafe}
.calls-stat-icon--purple{background:#f5f3ff}
.calls-stat-icon--amber{background:#fef3c7}
.calls-stat-icon--red{background:#fee2e2}
.calls-filter-bar{margin-bottom:32px}
.calls-filter-tabs{display:flex;align-items:flex-end;gap:24px;border-bottom:1.5px solid #e5e7eb;overflow-x:auto;scrollbar-width:none}
.calls-filter-tabs::-webkit-scrollbar{display:none}
.calls-filter-tab{appearance:none;background:transparent;border:0;border-bottom:2px solid transparent;color:#6b7280;cursor:pointer;font:inherit;font-size:14px;font-weight:500;line-height:1.35;padding:0 0 10px;white-space:nowrap}
.calls-filter-tab.active{color:#111;border-bottom-color:#111}
.calls-filter-tab span{margin-left:5px;font-size:12px;color:#9ca3af}
.calls-list-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.calls-table{width:100%;border-collapse:collapse;table-layout:fixed}
.calls-table th{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;text-align:left;padding:10px 20px;border-bottom:1px solid #f3f4f6}
.calls-table th:nth-child(1){width:32%}
.calls-table th:nth-child(2){width:20%}
.calls-table th:nth-child(3){width:20%}
.calls-table th:nth-child(4){width:14%}
.calls-table th:nth-child(5){width:14%;text-align:right}
.calls-table td{padding:0 20px;height:56px;border-bottom:1px solid #f3f4f6;vertical-align:middle;font-size:13px;color:#111}
.calls-table td:nth-child(5){text-align:right}
.calls-table tbody tr:last-child td{border-bottom:none}
.calls-table tbody tr{cursor:pointer;border-left:3px solid transparent}
.calls-table tbody tr:hover{background:#fafafa}
.calls-table tbody tr.is-high-urgency{border-left-color:#dc2626}
.calls-table tbody tr.is-high-urgency:hover{background:#fef9f9}
.calls-table tbody tr.is-follow-up:not(.is-high-urgency){border-left-color:#f59e0b}
.calls-row-caller{display:flex;align-items:center;gap:10px;min-width:0}
.calls-caller-avatar{width:30px;height:30px;border-radius:50%;background:#f5f3ff;color:#7c3aed;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.calls-caller-body{min-width:0}
.calls-caller-line1{display:flex;align-items:center;gap:8px;min-width:0}
.calls-caller-phone{font-size:13px;font-weight:500;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.calls-repeat-badge{background:#f5f3ff;color:#7c3aed;font-size:11px;padding:2px 8px;border-radius:20px;white-space:nowrap}
.calls-caller-routed{font-size:11px;color:#9ca3af;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.calls-table-datetime{font-size:13px;color:#6b7280;line-height:1.4}
.calls-table-datetime span{display:block;color:#9ca3af;font-size:11px;margin-top:2px}
.calls-outcome{display:inline-flex;align-items:center;border-radius:20px;background:#f3f4f6;color:#6b7280;font-size:12px;font-weight:500;padding:3px 8px;white-space:nowrap}
.calls-outcome-link{border:0;cursor:pointer;font-family:inherit}.calls-outcome-link:hover{box-shadow:0 0 0 1px currentColor inset}
.calls-outcome--booking{background:#f0fdf4;color:#16a34a}
.calls-outcome--followup{background:#fefce8;color:#ca8a04}
.calls-outcome--complaint{background:#fef2f2;color:#dc2626}
.calls-outcome--muted{background:#f9fafb;color:#9ca3af}
.calls-status{display:inline-flex;align-items:center;border-radius:20px;font-size:11px;font-weight:500;padding:3px 9px;white-space:nowrap}
.calls-status--progress{background:#fef3c7;color:#92400e}
.calls-status--completed{background:#f3f4f6;color:#6b7280}
.calls-status--missed{background:#fef2f2;color:#dc2626}
.calls-transcript-view-btn{appearance:none;background:#fff;border:1px solid #e5e7eb;border-radius:8px;color:#374151;cursor:pointer;font:inherit;font-size:12px;font-weight:500;padding:5px 12px;transition:border-color .15s ease,color .15s ease}
.calls-transcript-view-btn:hover{border-color:#7c3aed;color:#7c3aed}
.calls-transcript-pending{font-size:12px;color:#9ca3af}
.calls-empty{padding:54px 20px;text-align:center;color:#6b7280}
.calls-empty-icon{font-size:32px;opacity:.3;margin-bottom:10px}
.calls-empty h3{margin:0 0 6px;font-size:15px;font-weight:600;color:#111}
.calls-empty p{margin:0 auto 18px;max-width:340px;font-size:13px;line-height:1.5;color:#6b7280}
.calls-empty-btn{display:inline-flex;align-items:center;justify-content:center;height:38px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:0 16px}
.calls-pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;color:#6b7280;font-size:13px}
.calls-pager-btn{appearance:none;background:#fff;border:1px solid #e5e7eb;border-radius:8px;color:#374151;cursor:pointer;font:inherit;font-size:12px;font-weight:500;padding:8px 12px}
.calls-pager-btn:disabled{opacity:.45;cursor:not-allowed}
.mobile-calls{display:none}
.mobile-call-card{appearance:none;text-align:left;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;cursor:pointer;color:inherit}
.mobile-call-card.is-high-urgency{border-left:3px solid #dc2626}
.mobile-call-card.is-follow-up:not(.is-high-urgency){border-left:3px solid #f59e0b}
.mobile-call-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.mobile-call-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.modal-backdrop{position:fixed;inset:0;background:rgba(17,24,39,.58);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;z-index:160}
.modal-card{width:min(760px,100%);max-height:min(88vh,900px);overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 24px 80px rgba(17,24,39,.18);padding:22px}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.modal-title h3{margin:0;font-size:15px;font-weight:600;color:#111}
.modal-title p{margin:6px 0 0;color:#6b7280;font-size:13px}
.modal-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px}
.meta-tile{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#f9fafb}
.meta-tile strong{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:5px}
.meta-tile span{font-size:13px;color:#111}
.summary-panel,.transcript-note{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px;font-size:13px;line-height:1.6;color:#111;white-space:pre-wrap;margin-bottom:14px}
.transcript-toggle{margin-bottom:12px}
@media (max-width:900px){
  .calls-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .calls-table-desktop{display:none}
  .mobile-calls{display:flex;flex-direction:column;gap:10px;padding:10px}
}
@media (max-width:640px){
  .calls-metric-grid{grid-template-columns:1fr}
  .calls-metric-card{min-height:72px}
  .modal-backdrop{padding:10px}
  .modal-card{padding:18px;border-radius:16px}
  .modal-meta{grid-template-columns:1fr}
}
`;

export const userCallsStyles: string[] = [...userDashboardStyles, callsPortalStyles];
export const userCallsScripts: string[] = [];
export const templateTitle = 'Calls';

export function UserCallsTemplate() {
  return <UserLayout styles={userCallsStyles} scripts={userCallsScripts} scriptPrefix="user-calls-template"><div /></UserLayout>;
}
