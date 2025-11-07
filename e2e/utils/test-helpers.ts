import { Page } from '@playwright/test';

export async function waitForLoadingToFinish(page: Page) {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 5000 }).catch(() => {
    // Loading indicator might not appear, that's okay
  });
}

export async function fillItemForm(page: Page, itemData: {
  title: string;
  description: string;
  pricePerDay: string;
  category: string;
}) {
  await page.fill('input[name="title"]', itemData.title);
  await page.fill('textarea[name="description"]', itemData.description);
  await page.fill('input[name="pricePerDay"]', itemData.pricePerDay);
  await page.selectOption('select[name="category"]', itemData.category);
}

export async function uploadTestImage(page: Page, selector = 'input[type="file"]') {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  await page.setInputFiles(selector, {
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
