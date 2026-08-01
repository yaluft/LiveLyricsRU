import { test, expect, type Page } from '@playwright/test';

/**
 * Runs against the demo catalogue (no yt-dlp on PATH in CI/sandboxes), so
 * every play here resolves to `provider: 'demo'` and bundled demo lyrics —
 * see CLAUDE.md "Everything degrades to the demo catalogue".
 */

async function playSuggestion(page: Page, label: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.locator('.stage__dock')).toBeVisible({ timeout: 15_000 });
}

test('landing page loads with search and suggestions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('Земфира, или youtube.com/… vk.com/… spotify.com/…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сплин — Выхода нет', exact: true })).toBeVisible();
});

test('picking a suggestion resolves and autoplays a demo track', async ({ page }) => {
  await playSuggestion(page, 'Сплин — Выхода нет');

  await expect(page.locator('.stage__title')).not.toHaveText('Лирика');
  await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.dock__status')).toContainText('демо-режим');
});

test('lyrics load from the demo bundle and a word can be tapped for a definition', async ({
  page,
}) => {
  await playSuggestion(page, 'Сплин — Выхода нет');

  const activeLine = page.locator('.lyricline--active');
  await expect(activeLine).toBeVisible({ timeout: 20_000 });

  const firstWord = activeLine.locator('.word').first();
  await expect(firstWord).toBeVisible();
  await firstWord.click();

  const popover = page.locator('.word-pop');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.word-pop__gloss')).not.toHaveText('');
});

test('looping the active line marks the loop control active', async ({ page }) => {
  await playSuggestion(page, 'Сплин — Выхода нет');

  const activeLine = page.locator('.lyricline--active');
  await expect(activeLine).toBeVisible({ timeout: 20_000 });

  const loopButton = activeLine.getByRole('button', { name: '↻ Повтор', exact: true });
  await loopButton.click();
  await expect(loopButton).toHaveClass(/is-active/);

  await loopButton.click();
  await expect(loopButton).not.toHaveClass(/is-active/);
});

test('layout toggle switches from Stage to Studio', async ({ page }) => {
  await playSuggestion(page, 'Сплин — Выхода нет');

  await expect(page.locator('.stage')).toBeVisible();
  await page.getByRole('button', { name: 'Студия', exact: true }).click();

  await expect(page.locator('.studio')).toBeVisible();
  await expect(page.locator('.stage__dock')).toHaveCount(0);
});

test('interface language switch is reflected immediately and survives reload', async ({
  page,
}) => {
  await playSuggestion(page, 'Сплин — Выхода нет');

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveClass(/is-active/);
});

test('pasting an IP-literal URL is rejected with a Russian hint toast, not resolved', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByPlaceholder('Земфира, или youtube.com/… vk.com/… spotify.com/…').fill('http://169.254.169.254/track');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();

  const toast = page.locator('.toast-stack .toast');
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(toast).toContainText('IP');
  // Must not have silently proceeded into playback.
  await expect(page.locator('.stage__dock')).toHaveCount(0);
});

test('narrow viewport renders the mobile shell instead of the desktop layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('.mobile')).toBeVisible();
  await expect(page.locator('.landing')).toHaveCount(0);
});
