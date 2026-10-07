// Site do GitHub Pages (docs/) servido num subcaminho, como em https://usuario.github.io/repositorio/:
const { go } = require('./nav.js');
// CSP, nenhum pedido externo, fontes locais, service worker, uso sem internet, instalação, backup e PDF.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', 'docs'), BASE = '/assetplanning/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
let fails = 0; const ok = (n, c, x) => { if (!c) { fails++; console.log('FAIL', n, x === undefined ? '' : x); } else console.log('ok  ', n, x === undefined ? '' : x); };
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (!p.startsWith(BASE)) { res.writeHead(404); return res.end('fora do subcaminho'); }
    p = p.slice(BASE.length) || 'index.html'; if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=0' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const URL0 = 'http://127.0.0.1:' + server.address().port + BASE;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [], external = [], csp = [], failed = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(URL0.slice(0, URL0.indexOf('/', 8))) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  await page.goto(URL0); await page.waitForTimeout(1200);
  ok('o app abre e mostra o menu de etapas', await page.isVisible('.topbar'));
  ok('nenhum pedido externo (sem Google Fonts, sem CDN)', external.length === 0, external.join(', '));
  ok('nenhum pedido falhou', failed.length === 0, failed.join(', '));
  ok('nenhuma violação da política de segurança (CSP) e nenhum erro de console', (await page.evaluate(() => window.__csp)).length === 0 && errs.length === 0, JSON.stringify(await page.evaluate(() => window.__csp)) + errs.join(' | '));
  ok('fontes próprias carregadas (Fraunces e Public Sans)', await page.evaluate(async () => { await document.fonts.ready; const ok = (f) => [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded'); return ok('Fraunces') && ok('Public Sans'); }));
  ok('versão do build aparece no app', /Versão do app: [0-9a-f]{10}/.test(await page.evaluate(() => document.querySelector('.data-safety-slot').textContent)));
  // manifesto e ícones
  const man = await (await page.request.get(URL0 + 'manifest.webmanifest')).json();
  ok('manifesto: nome, tela cheia, escopo relativo, ícones 192/512 e maskable', man.name === 'Asset Planning' && man.display === 'standalone' && man.start_url === './' && man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && man.icons.some((i) => i.purpose === 'maskable'));
  const icons = await Promise.all(man.icons.map((i) => page.request.get(URL0 + i.src)));
  ok('ícones do manifesto existem', icons.every((r) => r.status() === 200));
  ok('robots.txt bloqueia indexação e a página pede noindex', (await (await page.request.get(URL0 + 'robots.txt')).text()).includes('Disallow: /') && (await page.evaluate(() => document.querySelector('meta[name=robots]').content)).includes('noindex'));
  // service worker
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 }).catch(() => {});
  await page.reload(); await page.waitForTimeout(1500);
  ok('service worker ativo e controlando a página', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !!r.active && !!navigator.serviceWorker.controller; }));
  ok('cache do app preenchido (13 arquivos)', await page.evaluate(async () => { const k = (await caches.keys()).filter((x) => x.startsWith('asset-planning-')); if (k.length !== 1) return false; return (await (await caches.open(k[0])).keys()).length >= 13; }));
  // dados e uso sem internet
  await go(page, 'apos', 400);
  await page.fill('[data-path="client.name"]:visible', 'Cliente Pages'); await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(1500);
  ok('sem internet: o app recarrega do cache e mantém os dados', await page.isVisible('.topbar') && (await page.inputValue('[data-path="client.name"]:visible')) === 'Cliente Pages');
  await go(page, 'succ', 500);
  ok('sem internet: abas e gráficos continuam funcionando', (await page.innerText('#succKpis')).includes('Monte-mor'));
  await go(page, 'apos', 600);
  ok('sem internet: Monte Carlo e gráficos desenhados', await page.evaluate(() => !!document.getElementById('chartMc') && document.getElementById('chartMc').width > 0));
  await ctx.setOffline(false);
  // backup e lembrete
  await page.evaluate(() => { document.getElementById('btnExportFile').closest('details').open = true; });
  ok('sem backup: lembrete de backup visível', (await page.innerText('.data-safety-slot')).includes('Nenhum backup em arquivo'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#btnExportFile')]); await page.waitForTimeout(400);
  const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok('backup baixado como arquivo comum e com o nome do cliente', dl.suggestedFilename() === 'asset-planning-backup.json' && j.client.name === 'Cliente Pages');
  ok('depois do backup: "Último backup: ... hoje"', (await page.innerText('.data-safety-slot')).includes('hoje'));
  // PDF sob CSP
  await go(page, 'diag', 500);
  const [pd] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#btnPdfDiag')]);
  const buf = fs.readFileSync(await pd.path());
  ok('PDF gerado sob a política de segurança (arquivo válido)', buf.slice(0, 5).toString() === '%PDF-' && buf.length > 50000, buf.length + ' bytes');
  ok('ainda sem violações de CSP depois de gerar o PDF', (await page.evaluate(() => window.__csp)).length === 0, JSON.stringify(await page.evaluate(() => window.__csp)));
  await ctx.close();
  // iPhone no Safari (fora da tela inicial): dica de instalação
  const ios = await browser.newContext({ ...devices['iPhone 13'] }); const ip = await ios.newPage();
  await ip.goto(URL0); await ip.waitForTimeout(1200);
  ok('iPhone: dica para adicionar à Tela de Início aparece', (await ip.evaluate(() => document.querySelector('.data-safety-slot').textContent)).includes('Adicionar à Tela de Início'));
  await ios.close();
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  console.log(fails === 0 ? '\nTODOS OS TESTES PASSARAM' : '\n' + fails + ' FALHA(S)');
  await browser.close(); server.close();
})();
