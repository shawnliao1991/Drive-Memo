// Start npm run preview first. Playwright can be supplied through NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => !!window.DriveMemoUI);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#quickMemoBtn').click();
    await page.locator('#projectRichEditor .outline-line').first().fill('App 離線筆記驗證');
    await page.locator('#bulletDialog .dialog-top-actions button[type=submit]').click();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#editor').value.includes('App 離線筆記驗證'));
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    await page.locator('#loginBtn').click();
    assert.equal(await page.evaluate(() => !!window.google), false);
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: App 啟動、手機與桌面版面、編輯後重新開啟、原生登入隔離、停用網頁快取。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
