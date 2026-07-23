import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function fail(msg) { console.log(`${RED}✗${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }

function exec(cmd, opts = {}) {
  const { ignoreFail = false, timeout = 120000 } = opts;
  try {
    return execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8', timeout }).trim();
  } catch (e) {
    if (ignoreFail) return '';
    throw e;
  }
}

const errors = [];
const warnings = [];

// 1. TypeScript
process.stdout.write('\n[1/5] TypeScript check... ');
try {
  exec('npx tsc --noEmit');
  ok('TypeScript check passed');
} catch {
  fail('TypeScript errors');
  errors.push('tsc --noEmit failed — run `npx tsc --noEmit` to see details');
}

// 2. ESLint
process.stdout.write('\n[2/5] ESLint... ');
try {
  exec('npm run lint');
  ok('ESLint passed');
} catch {
  fail('ESLint errors');
  errors.push('ESLint failed — run `npm run lint` to see details');
}

// 3. Production build
process.stdout.write('\n[3/5] Production build... ');
try {
  exec('npm run build', { timeout: 180000 });
  ok('Build succeeded');
} catch {
  fail('Build failed');
  errors.push('Build failed — run `npm run build` to see details');
}

// 4. Leftover console.log/debug
process.stdout.write('\n[4/5] Debug log check... ');
try {
  const logs = exec('rg "console\\.(log|debug)\\(" src/ --type-add "web:*.{tsx,ts}" -t web -g "!sw.ts" -g "!registerSW.js" 2>NUL || exit 0', { ignoreFail: true });
  if (logs) {
    warnings.push('Found console.log/debug calls:\n' + logs);
    warn(`console.log/debug found (${logs.split('\n').length} line(s))`);
  } else {
    ok('No leftover console.log/debug');
  }
} catch {
  warn('Skipped (ripgrep not available)');
}

// 5. TODO/FIXME/HACK markers
process.stdout.write('\n[5/5] Marker check... ');
try {
  const markers = exec('rg "TODO|FIXME|HACK" src/ --type-add "web:*.{tsx,ts,css}" -t web 2>NUL || exit 0', { ignoreFail: true });
  if (markers) {
    warnings.push('Unresolved markers:\n' + markers);
    warn(`TODO/FIXME/HACK markers found (${markers.split('\n').length} line(s))`);
  } else {
    ok('No TODO/FIXME/HACK markers');
  }
} catch {
  warn('Skipped (ripgrep not available)');
}

// Summary
console.log('\n' + '═'.repeat(50));
if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}${BOLD}All checks passed!${RESET}`);
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n${RED}${BOLD}${errors.length} error(s):${RESET}`);
    errors.forEach(e => console.log(`  ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}${warnings.length} warning(s):${RESET}`);
    warnings.forEach(w => console.log(`  ${w.replace(/\n/g, '\n  ')}`));
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
