import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestPhone } from '../utils/test-helpers';

test.describe('Authentication Flow', () => {
  test('should sign up new user', async ({ page }) => {
    await page.goto('/auth');
    
    const email = generateTestEmail();
    const password = 'Test123!@#';
    
    // Click sign up tab
    await page.click('text=Sign Up');
    
    // Fill form
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should redirect to home
    await expect(page).toHaveURL('/', { timeout: 10000 });
    
    // Should show header (user is logged in)
    await expect(page.locator('header')).toBeVisible();
  });
  
  test('should show validation error for password mismatch', async ({ page }) => {
    await page.goto('/auth');
    
    await page.click('text=Sign Up');
    
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', 'Test123!@#');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
    
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=/password.*match/i')).toBeVisible({ timeout: 5000 });
  });
  
  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth');
    
    await page.click('text=Sign Up');
    
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', 'weak');
    await page.fill('input[name="confirmPassword"]', 'weak');
    
    await page.click('button[type="submit"]');
    
    // Should show password strength error
    await expect(page.locator('text=/password.*requirements/i')).toBeVisible({ timeout: 5000 });
  });
  
  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/auth');
    
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error toast
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible({ timeout: 5000 });
  });
});
