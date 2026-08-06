(async function(){
  const puppeteer = await import('puppeteer-core');
  const exe = '/home/joski/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const logs = [];
  page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: String(e) }));

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 20000});
  } catch (e) {
    console.error('goto failed', String(e));
  }

  const blurbCount = await page.$$eval('.landing__blurb', els => els.length);
  console.log('blurbCount=' + blurbCount);

  const hasLanding = await page.$('.landing__blurb');
  if (hasLanding) {
    const text = await page.$eval('.landing__blurb', el => el.textContent?.trim());
    console.log('landingText=' + text);
  } else {
    // capture some indicators of what rendered
    const view = await page.$eval('.app', el => el.className).catch(() => 'no-app');
    console.log('appClass=' + view);
    const stageExists = !!(await page.$('.stage'));
    console.log('stageExists=' + stageExists);
  }

  const failed = [];
  const requests = [];
  page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
  page.on('requestfailed', req => failed.push({ url: req.url(), err: String(req.failure && req.failure().errorText) }));
  page.on('requestfinished', async req => {
    try {
      const res = await req.response();
      if (res && res.status() >= 400) failed.push({ url: res.url(), status: res.status() });
    } catch (e) {
      // ignore
    }
  });

  // click first chip if present
  const chip = await page.$('.chip');
  if (chip) {
    await chip.click();
    try {
      const resp = await page.waitForResponse(r => /\/api\/(search|resolve)/.test(r.url()), { timeout: 10000 });
      console.log('api.status=' + resp.status() + ' url=' + resp.url());
      try {
        const json = await resp.json();
        console.log('api.keys=' + Object.keys(json).slice(0,6).join(','));
      } catch (e) {
        console.log('api.nonjson');
      }
    } catch (e) {
      console.log('no-api-response');
    }
  }

  console.log('failed=' + JSON.stringify(failed.slice(0,40)));
  console.log('logs=' + JSON.stringify(logs.slice(0,40)));
  await browser.close();
})().catch(e=>{console.error('error',e); process.exit(2)});
