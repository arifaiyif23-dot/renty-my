import { test, expect } from '../fixtures/auth.fixture';
import { waitForLoadingToFinish } from '../utils/test-helpers';

test.describe('User Profile', () => {
  test('should view profile page', async ({ page, authenticatedUser }) => {
    await page.goto('/profile');
    
    await waitForLoadingToFinish(page);
    
    // Should show profile information
    await expect(
      page.locator('text=/profile|account|user/i')
    ).toBeVisible({ timeout: 10000 });
    
    // Should show user email or name
    await expect(
      page.locator(`text=${authenticatedUser.email}`)
    ).toBeVisible({ timeout: 5000 });
  });
  
  test('should open profile edit dialog', async ({ page, authenticatedUser }) => {
    await page.goto('/profile');
    
    await waitForLoadingToFinish(page);
    
    // Look for edit button
    const editButton = page.locator('button:has-text("Edit"), button[aria-label*="edit"]').first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Should show edit form
      await expect(
        page.locator('input[name="fullName"], input[name="displayName"]')
      ).toBeVisible({ timeout: 5000 });
    }
  });
  
  test('should view verification status', async ({ page, authenticatedUser }) => {
    await page.goto('/profile');
    
    await waitForLoadingToFinish(page);
    
    // Should show verification status or option to verify
    const hasVerificationInfo = 
      (await page.locator('text=/verified|verification|verify/i').count()) > 0;
    
    expect(hasVerificationInfo).toBeTruthy();
  });
  
  test('should navigate to verification page', async ({ page, authenticatedUser }) => {
    await page.goto('/verification');
    
    await waitForLoadingToFinish(page);
    
    // Should show verification interface
    await expect(
      page.locator('text=/verification|verify.*identity|documents/i')
    ).toBeVisible({ timeout: 10000 });
  });
});
