import { expect, test } from '@playwright/test';
import { makeWav, WORD_TIMED_LRC } from './fixtures.js';

/**
 * The whole product in one pass: get a song in, read it, tap a word you don't
 * know, and have it come back for review.
 *
 * Runs entirely on the upload path, so it needs no yt-dlp and no network — the
 * guarantee v2 carried with a bundled catalogue and a virtual clock, which
 * meant its own suite never touched the real <audio> element.
 */
test('upload → synced lyrics → tap a word → save → review queue', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Начать' }).click();

  await page.locator('input[type="file"][accept="audio/*"]').setInputFiles({
    name: 'tone.wav',
    mimeType: 'audio/wav',
    buffer: makeWav(3),
  });
  await page.locator('input[type="file"][accept=".lrc,text/plain"]').setInputFiles({
    name: 'tone.lrc',
    mimeType: 'text/plain',
    buffer: Buffer.from(WORD_TIMED_LRC, 'utf8'),
  });

  await page.getByRole('button', { name: 'Загрузить' }).click();

  // The sidecar carries real per-word timestamps, so the view must say so
  // rather than presenting interpolated timings as if they were measured.
  await expect(page.getByText('пословная синхронизация')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'никогда' })).toBeVisible();

  await page.getByRole('button', { name: 'гаснет' }).click();

  // Playback keeps going behind the card — stopping the song to read a gloss is
  // what makes a learning tool feel like homework.
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('button', { name: 'Словарь' }).click();
  await expect(page.getByText('гаснет', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Повторение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Показать' })).toBeVisible();

  await page.getByRole('button', { name: 'Показать' }).click();
  // The four FSRS grades — the queue v2's inert "Учить" button never opened.
  for (const grade of ['снова', 'трудно', 'хорошо', 'легко']) {
    await expect(page.getByRole('button', { name: grade })).toBeVisible();
  }
});

test('a plain-LRC upload is labelled line-synced, not word-synced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать' }).click();

  await page.locator('input[type="file"][accept="audio/*"]').setInputFiles({
    name: 'plain.wav',
    mimeType: 'audio/wav',
    // Different bytes so this is a distinct, content-addressed track.
    buffer: makeWav(4),
  });
  await page.locator('input[type="file"][accept=".lrc,text/plain"]').setInputFiles({
    name: 'plain.lrc',
    mimeType: 'text/plain',
    buffer: Buffer.from('[00:00.00]Где свет никогда\n[00:01.50]не гаснет\n', 'utf8'),
  });

  await page.getByRole('button', { name: 'Загрузить' }).click();

  await expect(page.getByText('построчная синхронизация')).toBeVisible({ timeout: 15_000 });
});

test('the ocean parameters are all live-adjustable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();

  // v2 exposed three of these and hardcoded the rest.
  await expect(page.locator('input[type="range"]')).toHaveCount(13);
  await expect(page.locator('input[type="color"]')).toHaveCount(3);

  const height = page.getByLabel(/Высота волн/);
  await height.fill('1.4');
  await expect(page.getByText('1.40')).toBeVisible();

  await page.getByRole('button', { name: 'сбросить' }).click();
  await expect(page.getByText('1.40')).toHaveCount(0);
});
