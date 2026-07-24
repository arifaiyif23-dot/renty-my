import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const DIST = join(ROOT, 'dist');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const BUDGETS = {
  'index.css': { warn: 80, error: 120 },       // main CSS
  'index': { warn: 200, error: 350 },          // main JS entry
  'vendor-react': { warn: 150, error: 200 },
  'vendor-ui': { warn: 100, error: 150 },
  'vendor-supabase': { warn: 150, error: 200 },
  'vendor-query': { warn: 50, error: 80 },
  'vendor-forms': { warn: 80, error: 120 },
  'vendor-recharts': { warn: 350, error: 500 },
  'default': { warn: 80, error: 150 },
};

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findBudget(name, file) {
  // Check for CSS-specific rules first (e.g. index.css)
  if (file.endsWith('.css')) {
    for (const [key, budget] of Object.entries(BUDGETS)) {
      if (key.endsWith('.css') && name.includes(key.replace('.css', ''))) return budget;
    }
  }
  for (const [key, budget] of Object.entries(BUDGETS)) {
    if (!key.endsWith('.css') && name.includes(key)) return budget;
  }
  return BUDGETS.default;
}

function getGzipSize(fp) {
  try {
    return gzipSync(readFileSync(fp)).length;
  } catch {
    return null;
  }
}

if (!existsSync(join(DIST, 'assets'))) {
  console.error(`${RED}dist/assets/ not found. Run "npm run build" first.${RESET}`);
  process.exit(1);
}

console.log(`\n${BOLD}${CYAN}Bundle Analysis${RESET}\n`);

const chunks = readdirSync(join(DIST, 'assets'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .filter((f) => !f.endsWith('.map'))
  .map((file) => {
    const fp = join(DIST, 'assets', file);
    const raw = statSync(fp).size;
    // Use full name without extension; budget matching uses includes() so keys still work
    const name = file.replace(/\.(js|css)$/, '');
    const cleanName = name.replace(/-[A-Za-z0-9_]{8,}$/, '');
    return { file, name, cleanName, size: raw, gzipSize: getGzipSize(fp) };
  })
  .sort((a, b) => b.size - a.size);

// Summary
const totalJS = chunks.filter(c => c.file.endsWith('.js')).reduce((s, c) => s + c.size, 0);
const totalCSS = chunks.filter(c => c.file.endsWith('.css')).reduce((s, c) => s + c.size, 0);
const swSize = existsSync(join(DIST, 'sw.js')) ? statSync(join(DIST, 'sw.js')).size : 0;
const totalBytes = totalJS + totalCSS;
console.log(`  JS chunks: ${chunks.filter(c => c.file.endsWith('.js')).length}`);
console.log(`  CSS files: ${chunks.filter(c => c.file.endsWith('.css')).length}`);
console.log(`  Total JS:  ${size(totalJS)}`);
console.log(`  Total CSS: ${size(totalCSS)}`);
console.log(`  SW:        ${size(swSize)}`);
console.log(`  Total:     ${size(totalBytes)} (${chunks.length} assets)\n`);

// Top 10
console.log(`${BOLD}Top 10 Largest Chunks${RESET}`);
console.log('─'.repeat(70));
console.log(`  ${'Chunk'.padEnd(42)} ${'Size'.padEnd(10)} ${'Gzip'.padEnd(10)}  Status`);
console.log('─'.repeat(70));

chunks.slice(0, 10).forEach((c) => {
  const budget = findBudget(c.name, c.file);
  const status = c.size > budget.error * 1024 ? `${RED}OVER BUDGET${RESET}`
    : c.size > budget.warn * 1024 ? `${YELLOW}warning${RESET}`
    : `${GREEN}ok${RESET}`;
  const gzip = c.gzipSize ? size(c.gzipSize) : '—';
  // Shorten display: show clean name with extension for CSS
  const display = c.file.endsWith('.css') ? c.cleanName + '.css' : c.cleanName;
  console.log(`  ${display.padEnd(40)} ${size(c.size).padEnd(10)} ${gzip.padEnd(10)}  ${status}`);
});
console.log('─'.repeat(70));

// Flag over-budget
const overBudget = chunks.filter((c) => {
  const budget = findBudget(c.name, c.file);
  return c.size > budget.warn * 1024;
});
if (overBudget.length > 0) {
  console.log(`\n${YELLOW}${BOLD}⚠ Assets exceeding budget:${RESET}`);
  overBudget.forEach((c) => {
    const budget = findBudget(c.name, c.file);
    const limit = c.size > budget.error * 1024 ? 'OVER BUDGET' : `warn (>${budget.warn}kB)`;
    const display = c.file.endsWith('.css') ? c.cleanName + '.css' : c.cleanName;
    console.log(`  ${display.padEnd(40)} ${size(c.size).padEnd(10)} ${YELLOW}${limit}${RESET}`);
  });
} else {
  console.log(`\n${GREEN}${BOLD}✓ All assets within budget${RESET}`);
}

// Exit with error if any asset is severely over budget
const errors = chunks.filter((c) => {
  const budget = findBudget(c.name, c.file);
  return c.size > budget.error * 1024;
});
process.exit(errors.length > 0 ? 1 : 0);
