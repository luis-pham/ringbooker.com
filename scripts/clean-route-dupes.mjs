import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const ROUTES_DIR = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes';
const files = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts'));
for (const f of files) {
  const fp = `${ROUTES_DIR}/${f}`;
  let src = readFileSync(fp, 'utf-8');
  // Remove the duplicate import lines that extract-routes.mjs added
  src = src.replace(/^import type \{ Hono \} from 'hono';\n/gm, '');
  src = src.replace(/^import type \{ RouteContext \} from '\.\.\/route-context';\n/gm, '');
  writeFileSync(fp, src);
  console.log(`Cleaned ${f}`);
}
