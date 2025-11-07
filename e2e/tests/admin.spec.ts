import { test, expect } from '../fixtures/auth.fixture';
import { waitForLoadingToFinish } from '../utils/test-helpers';

test.describe('Admin Features', () => {
  test('should block non-admin from admin pages', async ({ page, authenticatedUser }) => {
    await page.goto('/admin');
    
    // Should redirect or show unauthorized
    await page.waitForTimeout(2000);
    
    // Should not be on admin page or should show error
    const isOnAdminPage = page.url().includes('/admin');
    const hasUnauthorizedMessage = await page.locator('text=/unauthorized|access.*denied|admin.*required/i').isVisible();
    
    // Either redirected away or seeing error
    expect(!isOnAdminPage || hasUnauthorizedMessage).toBeTruthy();
  });
  
  test.skip('should access admin dashboard with admin account', async ({ page, adminUser }) => {
    // This test requires a pre-configured admin account
    await page.goto('/admin');
    
    await waitForLoadingToFinish(page);
    
    // Should show admin dashboard
    await expect(
      page.locator('text=/admin.*dashboard|dashboard/i')
    ).toBeVisible({ timeout: 10000 });
    
    // Should show admin statistics
    const hasStats = 
      (await page.locator('text=/users|verifications|transactions/i').count()) > 0;
    
    expect(hasStats).toBeTruthy();
  });
  
  test.skip('should view verification requests', async ({ page, adminUser }) => {
    await page.goto('/admin/verifications');
    
    await waitForLoadingToFinish(page);
    
    // Should show verifications list or empty state
    const hasContent = 
      (await page.locator('.verification-card, [data-testid*="verification"]').count()) > 0 ||
      (await page.locator('text=/no.*pending|empty/i').isVisible());
    
    expect(hasContent).toBeTruthy();
  });
  
  test.skip('should view payment management', async ({ page, adminUser }) => {
    await page.goto('/admin/payments');
    
    await waitForLoadingToFinish(page);
    
    // Should show payments interface
    await expect(
      page.locator('text=/payments|transactions|wallet/i')
    ).toBeVisible({ timeout: 10000 });
  });
});
