import { test, expect } from '@playwright/test';
import { generateTestEmail } from '../utils/test-helpers';

test.describe('Authentication Flow', () => {
  test('should show validation error for password mismatch', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('tab', { name: /sign up/i }).click();

    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', generateTestEmail());
    await page.fill('#signup-password', 'Test123!@#');
    await page.fill('#signup-confirm', 'DifferentPassword123!');
    await page.locator('#signup-terms').click();
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show a mismatch toast and stay on the auth page.
    await expect(page.locator('text=/passwords do not match/i')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('tab', { name: /sign up/i }).click();

    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', generateTestEmail());
    await page.fill('#signup-password', 'weak');
    await page.fill('#signup-confirm', 'weak');
    await page.locator('#signup-terms').click();
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show a password-strength validation toast.
    await expect(page.locator('text=/password must be at least 8 characters/i')).toBeVisible({ timeout: 5000 });
  });

  test('should require terms acceptance before signup', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('tab', { name: /sign up/i }).click();

    // Create Account button is disabled until the terms checkbox is ticked.
    const submit = page.getByRole('button', { name: /create account/i });
    await expect(submit).toBeDisabled();
    await page.locator('#signup-terms').click();
    await expect(submit).toBeEnabled();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/auth');
    // Switch from the default magic-link view to the password form.
    await page.getByRole('button', { name: /sign in with password/i }).click();

    await page.fill('#login-email', 'nonexistent@example.com');
    await page.fill('#login-password', 'wrongpassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Should show an error toast and remain on /auth.
    await expect(page.locator('text=/invalid email or password|sign in failed/i')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});
