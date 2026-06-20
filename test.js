import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.locator('div').nth(4).click();
  await page.goto('http://localhost:3000/login');
});