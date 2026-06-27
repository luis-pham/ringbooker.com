import pathlib

APP = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
ROUTES = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes')
lines = APP.read_text().split('\n')

# Find first admin route and last admin route (/admin/users/invite)
admin_start = None
admin_end = None
for i, line in enumerate(lines):
    if admin_start is None and "app.get(path('/admin/system-health/metrics')" in line:
        admin_start = i
    if admin_start is not None and "app.post(path('/admin/users/invite')" in line:
        admin_end = i + 1  # include this line
        # find the end of this route block (next '  app.' or '  register' or '}')
        for j in range(admin_end, len(lines)):
            if lines[j].startswith('  app.') or lines[j].startswith('  register') or lines[j].startswith('  }'):
                admin_end = j
                break
        break

print(f'Admin: lines {admin_start+1}-{admin_end+1} ({admin_end-admin_start} lines)')
admin_code = '\n'.join(lines[admin_start:admin_end])

# Admin deps - import all types from ports
admin_file = '''import type { Hono } from 'hono';
import {
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  requireSession,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  getMetricsSnapshot,
  collectEmailLifecycleDiagnostics,
  buildAdminShopStatus,
  buildAdminTrialEndingSoonWatchlist,
  getShopUsageForPeriod,
  getBillingPeriodForShop,
  escapeHtml,
  normalizePhone,
  parseAdminResourceUuid,
  parseAdminShopIdParam,
  toAdminFacingShop,
  stripSensitiveShopFields,
  timingSafeStringEqual,
  getEnv,
} from '../app-shared';
import { logger } from '@/src/backend/observability/logger';
import { randomUUID } from 'node:crypto';
import type {
  ShopsRepository,
  CallLogsRepository,
  BookingsRepository,
  BlogPostsRepository,
  ContactRequestsRepository,
  DemoSessionsRepository,
  AuthUsersRepository,
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopOverageChargesRepository,
  ShopUsageAlertsRepository,
  BillingNotificationsRepository,
  ShopAccessStatesRepository,
  CommercialGoLiveApprovalEventsRepository,
  ShopLocationsRepository,
  ShopRoutingRulesRepository,
  CommercialAccountsRepository,
  ShopActiveCallSessionsRepository,
  TestCallAttemptsRepository,
  ForwardingTestSessionsRepository,
  CallbacksRepository,
  CustomersRepository,
  OutboundMessagesRepository,
  HandoffSessionsRepository,
  VoiceCallLegsRepository,
  MissedCallsRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
} from '@/src/backend/ports/repositories';
import type { WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import type { EmailService } from '@/src/backend/services/email/types';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import type { DashboardChartPeriod } from '@/src/backend/services/admin-dashboard-chart-series';
import { getChartRangeSpec, aggregateIntoBuckets } from '@/src/backend/services/admin-dashboard-chart-series';
import type {
  Shop,
  BillingSubscription,
  BillingSubscriptionStatus,
  ShopAccessState,
  ContactRequestStatus,
} from '@/src/backend/domain/types';
import type { AdminTrialEndingSoonItem } from '@/src/backend/services/admin/admin-dashboard-trial-watchlist';

type AdminDeps = {
  shopsRepository?: ShopsRepository;
  callLogsRepository?: CallLogsRepository;
  bookingsRepository?: BookingsRepository;
  blogPostsRepository?: BlogPostsRepository;
  contactRequestsRepository?: ContactRequestsRepository;
  demoSessionsRepository?: DemoSessionsRepository;
  webDemoSessionsRepository?: WebDemoSessionsRepository;
  salesPreparedDemosRepository?: SalesPreparedDemosRepository;
  authUsersRepository?: AuthUsersRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopOverageChargesRepository?: ShopOverageChargesRepository;
  shopUsageAlertsRepository?: ShopUsageAlertsRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  commercialGoLiveApprovalEventsRepository?: CommercialGoLiveApprovalEventsRepository;
  shopLocationsRepository?: ShopLocationsRepository;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
  callbacksRepository?: CallbacksRepository;
  customersRepository?: CustomersRepository;
  outboundMessagesRepository?: OutboundMessagesRepository;
  handoffSessionsRepository?: HandoffSessionsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  missedCallsRepository?: MissedCallsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
  emailService?: EmailService;
  billingProvider?: BillingProviderAdapter;
};

export function registerAdminRoutes(app: Hono, path: (route: string) => string, deps: AdminDeps): void {
''' + admin_code + '''
}
'''
(ROUTES / 'admin.ts').write_text(admin_file)
print(f'Wrote admin.ts ({admin_file.count(chr(10))} lines)')
