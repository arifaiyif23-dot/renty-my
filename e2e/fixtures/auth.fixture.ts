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

export const test = base.extend<TestFixtures>({
  authenticatedUser: async ({ page }, use) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'Test123!@#';
    
    // Navigate to auth page
    await page.goto('/auth');
    
    // Sign up new user
    await page.click('text=Sign Up');
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home
    await page.waitForURL('/', { timeout: 10000 });
    
    await use({ email, password, userId: 'test-user-id' });
    
    // Cleanup: Sign out
    try {
      await page.goto('/');
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Sign Out');
    } catch (error) {
      console.log('Cleanup sign out failed:', error);
    }
  },
  
  adminUser: async ({ page }, use) => {
    // For admin testing, use pre-configured admin account
    const email = 'admin@renty.com';
    const password = 'Admin123!@#';
    
    await page.goto('/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL('/', { timeout: 10000 });
    
    await use({ email, password, userId: 'admin-user-id' });
  },
});

export { expect } from '@playwright/test';
