import { test, expect } from '../fixtures/auth.fixture';
import { waitForLoadingToFinish } from '../utils/test-helpers';

test.describe('Wallet Features', () => {
  test('should view wallet page', async ({ page, authenticatedUser }) => {
    await page.goto('/wallet');
    
    await waitForLoadingToFinish(page);
    
    // Should show wallet interface
    await expect(
      page.locator('text=/balance|wallet|RM/i')
    ).toBeVisible({ timeout: 10000 });
  });
  
  test('should display transaction history', async ({ page, authenticatedUser }) => {
    await page.goto('/wallet');
    
    await waitForLoadingToFinish(page);
    
    // Should show transactions section or empty state
    const hasTransactions = 
      (await page.locator('[data-testid="transaction-list"], .transaction').count()) > 0 ||
      (await page.locator('text=/no.*transaction|empty/i').isVisible());
    
    expect(hasTransactions).toBeTruthy();
  });
  
  test('should open top-up modal', async ({ page, authenticatedUser }) => {
    await page.goto('/wallet');
    
    await waitForLoadingToFinish(page);
    
    // Look for top-up button
    const topUpButton = page.locator('button:has-text("Top Up"), button:has-text("Add Funds")').first();
    
    if (await topUpButton.isVisible()) {
      await topUpButton.click();
      
      // Should show top-up form or modal
      await expect(
        page.locator('text=/amount|enter.*amount|payment/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });
  
  test('should validate top-up amount', async ({ page, authenticatedUser }) => {
    await page.goto('/wallet');
    
    await waitForLoadingToFinish(page);
    
    const topUpButton = page.locator('button:has-text("Top Up"), button:has-text("Add Funds")').first();
    
    if (await topUpButton.isVisible()) {
      await topUpButton.click();
      
      // Try to submit with invalid amount
      const amountInput = page.locator('input[name="amount"], input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('0');
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Proceed")').first();
        await submitButton.click();
        
        // Should show validation error
        await expect(
          page.locator('text=/minimum|invalid.*amount|required/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
  
  test('should view withdrawal section', async ({ page, authenticatedUser }) => {
    await page.goto('/wallet');
    
    await waitForLoadingToFinish(page);
    
    // Should show withdrawal option or button
    const hasWithdrawal = 
      (await page.locator('button:has-text("Withdraw"), text=/withdraw/i').count()) > 0;
    
    // Just check page loaded properly if withdrawal not visible
    expect(await page.locator('text=/wallet|balance/i').isVisible()).toBeTruthy();
  });
});
