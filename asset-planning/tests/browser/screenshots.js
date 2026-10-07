const { chromium } = require('playwright');
const { go } = require('./nav.js');
const tabs = (process.argv[2] || 'obj,cx,prot,ver').split(',');
const scheme = process.argv[3] || 'light', width = Number(process.argv[4] || 1400);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width, height: 950 }, colorScheme: scheme })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(800);
  for (const t of tabs) {
    await go(page, t, 500);
    const h = await page.evaluate((t) => { const el = document.getElementById('pane-' + t); const sc = [el, ...el.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible'); return sc ? sc.scrollHeight : el.scrollHeight; }, t);
    for (let y = 0, i = 1; y < h; y += 850, i++) {
      await page.evaluate(([t, y]) => { const el = document.getElementById('pane-' + t); const sc = [el, ...el.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible') || document.scrollingElement; sc.scrollTop = y; }, [t, y]);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `/tmp/shots_${scheme}_${t}_${i}.png` });
    }
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();