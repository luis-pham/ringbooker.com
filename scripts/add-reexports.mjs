import { readFileSync, writeFileSync } from 'node:fs';

const SHARED = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app-shared.ts';
const src = readFileSync(SHARED, 'utf-8');
const lines = src.split('\n');

// Remove existing re-export block (added by previous run)
const reExportStart = lines.findIndex(l => l.includes('// --- Re-exports of imported names for route modules ---'));
if (reExportStart >= 0) {
  lines.splice(reExportStart);
}
const cleanSrc = lines.join('\n').trimEnd() + '\n';

// Re-parse imports from cleaned source
const cleanLines = cleanSrc.split('\n');
const importLineRegex = /^import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/;

// Collect: which names are type-only vs value
// Heuristic: names imported with `import type { ... }` are type-only
// Names imported with `import { type X, Y }` — X is type-only, Y is value
const typeNames = new Set();
const valueNames = new Set();

for (const line of cleanLines) {
  const m = line.match(importLineRegex);
  if (!m) continue;
  const isTypeImport = /^import\s+type\s+/.test(line);
  const namesBlock = m[1];
  const parts = namesBlock.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const cleaned = part.replace(/^type\s+/, '');
    const asMatch = cleaned.match(/^(\w+)\s+as\s+(\w+)$/);
    const name = asMatch ? asMatch[2] : cleaned;
    if (!/^\w+$/.test(name)) continue;
    if (isTypeImport || part.startsWith('type ')) {
      typeNames.add(name);
    } else {
      valueNames.add(name);
    }
  }
}

// Build re-export lines
const reExportLines = [];
// Group value names by source for re-export
const valueBySource = new Map();
const typeBySource = new Map();

for (const line of cleanLines) {
  const m = line.match(importLineRegex);
  if (!m) continue;
  const namesBlock = m[1];
  const source = m[2];
  const isTypeImport = /^import\s+type\s+/.test(line);
  const parts = namesBlock.split(',').map(s => s.trim()).filter(Boolean);
  const vNames = [];
  const tNames = [];
  for (const part of parts) {
    const cleaned = part.replace(/^type\s+/, '');
    const asMatch = cleaned.match(/^(\w+)\s+as\s+(\w+)$/);
    const name = asMatch ? asMatch[2] : cleaned;
    if (!/^\w+$/.test(name)) continue;
    if (isTypeImport || part.startsWith('type ')) {
      tNames.push(name);
    } else {
      vNames.push(name);
    }
  }
  if (vNames.length > 0) {
    if (!valueBySource.has(source)) valueBySource.set(source, new Set());
    vNames.forEach(n => valueBySource.get(source).add(n));
  }
  if (tNames.length > 0) {
    if (!typeBySource.has(source)) typeBySource.set(source, new Set());
    tNames.forEach(n => typeBySource.get(source).add(n));
  }
}

for (const [source, names] of valueBySource) {
  const arr = [...names];
  reExportLines.push(`export { ${arr.join(', ')} } from '${source}';`);
}
for (const [source, names] of typeBySource) {
  const arr = [...names];
  reExportLines.push(`export type { ${arr.join(', ')} } from '${source}';`);
}

const newSrc = cleanSrc + '\n// --- Re-exports of imported names for route modules ---\n' + reExportLines.join('\n') + '\n';
writeFileSync(SHARED, newSrc);
console.log(`Rewrote ${reExportLines.length} re-export lines (${valueBySource.size} value, ${typeBySource.size} type)`);
