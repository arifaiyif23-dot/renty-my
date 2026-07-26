import { test, expect } from '../fixtures/auth.fixture';
import { fillItemForm, uploadTestImage } from '../utils/test-helpers';

// NOTE: Listing items requires ID verification. A freshly-signed-up test user is
// unverified, so the page shows a "Verification Required" banner and blocks
// publishing. These tests assert that REAL behaviour rather than assuming a
// verified account (which would need a seeded verified user).
test.describe('Item Listing Flow', () => {
  test('should show the List Item form', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');

    // The form fields are present.
    await expect(page.locator('#title')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#price')).toBeVisible();
    await expect(page.locator('#category')).toBeVisible();
  });

  test('should require verification before listing (new user)', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');

    // A brand-new user is unverified: the verification gate must be shown.
    await expect(
      page.getByRole('heading', { name: /verification required/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('should fill the item form fields', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    await expect(page.locator('#title')).toBeVisible({ timeout: 10000 });

    await fillItemForm(page, {
      title: 'Professional DSLR Camera',
      description: 'Canon EOS 5D Mark IV in excellent condition.',
      pricePerDay: '50',
      category: 'electronics',
    });
    await uploadTestImage(page);

    // Fields should hold the entered values.
    await expect(page.locator('#title')).toHaveValue('Professional DSLR Camera');
    await expect(page.locator('#location')).toHaveValue('Kuala Lumpur');
  });

  test('should block negative price input', async ({ page, authenticatedUser }) => {
    await page.goto('/list-item');
    await expect(page.locator('#price')).toBeVisible({ timeout: 10000 });

    // The price input strips non-numeric characters, so "-10" becomes "10".
    await page.locator('#price').fill('-10');
    await expect(page.locator('#price')).toHaveValue('10');
  });

  test('should view my listings page', async ({ page, authenticatedUser }) => {
    await page.goto('/my-listings');

    // Page header should be present.
    await expect(
      page.getByRole('heading', { name: /my listings/i }).first()
    ).toBeVisible({ timeout: 10000 });

    // A new user has no listings: assert the real empty state heading.
    await expect(
      page.getByRole('heading', { name: /no listings yet/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
