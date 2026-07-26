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
  await page.getByRole('button', { name: /create account/i }).click();
}

export const test = base.extend<TestFixtures>({
  authenticatedUser: async ({ page }, use) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'Test123!@#';

    await signUp(page, email, password);

    // Signup navigates away from /auth on success (home or vendor onboarding).
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 });

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
