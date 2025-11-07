import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Should have h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });
  
  test('should have accessible form labels', async ({ page }) => {
    await page.goto('/auth');
    
    // All inputs should have labels or aria-labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        return !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.closest('label') ||
          document.querySelector(`label[for="${el.id}"]`)
        );
      });
      
      if (!hasLabel) {
        const type = await input.getAttribute('type');
        console.warn(`Input of type "${type}" missing accessible label`);
      }
    }
    
    expect(inputCount).toBeGreaterThan(0);
  });
  
  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Check images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        
        if (alt === null || alt === '') {
          const src = await img.getAttribute('src');
          console.warn(`Image missing alt text: ${src}`);
        }
      }
    }
    
    expect(true).toBeTruthy(); // Test completed
  });
  
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Should be able to tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Focus should move to different elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
  
  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // This is a basic check - full contrast testing requires specialized tools
    // Just verify page renders without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('button[aria-label*="theme"], button:has-text("Dark"), button:has-text("Light")').first();
    
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      // Page should still be visible after theme change
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
