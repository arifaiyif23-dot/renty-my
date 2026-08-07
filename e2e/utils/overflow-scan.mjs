import { chromium, devices } from '@playwright/test';

const routes = [
  '/', '/search', '/auth', '/dashboard', '/messages', '/list-item',
  '/wishlist', '/profile', '/my-listings', '/earnings', '/saved-searches',
  '/notification-settings', '/disputes', '/help', '/about', '/terms', '/privacy',
  '/install', '/vendor-onboarding', '/verification', '/bookings',
];

const browser = await chromium.launch();
const results = [];
for (const device of ['Pixel 5', 'iPhone 12']) {
  const ctx = await browser.newContext({ ...devices[device] });
  const page = await ctx.newPage();
  for (const route of routes) {
    try {
      await page.goto(`http://localhost:8080${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      const status = m.sw > m.cw + 2 ? '⚠️ OVERFLOW' : 'OK';
      results.push({ device, route, status, sw: m.sw, cw: m.cw });
      if (status !== 'OK') console.log(`${device} ${route}: ${status} (sw=${m.sw} cw=${m.cw})`);
    } catch (e) {
      results.push({ device, route, status: `ERR ${e.message.split('\n')[0].slice(0, 40)}`, sw: 0, cw: 0 });
    }
  }
  await ctx.close();
}
const bad = results.filter(r => r.status.includes('OVERFLOW') || r.status.includes('ERR'));
const ok = results.filter(r => r.status === 'OK');
console.log(`\nTOTAL: ${ok.length} OK, ${bad.length} issues (${results.length} checks)`);
if (!bad.length) console.log('\n✅ ZERO horizontal overflow across all routes & devices');
await browser.close();
