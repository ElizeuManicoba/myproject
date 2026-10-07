const E = require("../src/engine.js"), I = require("../src/irpf.js"), P = require("../src/planning.js"), G = require("../src/goals.js"), D = require("../src/debt.js"), R = require("../src/protection.js"), V = require("../src/versions.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = (o) => JSON.parse(JSON.stringify(o));
E.setTaxProvider((m) => I.withdrawalTax(m.taxRows, m.irpf.vig, m.retTax.manual).tau);
const NOW = new Date("2026-10-05T12:00:00Z");

// ================= motor: números anteriores preservados =================
const s0 = E.defaultState(), a0 = E.analyze(s0, 0);
ok("base preservada: aporte p/ consumir ≈ R$ 491 e padrão máx ≈ R$ 28.959", near(a0.consume.X, 490.64, 0.01) && near(a0.consume.maxSpend, 28959.15, 0.5), a0.consume.X.toFixed(2) + " / " + a0.consume.maxSpend.toFixed(2));

// ================= fases de gasto =================
const sp = clone(s0); sp.phases.on = true; sp.phaseRows = [{ id: 1, ageFrom: 75, pct: 80, health: 0, label: "" }, { id: 2, ageFrom: 85, pct: 70, health: 2000, label: "" }];
const ap = E.analyze(sp, 0);
ok("gasto menor nas fases tardias melhora a cobertura", ap.consume.coverage > a0.consume.coverage && ap.consume.X < a0.consume.X, a0.consume.coverage.toFixed(3) + " → " + ap.consume.coverage.toFixed(3));
ok("fases desligadas = base idêntica", (() => { const q = clone(sp); q.phases.on = false; return near(E.analyze(q, 0).consume.X, a0.consume.X, 1e-9); })());
ok("fase com 100% e sem saúde não muda nada", (() => { const q = clone(s0); q.phases.on = true; q.phaseRows = [{ id: 1, ageFrom: 75, pct: 100, health: 0, label: "" }]; return near(E.analyze(q, 0).consume.X, a0.consume.X, 1e-9); })());
ok("linearidade mantida com fases: financiando o aporte, o saldo final = legado mínimo", (() => { const q = clone(sp); q.cashflow.desiredWithdrawal = 40000; const a = E.analyze(q, 0); return a.consume.X > 0 && near(a.consume.term, 0, 1e-3); })());
ok("cobertura > 100% com fases dispensa aporte adicional (sobra positiva)", ap.consume.X === 0 && ap.consume.surplus > 0);
const prof = E.spendingProfile(sp);
ok("perfil de gasto: 30.000 até 74, 24.000 aos 75, 23.000 aos 85 (70% + saúde 2.000)", prof[0].spend === 30000 && prof.find((r) => r.age === 75).spend === 24000 && prof.find((r) => r.age === 85).spend === 23000, prof.find((r) => r.age === 85).spend);
ok("saque líquido = gasto − renda (renda de INSS reduz o saque)", (() => { const q = clone(sp); q.retIncome = [{ id: 1, ageFrom: 65, value: 5000, label: "INSS" }]; return E.spendingProfile(q)[0].draw === 25000; })());
ok("fase antes da aposentadoria gera aviso; sem linhas também", (() => { const q = clone(sp); q.phaseRows[0].ageFrom = 60; const w = E.validate(q).warnings.join(" "); const q2 = clone(s0); q2.phases.on = true; return w.includes("Fase #1") && E.validate(q2).warnings.join(" ").includes("nenhuma fase"); })());

// ================= IR no resgate =================
const st = clone(s0); st.retTax.on = true; st.taxRows = [{ id: 1, label: "PGBL", kind: "pgbl", value: 500000, gainPct: 100, regime: "regressivo", years: 12, monthly: 0 }, { id: 2, label: "Isento", kind: "isento", value: 500000, gainPct: 0, regime: "regressivo", years: 0, monthly: 0 }];
const wt = I.withdrawalTax(st.taxRows, "2026", null);
ok("τ efetivo = 10% × 500k / 1 mi = 5%", near(wt.tau, 0.05, 1e-12), wt.tau);
const at = E.analyze(st, 0);
ok("IR no resgate reduz o padrão sustentável", at.consume.maxSpend < a0.consume.maxSpend && at.consume.coverage < a0.consume.coverage, a0.consume.maxSpend.toFixed(0) + " → " + at.consume.maxSpend.toFixed(0));
ok("a perda é de ordem coerente (≈ τ sobre o saque, entre 2% e 6% do padrão)", (a0.consume.maxSpend - at.consume.maxSpend) / a0.consume.maxSpend > 0.02 && (a0.consume.maxSpend - at.consume.maxSpend) / a0.consume.maxSpend < 0.06, ((a0.consume.maxSpend - at.consume.maxSpend) / a0.consume.maxSpend * 100).toFixed(2) + "%");
ok("financiando o aporte, o saldo final ≈ legado mínimo (bisseção consistente)", near(at.consume.term, 0, 1e-2) && near(at.consume.maxSpend, E.analyze(st, 0).consume.maxSpend, 1e-9), at.consume.term.toFixed(4));
ok("a bisseção reproduz o resultado linear quando τ = 0 (alíquota manual 0)", (() => { const q = clone(s0); q.retTax.on = true; q.retTax.manual = 0; return near(E.analyze(q, 0).consume.maxSpend, a0.consume.maxSpend, 1e-6); })());
ok("alíquota manual 10% substitui a estrutura", (() => { const q = clone(st); q.retTax.manual = 10; return near(I.withdrawalTax(q.taxRows, "2026", 10).tau, 0.10, 1e-12) && E.analyze(q, 0).consume.maxSpend < at.consume.maxSpend; })());
ok("IR desligado → sem efeito, mesmo com estrutura cadastrada", (() => { const q = clone(st); q.retTax.on = false; return near(E.analyze(q, 0).consume.maxSpend, a0.consume.maxSpend, 1e-9); })());
ok("renda de INSS maior que o gasto não é tributada (sem saque)", (() => { const q = clone(st); q.retIncome = [{ id: 1, ageFrom: 65, value: 40000, label: "x" }]; const t = clone(q); t.retTax.on = false; return near(E.analyze(q, 0).preserve.X, E.analyze(t, 0).preserve.X, 1e-6); })());
ok("estresse herda o IR", E.stress(st, { dRet: 0, dAporte: 0, dGasto: 0, shock: 0, custo: 0, custoIdade: 70, dHor: 0 }).coverage < a0.consume.coverage);
ok("IR ativado sem estrutura → aviso", E.validate((() => { const q = clone(s0); q.retTax.on = true; return q; })()).warnings.join(" ").includes("sem estrutura"));
// tabela de resgate
ok("regressiva: 35/30/25/20/15/10 por tempo", I.pgblRate(2) === 0.35 && I.pgblRate(3) === 0.30 && I.pgblRate(5) === 0.25 && I.pgblRate(7) === 0.20 && I.pgblRate(9) === 0.15 && I.pgblRate(11) === 0.10);
ok("VGBL: IR só sobre o ganho (40% de ganho × 15% = 6% do valor)", (() => { const w = I.withdrawalTax([{ kind: "vgbl", value: 100000, gainPct: 40, regime: "regressivo", years: 9 }], "2026"); return near(w.tau, 0.06, 1e-12); })());
ok("progressiva usa a tabela mensal sobre o saque estimado", (() => { const w = I.withdrawalTax([{ kind: "pgbl", value: 100000, gainPct: 100, regime: "progressivo", years: 5, monthly: 10000 }], "2026"); return near(w.tau, I.progressiveRate(10000, "2026"), 1e-12) && near(w.tau, (10000 * 0.275 - 908.73) / 10000, 1e-9); })());
ok("tributável: 15% sobre a parcela de ganho", near(I.withdrawalTax([{ kind: "tributavel", value: 100000, gainPct: 50, years: 5 }], "2026").tau, 0.075, 1e-12));

// ================= objetivos =================
const s1 = clone(s0), bs = P.balanco(s1), fl = P.fluxo(s1, bs), an = E.analyze(s1, 0);
const g = G.analyze(s1, fl, bs, NOW, an);
const car = g.rows.find((r) => r.label === "Troca de carro");
ok("meses até 1º/jan/2029 a partir de out/2026 = 27", car.months === 27, car.months);
const i3 = Math.pow(1.03, 1 / 12) - 1, pmtCar = 80000 * i3 / (Math.pow(1 + i3, 27) - 1);
ok("aporte necessário = PMT real a 3% a.a.", near(car.pmt, pmtCar, 1e-6), car.pmt.toFixed(2));
ok("com saved, o valor reservado cresce e reduz o aporte", (() => { const q = clone(s1); q.goals[1].saved = 30000; const r = G.analyze(q, fl, bs, NOW, an).rows[1]; return r.pmt < car.pmt && near(r.fvSaved, 30000 * Math.pow(1 + i3, 27), 1e-6); })());
ok("meta totalmente coberta pelo que já foi reservado → financiada e aporte 0", (() => { const q = clone(s1); q.goals[1].saved = 80000; const r = G.analyze(q, fl, bs, NOW, an).rows[1]; return r.status === "financiada" && r.pmt === 0; })());
ok("recursos livres = superávit − aporte da aposentadoria (7.000 − 7.000 = 0): ninguém financiado", g.totals.available === 0 && g.ranked.every((r) => r.status === "sem_recursos") && g.totals.gap > 0);
const s2 = clone(s1); s2.cashflow.executed = 0;
const g2 = G.analyze(s2, fl, bs, NOW, E.analyze(s2, 0));
ok("sem aporte comprometido, 7.000/mês financiam por prioridade: essencial primeiro", g2.ranked[0].priority === "essencial" && g2.ranked[0].status === "no_caminho" && near(g2.totals.available, 7000, 1e-9));
ok("total exigido ≈ 7.253 > 7.000 → a última (desejo) fica parcial", g2.ranked[2].status === "parcial" && g2.ranked[2].alloc > 0 && g2.ranked[2].reachPct < 1, g2.ranked[2].status);
ok("a soma alocada nunca passa do disponível", near(g2.rows.reduce((t, r) => t + r.alloc, 0), g2.totals.available, 1e-6));
ok("meta vencida é sinalizada", (() => { const q = clone(s1); q.goals[0].year = 2026; return G.analyze(q, fl, bs, NOW, an).rows[0].status === "vencida"; })());
ok("meta sem valor/ano é ignorada nos totais", (() => { const q = clone(s1); q.goals.push({ id: 9, label: "x", kind: "outro", amount: 0, year: 0, priority: "desejo", saved: 0, rate: null }); const r = G.analyze(q, fl, bs, NOW, an); return r.ranked.length === 3 && r.rows[3].status === "sem_dados"; })());
ok("reservado maior que o balanço (finalidade 'objetivos') gera divergência", (() => { const q = clone(s1); q.goals[0].saved = 50000; return G.analyze(q, fl, bs, NOW, an).totals.savedMismatch === 50000; })());
const imp = G.retirementImpact(s1, 3000);
ok("redirecionar aporte reduz a cobertura da aposentadoria", imp.coverage < a0.consume.coverage && imp.cut === 3000, imp.coverage.toFixed(3));
ok("retorno individual da meta substitui o padrão", (() => { const q = clone(s1); q.goals[1].rate = 6; return G.analyze(q, fl, bs, NOW, an).rows[1].pmt < car.pmt; })());

// ================= dívidas =================
const debts = [{ label: "Cartão", balance: 10000, cet: 120, payment: 700 }, { label: "Carro", balance: 40000, cet: 18.5, payment: 1800 }, { label: "Financ. imóvel", balance: 150000, cet: 11, payment: 1900 }];
const cmp = D.compare(debts, 500);
ok("avalanche paga menos juro que o cenário sem extra", cmp.avalanche.totalInterest < cmp.none.totalInterest && cmp.avalanche.interestSaved > 0 && cmp.avalanche.monthsSaved > 0, Math.round(cmp.avalanche.interestSaved));
ok("avalanche ≤ bola de neve ≤ ... em juros totais (avalanche é ótima)", cmp.avalanche.totalInterest <= cmp.bola.totalInterest + 1e-6 && cmp.avalanche.totalInterest <= cmp.fluxo.totalInterest + 1e-6);
ok("avalanche quita primeiro a dívida de maior CET", cmp.avalanche.debts[0].payoffMonth <= cmp.avalanche.debts[1].payoffMonth);
ok("série de saldos termina em zero", cmp.avalanche.series[cmp.avalanche.series.length - 1] === 0 && cmp.avalanche.series[0] === 200000);
ok("extra zero + rolagem das prestações liberadas ainda poupa juro", D.compare(debts, 0).avalanche.totalInterest < D.compare(debts, 0).none.totalInterest);
ok("prestação menor que o juro → nunca quita (e é sinalizado)", (() => { const r = D.simulate([{ label: "x", balance: 10000, cet: 300, payment: 100 }], { strategy: "none" }); return r.never === true && D.consistency([{ label: "x", balance: 10000, cet: 300, payment: 100, months: 12 }])[0].flag === "nao_amortiza"; })());
ok("consistência: prazo informado muito diferente do implícito é sinalizado", D.consistency([{ label: "c", balance: 40000, cet: 18.5, payment: 1800, months: 60 }])[0].flag === "prazo_diverge" && D.consistency([{ label: "c", balance: 40000, cet: 18.5, payment: 1800, months: 27 }])[0].flag === null);
const aoi = D.amortizeOrInvest(debts[1], 20000, 9.35);
ok("amortizar × investir: ponto de empate = CET (18,5% a.a.)", near(aoi.breakEvenPct, 18.5, 0.05), aoi.breakEvenPct.toFixed(3));
ok("CET 18,5% > retorno líquido 9,35% → amortizar", aoi.verdict === "amortizar" && aoi.diff > 0 && aoi.interestSaved > 0);
ok("dívida barata (11%) contra alternativa de 14% → investir", D.amortizeOrInvest(debts[2], 50000, 14).verdict === "investir");
ok("empate em CET = retorno → indiferente", D.amortizeOrInvest(debts[1], 20000, 18.5).verdict === "indiferente");
ok("valor acima do saldo é limitado ao saldo", D.amortizeOrInvest(debts[1], 999999, 9).lump === 40000);
const cas = D.cascade({ surplus: 7000, reserveGap: 14000, debts, altNetPct: 9.35 });
ok("cascata: reserva (2 meses), depois dívidas caras (CET > 9,35%: 50k + 150k)", near(cas.steps[0].months, 2, 1e-9) && cas.steps[1].amount === 200000 && near(cas.steps[1].start, 2, 1e-9) && near(cas.freeAfter, 2 + 200000 / 7000, 1e-9), JSON.stringify(cas.steps.map((x) => [x.key, Math.round(x.amount), x.months && x.months.toFixed(1)])));
ok("cascata sem superávit: prazos indefinidos", D.cascade({ surplus: 0, reserveGap: 1000, debts: [], altNetPct: 9 }).steps[0].months === null);

// ================= proteção =================
const bs3 = P.balanco(s1), fl3 = P.fluxo(s1, bs3), g3 = G.analyze(s1, fl3, bs3, NOW, an);
const pr = R.analyze(s1, { fl: fl3, bs: bs3, goals: g3 });
const n = 15 * 12, iM = Math.pow(1.03, 1 / 12) - 1, pvRenda = (18000 * 0.75 - 8000) * (1 - Math.pow(1 + iM, -n)) / iM;
ok("reposição de renda = VP de (75% × despesa − renda do cônjuge) por 15 anos a 3% real", near(pr.death.parts.find((x) => x.key === "renda").value, pvRenda, 1), Math.round(pvRenda));
ok("dívidas quitadas = saldo (R$ 40 mil); educação = metas de educação", pr.death.parts.find((x) => x.key === "dividas").value === 40000 && pr.death.parts.find((x) => x.key === "educ").value === 120000);
ok("custos finais = 20k + 4% do patrimônio líquido", near(pr.death.parts.find((x) => x.key === "final").value, 20000 + 0.04 * bs3.net, 1e-6));
ok("recursos = reserva (100k) sem tocar na aposentadoria", pr.death.resources === 100000 && pr.inputs.retirementShare === 0);
ok("lacuna = necessidade − recursos; cobertura classificada", near(pr.death.gap, pr.death.need - 100000, 1e-6) && pr.death.status === "crit");
const s4 = clone(s1); s4.protect.existingLife = 2000000; s4.protect.usePct = 0;
ok("capital existente fecha a lacuna", R.analyze(s4, { fl: fl3, bs: bs3, goals: g3 }).death.gap === 0 && R.analyze(s4, { fl: fl3, bs: bs3, goals: g3 }).death.status === "ok");
ok("usar parte da carteira de aposentadoria como recurso reduz a lacuna", (() => { const q = clone(s1); q.protect.usePct = 50; const r = R.analyze(q, { fl: fl3, bs: bs3, goals: g3 }); return r.death.gap < pr.death.gap && r.inputs.retirementShare === 500000; })());
ok("invalidez: família mantém 100% do custo (18.000 − 8.000 = 10.000/mês) até a aposentadoria (20 anos)", near(pr.disability.monthlyGap, 10000, 1e-9) && pr.disability.yearsToRetire === 20 && near(pr.disability.parts[0].value, R.annuityPV(10000, 3, 20), 1e-6));
ok("custos de cuidado entram na invalidez, não na morte", (() => { const q = clone(s1); q.protect.careMonthly = 3000; const r = R.analyze(q, { fl: fl3, bs: bs3, goals: g3 }); return r.disability.need > pr.disability.need && r.death.need === pr.death.need; })());
ok("renda do cônjuge ≥ necessidade → sem reposição de renda", (() => { const q = clone(s1); q.protect.survivorIncome = 20000; return R.analyze(q, { fl: fl3, bs: bs3, goals: g3 }).death.parts.find((x) => x.key === "renda").value === 0; })());
ok("sem dependentes nem renda de sobrevivente → hasDependents false", (() => { const q = clone(s1); q.protect.deps = 0; q.protect.survivorIncome = 0; return R.analyze(q, { fl: fl3, bs: bs3, goals: g3 }).hasDependents === false; })());
ok("VP com taxa zero = soma simples", R.annuityPV(100, 0, 1) === 1200);

// ================= sugestões novas =================
const ctx = { an, bs: bs3, fl: fl3, rs: P.reserva(s1, fl3, bs3), ind: P.indicadores(s1, bs3, fl3, P.reserva(s1, fl3, bs3), an), stress: {}, quality: P.quality(s1), goals: g3, protection: pr, tauEst: 0.05 };
const sugs = P.suggestions(s1, ctx), keys = sugs.map((x) => x.key);
ok("sugere metas, proteção e tributação do resgate", keys.includes("metas_lacuna") && keys.includes("protecao_lacuna") && keys.includes("tributacao_resgate"), keys.join(","));
ok("sugestões novas não citam produtos nem valores mobiliários", (() => { const words = new Set(JSON.stringify(sugs).toLowerCase().split(/[^a-zà-ú0-9]+/)); return !["cdb", "lci", "lca", "fii", "fiis", "tesouro", "pgbl", "vgbl", "fundo", "fundos", "ações", "debêntures", "apólice", "apólices"].some((w) => words.has(w)); })());
ok("memorando cita IR e fases quando ativos", (() => { const q = clone(sp); q.retTax.on = true; q.retTax.manual = 8; const m = P.draftRetirementMemo(q); return m.assumptions.includes("IR médio de 8%") && m.assumptions.includes("gasto por fases") && !m.risks.includes("tributação do resgate"); })());

// ================= versões =================
const vA = V.make(s1, "Antes", "plano inicial", "2026-10-05T10:00:00.000Z"), s5 = clone(s1);
s5.cashflow.executed = 9000; s5.goals[1].amount = 90000; s5.diag.bsAssets[1].value = 200000;
const cmpV = V.compare(s1, s5, NOW);
const row = (k) => cmpV.find((r) => r.key === k);
ok("comparar: aporte maior melhora a cobertura e reduz o aporte adicional", row("coverage").verdict === "better" && row("extraX").verdict === "better" && row("extraX").b < row("extraX").a);
ok("comparar: mais reserva líquida aumenta os meses de liquidez (melhor)", row("reserve").verdict === "better" && row("net").verdict === "better");
ok("comparar: o que não mudou fica 'same'", row("debt").verdict === "same" && row("debtMonths").verdict === "same");
ok("metas: exigido muda mas é só informativo", row("goalsReq").verdict === "changed");
const ch = V.changes(s1, s5);
ok("diferenças de premissas e listas detectadas", ch.some((c) => c.label === "Aporte realizado" && c.a === 7000 && c.b === 9000) && ch.some((c) => c.label.includes("Troca de carro") && c.label.includes("valor") && c.b === 90000) && ch.some((c) => c.label.includes("Tesouro Selic")));
ok("itens adicionados/removidos aparecem", (() => { const q = clone(s1); q.goals.push({ id: 7, label: "Reforma", kind: "imovel", amount: 1, year: 2030, priority: "desejo", saved: 0, rate: null }); q.diag.flow.splice(0, 1); const c = V.changes(s1, q); return c.some((x) => x.label.startsWith("Meta adicionado(a): Reforma")) && c.some((x) => x.label.startsWith("Fluxo removido(a)")); })());
ok("sem mudanças → lista vazia", V.changes(s1, clone(s1)).length === 0);
ok("fotografia não carrega a lista de versões e restaura mantendo as atuais", (() => { const w = clone(s1); w.versions = [vA]; const v2 = V.make(w, "", "", "2026-10-06T10:00:00.000Z", true); const back = V.restoreState(vA, [vA, v2]); return !("versions" in v2.state) && v2.id === 2 && v2.name === "Versão 2" && back.versions.length === 2 && back.cashflow.executed === 7000; })());
ok("normalizar aceita versões válidas e descarta lixo", (() => { const w = clone(s1); w.versions = [vA, { name: 5 }, null, { state: "x" }]; const n2 = E.normalizeState(w); return n2.versions.length === 1 && n2.versions[0].name === "Antes" && n2.versions[0].state.meta.version === 6; })());
ok("normalizar limita a 12 versões e remove versões aninhadas", (() => { const w = clone(s1); const inner = clone(s1); inner.versions = [vA]; w.versions = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: "v" + i, note: "", date: "2026-10-05T10:00:00.000Z", state: inner })); const n2 = E.normalizeState(w); return n2.versions.length === 12 && n2.versions.every((v) => v.state.versions.length === 0); })());
ok("data inválida é descartada; texto é limitado", (() => { const w = clone(s1); w.versions = [{ id: 1, name: "n".repeat(500), note: "x".repeat(900), date: "ontem", state: s1 }]; const v = E.normalizeState(w).versions[0]; return v.date === "" && v.name.length === 80 && v.note.length === 400; })());

// ================= normalização dos novos blocos =================
const dirty = E.normalizeState({ goals: [{ label: "G", kind: "foguete", priority: "urgente", amount: "1.500,50", year: "2031", rate: "4" }], taxRows: [{ kind: "x", regime: "y", value: "100" }], debtPlan: { strategy: "magia", extra: "300" }, phaseRows: [{ ageFrom: "80", pct: "75" }], protect: { needPct: "60", debtsPaid: 0 }, retTax: { on: 1, manual: "" } });
ok("enums inválidos voltam ao padrão", dirty.goals[0].kind === "outro" && dirty.goals[0].priority === "importante" && dirty.taxRows[0].kind === "tributavel" && dirty.taxRows[0].regime === "regressivo" && dirty.debtPlan.strategy === "avalanche");
ok("números em texto pt-BR são lidos; null preservado", dirty.goals[0].amount === 1500.5 && dirty.goals[0].year === 2031 && dirty.goals[0].rate === 4 && dirty.debtPlan.extra === 300 && dirty.phaseRows[0].pct === 75 && dirty.retTax.manual === null && dirty.retTax.on === true && dirty.protect.debtsPaid === false);
ok("estado novo traz 3 metas de exemplo; estado antigo não inventa metas nem proteção", E.normalizeState(null).goals.length === 3 && E.normalizeState({ profile: { currentAge: 50 } }).goals.length === 0 && E.normalizeState({ profile: { currentAge: 50 } }).protect.survivorIncome === 0);
ok("migração v3 → v4 preserva o estado e adiciona os blocos", (() => { const old3 = clone(s0); delete old3.goals; delete old3.protect; delete old3.versions; delete old3.phases; delete old3.retTax; old3.meta.version = 3; const m = E.normalizeState(old3); return m.meta.version === 6 && m.phases.on === false && m.retTax.on === false && Array.isArray(m.versions) && m.diag.bsAssets.length === 9; })());

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);