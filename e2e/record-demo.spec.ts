import { test, expect } from '@playwright/test';

/**
 * Records a short walkthrough of the app for the README's demo GIF: land on
 * the search suggestions, play a track, watch synced lyrics arrive, tap a
 * word for its definition, then close it. Not part of the regular test run —
 * invoke directly with `npx playwright test e2e/record-demo.spec.ts`, then
 * convert the resulting video with `scripts/make-demo-gif.sh`.
 */
test.use({
  video: { mode: 'on', size: { width: 1440, height: 900 } },
  viewport: { width: 1440, height: 900 },
});

test('record demo walkthrough', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Сплин — Выхода нет', exact: true })).toBeVisible();
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'Сплин — Выхода нет', exact: true }).click();
  await expect(page.locator('.stage__dock')).toBeVisible({ timeout: 15_000 });

  // Synced lyrics from a real provider aren't guaranteed for every track in
  // every environment — fall back to a pasted LRC so the recording always
  // shows the tap-a-word-for-a-definition flow reliably.
  const activeLine = page.locator('.lyricline--active');
  try {
    await expect(activeLine).toBeVisible({ timeout: 8_000 });
  } catch {
    await page.getByRole('button', { name: /Вставить LRC/ }).first().click();
    await page.locator('.lrc-paste__area').fill(
      [
        '[00:00.00]Гаснет свет над городом ночным',
        '[00:04.00]Тихо тает след шагов твоих',
        '[00:08.00]Мы идём вдвоём сквозь этот сон',
        '[00:12.00]Где рождается новый день',
      ].join('\n'),
    );
    await page.getByRole('button', { name: 'Применить', exact: true }).click();
    await expect(activeLine).toBeVisible({ timeout: 10_000 });
  }

  await page.waitForTimeout(2500);

  const firstWord = activeLine.locator('.word').first();
  await firstWord.click();
  await expect(page.locator('.word-pop')).toBeVisible();
  await page.waitForTimeout(2800);

  await page.locator('.word-pop .modal__close').click();
  await expect(page.locator('.word-pop')).toHaveCount(0);
  await page.waitForTimeout(1200);
});
