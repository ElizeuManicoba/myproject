const E = require("../src/engine.js"), P = require("../src/planning.js"), G = require("../src/goals.js"), R = require("../src/protection.js"), S = require("../src/succession.js"), V = require("../src/versions.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = (o) => JSON.parse(JSON.stringify(o));
const s = E.defaultState(), bs = P.balanco(s);
const a = S.analyze(s, { bs });

// ---- exemplo conferido à mão: ativos 2,1 mi − previdência 100 mil − dívidas 40 mil = monte 1,96 mi
ok("monte-mor = ativos − previdência (fora do inventário) − dívidas", near(a.monte, 2100000 - 100000 - 40000, 1e-6) && a.pension === 100000 && a.pensionAuto === 100000);
ok("comunhão parcial com 100% comum: meação = 50% do monte; base do ITCMD = 980 mil", a.community && near(a.meacao, 980000, 1e-6) && near(a.base, 980000, 1e-6));
ok("ITCMD 4% sobre a base = 39.200; honorários 4% e custas 1,5% sobre o monte-mor", near(a.itcmd, 39200, 1e-6) && near(a.fees, 78400, 1e-6) && near(a.costs, 29400, 1e-6));
ok("custo de manter os bens = 1.500 × 6 = 9.000; total = 156.000 (≈ 8% do monte)", near(a.carry, 9000, 1e-6) && near(a.total, 156000, 1e-6) && near(a.totalPct, 156000 / 1960000 * 100, 1e-9));
ok("partes somam o total", near(a.parts.reduce((t, x) => t + x.value, 0), a.total, 1e-6));
ok("liquidez fora do inventário = previdência 100 mil + seguro 0; lacuna = 56.000", a.liquidOutside === 100000 && near(a.gap, 56000, 1e-6));
ok("liquidez dentro do inventário (imediata + curta, sem previdência) = 200 mil; liberada por alvará fecha a lacuna", a.liquidInside === 200000 && a.gapAfterRelease === 0);
ok("parcela ilíquida do patrimônio no inventário = 1 mi / 2 mi = 50%", near(a.illiquidShare, 50, 1e-9));
ok("legítima = 50% do monte (parte indisponível)", near(a.legitima, 980000, 1e-6));

// ---- regimes, cônjuge e premissas
const withRegime = (r, extra) => S.analyze(Object.assign(clone(s), { succ: Object.assign({}, s.succ, { regime: r }, extra || {}) }), { bs });
ok("comunhão universal: sempre 50% (ignora o % de bens comuns)", near(withRegime("comunhao_universal", { commonPct: 20 }).meacao, 980000, 1e-6));
ok("comunhão parcial com 40% de bens comuns: meação = 20% do monte", near(withRegime("comunhao_parcial", { commonPct: 40 }).meacao, 1960000 * 0.5 * 0.4, 1e-6));
ok("separação de bens e participação final: sem meação, ITCMD sobe", withRegime("separacao").meacao === 0 && withRegime("separacao").itcmd > a.itcmd && withRegime("participacao").meacao === 0);
ok("sem cônjuge: sem meação", (() => { const q = clone(s); q.succ.spouse = false; return S.analyze(q, { bs }).meacao === 0; })());
ok("seguro de vida existente entra como liquidez fora do inventário e reduz a lacuna", (() => { const q = clone(s); q.protect.existingLife = 56000; const r = S.analyze(q, { bs }); return r.liquidOutside === 156000 && r.gap === 0 && r.life === 56000; })());
ok("previdência: ajuste manual substitui a detecção por nome", (() => { const q = clone(s); q.succ.pensionOverride = 0; const r = S.analyze(q, { bs }); return r.pension === 0 && r.pensionIsOverride && near(r.monte, 2060000, 1e-6) && r.gap === r.total; })());
ok("previdência detectada por nome: PGBL, VGBL e 'previdência'", (() => { const q = clone(s); q.diag.bsAssets.push({ id: 99, label: "Previdência VGBL", value: 50000, liq: "longa", purpose: "aposentadoria", quality: "declarada" }); return S.analyze(q, { bs: P.balanco(q) }).pensionAuto === 150000; })());
ok("sem patrimônio líquido → tudo zero e cobertura indefinida", (() => { const q = clone(s); q.diag.bsAssets = []; q.diag.bsLiabilities = []; const r = S.analyze(q, { bs: P.balanco(q) }); return r.monte === 0 && r.itcmd === 0 && r.fees === 0 && r.total === 9000 && r.gap === 9000; })());
ok("dívidas maiores que o ativo não geram base negativa", (() => { const q = clone(s); q.diag.bsLiabilities[0].balance = 5e6; const r = S.analyze(q, { bs: P.balanco(q) }); return r.monte === 0 && r.base === 0 && r.itcmd === 0; })());
ok("sobrescrever alíquota no cálculo (parâmetro) não altera o estado", (() => { const q = clone(s); const r = S.analyze(q, { bs }, { itcmd: 8 }); return near(r.itcmd, 78400, 1e-6) && q.succ.itcmd === 4; })());

// ---- sensibilidade ao ITCMD
const sens = S.sensitivity(s, { bs });
ok("sensibilidade: 2%, 4%, 6%, 8% → total e lacuna crescem 19.600 por 2 p.p.", sens.length === 4 && sens.every((r, i) => i === 0 || near(r.total - sens[i - 1].total, 19600, 1e-6)) && near(sens[1].total, a.total, 1e-6));

// ---- sugestão e versões
const an = E.analyze(s, 0), fl = P.fluxo(s, bs), rs = P.reserva(s, fl, bs), ind = P.indicadores(s, bs, fl, rs, an);
const sug = P.suggestions(s, { an, bs, fl, rs, ind, stress: {}, quality: P.quality(s), succession: a });
const sg = sug.find((x) => x.key === "liquidez_sucessao");
ok("sugere prever o caixa do inventário (lacuna 56 mil) e remete a advogado", sg && sg.evidence.includes("156.000") && sg.next.includes("advogado"), sg && sg.priority);
ok("sem lacuna → sem sugestão", !P.suggestions(s, { an, bs, fl, rs, ind, stress: {}, quality: P.quality(s), succession: Object.assign({}, a, { gap: 0 }) }).some((x) => x.key === "liquidez_sucessao"));
ok("sugestão de sucessão não cita produto", (() => { const w = new Set(JSON.stringify(sg).toLowerCase().split(/[^a-zà-ú0-9]+/)); return !["cdb", "lci", "lca", "fii", "tesouro", "pgbl", "vgbl", "fundo", "fundos", "ações", "debêntures", "holding", "apólice"].some((x) => w.has(x)); })());
const k = V.kpis(s, new Date("2026-10-05")).find((x) => x.key === "succGap");
ok("versões: KPI da lacuna de sucessão", k && near(k.value, 56000, 1e-6) && k.better === "down");
const s2 = clone(s); s2.protect.existingLife = 60000;
const cmp = V.compare(s, s2, new Date("2026-10-05")).find((x) => x.key === "succGap");
ok("versões: seguro maior zera a lacuna e é 'melhor'", cmp.verdict === "better" && cmp.b === 0);
ok("versões: mudança de premissas de sucessão e Monte Carlo aparece nas diferenças", (() => { const q = clone(s); q.succ.itcmd = 6; q.mc.vol = 15; const c = V.changes(s, q); return c.some((x) => x.label === "Sucessão: ITCMD") && c.some((x) => x.label === "Volatilidade (Monte Carlo)"); })());

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);
