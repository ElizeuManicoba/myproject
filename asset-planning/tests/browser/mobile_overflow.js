const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(800);
  for (const t of ['open', 'diag', 'obj', 'cx', 'prot', 'succ', 'apos', 'irm', 'ira', 'pgbl', 'syn', 'plan', 'ips', 'ver']) {
    await page.evaluate((t) => { document.querySelector('[data-tab="' + t + '"]').click(); }, t); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const w = document.documentElement.clientWidth; let worst = null; document.querySelectorAll('.pane.active *').forEach((e) => { if (e.closest('.table-scroll') || e.closest('canvas')) return; const b = e.getBoundingClientRect(); if (b.right > w + 1 && b.width > 0 && getComputedStyle(e).position !== 'fixed') { if (!worst || b.right > worst.right) worst = { tag: e.tagName, cls: e.className && e.className.baseVal === undefined ? e.className : '', right: Math.round(b.right) }; } }); return { sw: document.documentElement.scrollWidth, w, worst }; });
    console.log(t, JSON.stringify(r));
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();