// Fluxo da reunião: etapas, roteiro, diagnóstico final, compromissos, IPS, aceite e backup.
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
  const txt = (sel) => page.$eval(sel, (e) => e.innerText);
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('asset-planning-v2')));
  const activePane = () => page.evaluate(() => document.querySelector('.pane.active').id);
  const sel = (id) => page.evaluate((id) => document.querySelector('.stage[data-stage="' + id + '"]').getAttribute('aria-selected'), id);
  const armedClick = async (s) => { await page.click(s); await page.click(s); await page.waitForTimeout(300); };

  // ---------- etapas e roteiro ----------
  ok('o app abre na Abertura (etapa 1)', (await activePane()) === 'pane-open' && (await sel('open')) === 'true');
  ok('sete etapas na barra, mais Versões', (await page.$$eval('#stages .stage[data-stage]', (e) => e.length)) === 7 && await page.isVisible('.stage.util'));
  ok('roteiro com sete itens e a primeira etapa pendente marcada como próxima', (await page.$$eval('#roadmap .road-item', (e) => e.length)) === 7 && (await page.$$eval('#roadmap .road-item.next', (e) => e.length)) === 1);
  ok('subetapas escondidas na Abertura', !(await page.isVisible('#substrip')));
  await page.click('.stage[data-stage="ana"]'); await page.waitForTimeout(250);
  ok('etapa Análises mostra as 4 telas e abre a primeira (Caixa e dívidas)', (await activePane()) === 'pane-cx' && (await page.$$eval('.sub-group.on .tab', (e) => e.map((x) => x.dataset.tab).join(','))) === 'cx,prot,apos,succ');
  await page.click('.tab[data-tab="succ"]'); await page.waitForTimeout(250);
  await page.click('.stage[data-stage="diag"]'); await page.waitForTimeout(200); await page.click('.stage[data-stage="ana"]'); await page.waitForTimeout(250);
  ok('voltar à etapa reabre a última tela vista (Sucessão)', (await activePane()) === 'pane-succ');
  ok('só a etapa atual fica selecionada', (await sel('ana')) === 'true' && (await sel('diag')) === 'false');
  const nxt = await page.$$eval('#pane-succ .stepnav button', (b) => b.map((x) => x.dataset.go).join(','));
  ok('no fim das análises o próximo pula a tributação opcional, que fica como botão extra', nxt === 'apos,irm,syn', nxt);
  await page.click('#pane-succ .stepnav [data-go="syn"]'); await page.waitForTimeout(250);
  ok('próximo leva ao Diagnóstico final', (await activePane()) === 'pane-syn' && (await sel('syn')) === 'true');
  ok('o anterior do Diagnóstico final volta à Sucessão (pula a tributação)', (await page.$eval('#pane-syn .stepnav [data-go]', (b) => b.dataset.go)) === 'succ');
  await go(page, 'ira', 300);
  const s1 = await st();
  ok('telas visitadas ficam registradas no plano (e vão no backup)', s1.meeting.seen.ira === true && s1.meeting.seen.syn === true && s1.meeting.seen.succ === true && s1.meeting.seen.pgbl === false);
  ok('a etapa opcional concluída ganha o selo de feita', await page.$eval('.stage[data-stage="tax"]', (b) => b.classList.contains('done') && b.classList.contains('optional')));
  await go(page, 'ver', 300);
  ok('Versões fica fora das etapas e abre normalmente', (await activePane()) === 'pane-ver' && (await page.$$eval('.stage[aria-selected="true"]', (e) => e.length)) === 1);

  // ---------- abertura: identificação e documentos ----------
  await go(page, 'open', 300);
  await page.fill('#pane-open [data-path="client.name"]', 'Maria e João Silva');
  await page.fill('#pane-open [data-path="meeting.participants"]', 'Casal e contador');
  await page.fill('#pane-open [data-path="pro.name"]', 'Planejador Teste'); await page.fill('#pane-open [data-path="pro.scope"]', 'Planejamento financeiro pessoal, sem recomendação de valores mobiliários.');
  await page.fill('#pane-open [data-path="pro.fee"]', 'Honorário fixo'); await page.fill('#pane-open [data-path="pro.conflicts"]', 'Nenhum conhecido');
  await page.check('[data-path="meeting.docs.extratos"]'); await page.check('[data-path="meeting.docs.irpf"]');
  await page.selectOption('[data-path="risk.tolerance"]', 'moderada'); await page.fill('[data-path="risk.drawdown"]', '25');
  await page.waitForTimeout(300);
  const s2 = await st();
  ok('abertura grava cliente, reunião, documentos e percepção de risco', s2.client.name === 'Maria e João Silva' && s2.meeting.participants === 'Casal e contador' && s2.meeting.docs.extratos && s2.risk.tolerance === 'moderada' && s2.risk.drawdown === 25);
  ok('a etapa Abertura passa a concluída quando nome, profissional e escopo estão preenchidos', await page.$eval('.stage[data-stage="open"]', (b) => b.classList.contains('done')));
  ok('o nome do cliente aparece nas demais telas', (await txt('#pane-diag [data-client-line]')).includes('Maria e João Silva'));
  await go(page, 'apos', 300);
  ok('o campo Cliente da Aposentadoria acompanha a Abertura (duplicado sincronizado)', (await page.inputValue('#rail [data-path="client.name"]')) === 'Maria e João Silva');

  // ---------- diagnóstico final ----------
  await go(page, 'syn', 400);
  const synAreas = await page.$$eval('#synAreas tbody tr', (r) => r.length);
  ok('diagnóstico final traz as 10 áreas, resumo e prioridades', synAreas === 10 && (await txt('#synSummary')).includes('Patrimônio líquido') && (await txt('#synTop3')).length > 20);
  ok('com o plano de ação vazio, sugere montá-lo', (await txt('#synTop3')).includes('plano de ação ainda está vazio'));
  const synTxt = await txt('#pane-syn');
  ok('tributação aparece como informativa após a etapa ter sido vista', synTxt.includes('Eficiência tributária') && synTxt.includes('Informativo'));
  await page.click('#synAreas [data-go="cx"]'); await page.waitForTimeout(250);
  ok('cada área leva à tela de origem', (await activePane()) === 'pane-cx');

  // ---------- plano de ação (sugestões) ----------
  await go(page, 'plan', 400);
  const nSug = await page.$$eval('#suggestBox [data-sug]', (b) => b.length);
  if (nSug) { await page.click('#suggestBox [data-sug]'); await page.waitForTimeout(300); }
  ok('plano de ação aceita sugestões do sistema', nSug > 0 && (await st()).actions.length >= 1, nSug);
  await go(page, 'syn', 400);
  ok('com ações no plano, as decisões prioritárias vêm do plano', !(await txt('#synTop3')).includes('ainda está vazio') && (await page.$$eval('#synTop3 .top3 .t', (e) => e.length)) >= 1);

  // ---------- compromissos e IPS ----------
  await go(page, 'ips', 500);
  ok('IPS sem compromissos: aviso e aceite bloqueado', (await txt('#ipsWarnings')).includes('Nenhum compromisso') && await page.$eval('#btnIpsAccept', (b) => b.disabled));
  await page.click('#suggestCommit'); await page.waitForTimeout(400);
  const c1 = (await st()).commitments;
  ok('sugestões nascem do plano: aporte, reserva/dívida/metas e comportamentos', c1.length >= 5 && c1.some((x) => x.source === 'aporte_apos') && c1.some((x) => x.source === 'comp_revisao') && c1.some((x) => x.kind === 'dividas' || x.kind === 'divida' || x.kind === 'meta'), c1.length);
  ok('documento faltante vira sugestão (fora do documento por padrão)', c1.some((x) => x.source === 'docs' && !x.include && x.text.includes('contratos e saldos de dívidas')));
  const nBefore = c1.length;
  await page.click('#suggestCommit'); await page.waitForTimeout(300);
  ok('sugerir de novo não duplica', (await st()).commitments.length === nBefore && (await txt('#commitToast')).includes('Nenhum compromisso novo'));
  const incBefore = c1.filter((x) => x.include).length;
  ok('o documento lista só os incluídos', (await page.$$eval('#ipsDoc h4', (h) => h.length)) >= 9 && (await page.$$eval('#ipsDoc table:nth-of-type(1) tbody tr', (r) => r.length)) === incBefore, incBefore);
  // incluir o aporte adicional, mudar valor e editar o texto
  const idx = c1.findIndex((x) => x.source === 'aporte_apos_extra');
  if (idx >= 0) {
    await page.check('#commitRows .erow:nth-child(' + (idx + 1) + ') [data-field="include"]'); await page.waitForTimeout(300);
    ok('marcar "entra no documento" inclui o compromisso e o rótulo muda', (await st()).commitments[idx].include === true && (await page.$$eval('#ipsDoc table:nth-of-type(1) tbody tr', (r) => r.length)) === incBefore + 1);
  }
  await page.fill('#commitRows .erow:first-child [data-field="text"]', 'Manter o aporte de R$ 7.000 por mês sem interrupção'); await page.waitForTimeout(200);
  ok('texto do compromisso é editável e vai para o documento', (await txt('#ipsDoc')).includes('sem interrupção'));
  await page.click('#addCommit'); await page.waitForTimeout(450);
  ok('compromisso manual pode ser adicionado', (await st()).commitments.length === nBefore + 1);
  await page.click('#commitRows .erow:last-child .rm'); await page.waitForTimeout(450);
  ok('e removido', (await st()).commitments.length === nBefore);

  const doc = await txt('#ipsDoc');
  ok('documento: identificação, situação, objetivos, regras, responsabilidades, escopo, investimentos, assinaturas', ['1. Identificação', '2. Situação na data', '3. Objetivos do cliente', '5. Compromissos assumidos', '6. Regras de decisão', '7. Responsabilidades', '8. Escopo', '9. Investimentos', 'Maria e João Silva', 'Planejador Teste', 'Rascunho'].every((k) => doc.includes(k)));
  ok('sem autorização da CVM o documento não recomenda investimentos', doc.includes('não define alocação de ativos nem recomenda valores mobiliários') && !/\b(CDB|Tesouro|ETF|debênture|fundo de investimento|ações da|FII)\b/i.test(doc));
  ok('campos de diretriz de investimento escondidos sem autorização', !(await page.isVisible('#ipsInvestForm')));

  // parâmetros das regras
  await page.fill('[data-path="ips.coverageMin"]', '80'); await page.fill('[data-path="ips.reviewMonths"]', '6'); await page.waitForTimeout(300);
  ok('parâmetros do IPS entram nas regras e na revisão', (await txt('#ipsDoc')).includes('abaixo de 80%') && (await txt('#ipsDoc')).includes('a cada 6 meses'));

  // ---------- aceite ----------
  await page.click('#btnIpsAccept'); await page.waitForTimeout(200);
  ok('aceite exige segundo clique (sem confirm do navegador)', (await st()).ips.status === 'rascunho' && (await page.innerText('#btnIpsAccept')).includes('Clique de novo'));
  await page.click('#btnIpsAccept'); await page.waitForTimeout(500);
  const s3 = await st();
  const av = s3.versions.find((v) => v.id === s3.ips.acceptedVersion);
  ok('aceite registra status, data e a versão do plano', s3.ips.status === 'aceito' && /^\d{4}-\d{2}-\d{2}$/.test(s3.ips.acceptedOn) && av && av.name.startsWith('Compromisso aceito em') && av.state.ips.status === 'aceito' && av.state.commitments.length === s3.commitments.length);
  ok('o documento mostra "Aceito" e o banner confirma', (await txt('#ipsDoc')).includes('Aceito em') && (await txt('#ipsAccept')).includes('Aceito em'));
  ok('o roteiro marca o compromisso como concluído', await page.$eval('.stage[data-stage="ips"]', (b) => b.classList.contains('done')));
  ok('sem alterações após o aceite, sem alerta', !(await txt('#ipsAccept')).includes('alterações desde o aceite'));
  await page.fill('#commitRows .erow:first-child [data-field="value"]', '8.000,00'); await page.waitForTimeout(300);
  ok('alterar o plano depois do aceite acende o alerta e marca o documento', (await txt('#ipsAccept')).includes('alterações desde o aceite') && (await txt('#ipsDoc')).includes('com alterações posteriores') && (await txt('#ipsAccept')).includes('Compromisso'));
  await armedClick('#btnIpsRenew');
  const s4 = await st();
  ok('novo aceite cria outra versão e zera o alerta', s4.versions.length === s3.versions.length + 1 && s4.ips.acceptedVersion !== s3.ips.acceptedVersion && !(await txt('#ipsAccept')).includes('alterações desde o aceite'));
  await armedClick('#btnIpsReopen');
  ok('reabrir volta a rascunho sem apagar a versão aceita', (await st()).ips.status === 'rascunho' && (await st()).versions.length === s4.versions.length);

  // ---------- backup e restauração ----------
  await page.evaluate(() => { document.getElementById('btnExportFile').closest('details').open = true; }); await go(page, 'apos', 300);
  await page.evaluate(() => { document.getElementById('btnExportFile').closest('details').open = true; }); await page.waitForTimeout(250);
  const backup = await page.inputValue('#backupExport');
  const bj = JSON.parse(backup);
  ok('o backup leva compromissos, IPS, reunião e telas vistas', bj.commitments.length === nBefore && bj.ips.acceptedVersion === s4.ips.acceptedVersion && bj.meeting.participants === 'Casal e contador' && bj.meeting.seen.ira === true && bj.meta.version === 6);
  await armedClick('#btnWipe'); await page.waitForTimeout(400);
  ok('apagar tudo volta à Abertura com o roteiro zerado', (await activePane()) === 'pane-open' && (await page.$$eval('.stage.done', (e) => e.map((x) => x.dataset.stage).join(','))) === 'diag,obj');
  await go(page, 'apos', 300); await page.evaluate(() => { document.getElementById('backupImport').closest('details').open = true; });
  await page.fill('#backupImport', backup); await page.click('#btnImport'); await page.waitForTimeout(500);
  const s5 = await st();
  ok('restaurar o backup traz tudo de volta e abre na Abertura', s5.commitments.length === nBefore && s5.ips.status === 'rascunho' && s5.meeting.seen.ira === true && (await activePane()) === 'pane-open');
  ok('o roteiro reflete o estado restaurado', await page.$eval('.stage[data-stage="tax"]', (b) => b.classList.contains('done')));

  // ---------- com autorização da CVM ----------
  await page.selectOption('#pane-open [data-path="pro.cvm"]', 'sim'); await page.fill('#pane-open [data-path="pro.cvmNo"]', 'Ato Declaratório 0000');
  await go(page, 'ips', 400);
  ok('com autorização da CVM aparecem os campos de diretriz de investimento', await page.isVisible('#ipsInvestForm'));
  await page.fill('[data-path="ips.investmentPolicy"]', 'Diretrizes do consultor autorizado: texto livre.'); await page.waitForTimeout(250);
  ok('as diretrizes digitadas pelo consultor entram no documento (a ferramenta não as gera)', (await txt('#ipsDoc')).includes('Diretrizes do consultor autorizado: texto livre.') && !(await txt('#ipsDoc')).includes('não define alocação de ativos'));
  ok('alerta de perfil de investidor sem data', (await txt('#ipsWarnings')).includes('perfil de investidor'));

  // ---------- injeção ----------
  await go(page, 'open', 300);
  await page.fill('#pane-open [data-path="client.name"]', '<img src=x onerror="window.__pwn=1">');
  await go(page, 'ips', 400); await go(page, 'syn', 400);
  ok('texto do cliente não executa HTML nas novas telas', await page.evaluate(() => !window.__pwn && !document.querySelector('#ipsDoc img, #synSummary img')));

  ok('nenhum confirm/alert/prompt', dialogs === 0, dialogs);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'nenhum');
  console.log(fails === 0 && errs.length === 0 ? '\nTODOS OS TESTES PASSARAM' : '\n' + fails + ' FALHA(S)');
  await browser.close();
})();
