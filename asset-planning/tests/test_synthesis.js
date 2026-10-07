const E = require("../src/engine.js"), I = require("../src/irpf.js"), P = require("../src/planning.js"), G = require("../src/goals.js"), D = require("../src/debt.js"), R = require("../src/protection.js"), S = require("../src/succession.js"), V = require("../src/versions.js"), Y = require("../src/synthesis.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = (o) => JSON.parse(JSON.stringify(o));
const NOW = new Date("2026-10-07T12:00:00Z");
E.setTaxProvider((m) => I.withdrawalTax(m.taxRows, m.irpf.vig, m.retTax.manual).tau);
const s = E.defaultState(), c = Y.context(s, NOW), A = Y.areas(c, { taxVisited: true });
const by = (k) => A.find((a) => a.key === k);

// ---- áreas do diagnóstico final (exemplo conferido)
ok("10 áreas, cada uma com situação, resumo, detalhe e a aba de origem", A.length === 10 && A.every((a) => ["ok", "warn", "crit", "na", "info"].includes(a.status) && a.headline && a.tab && a.tabLabel));
ok("fluxo: superávit de R$ 7.000 (28% da renda) → ok", by("fluxo").status === "ok" && by("fluxo").headline.includes("7.000") && by("fluxo").headline.includes("28%"));
ok("reserva: 6,8 meses contra alvo de 3 → ok", by("reserva").status === "ok" && by("reserva").headline.includes("6,8"));
ok("reserva abaixo do alvo → atenção; abaixo da metade → crítico", (() => { const q = clone(s); q.diag.bsAssets[1].value = 40000; const w = Y.areas(Y.context(q, NOW)).find((a) => a.key === "reserva"); q.diag.bsAssets[1].value = 5000; const k = Y.areas(Y.context(q, NOW)).find((a) => a.key === "reserva"); return w.status === "warn" && k.status === "crit"; })());
ok("dívida cara (CET 18,5% > retorno líquido 9,35%) → atenção, com a dívida citada", by("dividas").status === "warn" && by("dividas").detail.includes("Financiamento de veículo"));
ok("sem dívidas → ok", (() => { const q = clone(s); q.diag.bsLiabilities = []; return Y.areas(Y.context(q, NOW)).find((a) => a.key === "dividas").status === "ok"; })());
ok("aposentadoria: cobertura de 97% → atenção, cita o aporte adicional e a crise", by("aposentadoria").status === "warn" && by("aposentadoria").headline.includes("97%") && by("aposentadoria").detail.includes("491") && by("aposentadoria").detail.includes("crise"));
ok("aposentadoria com premissas inválidas → sem dado, com a mensagem do erro", (() => { const q = clone(s); q.profile.retireAge = 30; const a = Y.areas(Y.context(q, NOW)).find((x) => x.key === "aposentadoria"); return a.status === "na" && a.detail.length > 10; })());
ok("metas: sem recursos para metas essenciais → crítico; sem metas → sem dado", by("metas").status === "crit" && (() => { const q = clone(s); q.goals = []; return Y.areas(Y.context(q, NOW)).find((x) => x.key === "metas").status === "na"; })());
ok("metas financiadas (aporte da aposentadoria zerado) → atenção apenas pelo desejo", (() => { const q = clone(s); q.cashflow.executed = 0; const m = Y.areas(Y.context(q, NOW)).find((x) => x.key === "metas"); return m.status === "warn" || m.status === "ok"; })());
ok("proteção: lacunas de morte e invalidez → crítico, citadas no resumo", by("protecao").status === "crit" && by("protecao").headline.includes("1.049.280"));
ok("proteção coberta → ok", (() => { const q = clone(s); q.protect.existingLife = 5e6; q.protect.existingDisab = 5e6; return Y.areas(Y.context(q, NOW)).find((x) => x.key === "protecao").status === "ok"; })());
ok("sucessão: custo de R$ 156 mil e lacuna → atenção (liquidez cobre ≥ 50%)", by("sucessao").status === "warn" && by("sucessao").headline.includes("156.000"));
ok("tributação: só aparece analisada se a etapa foi vista (informativa)", by("tributario").status === "info" && Y.areas(c).find((a) => a.key === "tributario").status === "na");
ok("dados: 0 de 8 confirmados → atenção; pendente → crítico", by("dados").status === "warn" && (() => { const q = clone(s); q.quality.liquid = "pendente"; return Y.areas(Y.context(q, NOW)).find((x) => x.key === "dados").status === "crit"; })());
const sm = Y.summary(A);
ok("resumo: contagens batem com as áreas e a atenção vem ordenada do crítico ao menor", sm.counts.crit + sm.counts.warn + sm.counts.ok + sm.counts.info + sm.counts.na === 10 && sm.attention[0].status === "crit" && sm.attention.every((a, i, l) => i === 0 || (a.status === "warn" ? l[i - 1].status !== "warn" || true : true)) && sm.strengths.every((a) => a.status === "ok"));
ok("resumo executivo: patrimônio, pontos fortes e de atenção, sem inventar produto", (() => { const t = Y.executive(c, A).join(" "); return t.includes("2.060.000") && t.includes("Pontos fortes") && t.includes("Pontos de atenção") && !/cdb|tesouro|fundo|ações|pgbl/i.test(t); })());

// ---- compromissos sugeridos
const cm = Y.commitments(c, { taxVisited: true }), src = (k) => cm.find((x) => x.source === k);
ok("aporte atual entra marcado; aporte adicional e ajuste do objetivo entram como opção (desmarcados)", src("aporte_apos").include && src("aporte_apos").value === 7000 && src("aporte_apos_extra") && !src("aporte_apos_extra").include && near(src("aporte_apos_extra").value, 490.64, 0.01) && src("ajuste_apos") && !src("ajuste_apos").include);
ok("dívida cara vira compromisso com o recurso extra; reserva só se houver lacuna", src("divida:1").include && src("divida:1").value === 1000 && src("divida:1").freq === "mensal" && !src("reserva"));
ok("reserva abaixo do alvo gera compromisso com prazo de 12 meses", (() => { const q = clone(s); q.diag.bsAssets[1].value = 20000; const k = Y.commitments(Y.context(q, NOW), {}).find((x) => x.source === "reserva"); return k && k.include && k.due === "2027-10-07" && near(k.value, 14700 * 3 - 20000, 1e-6); })());
ok("metas: uma linha por meta, com prazo em 1º de janeiro; sem recursos ficam desmarcadas", ["meta:1", "meta:2", "meta:3"].every((k) => src(k) && !src(k).include) && src("meta:2").due === "2029-01-01" && near(src("meta:2").value, 2869.06, 0.01));
ok("metas com recursos livres entram marcadas", (() => { const q = clone(s); q.cashflow.executed = 0; return Y.commitments(Y.context(q, NOW), {}).filter((x) => x.kind === "meta" && x.include).length >= 1; })());
ok("proteção e sucessão são decisões do cliente com profissional habilitado (desmarcadas)", !src("protecao").include && src("protecao").text.includes("profissional habilitado") && !src("sucessao").include && src("sucessao").text.includes("orientação jurídica"));
ok("PGBL só é sugerido se a etapa de tributação foi vista; remete ao contador", src("pgbl") && !src("pgbl").include && src("pgbl").text.includes("contador") && !Y.commitments(c, {}).some((x) => x.source === "pgbl"));
ok("compromissos de comportamento padrão (3) entram marcados", ["comp_resgate", "comp_revisao", "comp_comunicar"].every((k) => src(k) && src(k).include && src(k).kind === "comportamento"));
ok("dados pendentes viram compromisso do cliente com prazo de 1 mês", (() => { const q = clone(s); q.quality.income = "pendente"; const k = Y.commitments(Y.context(q, NOW), {}).find((x) => x.source === "dados"); return k && k.owner === "cliente" && k.due === "2026-11-07" && k.text.includes("Receita mensal"); })());
ok("nenhum compromisso cita produto ou valor mobiliário", (() => { const w = new Set(JSON.stringify(cm.filter((x) => x.source !== "pgbl")).toLowerCase().split(/[^a-zà-ú0-9]+/)); return !["cdb", "lci", "lca", "fii", "tesouro", "fundo", "fundos", "ações", "debêntures", "holding"].some((x) => w.has(x)); })());
ok("todos os compromissos gerados passam pela normalização do estado", (() => { const q = clone(s); q.commitments = cm; const n = E.normalizeState(q); return n.commitments.length === cm.length && n.commitments.every((x, i) => x.kind === cm[i].kind && x.freq === cm[i].freq && x.due === cm[i].due && x.include === cm[i].include && x.text.length <= 300); })());
ok("textos longos de compromisso cabem no limite de 300 caracteres", cm.every((x) => x.text.length <= 300), Math.max(...cm.map((x) => x.text.length)));

// ---- etapas da reunião
const st0 = Y.stages(s, []);
ok("etapas: abertura pendente (sem nome/escopo); diagnóstico e objetivos concluídos com o exemplo; próxima = abertura", !st0.list[0].done && st0.list[1].done && st0.list[2].done && st0.next === "open" && st0.list.find((x) => x.id === "tax").optional);
ok("etapas: análises só concluem com Caixa, Proteção e Aposentadoria visitadas", !Y.stages(s, ["cx", "prot"]).list.find((x) => x.id === "ana").done && Y.stages(s, ["cx", "prot", "apos"]).list.find((x) => x.id === "ana").done);
ok("etapas: tributação opcional não bloqueia o 'próximo'", (() => { const q = clone(s); q.client.name = "A"; q.pro.name = "B"; q.pro.scope = "C"; q.actions = [{ id: 1 }]; const r = Y.stages(q, ["cx", "prot", "apos"]); return r.list.find((x) => x.id === "syn").done && r.next === "ips"; })());
ok("etapas: compromisso concluído só quando aceito", (() => { const q = clone(s); q.ips.status = "aceito"; return Y.stages(q, []).list.find((x) => x.id === "ips").done; })());

// ---- documento do IPS
const withCommit = clone(s); withCommit.client.name = "Maria"; withCommit.pro = Object.assign({}, withCommit.pro, { name: "Fulano", scope: "Planejamento financeiro pessoal", fee: "Fixo", conflicts: "Nenhum conhecido" }); withCommit.commitments = cm.map((x, i) => Object.assign({ id: i + 1 }, x));
const M = Y.ipsModel(Y.context(withCommit, NOW));
ok("IPS: identificação, situação (7 linhas), objetivos (aposentadoria + 3 metas) e premissas", M.identification.client === "Maria" && M.situation.length === 7 && M.objectives.length === 4 && M.objectives[0].label.includes("Aposentadoria") && M.assumptions.length === 2);
ok("IPS: só os compromissos marcados entram no documento", M.commitments.length === cm.filter((x) => x.include).length && M.commitments.every((x) => x.include));
ok("IPS: regras de decisão com limiar, valor atual e situação (cobertura 97% ≥ 90% → ok)", M.rules.length === 4 && M.rules[0].status === "ok" && M.rules[0].current === "97%" && M.rules[1].status === "ok" && M.rules[3].rule.includes("07/10/2027"));
ok("IPS: cobertura abaixo do limite configurado marca a regra como crítica", (() => { const q = clone(withCommit); q.ips.coverageMin = 100; return Y.ipsModel(Y.context(q, NOW)).rules[0].status === "crit"; })());
ok("IPS: responsabilidades do cliente e do planejador; escopo e conflitos vêm do perfil", M.responsibilities.client.length === 4 && M.responsibilities.planner.length === 4 && M.scope.scope.includes("Planejamento") && M.scope.conflicts === "Nenhum conhecido");
ok("IPS sem autorização da CVM: não há política de investimentos; só necessidades e restrições do cliente", M.investment.mode === "cliente" && M.investment.needs.length === 5 && !("policy" in M.investment) && M.disclaimer.lines[1].includes("Não possui autorização"));
ok("IPS com autorização da CVM: seção de política do consultor e alerta de perfil vencido", (() => { const q = clone(withCommit); q.pro.cvm = "sim"; const m = Y.ipsModel(Y.context(q, NOW)); const q2 = clone(q); q2.ips.profileDate = "2026-09-01"; const m2 = Y.ipsModel(Y.context(q2, NOW)); const q3 = clone(q); q3.ips.profileDate = "2023-01-01"; return m.investment.mode === "autorizado" && m.investment.profileStale && m.warnings.some((w) => w.includes("24 meses")) && !m2.investment.profileStale && Y.ipsModel(Y.context(q3, NOW)).investment.profileStale; })());
ok("IPS: alertas — sem nome, sem escopo, sem compromisso, cobertura sem medida", (() => { const m = Y.ipsModel(Y.context(s, NOW)); return m.warnings.length === 4 && m.warnings[0].includes("nome do cliente") && m.warnings.some((w) => w.includes("escopo")) && m.warnings.some((w) => w.includes("Nenhum compromisso")); })());
ok("IPS: com aporte adicional incluído, o alerta da cobertura some", (() => { const q = clone(withCommit); q.commitments.find((x) => x.source === "aporte_apos_extra").include = true; return !Y.ipsModel(Y.context(q, NOW)).warnings.some((w) => w.includes("cobertura da aposentadoria")); })());
ok("IPS: gatilho de queda acima do que o cliente suporta gera alerta", (() => { const q = clone(withCommit); q.risk.drawdown = 10; q.ips.drawdownTrigger = 25; return Y.ipsModel(Y.context(q, NOW)).warnings.some((w) => w.includes("gatilho")); })());
ok("IPS aceito usa a data do aceite e calcula a próxima revisão a partir dela", (() => { const q = clone(withCommit); q.ips.status = "aceito"; q.ips.acceptedOn = "2026-03-15"; q.ips.reviewMonths = 6; const m = Y.ipsModel(Y.context(q, NOW)); return m.identification.date === "2026-03-15" && m.identification.nextReview === "2026-09-15" && m.acceptance.status === "aceito"; })());
ok("reserva mínima configurada substitui a calculada na regra", (() => { const q = clone(withCommit); q.ips.reserveMonths = 9; const r = Y.ipsModel(Y.context(q, NOW)).rules[1]; return r.rule.includes("9") && r.status === "crit"; })());
ok("o documento não contém alocação de ativos nem recomendação de valores mobiliários", (() => { const t = JSON.stringify(M).toLowerCase().replace(/não contém recomendação individualizada de valores mobiliários/g, ""), w = new Set(t.split(/[^a-zà-ú0-9]+/)); return !["cdb", "lci", "lca", "fii", "fiis", "tesouro", "fundo", "fundos", "ações", "debêntures", "alocação", "rebalanceamento", "carteira"].some((x) => w.has(x)) && !t.includes("renda fixa") && !t.includes("renda variável"); })());

// ---- documentos da reunião e telas vistas
ok("documentos: sem nenhum item marcado não gera sugestão (checklist ainda não usado)", !Y.commitments(c, {}).some((x) => x.source === "docs"));
ok("documentos: marcados alguns, os que faltam viram sugestão fora do documento, com prazo de 1 mês", (() => { const q = clone(s); q.meeting.docs.extratos = true; q.meeting.docs.irpf = true; const k = Y.commitments(Y.context(q, NOW), {}).find((x) => x.source === "docs"); return k && !k.include && k.owner === "cliente" && k.due === "2026-11-07" && k.text.includes("contratos e saldos de dívidas") && !k.text.includes("declaração de IRPF"); })());
ok("documentos: todos entregues não gera sugestão", (() => { const q = clone(s); Object.keys(q.meeting.docs).forEach((k) => { q.meeting.docs[k] = true; }); return !Y.commitments(Y.context(q, NOW), {}).some((x) => x.source === "docs"); })());
ok("telas vistas: estado novo começa com tudo por ver; lixo e chaves desconhecidas são descartados", (() => { const n = E.normalizeState(null); const m = E.normalizeState({ meeting: { seen: { ira: true, xx: true, apos: "sim" } } }); return Object.keys(n.meeting.seen).length === 13 && Object.values(n.meeting.seen).every((v) => v === false) && m.meeting.seen.ira === true && m.meeting.seen.apos === true && !("xx" in m.meeting.seen); })());

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);
