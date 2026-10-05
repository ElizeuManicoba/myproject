const E = require("../src/engine.js");
const P = require("../src/planning.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const s = E.defaultState();

// ---- exemplo do Diagnóstico coerente com o exemplo da Aposentadoria
const bs = P.balanco(s), fl = P.fluxo(s, bs);
ok("ativos totais = 2,1 mi", near(bs.totalAssets, 2100000, 1e-6), bs.totalAssets);
ok("patrimônio líquido = 2,06 mi", near(bs.net, 2060000, 1e-6));
ok("patrimônio financeiro = 1,1 mi", near(bs.financial, 1100000, 1e-6));
ok("capital p/ aposentadoria = 1 mi", near(bs.retirementFin, 1000000, 1e-6));
ok("liquidez imediata = 100 mil", near(bs.byLiq.imediata, 100000, 1e-6));
ok("serviço da dívida = 1.800", near(bs.serviceDebt, 1800, 1e-6));
ok("receita recorrente normalizada = 25.000 (bônus fica de fora)", near(fl.incomeRec, 25000, 1e-6), fl.incomeRec);
ok("receita extraordinária separada = 2.500/mês", near(fl.incomeExtra, 2500, 1e-6));
ok("despesas totais = 18.000 (inclui IPTU/IPVA/seguros ÷ 12 e dívida)", near(fl.expenseTotal, 18000, 1e-6), fl.expenseTotal);
ok("superávit sustentável = 7.000", near(fl.surplus, 7000, 1e-6), fl.surplus);
ok("essencial mensal = 14.700", near(fl.essentialMonthly, 14700, 1e-6), fl.essentialMonthly);
const patch = P.syncPatch(s);
ok("sync → liquid/illiquid/debts/income/expense = exemplo da Aposentadoria", patch.liquid === s.assets.liquid && patch.illiquid === s.assets.illiquid && patch.debts === s.assets.debts && patch.income === s.cashflow.income && patch.expense === s.cashflow.expense, JSON.stringify(patch));

// ---- reserva dimensionada
const rs = P.reserva(s, fl, bs);
ok("reserva base = 3 meses sem fatores", rs.months === 3 && near(rs.target, 44100, 1e-6));
ok("liquidez atual ≈ 6,8 meses", near(rs.monthsHave, 100000 / 14700, 1e-9), rs.monthsHave.toFixed(2));
const s2 = E.normalizeState(s); s2.diag.risk.variable = true; s2.diag.risk.single = true; s2.diag.risk.dependents = true;
ok("fatores de risco elevam os meses (3+2+2+1 = 8)", P.reserva(s2, fl, bs).months === 8);
s2.diag.monthsOverride = 12; s2.diag.shocks = 20000;
ok("override manual + choques previsíveis", P.reserva(s2, fl, bs).months === 12 && near(P.reserva(s2, fl, bs).target, 14700 * 12 + 20000, 1e-6));

// ---- indicadores
const an = E.analyze(s, 0);
const ind = P.indicadores(s, bs, fl, rs, an);
const g = (k) => ind.find((i) => i.key === k);
ok("taxa de aporte = 28% (7.000/25.000)", near(g("poupanca").value, 28, 1e-9));
ok("comprometimento com dívidas = 7,2%", near(g("dividas").value, 7.2, 1e-9), g("dividas").value);
ok("alavancagem = 40/2100 = 1,9%", near(g("alavancagem").value, 40000 / 2100000 * 100, 1e-9));
ok("solvência ≈ 98,1%", near(g("solvencia").value, 2060000 / 2100000 * 100, 1e-9));
ok("concentração = 200/1100 = 18,2%", near(g("concentracao").value, 200000 / 1100000 * 100, 1e-9), g("concentracao").detail);
ok("aporte sobre meta ≈ 93,4% (7000 / (7000+491))", near(g("meta").value, 7000 / (7000 + an.consume.X) * 100, 1e-9), g("meta").value.toFixed(2));
ok("liquidez ok (6,8 ≥ 3)", g("liquidez").status === "ok");
ok("meta de aporte em 'warn' (93% < 100%, dentro de 25%)", g("meta").status === "warn", g("meta").status);
ok("statusOf: crítico além de 25% do alvo", P.statusOf(10, 100, "min") === "crit" && P.statusOf(80, 100, "min") === "warn" && P.statusOf(120, 100, "min") === "ok" && P.statusOf(31, 30, "max") === "warn" && P.statusOf(50, 30, "max") === "crit");
ok("statusOf: sem dado → na", P.statusOf(null, 1, "min") === "na");

// ---- qualidade dos dados
const q = P.quality(s);
ok("qualidade crítica: 8 campos, 7 declarados + 1 estimado", q.critical.total === 8 && q.critical.estimated.length === 1 && q.critical.confirmed === 0);
const s3 = E.normalizeState(s); s3.quality.liquid = "pendente"; s3.diag.flow[0].quality = "pendente";
const q3 = P.quality(s3);
ok("pendências aparecem por rótulo", q3.critical.pending[0] === "Recursos financeiros" && q3.rows.pending[0] === "Salário líquido");

// ---- sugestões (só planejamento; nenhum produto)
const ctx = { an, bs, fl, rs, ind, stress: { crise: E.stress(s, s.stress.crise) }, quality: q };
const sug = P.suggestions(s, ctx);
const keys = sug.map((x) => x.key);
ok("sugere fechar a lacuna da aposentadoria (cobertura 97%)", keys.includes("aposentadoria_lacuna"), keys.join(","));
ok("sugere avaliar dívida cara (CET 18,5% ≥ retorno 11%)", keys.includes("divida_cara"));
ok("não sugere reserva (liquidez ok)", !keys.includes("reserva"));
const s4 = E.normalizeState(s); s4.diag.bsAssets[1].value = 20000;
const bs4 = P.balanco(s4), fl4 = P.fluxo(s4, bs4), rs4 = P.reserva(s4, fl4, bs4);
const sug4 = P.suggestions(s4, { an, bs: bs4, fl: fl4, rs: rs4, ind: P.indicadores(s4, bs4, fl4, rs4, an), stress: {}, quality: q });
ok("reserva baixa → sugestão crítica", sug4.find((x) => x.key === "reserva") && sug4.find((x) => x.key === "reserva").priority === "critica");
ok("nenhuma sugestão cita produto/valor mobiliário", (() => { const words = new Set(JSON.stringify(sug).toLowerCase().split(/[^a-zà-ú0-9]+/)); return !["cdb", "lci", "lca", "fii", "fiis", "tesouro", "pgbl", "vgbl", "fundo", "fundos", "ações", "debêntures"].some((w) => words.has(w)); })());

// ---- estresses determinísticos
const base = E.stress(s, { dRet: 0, dAporte: 0, dGasto: 0, shock: 0, custo: 0, custoIdade: 70, dHor: 0 });
ok("estresse neutro = base (cobertura e aporte)", near(base.coverage, an.consume.coverage, 1e-9) && near(base.X, an.consume.X, 1e-6));
const cons = E.stress(s, s.stress.cons), crise = E.stress(s, s.stress.crise), lon = E.stress(s, s.stress.long), flex = E.stress(s, s.stress.flex);
ok("conservador piora a cobertura", cons.coverage < base.coverage);
ok("crise inicial piora a cobertura", crise.coverage < base.coverage);
ok("longevidade piora a cobertura e amplia o horizonte", lon.coverage < base.coverage && lon.horizon === 110);
ok("gasto flexível (−20%) melhora a cobertura", flex.coverage > base.coverage);
ok("corte necessário = 1 − cobertura (quando < 1)", near(base.cut, 1 - base.coverage, 1e-9));
ok("choque de 30% no 1º ano da aposentadoria reduz muito o saldo final", (() => { const a0 = E.analyze(s, 0); const a1 = E.analyze(s, 0, { shock: 0.3 }); return a1.consume.maxSpend < a0.consume.maxSpend * 0.85; })());
ok("linearidade mantida com choque: terminal = alvo ao financiar", (() => { const a = E.analyze(s, 0, { shock: 0.3 }); return near(a.consume.term, 0, 1e-3); })(), "");

// ---- memorando
const memo = P.draftRetirementMemo(s);
ok("memorando traz 4 alternativas e custo da inação", memo.alternatives.split("\n").length === 4 && /esgota aos \d+/.test(memo.inaction), memo.inaction);
ok("memorando deixa a escolha em aberto", memo.chosen.includes("[Preencher"));
ok("memorando enquadrado como planejamento", memo.frame === "planejamento");

// ---- aviso legal
const d0 = P.disclaimer(s);
ok("aviso sem perfil → incompleto e sem consultoria", !d0.filled && d0.lines[1].includes("Não possui autorização"));
const s5 = E.normalizeState(s); s5.pro = { name: "Fulano", cert: "CFP", cvm: "sim", cvmNo: "nº 123", scope: "Planejamento", fee: "Fee fixo", conflicts: "Nenhum" };
const d1 = P.disclaimer(s5);
ok("aviso com perfil completo", d1.filled && d1.lines[1].includes("possui — nº 123"));

// ---- normalização dos novos blocos
const dirty = E.normalizeState({ diag: { bsAssets: [{ label: "X", value: "1.000,50", liq: "inexistente", purpose: "reserva" }], flow: [{ freq: "diario", kind: "despesa", nature: "x" }] }, actions: [{ title: "T", priority: "urgente", due: "amanhã", status: "concluida" }], memos: [{ frame: "outro", problem: "p".repeat(5000) }], pro: { cvm: "talvez" }, quality: { liquid: "inventada" } });
ok("enum inválido volta ao padrão", dirty.diag.bsAssets[0].liq === "longa" && dirty.diag.flow[0].freq === "mensal" && dirty.actions[0].priority === "media");
ok("data inválida é descartada", dirty.actions[0].due === "" && dirty.actions[0].status === "concluida");
ok("texto longo é limitado", dirty.memos[0].problem.length === 2000 && dirty.memos[0].frame === "planejamento");
ok("cvm inválido → nao; qualidade inválida → declarada", dirty.pro.cvm === "nao" && dirty.quality.liquid === "declarada");
ok("valor com vírgula em linha", dirty.diag.bsAssets[0].value === 1000.5);
const old = E.normalizeState({ profile: { currentAge: 50 }, extraMonthly: [{ ageFrom: 50, ageTo: 60, value: -1 }] });
ok("estado antigo migra com diagnóstico vazio (não inventa dados) e blocos novos padrão", old.diag.bsAssets.length === 0 && old.stress.cons.dRet === -1.5 && old.meta.version === 5);
ok("estado novo (null) traz o exemplo completo", E.normalizeState(null).diag.bsAssets.length === 9 && E.normalizeState(null).diag.flow.length === 10);

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);
