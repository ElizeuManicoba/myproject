/* GOALS:BEGIN — metas de vida: valor em R$ de hoje, data, aporte necessário e financiamento por prioridade. Puro, sem DOM. */
const Goals = (function (E) {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const PRIO_RANK = { essencial: 0, importante: 1, desejo: 2 };
  const monthlyRate = (rPct) => Math.pow(1 + rPct / 100, 1 / 12) - 1;
  const annuityFV = (n, i) => (i === 0 ? n : (Math.pow(1 + i, n) - 1) / i);
  // meses até 1º de janeiro do ano-alvo
  const monthsTo = (year, now) => (year - now.getFullYear()) * 12 - now.getMonth();

  /* Cada meta é calculada em termos reais (R$ de hoje): o aporte é reajustado pela inflação e o retorno é o real.
     fvSaved = valor já reservado projetado até a data; need = o que falta; pmt = aporte mensal real que fecha o valor.
     Os recursos livres (superávit − aporte da aposentadoria) são distribuídos por prioridade e, dentro dela, por data. */
  function analyze(s, fl, bs, now, an) {
    now = now || new Date();
    const cfg = s.goalsCfg || { realReturn: 3 };
    const inflM = Math.pow(1 + (s.rates.inflation || 0) / 100, 1 / 12);
    const rows = s.goals.map(function (g) {
      const amount = Math.max(0, num(g.amount)), saved = Math.max(0, num(g.saved));
      const rate = g.rate == null ? num(cfg.realReturn) : num(g.rate);
      const i = monthlyRate(rate), n = g.year > 0 ? monthsTo(g.year, now) : 0;
      const valid = amount > 0 && g.year > 0;
      const overdue = valid && n <= 0;
      const fvSaved = n > 0 ? saved * Math.pow(1 + i, n) : saved;
      const need = Math.max(0, amount - fvSaved);
      const pmt = !valid || need <= 0 ? 0 : overdue ? need : need / annuityFV(n, i);
      return {
        id: g.id, label: g.label || "Meta sem nome", kind: g.kind, priority: g.priority, amount: amount, year: g.year, months: n, valid: valid, overdue: overdue,
        saved: saved, rate: rate, i: i, fvSaved: fvSaved, need: need, pmt: pmt,
        future: valid && n > 0 ? amount * Math.pow(inflM, n) : amount,
        fundedPct: amount > 0 ? Math.min(1, fvSaved / amount) : 0, alloc: 0, reachPct: 0, status: valid ? "pendente" : "sem_dados"
      };
    });
    const ranked = rows.filter((r) => r.valid).sort((a, b) => (PRIO_RANK[a.priority] - PRIO_RANK[b.priority]) || (a.months - b.months) || (a.id - b.id));
    const executed = num(s.cashflow.executed);
    const surplus = fl ? num(fl.surplus) : 0;
    const available = Math.max(0, surplus - executed);
    let left = available, required = 0;
    ranked.forEach(function (r) {
      required += r.pmt;
      if (r.need <= 0) { r.status = "financiada"; r.reachPct = 1; return; }
      if (r.overdue) { r.status = "vencida"; r.reachPct = r.fundedPct; return; }
      const a = Math.min(r.pmt, left); r.alloc = a; left -= a;
      r.reachPct = Math.min(1, (r.fvSaved + a * annuityFV(r.months, r.i)) / r.amount);
      r.status = a >= r.pmt - 0.5 ? "no_caminho" : a > 0 ? "parcial" : "sem_recursos";
    });
    const pool = bs ? num(bs.byPurpose.objetivos) : 0;
    const totalSaved = rows.reduce((t, r) => t + r.saved, 0);
    const totals = {
      amount: ranked.reduce((t, r) => t + r.amount, 0), saved: totalSaved, required: required, available: available, executed: executed, surplus: surplus,
      gap: Math.max(0, required - available), slack: Math.max(0, available - required),
      pool: pool, savedMismatch: bs && totalSaved > pool + 1 ? totalSaved - pool : 0,
      retirementExtra: an && isFinite(an.consume.X) ? an.consume.X : null
    };
    return { rows: rows, ranked: ranked, totals: totals };
  }

  // Quanto a cobertura da aposentadoria cai se `amount` R$/mês do aporte atual for redirecionado às metas.
  function retirementImpact(s, amount) {
    const m = JSON.parse(JSON.stringify(s));
    const cut = Math.min(Math.max(0, amount), Math.max(0, m.cashflow.executed));
    m.cashflow.executed -= cut;
    const a = E.analyze(m, 0);
    return { cut: cut, coverage: a.consume.coverage, X: a.consume.X };
  }

  return { analyze, retirementImpact, monthsTo, monthlyRate, annuityFV, PRIO_RANK };
})(typeof Engine !== "undefined" ? Engine : require("./engine.js"));
if (typeof module !== "undefined") module.exports = Goals;
/* GOALS:END */
