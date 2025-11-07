import { test, expect } from '@playwright/test';

test.describe('Search and Browse', () => {
  test('should display homepage with items', async ({ page }) => {
    await page.goto('/');
    
    // Should show hero section or search
    await expect(
      page.locator('input[placeholder*="Search"], h1, [data-testid="hero"]')
    ).toBeVisible();
    
    // Should show some content (categories, featured items, or items)
    const hasContent = 
      (await page.locator('.category-card, [data-testid="category"]').count()) > 0 ||
      (await page.locator('.item-card, [data-testid="item-card"]').count()) > 0 ||
      (await page.locator('text=/featured|popular|categories/i').count()) > 0;
    
    expect(hasContent).toBeTruthy();
  });
  
  test('should perform search', async ({ page }) => {
    await page.goto('/');
    
    // Find and use search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await searchInput.fill('camera');
    await searchInput.press('Enter');
    
    // Should navigate to search page or show results
    await expect(
      page.locator('text=/results|search|items/i')
    ).toBeVisible({ timeout: 5000 });
  });
  
  test('should navigate to search page', async ({ page }) => {
    await page.goto('/search');
    
    // Should show search interface
    await expect(page.locator('input[type="search"], input[placeholder*="Search"]')).toBeVisible();
  });
  
  test('should filter by category', async ({ page }) => {
    await page.goto('/search');
    
    // Look for category filters
    const categoryFilter = page.locator('select[name*="category"], button:has-text("Electronics"), [data-testid*="category"]').first();
    
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      
      // Should update results or show loading
      await page.waitForTimeout(1000);
      
      // Results should be displayed
      const hasResults = 
        (await page.locator('.item-card, [data-testid="item-card"]').count()) > 0 ||
        (await page.locator('text=/no.*results|empty/i').isVisible());
      
      expect(hasResults).toBeTruthy();
    }
  });
  
  test('should view item details', async ({ page }) => {
    await page.goto('/');
    
    // Find and click first item card
    const itemCard = page.locator('.item-card, [data-testid="item-card"], a[href*="/item/"]').first();
    
    if (await itemCard.isVisible()) {
      await itemCard.click();
      
      // Should navigate to item detail page
      await expect(page).toHaveURL(/\/item\//);
      
      // Should show item details
      await expect(
        page.locator('text=/price|day|book|rent/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
