#!/usr/bin/env node
/**
 * Extract route blocks from app.ts into separate module files.
 * Each module exports registerXxxRoutes(app, ctx) that registers routes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const APP_TS = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts';
const ROUTES_DIR = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes';
const SHARED_TS = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app-shared.ts';

mkdirSync(ROUTES_DIR, { recursive: true });

const src = readFileSync(APP_TS, 'utf-8');
const lines = src.split('\n');

// --- Find all "anchor" lines: route registrations + closure functions ---
const routeRegex = /^\s+app\.(get|post|put|patch|delete|use)\(\s*(?:path\()?['"`]/;
const closureRegex = /^  (?:const|let|function|async function)\s+(\w+)\s*=\s*(?:async\s*)?\(?.*\)?\s*=>?\s*\{?/;

const anchors = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (routeRegex.test(line)) {
    const pathMatch = line.match(/path\(\s*['"`]([^'"`]+)['"`]/);
    const path = pathMatch ? pathMatch[1] : '';
    anchors.push({ line: i + 1, type: 'route', path, raw: line });
  } else if (closureRegex.test(line) && i > 500 && i < 10600) {
    const nameMatch = line.match(/(?:const|let|function|async function)\s+(\w+)/);
    const name = nameMatch ? nameMatch[1] : '';
    if (name && !['app', 'path', 'platformSyncLastRunByShop', 'getPlatformSyncDeps', 'enqueueLifecycleEmail'].includes(name)) {
      anchors.push({ line: i + 1, type: 'closure', name, raw: line });
    }
  }
}

const returnAppLine = lines.findIndex((l) => l.trim() === 'return app;');
if (returnAppLine >= 0) anchors.push({ line: returnAppLine + 1, type: 'end' });
anchors.sort((a, b) => a.line - b.line);

for (let i = 0; i < anchors.length - 1; i++) anchors[i].endLine = anchors[i + 1].line - 1;
anchors[anchors.length - 1].endLine = lines.length;

// --- Group by domain ---
function getDomain(anchor) {
  if (anchor.type === 'closure') {
    if (anchor.name.includes('Vagaro') || anchor.name.includes('vagaro')) return 'webhooks';
    return 'user-billing';
  }
  const p = anchor.path || '';
  if (p.startsWith('/health') || p.startsWith('/readiness')) return 'health';
  if (p.startsWith('/webhooks') || p.startsWith('/telnyx')) return 'webhooks';
  if (p.startsWith('/runtime') || p.startsWith('/metrics')) return 'system';
  if (p.startsWith('/public/blog') || p.startsWith('/public/contact')) return 'public';
  if (p.startsWith('/public/demo') || p.startsWith('/internal/sales')) return 'demo';
  if (p.startsWith('/auth')) return 'auth';
  if (p.startsWith('/user/dashboard') || p.startsWith('/user/notifications') || p.startsWith('/user/onboarding') ||
      p.startsWith('/user/business-knowledge') || p.startsWith('/user/read-website') || p.startsWith('/user/go-live') ||
      p.startsWith('/user/nav-state') || p.startsWith('/user/test-call') || p.startsWith('/user/test-calls')) return 'user-dashboard';
  if (p.startsWith('/user/calls') || p.startsWith('/user/bookings')) return 'user-calls-bookings';
  if (p.startsWith('/user/settings') || p.startsWith('/user/staff') || p.startsWith('/user/integrations/preferences') ||
      p.startsWith('/user/password') || p.startsWith('/user/phone-numbers')) return 'user-settings-staff';
  if (p.startsWith('/user/calendar') || p.startsWith('/user/platform-sync')) return 'user-integrations';
  if (p.startsWith('/user/billing')) return 'user-billing';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/jobs') || p.startsWith('/agent')) return 'agent-jobs';
  return 'misc';
}

const groups = {};
const groupOrder = [];
for (const anchor of anchors) {
  const domain = getDomain(anchor);
  if (!groups[domain]) { groups[domain] = []; groupOrder.push(domain); }
  groups[domain].push(anchor);
}

function extractBlock(anchor) {
  return lines.slice(anchor.line - 1, anchor.endLine).join('\n');
}

// --- Read export names from app-shared.ts ---
const sharedSrc = readFileSync(SHARED_TS, 'utf-8');
const exportNameRegex = /^export (?:const|function|type|async function|interface|let) (\w+)/gm;
const exportNames = [];
let m;
while ((m = exportNameRegex.exec(sharedSrc)) !== null) exportNames.push(m[1]);
const sharedImportBlock = `import {\n  ${exportNames.join(',\n  ')},\n} from '../app-shared';\n`;

const moduleOrder = ['health', 'webhooks', 'system', 'public', 'demo', 'auth',
  'user-dashboard', 'user-calls-bookings', 'user-settings-staff',
  'user-integrations', 'user-billing', 'admin', 'agent-jobs'];

const registerCalls = [];
for (const domain of moduleOrder) {
  if (!groups[domain]) continue;
  const blocks = groups[domain].map(extractBlock);
  const code = blocks.join('\n\n');
  const fnName = `register${domain.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')}Routes`;
  const fileName = `${domain}.ts`;
  const fileContent = `${sharedImportBlock}\nimport type { Hono } from 'hono';\nimport type { RouteContext } from '../route-context';\n\nexport function ${fnName}(app: Hono, ctx: RouteContext): void {\n  const { deps, path, enqueueLifecycleEmail, platformSyncLastRunByShop, getPlatformSyncDeps } = ctx;\n\n${code}\n}\n`;
  writeFileSync(`${ROUTES_DIR}/${fileName}`, fileContent);
  console.log(`Wrote routes/${fileName} (${groups[domain].length} blocks)`);
  registerCalls.push(fnName);
}
console.log(`\nTotal modules: ${registerCalls.length}`);
console.log('Register calls: ' + registerCalls.map(fn => `${fn}(app, ctx);`).join(' '));
