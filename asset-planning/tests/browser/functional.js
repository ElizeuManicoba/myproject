const { chromium } = require('playwright');
let fails = 0; const ok = (n, c, x) => { if (!c) { fails++; console.log('FAIL', n, x === undefined ? '' : x); } else console.log('ok  ', n, x === undefined ? '' : x); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.goto('file://' + require('path').join(__dirname, '..', '..', 'dist', 'asset-planning.local.html')); await page.waitForTimeout(800);
  const tab = async (t) => { await page.click('.tab[data-tab="' + t + '"]'); await page.waitForTimeout(350); };
  const txt = (sel) => page.$eval(sel, (e) => e.innerText);
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('asset-planning-v2')));

  // ---------- Objetivos ----------
  await tab('obj');
  ok('3 metas de exemplo na tabela', (await page.$$('#goalRows tbody tr')).length === 3);
  ok('KPI: aporte necessário ≈ R$ 7.253', (await txt('#objKpis')).replace(/\s/g, ' ').includes('7.253'));
  await page.click('#addGoal'); await page.waitForTimeout(300);
  ok('adicionar meta cria linha e persiste', (await page.$$('#goalRows tbody tr')).length === 4);
  const lastRow = '#goalRows tbody tr:last-child';
  await page.fill(lastRow + ' [data-field="label"]', 'Reforma da casa'); await page.fill(lastRow + ' [data-field="amount"]', '50.000,00'); await page.fill(lastRow + ' [data-field="year"]', '2030');
  await page.waitForTimeout(500);
  const s1 = await st();
  ok('meta salva com valor pt-BR e ano numérico', s1.goals[3].label === 'Reforma da casa' && s1.goals[3].amount === 50000 && s1.goals[3].year === 2030);
  ok('resultado lista a nova meta', (await txt('#goalResult')).includes('Reforma da casa'));
  await page.fill('#goalRows tbody tr:first-child [data-field="saved"]', '200.000,00'); await page.waitForTimeout(300);
  ok('meta com valor reservado maior que o balanço dispara aviso', (await txt('#objBanner')).includes('Reservado acima do balanço'));
  ok('meta financiada pelo reservado aparece como Financiada', (await txt('#goalResult')).includes('Financiada'));
  await page.fill('#goalRows tbody tr:first-child [data-field="saved"]', '0'); await page.waitForTimeout(200);
  await page.click(lastRow + ' .rm'); await page.waitForTimeout(300);
  ok('remover meta', (await page.$$('#goalRows tbody tr')).length === 3);
  ok('gráfico de metas criado', await page.evaluate(() => !!document.getElementById('chartGoals') && document.getElementById('goalsCv').style.display !== 'none'));
  ok('texto sobre redirecionar aporte mostra impacto na cobertura', (await txt('#goalFunding')).includes('reduziria a cobertura'));

  // ---------- Caixa e dívidas ----------
  await tab('cx');
  const cx0 = await txt('#cxCompare');
  ok('estratégias listadas (4) e juros poupados com extra de R$ 1.000', cx0.includes('Avalanche') && cx0.includes('Bola de neve') && cx0.includes('Fluxo de caixa') && /R\$\s?\d/.test(cx0));
  await page.fill('[data-path="debtPlan.extra"]', '0'); await page.waitForTimeout(300);
  ok('sem extra e com um contrato, a avalanche poupa R$ 0 de juros', /Avalanche[\s\S]*?R\$\s0\b/.test(await txt('#cxCompare')));
  await page.fill('[data-path="debtPlan.extra"]', '2.000,00'); await page.waitForTimeout(300);
  ok('extra maior poupa mais tempo', (await txt('#cxCompare')).includes('meses'));
  const aoi0 = await txt('#cxAoi');
  await page.fill('[data-path="debtPlan.lump"]', '5.000,00'); await page.waitForTimeout(300);
  ok('valor a amortizar muda o resultado', (await txt('#cxAoi')) !== aoi0);
  await page.fill('[data-path="debtPlan.altReturn"]', '25'); await page.waitForTimeout(300);
  ok('retorno da alternativa de 25% > CET 18,5% → "A dívida é mais barata" (investir)', (await txt('#cxAoi')).includes('A dívida é mais barata'));
  await page.fill('[data-path="debtPlan.altReturn"]', ''); await page.waitForTimeout(300);
  ok('em branco volta ao automático (amortizar)', (await txt('#cxAoi')).includes('Amortizar rende mais'));
  ok('cascata mostra reserva concluída e dívida cara', (await txt('#cxCascade')).includes('Concluída') && (await txt('#cxCascade')).includes('Financiamento de veículo'));
  await page.click('#goDiag'); await page.waitForTimeout(300);
  ok('botão leva ao Diagnóstico', await page.evaluate(() => document.getElementById('pane-diag').classList.contains('active')));

  // ---------- Proteção ----------
  await tab('prot');
  const gap0 = await txt('#protSticky');
  ok('faixa fixa mostra lacunas de morte e invalidez', gap0.includes('Morte') && gap0.includes('Invalidez') && gap0.includes('lacuna'));
  await page.fill('[data-path="protect.survivorIncome"]', '0'); await page.waitForTimeout(300);
  ok('sem renda do cônjuge a lacuna aumenta', (await txt('#protSticky')) !== gap0);
  await page.fill('[data-path="protect.existingLife"]', '5.000.000,00'); await page.waitForTimeout(300);
  ok('cobertura existente alta zera a lacuna de morte', (await txt('#protSticky')).split('\n').join(' ').includes('Morte sem lacuna') || /Morte\s*sem lacuna/.test(await txt('#protSticky')));
  ok('notas deixam claro: sem indicação de produto', (await txt('#protNotes')).includes('não indica produto'));
  await page.fill('[data-path="protect.existingLife"]', '0'); await page.fill('[data-path="protect.survivorIncome"]', '8.000,00'); await page.waitForTimeout(200);

  // ---------- Aposentadoria: fases e IR ----------
  await tab('apos');
  const cov = async () => (await txt('#phaseResult')).match(/Cobertura com as fases\s*([^\n]+)/);
  await page.click('#addPhaseEx'); ok('exemplo exige segundo clique (armado)', (await page.$$('#phaseRows tbody tr')).length === 0);
  await page.click('#addPhaseEx'); await page.waitForTimeout(300);
  ok('exemplo cria 2 fases e ativa o interruptor', (await page.$$('#phaseRows tbody tr')).length === 2 && await page.isChecked('[data-path="phases.on"]'));
  const phTxt = await txt('#phaseResult');
  const m = phTxt.match(/Cobertura sem fases\s*(\d+)%[\s\S]*?Cobertura com as fases\s*(\d+)%/);
  ok('cobertura com fases maior que sem fases', m && Number(m[2]) > Number(m[1]), m && m.slice(1, 3).join(' → '));
  await page.uncheck('[data-path="phases.on"]'); await page.waitForTimeout(300);
  ok('desativar volta ao cálculo base', (await txt('#phaseResult')).includes('Desativado'));
  await page.check('[data-path="phases.on"]');
  await page.click('#fillTax'); await page.click('#fillTax'); await page.waitForTimeout(300);
  ok('preencher a partir do Diagnóstico cria linhas (7 ativos de aposentadoria)', (await page.$$('#taxRows tbody tr')).length === 7);
  const sTax = await st();
  ok('palavras-chave: PGBL → pgbl; LCI/LCA → isento; CDB → tributável', sTax.taxRows.find((r) => /PGBL/.test(r.label)).kind === 'pgbl' && sTax.taxRows.find((r) => /LCI/.test(r.label)).kind === 'isento' && sTax.taxRows.find((r) => /CDB/.test(r.label)).kind === 'tributavel');
  const before = (await txt('#taxResult')).match(/Padrão de vida sustentável\s*R\$\s([\d.]+)/)[1];
  await page.check('[data-path="retTax.on"]'); await page.waitForTimeout(400);
  const after = (await txt('#taxResult')).match(/Padrão de vida sustentável\s*R\$\s([\d.]+)/)[1];
  ok('ativar o IR reduz o padrão de vida sustentável', Number(after.replace(/\./g, '')) < Number(before.replace(/\./g, '')), before + ' → ' + after);
  await page.fill('[data-path="retTax.manual"]', '20'); await page.waitForTimeout(300);
  ok('alíquota manual de 20% aparece e substitui o cálculo', (await txt('#taxResult')).includes('alíquota manual') && (await txt('#taxResult')).includes('20,0%'));
  await page.fill('[data-path="retTax.manual"]', ''); await page.waitForTimeout(300);
  ok('em branco → nulo no estado', (await st()).retTax.manual === null);
  ok('o gráfico de fases foi desenhado', await page.evaluate(() => !!document.getElementById('chartPhase')));

  // ---------- Versões ----------
  await tab('ver');
  await page.fill('#verName', 'Base inicial'); await page.fill('#verNote', 'antes da revisão'); await page.click('#btnVerSave'); await page.waitForTimeout(300);
  ok('salvar versão cria item na lista', (await txt('#verList')).includes('Base inicial') && (await txt('#verList')).includes('antes da revisão'));
  await tab('apos');
  await page.fill('[data-path="cashflow.executed"]', '9.000,00'); await page.waitForTimeout(300);
  await tab('ver');
  const cmpTxt = await txt('#verCompare');
  ok('comparação mostra aporte realizado e indicadores melhores', cmpTxt.includes('Aporte realizado') && cmpTxt.includes('melhor') && cmpTxt.includes('Cobertura da renda desejada'));
  ok('comparação lista R$ 7.000 → R$ 9.000', /7\.000[\s\S]*9\.000/.test(cmpTxt));
  await page.click('[data-vrest]'); ok('restaurar exige segundo clique', (await st()).cashflow.executed === 9000);
  await page.click('[data-vrest]'); await page.waitForTimeout(500);
  const sR = await st();
  ok('restaurar volta o aporte para 7.000 e mantém as versões', sR.cashflow.executed === 7000 && sR.versions.length === 2 && sR.versions.some((v) => v.auto), JSON.stringify(sR.versions.map((v) => v.name)));
  ok('o estado antes da restauração foi guardado (9.000)', sR.versions.find((v) => v.auto).state.cashflow.executed === 9000);
  await page.click('[data-vdel]'); await page.click('[data-vdel]'); await page.waitForTimeout(300);
  ok('excluir (2 cliques) remove uma versão', (await st()).versions.length === 1);
  await page.fill('#verName', ''); 
  for (let i = 0; i < 12; i++) { await page.click('#btnVerSave'); await page.waitForTimeout(80); }
  ok('limite de 12 versões', (await st()).versions.length === 12 && (await txt('#verToast')).includes('Limite'));

  // ---------- persistência e backup ----------
  await page.reload(); await page.waitForTimeout(800);
  const sP = await st();
  ok('recarregar mantém metas, fases, IR, versões', sP.goals.length === 3 && sP.phases.on === true && sP.retTax.on === true && sP.versions.length === 12);
  await tab('apos');
  await page.evaluate(() => { const d = document.getElementById('backupExport').closest('details'); d.open = true; }); await page.waitForTimeout(300);
  ok('backup em texto inclui as versões', (await page.$eval('#backupExport', (e) => e.value)).includes('"versions"'));
  const hostile = JSON.stringify({ goals: [{ label: '<img src=x onerror=window.__pwn=1>', amount: '1e9999', year: 'abc', kind: 'x' }], versions: [{ name: '<script>window.__pwn=2</script>', state: { client: { name: '<b onmouseover=window.__pwn=3>x</b>' } } }, { name: 'só nome' }], phaseRows: [{ ageFrom: 'NaN', pct: {} }], taxRows: [{ label: '<i>', kind: 'pgbl', value: -5 }], protect: { needPct: 'x' }, debtPlan: { strategy: '__proto__' } });
  await page.evaluate(() => { document.getElementById('backupImport').closest('details').open = true; });
  await page.fill('#backupImport', hostile); await page.click('#btnImport'); await page.waitForTimeout(500);
  const sH = await st();
  ok('importação hostil sanitizada: enums, números, versões inválidas descartadas', sH.goals[0].kind === 'outro' && isFinite(sH.goals[0].amount) && sH.versions.length === 1 && sH.debtPlan.strategy === 'avalanche' && sH.phaseRows[0].pct === 100 && sH.phaseRows[0].ageFrom === 75);
  ok('nenhum script executou', await page.evaluate(() => !window.__pwn));
  await tab('obj'); await tab('ver'); await tab('cx'); await tab('prot'); await page.waitForTimeout(300);
  ok('nenhum script executou após renderizar todas as abas', await page.evaluate(() => !window.__pwn));
  ok('HTML hostil aparece como texto no nome da versão (sem elementos injetados)', await page.evaluate(() => document.querySelectorAll('#verList script, #verList img, #verList b').length === 0 && document.getElementById('verList').innerText.includes('<script>window.__pwn=2</script>')));

  // ---------- plano de ação: sugestões novas ----------
  await tab('apos'); await page.evaluate(() => { document.getElementById('btnReset').closest('details').open = true; }); await page.click('#btnReset'); await page.click('#btnReset'); await page.waitForTimeout(500);
  await tab('plan');
  const sug = await txt('#suggestBox');
  ok('sugestões: metas e proteção aparecem', sug.includes('Fechar a conta das metas') && sug.includes('lacuna de proteção'));
  await page.click('[data-sug="protecao_lacuna"]'); await page.waitForTimeout(300);
  ok('sugestão vira ação com origem', (await st()).actions.some((a) => a.source === 'protecao_lacuna'));

  ok('nenhum confirm/alert/prompt disparado', dialogs === 0, dialogs);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  console.log(fails === 0 ? '\nTODOS OS TESTES PASSARAM' : '\n' + fails + ' FALHA(S)');
  await browser.close();
})();