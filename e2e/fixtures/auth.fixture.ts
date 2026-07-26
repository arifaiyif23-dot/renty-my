/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test';

type TestFixtures = {
  authenticatedUser: {
    email: string;
    password: string;
    userId: string;
  };
  adminUser: {
    email: string;
    password: string;
    userId: string;
  };
};

type WorkerFixtures = {
  workerAuth: {
    email: string;
    password: string;
  };
};

// NOTE: every signup creates a REAL user in Supabase. The shared test IP hits
// Supabase Auth's ~30 signups/hour cap (HTTP 429) after a few runs. To stay
// reliable we sign up ONCE per worker (worker-scoped) and reuse that account for
// every test in the worker, instead of one signup per test.

// Selectors match the REAL Auth page (src/pages/Auth.tsx): inputs use `id`,
// the default login method is magic-link (password is behind a toggle), and
// signup requires accepting the terms checkbox.
async function signUp(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/auth');
  await page.getByRole('tab', { name: /sign up/i }).click();
  await page.fill('#signup-name', 'Test User');
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);
  await page.fill('#signup-confirm', password);
  await page.locator('#signup-terms').click();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
}

async function signInWithPassword(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/auth');
  // The Login tab defaults to the PASSWORD form (magic link is behind
  // "Send magic link instead"). No method toggle is needed.
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One account per worker: sign up once, then every test just signs in.
  workerAuth: [
    async ({ browser }, use) => {
      const email = `test-wk-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
      const password = 'Test123!@#';
      const page = await browser.newPage();
      try {
        await signUp(page, email, password);
      } finally {
        await page.close();
      }
      await use({ email, password });
    },
    { scope: 'worker' },
  ],

  authenticatedUser: async ({ page, workerAuth }, use) => {
    await signInWithPassword(page, workerAuth.email, workerAuth.password);
    await use({ email: workerAuth.email, password: workerAuth.password, userId: 'test-user-id' });
  },

  adminUser: async ({ page }, use) => {
    // For admin testing, use a pre-configured admin account.
    const email = 'admin@renty.com';
    const password = 'Admin123!@#';
    await signInWithPassword(page, email, password);
    await use({ email, password, userId: 'admin-user-id' });
  },
});

export { expect } from '@playwright/test';
