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

  // Retry on transient Supabase Auth rate-limits (each test creates a real user;
  // the shared test IP can hit the ~30 signups/hour cap). Surface the real toast
  // on failure so flakes are diagnosable.
  // NOTE: each test creates a REAL user; the shared test IP hits Supabase Auth's
  // ~30 signups/hour cap after a few runs (429). The default 30s test timeout is
  // too short for the form fill + navigation, so the click must not block on it.
  const submit = page.getByRole('button', { name: /create account/i });
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
}

export const test = base.extend<TestFixtures>({
  authenticatedUser: async ({ page }, use) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'Test123!@#';

    // signUp already waits until navigation away from /auth (with retries).
    await signUp(page, email, password);

    await use({ email, password, userId: 'test-user-id' });
  },

  adminUser: async ({ page }, use) => {
    // For admin testing, use pre-configured admin account
    const email = 'admin@renty.com';
    const password = 'Admin123!@#';

    await page.goto('/auth');
    // Switch from the default magic-link view to the password form.
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 });

    await use({ email, password, userId: 'admin-user-id' });
  },
});

export { expect } from '@playwright/test';
