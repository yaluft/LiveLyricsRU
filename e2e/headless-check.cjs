const { chromium } = require('playwright-core');

(async function run(){
  const exe = '/home/joski/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push({ type: 'console', text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: String(e) }));

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' , timeout: 20000});
  } catch (e) {
    console.error('goto failed', String(e));
  }

  const blurbCount = await page.locator('.landing__blurb').count();
  console.log('blurbCount=' + blurbCount);

  let resp = null;
  try {
    const p = page.waitForResponse((r) => /\/api\/(search|resolve)/.test(r.url()), { timeout: 10000 });
    const chip = page.locator('.chip').first();
    if (await chip.count()) await chip.click();
    resp = await p.catch(() => null);
  } catch (e) {
    // ignore
  }

  if (resp) {
    console.log('api.status=' + resp.status() + ' url=' + resp.url());
    try {
      const json = await resp.json();
      console.log('api.keys=' + Object.keys(json).slice(0,6).join(','));
    } catch (e) {
      console.log('api.nonjson');
    }
  } else {
    console.log('no-api-response');
  }

  console.log('logs=' + JSON.stringify(logs.slice(0,40)));
  await browser.close();
})().catch((e)=>{console.error('error', e); process.exit(2)});
