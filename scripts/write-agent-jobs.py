import pathlib, json

p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes/agent-jobs.ts')

# Read the exact code from current app.ts (before replacement)
# Find /jobs/enqueue route and app.notFound
app_ts = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
app_lines = app_ts.read_text().split('\n')
start_idx = None
end_idx = None
for i, line in enumerate(app_lines):
    if start_idx is None and "app.post(path('/jobs/enqueue')" in line:
        start_idx = i
    if start_idx is not None and "app.notFound(" in line:
        end_idx = i
        break
route_code = '\n'.join(app_lines[start_idx:end_idx])
print(f'Extracted routes from line {start_idx+1} to {end_idx} ({end_idx - start_idx} lines)')

# Build the module file
header = '''import type { Hono } from 'hono';
import {
  ensureInternalAccess,
  ensureRealtimeDispatchAccess,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  requireLivekitRealtimeInProduction,
  createInboundAgentSession,
  handleRealtimeDispatch,
  parseRealtimeDispatchInput,
  enqueueJobSchema,
  simulateInboundSchema,
  startInboundSchema,
  dispatchStatusSchema,
  mapDispatchStatusToDemoCallStatus,
  logger,
  randomUUID,
} from '../app-shared';
import type { JobType } from '../app-shared';

type AgentJobsDeps = {
  jobsRepository?: {
    enqueue(params: {
      shopId: string;
      type: JobType;
      payload: Record<string, unknown>;
      runAt: Date;
      idempotencyKey: string;
    }): Promise<unknown>;
  };
  bookingsRepository?: unknown;
  callbacksRepository?: unknown;
  shopsRepository?: unknown;
  telephonyService?: unknown;
  shopRoutingRulesRepository?: unknown;
  realtimeAgentRuntime?: {
    startInboundSession(params: unknown): Promise<unknown>;
  };
  callLogsRepository?: {
    markAgentJoined(params: { shopId: string; requestId: string; roomName: string }): Promise<unknown>;
    updateTranscriptStatusByRequestId(params: {
      shopId: string;
      requestId: string;
      status: 'completed' | 'failed';
    }): Promise<unknown>;
  };
  demoSessionsRepository?: {
    markCallRunStatusByRequestId(params: {
      requestId: string;
      status: string;
      connectedAt?: Date;
      endedAt?: Date;
      outcome?: string;
    }): Promise<unknown>;
    addStatusEvent(params: {
      requestId: string;
      eventType: string;
      payload: Record<string, unknown>;
      occurredAt: Date;
    }): Promise<unknown>;
  };
};

export function registerAgentJobsRoutes(app: Hono, path: (route: string) => string, deps: AgentJobsDeps): void {
'''

footer = '\n}\n'

content = header + route_code + footer
p.write_text(content)
print(f'Wrote {p} ({content.count(chr(10))} lines)')
