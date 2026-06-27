#!/usr/bin/env node
/**
 * Mechanical splitter: extracts all module-level code (lines 234-2972) from app.ts
 * into app-shared.ts, and rewrites app.ts to import those names.
 *
 * Safety: NO behavior change. Only moves declarations to a new file + adds imports.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP_TS = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts';
const SHARED_TS = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app-shared.ts';

const src = readFileSync(APP_TS, 'utf-8');
const lines = src.split('\n');

// Line 234 (1-indexed) = index 233. Line 2972 = index 2971. Line 2973 = index 2972.
const IMPORTS_END = 233;        // last import line (0-indexed 232, line 233)
const MODULE_CODE_START = 233;  // line 234 (0-indexed)
const MODULE_CODE_END = 2972;   // line 2972 (0-indexed 2971), inclusive — last line before createBackendApp
const FUNC_START = 2972;        // line 2973 (0-indexed 2972)

const importLines = lines.slice(0, IMPORTS_END);     // lines 1-233 (0-indexed 0-232)
const moduleCodeLines = lines.slice(MODULE_CODE_START, MODULE_CODE_END); // lines 234-2972
const funcLines = lines.slice(FUNC_START);            // lines 2973-end

// --- Add `export` prefix to top-level declarations in moduleCodeLines ---
// Match both `const/function/type/...` AND `export const/export function/...` (already exported)
const exportablePattern = /^(?:export\s+)?(?:const |function |type |async function |interface |let )/;
const alreadyExportedPattern = /^export\s+/;
const nameExtractPattern = /^(?:export\s+)?(?:const|function|type|async function|interface|let)\s+(\w+)/;
const exportedNames = [];
const processedModuleLines = moduleCodeLines.map((line) => {
  // Only process lines at column 0 (no leading whitespace)
  if (exportablePattern.test(line)) {
    // Extract name
    const match = line.match(nameExtractPattern);
    if (match) {
      exportedNames.push(match[1]);
    }
    // Only add `export` if not already exported
    if (alreadyExportedPattern.test(line)) {
      return line;
    }
    return 'export ' + line;
  }
  return line;
});

// --- Build app-shared.ts ---
// All imports + the module-level code (with exports added)
const sharedContent = [
  ...importLines,
  '',
  '// Auto-extracted from app.ts by scripts/split-app-ts.mjs',
  '// All module-level schemas, helpers, constants, and types live here.',
  '// Do not edit manually — re-run the script if app.ts module-level code changes.',
  '',
  ...processedModuleLines,
  '',
].join('\n');

writeFileSync(SHARED_TS, sharedContent);
console.log(`Wrote ${SHARED_TS} (${processedModuleLines.length} lines, ${exportedNames.length} exports)`);

// --- Build new app.ts ---
// All imports + import from app-shared + createBackendApp function
const importFromShared = `import {\n  ${exportedNames.join(',\n  ')},\n} from './app-shared';\n`;

const newAppContent = [
  ...importLines,
  '',
  importFromShared,
  ...funcLines,
].join('\n');

writeFileSync(APP_TS, newAppContent);
console.log(`Rewrote ${APP_TS} (${funcLines.length} function lines)`);
console.log(`Imported ${exportedNames.length} names from app-shared`);
