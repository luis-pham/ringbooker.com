import pathlib

p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
lines = p.read_text().split('\n')

# Find the /jobs/enqueue route line and the app.notFound line
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if start_idx is None and "app.post(path('/jobs/enqueue')" in line:
        start_idx = i  # 0-indexed
    if start_idx is not None and "app.notFound(" in line:
        end_idx = i  # 0-indexed, line with app.notFound (keep it)
        break

print(f'Found /jobs/enqueue at line {start_idx+1}, app.notFound at line {end_idx+1}')

# Replace lines start_idx..end_idx-1 with registerAgentJobsRoutes call
replacement = [
    '  registerAgentJobsRoutes(app, path, {',
    '    jobsRepository: deps.jobsRepository,',
    '    bookingsRepository: deps.bookingsRepository,',
    '    callbacksRepository: deps.callbacksRepository,',
    '    shopsRepository: deps.shopsRepository,',
    '    telephonyService: deps.telephonyService,',
    '    shopRoutingRulesRepository: deps.shopRoutingRulesRepository,',
    '    realtimeAgentRuntime: deps.realtimeAgentRuntime,',
    '    callLogsRepository: deps.callLogsRepository,',
    '    demoSessionsRepository: deps.demoSessionsRepository,',
    '  });',
    '',
]

new_lines = lines[:start_idx] + replacement + lines[end_idx:]
p.write_text('\n'.join(new_lines))
print(f'Replaced lines {start_idx+1}-{end_idx} with registerAgentJobsRoutes call')
print(f'New file: {len(new_lines)} lines')