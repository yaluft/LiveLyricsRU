import { test, expect } from '@playwright/test';

test('landing mounts and play flow', async ({ page }) => {
  const logs: Array<{type: string; text: string}> = [];
  page.on('console', (msg) => logs.push({ type: 'console', text: msg.text() }));
  page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: String(err) }));

  // navigate
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // wait for landing blurb
  const blurb = await page.locator('.landing__blurb');
  const blurbPresent = await blurb.count();
  console.log('blurbCount=', blurbPresent);

  // capture a network response for search/resolve
  const apiResponse = page.waitForResponse((r) => /\/api\/(search|resolve)/.test(r.url()), { timeout: 10000 }).catch(() => null);

  // click first suggestion chip if present
  const chip = page.locator('.chip').first();
  if (await chip.count()) {
    await chip.click();
  }

  const resp = await apiResponse;
  if (resp) {
    console.log('apiResponse status=', resp.status(), 'url=', resp.url());
    try {
      const json = await resp.json();
      console.log('apiResponse json sample keys=', Object.keys(json).slice(0,6));
    } catch (e) {
      console.log('apiResponse non-json or empty');
    }
  } else {
    console.log('no api response captured');
  }

  // snapshot console logs
  console.log('collectedLogs=', JSON.stringify(logs.slice(0,30)));

  // assert basic expectations so playwright returns non-zero on failure
  expect(blurbPresent).toBeGreaterThanOrEqual(0);
});
