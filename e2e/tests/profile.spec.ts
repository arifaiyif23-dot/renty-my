import { test, expect } from '../fixtures/auth.fixture';
import { waitForLoadingToFinish } from '../utils/test-helpers';

test.describe('User Profile', () => {
  test('should view profile page', async ({ page, authenticatedUser }) => {
    await page.goto('/profile');
    await waitForLoadingToFinish(page);

    // The signed-up user's name is shown as the page heading.
    await expect(
      page.getByRole('heading', { name: 'Test User' })
    ).toBeVisible({ timeout: 10000 });

    // The Edit Profile action is present (always rendered for the owner).
    await expect(
      page.getByRole('button', { name: /edit profile/i }).first()
    ).toBeVisible();
  });

  test('should open profile edit dialog', async ({ page, authenticatedUser }) => {
    await page.goto('/profile');
    await waitForLoadingToFinish(page);

    const editButton = page.getByRole('button', { name: /edit profile/i }).first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // An editable name field should appear in the dialog.
    await expect(
      page.locator('input[name="fullName"], input[name="displayName"], #fullName, #full_name').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to verification page', async ({ page, authenticatedUser }) => {
    await page.goto('/verification');
    await waitForLoadingToFinish(page);

    // Identity Verification heading is shown.
    await expect(
      page.getByRole('heading', { name: /identity verification/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
