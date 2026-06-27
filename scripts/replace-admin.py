import pathlib

p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
lines = p.read_text().split('\n')

admin_start = None
admin_end = None
for i, line in enumerate(lines):
    if admin_start is None and "app.get(path('/admin/system-health/metrics')" in line:
        admin_start = i
    if admin_start is not None and "app.post(path('/admin/users/invite')" in line:
        admin_end = i + 1
        for j in range(admin_end, len(lines)):
            if lines[j].startswith('  app.') or lines[j].startswith('  register') or lines[j].startswith('  }'):
                admin_end = j
                break
        break

print(f'Replacing admin: lines {admin_start+1}-{admin_end+1} ({admin_end-admin_start} lines)')

replacement = [
    '  registerAdminRoutes(app, path, {',
    '    shopsRepository: deps.shopsRepository,',
    '    callLogsRepository: deps.callLogsRepository,',
    '    bookingsRepository: deps.bookingsRepository,',
    '    blogPostsRepository: deps.blogPostsRepository,',
    '    contactRequestsRepository: deps.contactRequestsRepository,',
    '    demoSessionsRepository: deps.demoSessionsRepository,',
    '    webDemoSessionsRepository: deps.webDemoSessionsRepository,',
    '    salesPreparedDemosRepository: deps.salesPreparedDemosRepository,',
    '    authUsersRepository: deps.authUsersRepository,',
    '    billingCustomersRepository: deps.billingCustomersRepository,',
    '    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,',
    '    shopOverageChargesRepository: deps.shopOverageChargesRepository,',
    '    shopUsageAlertsRepository: deps.shopUsageAlertsRepository,',
    '    billingNotificationsRepository: deps.billingNotificationsRepository,',
    '    shopAccessStatesRepository: deps.shopAccessStatesRepository,',
    '    commercialGoLiveApprovalEventsRepository: deps.commercialGoLiveApprovalEventsRepository,',
    '    shopLocationsRepository: deps.shopLocationsRepository,',
    '    shopRoutingRulesRepository: deps.shopRoutingRulesRepository,',
    '    commercialAccountsRepository: deps.commercialAccountsRepository,',
    '    shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,',
    '    testCallAttemptsRepository: deps.testCallAttemptsRepository,',
    '    forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,',
    '    callbacksRepository: deps.callbacksRepository,',
    '    customersRepository: deps.customersRepository,',
    '    outboundMessagesRepository: deps.outboundMessagesRepository,',
    '    handoffSessionsRepository: deps.handoffSessionsRepository,',
    '    voiceCallLegsRepository: deps.voiceCallLegsRepository,',
    '    missedCallsRepository: deps.missedCallsRepository,',
    '    shopStaffRepository: deps.shopStaffRepository,',
    '    shopStaffServicesRepository: deps.shopStaffServicesRepository,',
    '    emailService: deps.emailService,',
    '    billingProvider: deps.billingProvider,',
    '  });',
    '',
]

new_lines = lines[:admin_start] + replacement + lines[admin_end:]
p.write_text('\n'.join(new_lines))
print(f'New file: {len(new_lines)} lines')