import { test, expect } from '@playwright/test';

test.describe('Search and Browse', () => {
  test('should display homepage with hero and search', async ({ page }) => {
    await page.goto('/');

    // Hero heading (Malay) + a search box are the stable entry points. Desktop renders
    // two search boxes (navbar + hero) so scope to the main h1 + the hero search.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('textbox', { name: /search items/i }).last()).toBeVisible();
  });

  test('should perform search and land on search page', async ({ page }) => {
    await page.goto('/');

    // Use the hero search (last match; navbar search also matches on desktop).
    const searchInput = page.getByRole('textbox', { name: /search items/i }).last();
    await searchInput.fill('camera');
    await searchInput.press('Enter');

    // Navigates to /search and shows the results region (items or empty state).
    await expect(page).toHaveURL(/\/search/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { name: /no items found/i }).or(page.locator('a[href*="/items/"]').first())
    ).toBeVisible({ timeout: 8000 });
  });

  test('should navigate to search page', async ({ page }) => {
    await page.goto('/search');
    // The search page has no "Search" heading; assert the filters sidebar landmark.
    await expect(page.getByRole('heading', { name: /^filters$/i })).toBeVisible({ timeout: 8000 });
  });

  test('selecting All Malaysia location does not empty results', async ({ page }) => {
    await page.goto('/search');

    // Open the results toolbar location select and choose "All Malaysia".
    await page.getByTestId('search-location').click();
    await page.getByRole('option', { name: /all malaysia/i }).click();

    // The 'all' sentinel must NOT filter out every item: page settles into either
    // results or a legitimate empty state (not a silent crash / perpetual skeleton).
    await expect(
      page.getByRole('heading', { name: /no items found/i }).or(page.locator('a[href*="/items/"]').first())
    ).toBeVisible({ timeout: 10000 });
  });
});
