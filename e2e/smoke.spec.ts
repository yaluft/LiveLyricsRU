import { expect, test } from '@playwright/test';

test('the app boots', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('navigation')).toContainText('Лирика');
  // The landing state, before any track is chosen.
  await expect(page.getByRole('heading', { name: 'Слушайте и читайте' })).toBeVisible();
});

test('the nav never auto-hides', async ({ page }) => {
  // v1's disappearing dock was the top complaint, and v2's fix was to make the
  // chrome permanent. Scrolling must not change that.
  await page.goto('/');
  await page.mouse.wheel(0, 2000);

  await expect(page.getByRole('navigation')).toBeVisible();
});

test('the API reports what is and is not configured', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);

  const body = (await response.json()) as {
    status: string;
    ytDlp: boolean;
    dictionary: boolean;
    translation: boolean;
  };

  expect(body.status).toBe('ok');
  // All three are optional capabilities. The app runs regardless — this asserts
  // they are *reported* rather than assumed.
  expect(typeof body.ytDlp).toBe('boolean');
  expect(typeof body.dictionary).toBe('boolean');
  expect(typeof body.translation).toBe('boolean');
});

test('an unmatched /api route answers JSON, not the SPA shell', async ({ request }) => {
  const response = await request.get('/api/definitely-not-a-route');

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');
});
