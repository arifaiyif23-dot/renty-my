import { Page } from '@playwright/test';

export async function waitForLoadingToFinish(page: Page) {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 5000 }).catch(() => {
    // Loading indicator might not appear, that's okay
  });
}

// Fill the List Item form. The real page (src/pages/ListItem.tsx) uses `id`
// selectors and a Radix Select for category, plus a required Location field.
export async function fillItemForm(page: Page, itemData: {
  title: string;
  description: string;
  pricePerDay: string;
  category: string;
}) {
  await page.fill('#title', itemData.title);
  await page.fill('#description', itemData.description);
  await page.fill('#price', itemData.pricePerDay);
  // Radix Select: open the trigger then pick the option by its visible label.
  await page.locator('#category').click();
  await page.getByRole('option', { name: new RegExp(`^${itemData.category}$`, 'i') }).first().click();
  // Location is required for publishing.
  await page.fill('#location', 'Kuala Lumpur');
}

export async function uploadTestImage(page: Page) {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  // The ImageUpload component exposes a hidden #gallery-upload file input.
  await page.setInputFiles('#gallery-upload', {
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer,
  });
}

export function generateTestEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export function generateTestPhone() {
  return `+6012${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
}
