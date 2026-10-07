const { chromium } = require('playwright');
const { go } = require('./nav.js');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const saved = [];
  await page.exposeFunction('__saveFile', (name, b64) => { saved.push(name); fs.writeFileSync(require('path').join(process.env.OUT_DIR || '/tmp', 'out_' + name), Buffer.from(b64, 'base64')); });
  await page.addInitScript(() => { window.claude = { use: async (n) => n === 'downloads' ? { save: async ({ filename, data }) => { const blob = data instanceof Blob ? data : new Blob([data]); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); await window.__saveFile(filename, btoa(s)); return { status: 'saved' }; } } : null }; });
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(900);
  const tab = async (t) => { await go(page, t, 450); };
  await tab('open'); await page.fill('#pane-open [data-path="client.name"]', 'Maria e João Silva'); await page.fill('[data-path="pro.name"]', 'Planejador Teste'); await page.fill('[data-path="pro.scope"]', 'Planejamento financeiro pessoal'); await page.fill('[data-path="pro.fee"]', 'Honorário fixo'); await page.fill('[data-path="pro.conflicts"]', 'Nenhum conhecido');
  await tab('ver'); await page.fill('#verName', 'Revisão anual'); await page.fill('#verNote', 'estado inicial do plano'); await page.click('#btnVerSave');
  await tab('apos'); await page.evaluate(() => document.getElementById('btnReset').closest('details').open = true);
  await page.fill('[data-path="cashflow.executed"]', '9.000,00'); await page.click('#addPhaseEx'); await page.click('#addPhaseEx'); await page.click('#fillTax'); await page.click('#fillTax'); await page.check('[data-path="retTax.on"]');
  await tab('obj'); await page.fill('#goalRows tbody tr:first-child [data-field="saved"]', '30.000,00');
  await tab('ips'); await page.click('#suggestCommit'); await page.waitForTimeout(400);
  await page.click('#btnIpsAccept'); await page.click('#btnIpsAccept'); await page.waitForTimeout(500);
  for (const [t, id] of [['succ', 'btnPdfSucc'], ['apos', 'btnPdfApos'], ['obj', 'btnPdfObj'], ['ver', 'btnPdfVer'], ['syn', 'btnPdfSyn'], ['ips', 'btnPdfIps']]) {
    await tab(t); await page.click('#' + id);
    await page.waitForFunction((i) => !document.getElementById(i).disabled, id, { timeout: 120000 });
    await page.waitForTimeout(400);
  }
  console.log('salvos:', saved.join(', '));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  await browser.close();
})();