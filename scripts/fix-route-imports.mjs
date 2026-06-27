import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SHARED = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app-shared.ts';
const ROUTES_DIR = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/routes';

const sharedSrc = readFileSync(SHARED, 'utf-8');

// Collect ALL exported names from app-shared.ts
// 1. Direct exports: `export const/function/type/interface/let NAME`
// 2. Re-export values: `export { A, B } from '...'`
// 3. Re-export types: `export type { C, D } from '...'`
const allExportedNames = new Set();

// Direct exports
const directRegex = /^export (?:const|function|type|async function|interface|let) (\w+)/gm;
let m;
while ((m = directRegex.exec(sharedSrc)) !== null) allExportedNames.add(m[1]);

// Re-export values: `export { A, B, C } from '...'`
const reExportValueRegex = /^export \{([^}]+)\} from/gm;
while ((m = reExportValueRegex.exec(sharedSrc)) !== null) {
  for (const part of m[1].split(',')) {
    const name = part.trim().replace(/^type\s+/, '');
    const asMatch = name.match(/^(\w+)\s+as\s+(\w+)$/);
    allExportedNames.add(asMatch ? asMatch[2] : name);
  }
}

// Re-export types: `export type { A, B } from '...'`
const reExportTypeRegex = /^export type \{([^}]+)\} from/gm;
while ((m = reExportTypeRegex.exec(sharedSrc)) !== null) {
  for (const part of m[1].split(',')) {
    const name = part.trim();
    const asMatch = name.match(/^(\w+)\s+as\s+(\w+)$/);
    allExportedNames.add(asMatch ? asMatch[2] : name);
  }
}

const allNames = [...allExportedNames].filter(n => /^\w+$/.test(n)).sort();
console.log(`Total exported names: ${allNames.length}`);

// For each route file, replace the import block
const newImportBlock = `import {\n  ${allNames.join(',\n  ')},\n} from '../app-shared';\n`;

const routeFiles = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts'));
for (const file of routeFiles) {
  const filePath = `${ROUTES_DIR}/${file}`;
  const src = readFileSync(filePath, 'utf-8');

  // Find the existing import block from '../app-shared'
  // It starts with `import {\n` and ends with `} from '../app-shared';\n`
  const importStart = src.indexOf("import {\n");
  const importEnd = src.indexOf("} from '../app-shared';\n");
  if (importStart < 0 || importEnd < 0) {
    console.log(`SKIP ${file} (no app-shared import found)`);
    continue;
  }
  const importEndFull = importEnd + "} from '../app-shared';\n".length;

  const newSrc = src.slice(0, importStart) + newImportBlock + src.slice(importEndFull);
  writeFileSync(filePath, newSrc);
  console.log(`Updated ${file}`);
}
