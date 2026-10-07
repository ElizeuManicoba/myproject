const { chromium } = require('playwright');
const { go } = require('./nav.js');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(800);
  for (const t of ['open', 'diag', 'obj', 'cx', 'prot', 'succ', 'apos', 'irm', 'ira', 'pgbl', 'syn', 'plan', 'ips', 'ver']) {
    await go(page, t, 350);
    const h = await page.evaluate((t) => document.getElementById('pane-' + t).scrollHeight, t);
    console.log(t, 'altura', h);
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();