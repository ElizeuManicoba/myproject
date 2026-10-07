// Fase 3: Monte Carlo, sucessão, download autônomo (fora do claude.ai).
const { go } = require('./nav.js');
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (n, c, x) => { if (!c) { fails++; console.log('FAIL', n, x === undefined ? '' : x); } else console.log('ok  ', n, x === undefined ? '' : x); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.goto('file://' + path.join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(900);
  const tab = async (t) => { await go(page, t, 450); };
  const txt = (sel) => page.$eval(sel, (e) => e.innerText);
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('asset-planning-v2')));
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));

  // ---------- download autônomo (sem window.claude) ----------
  await tab('apos');
  await page.evaluate(() => { document.getElementById('btnExportFile').closest('details').open = true; }); await page.waitForTimeout(200);
  ok('sem claude.ai o botão de backup aparece (download comum)', await page.isVisible('#btnExportFile'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#btnExportFile')]);
  const body = require('fs').readFileSync(await dl.path(), 'utf8');
  ok('download do backup: nome do arquivo e JSON válido com versões e blocos novos', dl.suggestedFilename() === 'asset-planning-backup.json' && (() => { const j = JSON.parse(body); return Array.isArray(j.versions) && j.mc && j.succ && j.meta.version === 6; })());
  ok('botões de PDF visíveis (html2pdf carregado)', await page.isVisible('#btnPdfApos'));

  // ---------- Monte Carlo ----------
  const mc = () => txt('#mcResult');
  const t0 = await mc();
  ok('aviso destacado: não é probabilidade de sucesso nem previsão', t0.includes('Isto não é probabilidade de sucesso nem previsão'));
  ok('premissas explícitas: cenários, volatilidade, distribuição, semente, plano', /2\.000 cenários/.test(t0) && t0.includes('volatilidade de 10,0%') && t0.includes('distribuição normal') && t0.includes('Semente 1') && t0.includes('aporte realizado de'));
  ok('nunca exibe "% de chance/probabilidade/taxa de sucesso"', !/\d+\s?%\s+(de\s+)?(chance|probabilidade)/i.test(t0) && !/taxa de sucesso/i.test(t0) && !/chance de (sucesso|dar certo)/i.test(t0));
  ok('seção explica por que não mostra probabilidade de sucesso', t0.includes('Por que a seção não mostra'));
  ok('faixas por idade e sensibilidade à volatilidade (6, 10, 14 e 18%)', t0.includes('Faixas por idade') && ['6,0%', '10,0% (atual)', '14,0%', '18,0%'].every((v) => t0.includes(v)));
  ok('gráficos da faixa e da ordem dos retornos desenhados', await page.evaluate(() => !!document.getElementById('chartMc') && !!document.getElementById('chartSeq') && document.getElementById('chartMc').width > 0));
  const med0 = (t0.match(/Saldo na aposentadoria\s*R\$\s([\d.]+)/) || [])[1];
  await page.fill('[data-path="mc.vol"]', '20'); await page.waitForTimeout(600);
  const t1 = await mc(); const med1 = (t1.match(/Saldo na aposentadoria\s*R\$\s([\d.]+)/) || [])[1];
  ok('volatilidade maior muda a faixa e rebaixa a mediana (efeito composto)', t1.includes('volatilidade de 20,0%') && num(med1) < num(med0), med0 + ' → ' + med1);
  await page.fill('[data-path="mc.vol"]', '0'); await page.waitForTimeout(500);
  ok('volatilidade 0: aviso de que os cenários coincidem com o determinístico', (await mc()).includes('todos os cenários coincidem'));
  await page.fill('[data-path="mc.vol"]', '10'); await page.waitForTimeout(300);
  await page.selectOption('[data-path="mc.dist"]', 'tstudent'); await page.waitForTimeout(500);
  ok('distribuição de caudas pesadas aparece nas premissas', (await mc()).includes('caudas pesadas (t de Student'));
  await page.selectOption('[data-path="mc.dist"]', 'normal');
  await page.selectOption('[data-path="mc.sims"]', '500'); await page.waitForTimeout(400);
  ok('número de cenários editável (500)', (await mc()).includes('500 cenários'));
  await page.selectOption('[data-path="mc.sims"]', '2000'); await page.waitForTimeout(300);
  await page.selectOption('[data-path="mc.scenario"]', 'consumir'); await page.waitForTimeout(500);
  ok('plano com aporte adicional (consumir a reserva) aparece nas premissas', /aporte realizado \+ R\$\s\d+\/mês adicionais/.test(await mc()));
  await page.selectOption('[data-path="mc.scenario"]', 'atual'); await page.waitForTimeout(300);
  const before = await mc();
  await page.click('#mcReseed'); await page.waitForTimeout(600);
  const after = await mc(); const seed = (await st()).mc.seed;
  ok('"Sortear outra" troca a semente e a amostra', seed > 1 && after.includes('Semente ' + seed) && after !== before, 'semente ' + seed);
  ok('estado salvo: mc.vol, dist, sims, seed', (await st()).mc.vol === 10 && (await st()).mc.dist === 'normal' && (await st()).mc.sims === 2000);
  await page.fill('[data-path="mc.seed"]', '1'); await page.waitForTimeout(500);
  ok('mesma semente reproduz o resultado inicial', (await mc()) === t0);
  // integração: fases e IR alteram a simulação
  await page.click('#addPhaseEx'); await page.click('#addPhaseEx'); await page.waitForTimeout(500);
  ok('gasto por fases aparece nas premissas da simulação', (await mc()).includes('com gasto por fases'));
  await page.evaluate(() => { document.getElementById('mcResult').scrollIntoView(); });

  // ---------- Sucessão ----------
  await tab('succ');
  ok('exemplo: custo de R$ 156.000 e lacuna de R$ 56.000', (await txt('#succSticky')).includes('156.000') && (await txt('#succSticky')).includes('56.000'));
  ok('campo de bens em comum visível na comunhão parcial', await page.isVisible('#succCommonRow'));
  await page.selectOption('[data-path="succ.regime"]', 'separacao'); await page.waitForTimeout(400);
  ok('separação de bens: campo some, sem meação, ITCMD maior', !(await page.isVisible('#succCommonRow')) && (await txt('#succFlow')).includes('Meação do cônjuge') && num((await txt('#succSticky')).match(/Custo estimado\s*R\$\s([\d.]+)/)[1]) > 156000);
  await page.selectOption('[data-path="succ.regime"]', 'comunhao_parcial');
  await page.fill('[data-path="succ.itcmd"]', '8'); await page.waitForTimeout(400);
  ok('ITCMD 8% → custo 195.200 e a linha da sensibilidade destaca a premissa atual', (await txt('#succSticky')).includes('195.200') && (await txt('#succSens')).includes('8% (premissa atual)'));
  await page.fill('[data-path="succ.itcmd"]', '4');
  await page.click('#succPresetJud'); await page.waitForTimeout(400);
  const sj = await st();
  ok('preset judicial: honorários 6%, custas 2%, 24 meses; aviso de que é ponto de partida', sj.succ.fees === 6 && sj.succ.costs === 2 && sj.succ.months === 24 && (await txt('#succToast')).includes('confirme com o advogado'));
  await page.click('#succPresetExtra'); await page.waitForTimeout(300);
  ok('preset extrajudicial restaura 4% / 1,5% / 6 meses', (await st()).succ.fees === 4 && (await st()).succ.months === 6);
  await page.uncheck('[data-path="succ.spouse"]'); await page.waitForTimeout(400);
  ok('sem cônjuge: sem meação e campo de bens em comum oculto', !(await page.isVisible('#succCommonRow')) && num((await txt('#succSticky')).match(/Custo estimado\s*R\$\s([\d.]+)/)[1]) > 156000);
  await page.check('[data-path="succ.spouse"]');
  await page.fill('[data-path="succ.pensionOverride"]', '300.000,00'); await page.waitForTimeout(400);
  ok('previdência manual de R$ 300 mil: liquidez fora do inventário = 300.000 e a lacuna some', (await txt('#succSticky')).includes('300.000') && (await txt('#succSticky')).includes('Folga'));
  await page.fill('[data-path="succ.pensionOverride"]', ''); await page.waitForTimeout(300);
  ok('em branco → automático (nulo no estado)', (await st()).succ.pensionOverride === null);
  ok('notas deixam claro: estimativa, advogado e sem indicação de instrumentos', (await txt('#succNotes')).includes('Estimativa de ordem de grandeza') && (await txt('#succNotes')).includes('advogado') && (await txt('#succNotes')).includes('não indica instrumentos'));
  ok('texto da aba cita que testamento/doação/estruturas ficam fora', (await txt('#pane-succ')).includes('Testamento, doação e estruturas societárias são matéria jurídica'));

  // ---------- plano de ação e versões ----------
  await tab('plan');
  ok('sugestão de caixa para o inventário aparece e pede advogado', (await txt('#suggestBox')).includes('Prever o caixa para o inventário') && (await txt('#suggestBox')).includes('advogado'));
  await tab('ver'); await page.fill('#verName', 'Antes'); await page.click('#btnVerSave'); await page.waitForTimeout(300);
  await tab('succ'); await page.fill('[data-path="succ.itcmd"]', '6'); await page.waitForTimeout(300);
  await tab('ver'); await page.waitForTimeout(300);
  const cmp = await txt('#verCompare');
  ok('versões: lacuna de sucessão e premissa de ITCMD aparecem na comparação', cmp.includes('Sucessão: lacuna de caixa no inventário') && cmp.includes('Sucessão: ITCMD'));

  // ---------- importação hostil dos blocos novos ----------
  await tab('apos');
  await page.evaluate(() => { document.getElementById('backupImport').closest('details').open = true; });
  await page.fill('#backupImport', JSON.stringify({ mc: { sims: -5, vol: '<img src=x onerror=window.__pwn=1>', dist: '<script>', seed: 'x', scenario: 5 }, succ: { regime: '__proto__', itcmd: 1e9, commonPct: -50, months: 'abc', pensionOverride: '1e400' } }));
  await page.click('#btnImport'); await page.waitForTimeout(600);
  const sh = await st();
  ok('importação: mc e succ sanitizados', sh.mc.sims === 200 && sh.mc.dist === 'normal' && sh.mc.scenario === 'atual' && sh.mc.seed === 1 && sh.succ.regime === 'comunhao_parcial' && sh.succ.itcmd === 30 && sh.succ.commonPct === 0 && Number.isFinite(sh.mc.vol));
  await tab('succ'); await tab('apos');
  ok('nada executou e a página continua renderizando', await page.evaluate(() => !window.__pwn) && (await txt('#mcResult')).length > 100);

  ok('nenhum confirm/alert/prompt', dialogs === 0, dialogs);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  console.log(fails === 0 ? '\nTODOS OS TESTES PASSARAM' : '\n' + fails + ' FALHA(S)');
  await browser.close();
})();
