import pathlib

APP = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
ROUTES = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes')
lines = APP.read_text().split('\n')

def find_route_line(path_str):
    for i, line in enumerate(lines):
        if f"path('{path_str}')" in line and 'app.' in line:
            return i
    return None

# System routes: /runtime (821) and /metrics (844), ends before /public/blog/posts (861)
sys_start = find_route_line('/runtime')
sys_end = find_route_line('/public/blog/posts')
print(f'System: lines {sys_start+1}-{sys_end} ({sys_end-sys_start} lines)')
sys_code = '\n'.join(lines[sys_start:sys_end])

system_file = '''import type { Hono } from 'hono';
import {
  ensureInternalAccess,
  securityAudit,
  getClientIp,
  resolveEmailProviderMode,
  getMetricsSnapshot,
} from '../app-shared';

type SystemDeps = {
  runtimeInfo?: {
    mode: 'memory' | 'supabase';
    commProvider: 'noop' | 'telnyx';
    agentRuntimeMode?: 'mock' | 'livekit_realtime';
    agentTransportMode?: 'mock' | 'livekit';
    agentVoiceProviderMode?: 'none' | 'gemini_live' | 'openai_realtime';
  };
};

export function registerSystemRoutes(app: Hono, path: (route: string) => string, deps: SystemDeps): void {
''' + sys_code + '''
}
'''
(ROUTES / 'system.ts').write_text(system_file)
print(f'Wrote system.ts ({system_file.count(chr(10))} lines)')

# Public routes: /public/blog/posts (861) to /public/demo/request (1135)
pub_start = find_route_line('/public/blog/posts')
pub_end = find_route_line('/public/demo/request')
print(f'Public: lines {pub_start+1}-{pub_end} ({pub_end-pub_start} lines)')
pub_code = '\n'.join(lines[pub_start:pub_end])

public_file = '''import type { Hono } from 'hono';
import {
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  blogPostListQuerySchema,
  publicContactRequestSchema,
  verifyTurnstileToken,
  escapeHtml,
  emailDefaultFrom,
  emailFounderFrom,
  emailReplyTo,
  contactSalesEmail,
  buildDemoRequestCustomerEmailPayload,
  renderBaseEmailHtml,
  randomUUID,
} from '../app-shared';
import { logger } from '@/src/backend/observability/logger';
import type { BlogPostsRepository, ContactRequestsRepository } from '../app-shared';
import type { EmailService } from '../app-shared';

type PublicDeps = {
  blogPostsRepository?: BlogPostsRepository;
  contactRequestsRepository?: ContactRequestsRepository;
  emailService?: EmailService;
};

export function registerPublicRoutes(app: Hono, path: (route: string) => string, deps: PublicDeps): void {
''' + pub_code + '''
}
'''
(ROUTES / 'public.ts').write_text(public_file)
print(f'Wrote public.ts ({public_file.count(chr(10))} lines)')
