const { chromium } = require('playwright');
const { go } = require('./nav.js');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: process.argv[2] || 'light' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(800);
  await go(page, 'apos', 400);
  // ativa exemplo de fases e preenche IR
  await page.click('#addPhaseEx'); await page.click('#addPhaseEx'); await page.waitForTimeout(300);
  await page.click('#fillTax'); await page.click('#fillTax'); await page.waitForTimeout(300);
  await page.check('[data-path="retTax.on"]'); await page.waitForTimeout(400);
  await page.evaluate(() => { const el = document.getElementById('phaseRows'); el.scrollIntoView(); const c = document.querySelector('.canvas'); });
  const pos = await page.evaluate(() => { const sc = document.querySelector('.canvas'); return { sh: sc.scrollHeight, ch: sc.clientHeight, ov: getComputedStyle(sc).overflowY, top: document.getElementById('phaseRows').getBoundingClientRect().top }; });
  console.log(JSON.stringify(pos));
  for (const [id, name] of [['phaseRows', 'ph'], ['taxRows', 'tx']]) {
    await page.evaluate((id) => { document.getElementById(id).scrollIntoView({ block: 'start' }); }, id);
    await page.waitForTimeout(300);
    await page.screenshot({ path: require("os").tmpdir() + `/ap_${name}_a.png` });
    await page.mouse.wheel(0, 780); await page.waitForTimeout(300);
    await page.screenshot({ path: require("os").tmpdir() + `/ap_${name}_b.png` });
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();