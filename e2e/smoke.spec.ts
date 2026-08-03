import { expect, test } from '@playwright/test';

test('the app boots and reaches the API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('app')).toBeVisible();
  await expect(page.getByTestId('health')).toContainText('ok');
});

test('an unmatched /api route answers JSON, not the SPA shell', async ({ request }) => {
  const response = await request.get('/api/definitely-not-a-route');

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');
});
