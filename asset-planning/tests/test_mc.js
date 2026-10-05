const E = require("../src/engine.js"), I = require("../src/irpf.js");
let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("FAIL", n, x === undefined ? "" : x); } else console.log("ok  ", n, x === undefined ? "" : x); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = (o) => JSON.parse(JSON.stringify(o));
E.setTaxProvider((m) => I.withdrawalTax(m.taxRows, m.irpf.vig, m.retTax.manual).tau);
const s = E.defaultState(), a0 = E.analyze(s, 0);
const ret = 20; // índice anual da aposentadoria (65 − 45)

// ---- inversa da normal
ok("invNorm: 0,5 → 0; 0,975 → 1,95996; 0,8413447 → 1; simetria", near(E.invNorm(0.5), 0, 1e-9) && near(E.invNorm(0.975), 1.959964, 1e-5) && near(E.invNorm(0.8413447), 1, 1e-5) && near(E.invNorm(0.1), -E.invNorm(0.9), 1e-9));

// ---- repetibilidade e semente
const A = E.monteCarlo(s, { sims: 500, vol: 10, seed: 7 }), B = E.monteCarlo(s, { sims: 500, vol: 10, seed: 7 }), C = E.monteCarlo(s, { sims: 500, vol: 10, seed: 8 });
ok("mesma semente → resultado idêntico", JSON.stringify(A.bands) === JSON.stringify(B.bands) && A.terminal.p50 === B.terminal.p50);
ok("semente diferente → amostra diferente", JSON.stringify(A.bands.p50) !== JSON.stringify(C.bands.p50));
ok("estrutura: 56 idades de 45 a 100, 5 faixas de 56 pontos", A.ages.length === 56 && A.ages[0] === 45 && A.ages[55] === 100 && Object.keys(A.bands).every((k) => A.bands[k].length === 56));

// ---- volatilidade zero = caminho determinístico
const Z = E.monteCarlo(s, { sims: 200, vol: 0, seed: 1 });
ok("vol = 0: todas as faixas e a média coincidem com o caminho determinístico", Z.det.every((v, i) => ["p10", "p25", "p50", "p75", "p90"].every((k) => near(Z.bands[k][i], v, 1e-6)) && near(Z.mean[i], v, 1e-6)));
ok("vol = 0: esgota aos 97 como o motor determinístico", Z.exhaust.det === 97 && Z.exhaust.p50 === 97 && E.exhaustAge(E.paths(s, a0).current) === 97);
ok("financiando o aporte (consumir) com vol = 0, o saldo final é ≈ 0", near(E.monteCarlo(s, { sims: 100, vol: 0, X: a0.consume.X }).terminal.p50, 0, 1e-2));

// ---- propriedades estatísticas
const M = E.monteCarlo(s, { sims: 10000, vol: 10, seed: 3 });
ok("média aritmética dos saldos na aposentadoria ≈ determinístico (retorno esperado preservado)", Math.abs(M.mean[ret] / M.det[ret] - 1) < 0.03, (M.mean[ret] / M.det[ret]).toFixed(4));
ok("mediana abaixo do determinístico (efeito da volatilidade sobre o retorno composto)", M.bands.p50[ret] < M.det[ret] && M.bands.p50[ret] / M.det[ret] > 0.82, (M.bands.p50[ret] / M.det[ret]).toFixed(3));
ok("percentis monotônicos em todas as idades", M.ages.every((_, i) => M.bands.p10[i] <= M.bands.p25[i] && M.bands.p25[i] <= M.bands.p50[i] && M.bands.p50[i] <= M.bands.p75[i] && M.bands.p75[i] <= M.bands.p90[i]));
ok("faixas abrem com o tempo (largura P90−P10 cresce até a aposentadoria)", (M.bands.p90[ret] - M.bands.p10[ret]) > (M.bands.p90[5] - M.bands.p10[5]) && (M.bands.p90[5] - M.bands.p10[5]) > 0);
const Lo = E.monteCarlo(s, { sims: 3000, vol: 5, seed: 3 }), Hi = E.monteCarlo(s, { sims: 3000, vol: 20, seed: 3 });
ok("mais volatilidade → faixa mais larga e cenário desfavorável pior", (Hi.bands.p90[ret] - Hi.bands.p10[ret]) > (Lo.bands.p90[ret] - Lo.bands.p10[ret]) && Hi.terminal.p10 < Lo.terminal.p10);
ok("a semente não muda a conclusão: P50 na aposentadoria difere < 3% entre sementes (10.000 cenários)", (() => { const M2 = E.monteCarlo(s, { sims: 10000, vol: 10, seed: 99 }); return Math.abs(M2.bands.p50[ret] / M.bands.p50[ret] - 1) < 0.03; })());
const T = E.monteCarlo(s, { sims: 10000, vol: 10, seed: 3, dist: "tstudent" });
ok("t de Student: finito, média ≈ determinístico, mas amostra diferente da normal", Number.isFinite(T.terminal.p10) && Math.abs(T.mean[ret] / T.det[ret] - 1) < 0.04 && T.bands.p50[ret] !== M.bands.p50[ret] && T.dist === "tstudent");
ok("limites de simulações: 5 → 100 (mínimo do motor); 1e6 → 10.000", E.monteCarlo(s, { sims: 5, vol: 5 }).sims === 100 && E.monteCarlo(s, { sims: 1e6, vol: 5 }).sims === 10000);

// ---- integração com fases, IR e choque
const sp = clone(s); sp.phases.on = true; sp.phaseRows = [{ id: 1, ageFrom: 75, pct: 80, health: 0, label: "" }];
const Zp = E.monteCarlo(sp, { sims: 100, vol: 0 });
ok("com fases (vol 0) a faixa segue o determinístico das fases e supera o plano sem fases", near(Zp.bands.p50[55], E.paths(sp, E.analyze(sp, 0)).current[55].bal, 1e-3) && Zp.terminal.p50 > Z.terminal.p50);
const st = clone(s); st.retTax.on = true; st.retTax.manual = 10;
ok("com IR no resgate (vol 0) o saldo final é menor que sem IR", E.monteCarlo(st, { sims: 100, vol: 0 }).terminal.p50 < Z.terminal.p50);
ok("choque de 30% ao aposentar rebaixa a faixa central depois da aposentadoria", E.monteCarlo(s, { sims: 500, vol: 10, seed: 3, shock: 0.3 }).bands.p50[30] < E.monteCarlo(s, { sims: 500, vol: 10, seed: 3 }).bands.p50[30]);

// ---- ordem dos retornos
const q = E.sequenceDemo(s, { vol: 15 });
ok("ordem dos retornos: piores 5 anos no início termina abaixo de melhores 5 anos no início (mesmo conjunto de retornos)", q.bad.term < q.good.term, Math.round(q.bad.term) + " < " + Math.round(q.good.term));
ok("com os piores anos no início a reserva esgota antes (ou só ela esgota)", q.bad.exhaust !== null && (q.good.exhaust === null || q.bad.exhaust < q.good.exhaust), q.bad.exhaust + " vs " + q.good.exhaust);
ok("35 anos de aposentadoria, janela de 5 anos; pior ano muito negativo e melhor ano muito positivo", q.years === 35 && q.window === 5 && q.worst < -0.1 && q.best > 0.2, q.worst.toFixed(3) + " / " + q.best.toFixed(3));
ok("as duas ordens são permutações do mesmo conjunto (mesma média e mesmo desvio) e diferem só nos 5+5 anos extremos", (() => { const r = E.sequenceDemo(s, { vol: 15 }), a = r.orders.bad.slice().sort((x, y) => x - y), b = r.orders.good.slice().sort((x, y) => x - y); const mean = (v) => v.reduce((t, x) => t + x, 0) / v.length; const sd = (v) => Math.sqrt(v.reduce((t, x) => t + (x - mean(v)) ** 2, 0) / v.length); const diff = r.orders.bad.map((x, i) => (x === r.orders.good[i] ? 0 : 1)).reduce((t, x) => t + x, 0); return a.every((x, i) => x === b[i]) && near(mean(a), 0, 1e-9) && near(sd(a), 1, 1e-9) && diff === 10 && r.orders.bad.slice(0, 5).every((x) => x < -1.1) && r.orders.good.slice(0, 5).every((x) => x > 1.1); })());
const q0 = E.sequenceDemo(s, { vol: 0 });
ok("vol = 0: as duas ordens coincidem com o determinístico", near(q0.bad.term, q0.flat.term, 1e-6) && near(q0.good.term, q0.flat.term, 1e-6));

// ---- normalização do estado e desempenho
const n = E.normalizeState({ mc: { sims: 5, vol: 999, dist: "xx", seed: 0, scenario: "yy" }, succ: { regime: "zz", itcmd: 99, commonPct: 500, months: -3, heirs: 1e6, carry: -5 } });
ok("mc: valores fora do intervalo e enums inválidos são corrigidos", n.mc.sims === 200 && n.mc.vol === 60 && n.mc.dist === "normal" && n.mc.seed === 1 && n.mc.scenario === "atual");
ok("succ: regime inválido, alíquotas e prazos limitados", n.succ.regime === "comunhao_parcial" && n.succ.itcmd === 30 && n.succ.commonPct === 100 && n.succ.months === 0 && n.succ.heirs === 30 && n.succ.carry === 0);
const t0 = Date.now(); E.monteCarlo(s, { sims: 2000, vol: 10 }); const dt = Date.now() - t0;
ok("2.000 cenários em menos de 1,5 s", dt < 1500, dt + " ms");

console.log(fails === 0 ? "\nTODOS OS TESTES PASSARAM" : "\n" + fails + " FALHA(S)");
process.exit(fails ? 1 : 0);
