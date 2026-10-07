// Núcleo: leitura de números, juros reais, motor determinístico e tabelas do IRPF (valores conferidos à mão).
const E = require("../src/engine.js"), I = require("../src/irpf.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- leitura de números (pt-BR, en-US, ambíguos)
const p = E.parseLocaleNumber;
ok("1.234,56 → 1234,56", p("1.234,56") === 1234.56);
ok("1,234.56 → 1234,56", p("1,234.56") === 1234.56);
ok("1.234 (milhar) → 1234; 0.5 → 0,5", p("1.234") === 1234 && p("0.5") === 0.5);
ok("percentual: '5.5' e '5,5' → 5,5; '1.234' como percentual fica 1,234", p("5.5", true) === 5.5 && p("5,5", true) === 5.5 && p("1.234", true) === 1.234);
ok("negativos e lixo", p("-1.000,50") === -1000.5 && p("abc") === 0 && p("") === 0 && p(null) === 0 && p(42) === 42 && p(Infinity) === 0);
ok("'R$ 2.500,00' → 2500", p("R$ 2.500,00") === 2500);

// ---- juros reais (Fisher) e taxas
ok("Fisher: (1,11/1,055) − 1", near(E.realRate(0.11, 0.055), 1.11 / 1.055 - 1, 1e-15));
const s = E.defaultState(), rt = E.ratesOf(s);
ok("taxa real do exemplo ≈ 5,2132% a.a.", near(rt.rrAcc, 0.0521327, 1e-6), (rt.rrAcc * 100).toFixed(4));
ok("taxas diferenciadas só valem com o interruptor", (() => { const q = clone(s); q.rates.nominalPost = 8; return near(E.ratesOf(q).rrPost, rt.rrAcc, 1e-15); })() && (() => { const q = clone(s); q.rates.differentiate = true; q.rates.nominalPost = 8; return E.ratesOf(q).rrPost < rt.rrAcc; })());

// ---- números publicados do exemplo (R$ de hoje)
const a0 = E.analyze(s, 0);
ok("exemplo: aporte adicional para consumir a reserva ≈ R$ 490,64", near(a0.consume.X, 490.64, 0.01), a0.consume.X.toFixed(2));
ok("exemplo: padrão de vida máximo ≈ R$ 28.959 (cobertura 96,5%)", near(a0.consume.maxSpend, 28959.15, 0.5) && near(a0.consume.coverage, 0.9653, 0.0002), a0.consume.coverage.toFixed(4));
ok("exemplo: aporte adicional para preservar ≈ R$ 3.364", near(a0.preserve.X, 3363.76, 0.5), a0.preserve.X.toFixed(2));
ok("exemplo: cobertura preservar ≈ 80%", near(a0.preserve.coverage, 0.8027, 0.002), a0.preserve.coverage.toFixed(4));

// ---- verificação independente (forma fechada, sem fluxos)
const z = clone(s); z.cashflow.executed = 0; z.cashflow.desiredWithdrawal = 0; z.assets.liquid = 1000000;
const az = E.analyze(z, 0);
ok("sem fluxos: saldo final = 1 mi × (1+r real)^55 (capitalização mensal equivalente)", near(az.termNow, 1e6 * Math.pow(1 + rt.rrAcc, 55), 1e-3), az.termNow.toFixed(2));
ok("sem fluxos: saldo na aposentadoria = 1 mi × (1+r)^20", near(az.reserveNow, 1e6 * Math.pow(1 + rt.rrAcc, 20), 1e-3));
ok("desejado = 0 → cobertura indefinida", az.consume.coverage === null);
// aporte mensal constante: valor futuro de anuidade (postecipada)
const w = clone(z); w.assets.liquid = 0; w.cashflow.executed = 1000;
const iM = Math.pow(1 + rt.rrAcc, 1 / 12) - 1, n1 = 240;
ok("anuidade: R$ 1.000/mês por 20 anos, reajustados pela inflação = VF da anuidade real", near(E.analyze(w, 0).reserveNow, 1000 * (Math.pow(1 + iM, n1) - 1) / iM, 1e-3), E.analyze(w, 0).reserveNow.toFixed(2));

// ---- linearidade: terminal(X) afim em X, e financiar X leva o saldo final ao legado
ok("financiando o aporte, o saldo final = legado mínimo (0)", near(a0.consume.term, 0, 1e-4));
ok("legado mínimo respeitado: com legado de 500 mil o aporte necessário sobe e o final = 500 mil", (() => { const q = clone(s); q.cashflow.minLegacy = 500000; const a = E.analyze(q, 0); return a.consume.X > a0.consume.X && near(a.consume.term, 500000, 1e-2); })());
ok("afinidade: Δ do saldo final é proporcional ao aporte", (() => { const t = (x) => { const q = clone(s); q.cashflow.executed += x; return E.analyze(q, 0).termNow; }; const d1 = t(100) - t(0), d2 = t(200) - t(0); return near(d2, 2 * d1, Math.abs(d1) * 1e-9); })());
ok("consumir exige menos aporte que preservar; cobertura de preservar ≤ consumir", a0.consume.X < a0.preserve.X && a0.preserve.coverage <= a0.consume.coverage);

// ---- eventos, rendas e reajuste
ok("INSS de R$ 5.000 a partir dos 65 zera o aporte adicional", (() => { const q = clone(s); q.retIncome = [{ id: 1, ageFrom: 65, value: 5000, label: "" }]; return E.analyze(q, 0).consume.X === 0; })());
ok("venda de imóvel de R$ 1 mi aos 70 também zera", (() => { const q = clone(s); q.extraAnnual = [{ id: 1, age: 70, ageTo: null, value: 1000000, label: "" }]; return E.analyze(q, 0).consume.X === 0; })());
ok("custo extraordinário na aposentadoria aumenta o aporte necessário", (() => { const q = clone(s); q.extraAnnual = [{ id: 1, age: 70, ageTo: null, value: -100000, label: "" }]; return E.analyze(q, 0).consume.X > a0.consume.X; })());
ok("sem reajuste, aportes E gasto ficam fixos em R$ nominais: o gasto perde mais valor (cobertura sobe) e o sistema avisa", (() => { const q = clone(s); q.cashflow.escalate = false; return E.analyze(q, 0).consume.coverage > a0.consume.coverage && E.validate(q).warnings.join(" ").includes("nominais"); })());
ok("evento mensal extra: retirada de R$ 1.000/mês entre 66 e 70 reduz a cobertura", (() => { const q = clone(s); q.extraMonthly = [{ id: 1, ageFrom: 66, ageTo: 70, value: -1000, label: "" }]; return E.analyze(q, 0).consume.coverage < a0.consume.coverage; })());
ok("linha mensal com idade final ≤ inicial é ignorada (e gera aviso)", (() => { const q = clone(s); q.extraMonthly = [{ id: 1, ageFrom: 70, ageTo: 70, value: -1000, label: "" }]; return near(E.analyze(q, 0).consume.X, a0.consume.X, 1e-9) && E.validate(q).warnings.join(" ").includes("idade final"); })());

// ---- sensibilidade: ordem monotônica e linha base = análise base
const sens = E.sensitivity(s), X = sens.map((r) => r.an.consume.X);
ok("sensibilidade: favorável < base < conservador < defensivo < estresse", X[0] < X[1] && X[1] < X[2] && X[2] < X[3] && X[3] < X[4], X.map((v) => Math.round(v)).join(" < "));
ok("sensibilidade: base idêntica à análise", near(X[1], a0.consume.X, 1e-9) && sens.map((r) => r.pp).join() === "1,0,-1,-2,-3");

// ---- trajetórias e extrato nominal
const pa = E.paths(s, a0);
ok("trajetórias anuais: 56 pontos (45 → 100)", pa.current.length === 56 && pa.current[0].age === 45 && pa.current[55].age === 100);
ok("plano 'consumir' termina em ≈ 0 e 'preservar' termina em ≈ reserva da aposentadoria", near(pa.consume[55].bal, 0, 0.01) && near(pa.preserve[55].bal, a0.preserve.reserve, 0.5), pa.preserve[55].bal.toFixed(0));
const led = E.ledger(s, a0, a0.consume.X, 2025);
ok("extrato: 55 anos; nominal/real do 1º ano = inflação anual (5,5%)", led.length === 55 && near(led[0].endNom / led[0].endReal, 1.055, 1e-9), (led[0].endNom / led[0].endReal).toFixed(6));
ok("extrato marca o ano de aposentadoria", led.filter((r) => r.isRetireYear).length === 1 && led.find((r) => r.isRetireYear).age === 65);
ok("idade de esgotamento: sem aportes extras a reserva esgota aos 97", E.exhaustAge(pa.current) === 97);

// ---- validação
ok("aposentar antes da idade atual → erro", E.validate((() => { const q = clone(s); q.profile.retireAge = 40; return q; })()).errors.length === 1);
ok("horizonte antes da aposentadoria → erro; > 120 → erro", E.validate((() => { const q = clone(s); q.profile.horizonAge = 60; return q; })()).errors.length >= 1 && E.validate((() => { const q = clone(s); q.profile.horizonAge = 130; return q; })()).errors.length >= 1);
ok("juros absurdos → erro; patrimônio negativo → erro", E.validate((() => { const q = clone(s); q.rates.nominal = 500; return q; })()).errors.length >= 1 && E.validate((() => { const q = clone(s); q.assets.liquid = -1; return q; })()).errors.length >= 1);
ok("retorno real ≤ 0 → aviso", E.validate((() => { const q = clone(s); q.rates.nominal = 4; return q; })()).warnings.join(" ").includes("Retorno real"));
ok("aporte acima da capacidade → aviso", E.validate((() => { const q = clone(s); q.cashflow.executed = 99999; return q; })()).warnings.join(" ").includes("capacidade"));
ok("retorno real ≤ 0 após aposentar: preservar é inviável (X infinito)", (() => { const q = clone(s); q.rates.differentiate = true; q.rates.nominalPost = 5; q.rates.inflationPost = 5.5; return !isFinite(E.analyze(q, 0).preserve.X); })());

// ---- normalização/importação
ok("normalizeState(null) = exemplo", E.normalizeState(null).meta.version === 6 && E.normalizeState(null).profile.currentAge === 45);
ok("campos numéricos em texto pt-BR são lidos na importação", E.normalizeState({ assets: { liquid: "1.500.000,50" } }).assets.liquid === 1500000.5);
ok("campos desconhecidos são descartados (sem poluição de protótipo)", (() => { const n = E.normalizeState(JSON.parse('{"__proto__":{"x":1},"constructor":{"y":2},"foo":1}')); return n.foo === undefined && ({}).x === undefined && ({}).y === undefined; })());
ok("estado antigo sem 'executed' deriva do fluxo (receita − despesa)", E.normalizeState({ cashflow: { income: 20000, expense: 15000 } }).cashflow.executed === 5000);

// ================= IRPF =================
const T = I.TAX["2026"];
ok("tabela mensal 2026: isento até 2.428,80; 3.000 → 55,84; 5.000 → 466,27", I.tableTax(2428.8, T.monthly.brackets) === 0 && near(I.tableTax(3000, T.monthly.brackets), 3000 * 0.15 - 394.16, 1e-9) && near(I.tableTax(5000, T.monthly.brackets), 466.27, 1e-9));
const m5 = I.monthly({ rend: 5000, inss: 0, dep: 0, pensao: 0, outras: 0 }, "2026");
ok("mensal: R$ 5.000 → desconto simplificado 607,20, redutor zera o imposto", m5.mode === "simplificado" && m5.used === 607.2 && near(m5.base, 4392.8, 1e-9) && m5.tax === 0 && m5.red > 0);
const m59 = I.monthly({ rend: 5900, inss: 0, dep: 0, pensao: 0, outras: 0 }, "2026");
ok("mensal: R$ 5.900 → imposto bruto 546,79, redução 193,06, devido 353,73", near(m59.gross, 5292.8 * 0.275 - 908.73, 1e-9) && near(m59.red, 978.62 - 0.133145 * 5900, 1e-9) && near(m59.red, 193.0645, 1e-3) && near(m59.tax, 353.73, 0.01), m59.tax.toFixed(2));
ok("mensal: acima de R$ 7.350 não há redução", I.monthly({ rend: 8000, inss: 800, dep: 0, pensao: 0, outras: 0 }, "2026").red === 0);
ok("mensal: deduções legais maiores que o simplificado são usadas (INSS 900 + 2 dependentes)", (() => { const r = I.monthly({ rend: 9000, inss: 900, dep: 2, pensao: 0, outras: 0 }, "2026"); return r.mode === "legal" && near(r.used, 900 + 2 * 189.59, 1e-9); })());
const m25 = I.monthly({ rend: 3000, inss: 0, dep: 0, pensao: 0, outras: 0 }, "2025");
ok("tabela 2025 preservada (sem redutor; simplificado 564,80)", m25.used === 564.8 && I.TAX["2025"].monthly.reducer === null && near(m25.tax, (3000 - 564.8) * 0.075 - 169.44, 1e-9));
const an300 = I.annual({ rend: 300000, irrf: 68000, inss: 11000, dep: 0, instr: 0, med: 10000, outras: 0, aporte: null }, "2026");
ok("anual: simplificado limitado a 17.640; base 282.360; imposto 66.744,34", near(an300.S.ded, 17640, 1e-9) && near(an300.S.base, 282360, 1e-9) && near(an300.S.tax, 282360 * 0.275 - 10904.66, 1e-6), an300.S.tax.toFixed(2));
ok("anual: teto do PGBL = 12% (36.000); aporte padrão = teto; economia ≥ 0 e IR menor", an300.pgblLimit === 36000 && an300.aporte === 36000 && an300.saving >= 0 && an300.P.tax <= an300.C.tax);
ok("anual: aporte acima do teto é limitado e sinalizado; instrução limitada a 3.561,50", (() => { const r = I.annual({ rend: 100000, irrf: 0, inss: 0, dep: 0, instr: 9000, med: 0, outras: 0, aporte: 50000 }, "2026"); return r.aporte === 12000 && r.flags.aporteClamped && r.flags.instrCapped && near(r.flags.instrCap, 3561.5, 1e-9); })());
ok("anual: redutor de até R$ 60 mil zera o imposto (rend 50.000 → imposto 0)", I.annual({ rend: 50000, irrf: 0, inss: 0, dep: 0, instr: 0, med: 0, outras: 0, aporte: 0 }, "2026").S.tax === 0);
ok("anual: acima de R$ 600 mil sinaliza o imposto mínimo", I.annual({ rend: 700000, irrf: 0, inss: 0, dep: 0, instr: 0, med: 0, outras: 0, aporte: 0 }, "2026").flags.minTax === true);
const pr = I.project({ renda: 300000, pct: 12, cdi: 10.5, taxa: 0.5, anos: 25, aliq: 27.5 });
ok("PGBL longo prazo: aporte 36.000, economia 9.900, desembolso 26.100", pr.aporte === 36000 && near(pr.econ, 9900, 1e-9) && near(pr.outOfPocket, 26100, 1e-9));
ok("PGBL: vantagem líquida cresce com o prazo e há ponto de equilíbrio dentro de 25 anos", pr.rows[24].adv > pr.rows[9].adv && pr.breakEven !== null && pr.breakEven <= 25, "equilíbrio no ano " + pr.breakEven);
ok("PGBL curto: em 3 anos o investimento comum ainda vence (35% a 30% de IR no resgate)", I.project({ renda: 300000, pct: 12, cdi: 10.5, taxa: 0.5, anos: 3, aliq: 27.5 }).last.adv < 0);

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);
