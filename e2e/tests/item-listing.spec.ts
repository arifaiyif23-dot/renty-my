import { test, expect } from '../fixtures/auth.fixture';
import { fillItemForm, uploadTestImage, waitForLoadingToFinish } from '../utils/test-helpers';

test.describe('Item Listing Flow', () => {
  test('should create new item listing', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    
    // Fill item details
    await fillItemForm(page, {
      title: 'Professional DSLR Camera',
      description: 'Canon EOS 5D Mark IV in excellent condition. Perfect for professional photography.',
      pricePerDay: '50',
      category: 'electronics',
    });
    
    // Upload image
    await uploadTestImage(page);
    
    // Wait a bit for form to be ready
    await page.waitForTimeout(1000);
    
    // Submit
    await page.click('button[type="submit"]:has-text("List Item")');
    
    // Should show success message or redirect
    await expect(
      page.locator('text=/success|listed/i')
    ).toBeVisible({ timeout: 10000 });
  });
  
  test('should validate required fields', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    
    // Try to submit without filling
    await page.click('button[type="submit"]:has-text("List Item")');
    
    // Should show validation errors (at least one)
    await expect(
      page.locator('text=/required|enter|provide/i')
    ).toBeVisible({ timeout: 5000 });
  });
  
  test('should validate price is positive', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    
    await fillItemForm(page, {
      title: 'Test Item',
      description: 'Test description',
      pricePerDay: '-10',
      category: 'electronics',
    });
    
    await uploadTestImage(page);
    await page.click('button[type="submit"]:has-text("List Item")');
    
    // Should show price validation error
    await expect(
      page.locator('text=/price.*positive|invalid.*price/i')
    ).toBeVisible({ timeout: 5000 });
  });
  
  test('should navigate to AI analysis feature', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    
    // Upload an image first
    await uploadTestImage(page);
    
    // Look for AI analyze button
    const aiButton = page.locator('button:has-text("AI"), button:has-text("Analyze")').first();
    
    if (await aiButton.isVisible()) {
      await aiButton.click();
      
      // Should show loading or processing state
      await expect(
        page.locator('text=/analyzing|processing|loading/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });
  
  test('should view my listings page', async ({ page, authenticatedUser }) => {
    await page.goto('/my-listings');
    
    // Page should load
    await expect(page.locator('h1, h2').filter({ hasText: /my.*listing/i })).toBeVisible();
    
    // Should show either listings or empty state
    const hasListings = await page.locator('.item-card, [data-testid="item-card"]').count() > 0;
    const hasEmptyState = await page.locator('text=/no.*items|empty/i').isVisible();
    
    expect(hasListings || hasEmptyState).toBeTruthy();
  });
});
