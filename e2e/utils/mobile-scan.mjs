import { chromium, devices } from '@playwright/test';

const pages = [
  { name: 'home', path: '/' },
  { name: 'search', path: '/search' },
  { name: 'auth', path: '/auth' },
];

const outDir = 'test-results/mobile-shots';
const fs = await import('node:fs');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const device of ['Pixel 5', 'iPhone 12']) {
  const ctx = await browser.newContext({ ...devices[device] });
  const page = await ctx.newPage();
  for (const p of pages) {
    try {
      await page.goto(`http://localhost:8080${p.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      const shot = `${outDir}/${device.replace(' ', '-')}-${p.name}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      // Check for horizontal overflow (common mobile bug)
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
      });
      const hasOverflow = overflow.scrollW > overflow.clientW + 2;
      console.log(`${device} ${p.name}: ${hasOverflow ? '⚠️ H-OVERFLOW' : 'OK'} (scrollW=${overflow.scrollW}, clientW=${overflow.clientW}) shot=${shot}`);
    } catch (e) {
      console.log(`${device} ${p.name}: ERROR ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}

// Also check key interactive pages on mobile
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
const page = await ctx.newPage();
for (const p of [
  { name: 'item-detail', path: '/items/3f5ef3b1-8a4f-4c67-b2ea-7f9c0f0d1a2b' }, // may 404, fine
  { name: 'dashboard', path: '/dashboard' },
  { name: 'messages', path: '/messages' },
]) {
  try {
    await page.goto(`http://localhost:8080${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(`Pixel5 ${p.name}: ${overflow.sw > overflow.cw + 2 ? '⚠️ H-OVERFLOW' : 'OK'}`);
  } catch (e) {
    console.log(`Pixel5 ${p.name}: ${e.message.split('\n')[0].slice(0, 80)}`);
  }
}
await ctx.close();
await browser.close();
console.log('\nDone. Screenshots in', outDir);
