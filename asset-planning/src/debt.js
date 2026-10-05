/* DEBT:BEGIN — dívidas e caixa: estratégias de quitação, amortizar × investir e ordem de uso do superávit. Puro, sem DOM. */
const Debt = (function () {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const mRate = (cetPct) => Math.pow(1 + num(cetPct) / 100, 1 / 12) - 1;
  const EPS = 0.005;

  const STRATEGY_INFO = {
    none: { label: "Só as prestações atuais", desc: "Cada dívida segue o próprio contrato; nada é redirecionado." },
    avalanche: { label: "Avalanche (maior custo primeiro)", desc: "Todo recurso extra vai para a dívida com maior CET. Minimiza o juro total." },
    bola: { label: "Bola de neve (menor saldo primeiro)", desc: "Quita a menor dívida primeiro para liberar parcelas e manter o ritmo. Paga um pouco mais de juro, ajuda na disciplina." },
    fluxo: { label: "Fluxo de caixa (maior alívio mensal)", desc: "Prioriza a dívida cuja quitação libera mais prestação por real amortizado. Útil quando o orçamento está apertado." }
  };

  function pick(active, strategy) {
    const a = active.slice();
    if (strategy === "avalanche") a.sort((x, y) => (y.i - x.i) || (x.bal - y.bal));
    else if (strategy === "bola") a.sort((x, y) => (x.bal - y.bal) || (y.i - x.i));
    else a.sort((x, y) => (y.pay / Math.max(y.bal, EPS) - x.pay / Math.max(x.bal, EPS)) || (x.bal - y.bal));
    return a;
  }

  /* Simulação mensal. Juros do mês → prestação contratual → sobra extra (recurso novo + prestações já liberadas), aplicada pela estratégia. */
  function simulate(debts, opts) {
    opts = opts || {};
    const strat = opts.strategy || "none", extra = strat === "none" ? 0 : Math.max(0, num(opts.extra)), max = opts.maxMonths || 600;
    const D = debts.filter((d) => num(d.balance) > EPS).map((d, k) => ({ k: k, label: d.label || "Dívida", bal: num(d.balance), i: mRate(d.cet), pay: Math.max(0, num(d.payment)), cet: num(d.cet), paidAt: null, interest: 0, grows: false }));
    let t = 0, totalInterest = 0, totalPaid = 0;
    const series = [D.reduce((s, d) => s + d.bal, 0)];
    while (t < max && D.some((d) => d.paidAt === null)) {
      t++;
      D.forEach(function (d) {
        if (d.paidAt !== null) return;
        const int = d.bal * d.i; d.bal += int; d.interest += int; totalInterest += int;
        if (d.pay <= int + 1e-9) d.grows = true;
        const p = Math.min(d.pay, d.bal); d.bal -= p; totalPaid += p;
        if (d.bal <= EPS) { d.bal = 0; d.paidAt = t; }
      });
      if (strat !== "none") {
        let pool = extra;
        D.forEach((d) => { if (d.paidAt !== null && d.paidAt < t) pool += d.pay; });
        pick(D.filter((d) => d.paidAt === null), strat).forEach(function (d) {
          if (pool <= EPS) return;
          const p = Math.min(pool, d.bal); d.bal -= p; pool -= p; totalPaid += p;
          if (d.bal <= EPS) { d.bal = 0; d.paidAt = t; }
        });
      }
      series.push(D.reduce((s, d) => s + d.bal, 0));
    }
    const never = D.some((d) => d.paidAt === null);
    return {
      months: never ? Infinity : t, never: never, totalInterest: totalInterest, totalPaid: totalPaid, series: series,
      debts: D.map((d) => ({ label: d.label, cet: d.cet, payoffMonth: d.paidAt, interest: d.interest, grows: d.grows && d.paidAt === null }))
    };
  }

  function compare(debts, extra) {
    const out = {};
    ["none", "avalanche", "bola", "fluxo"].forEach((k) => { out[k] = simulate(debts, { strategy: k, extra: extra }); });
    const base = out.none;
    Object.keys(out).forEach(function (k) {
      const r = out[k];
      r.interestSaved = isFinite(base.totalInterest) && !base.never && !r.never ? base.totalInterest - r.totalInterest : null;
      r.monthsSaved = isFinite(base.months) && isFinite(r.months) ? base.months - r.months : null;
    });
    return out;
  }

  // Confere se saldo, CET, prestação e prazo informados são coerentes entre si.
  function consistency(debts) {
    return debts.filter((d) => num(d.balance) > EPS).map(function (d) {
      const solo = simulate([d], { strategy: "none" });
      const informed = Math.round(num(d.months));
      let flag = null;
      if (num(d.payment) <= 0) flag = "sem_prestacao";
      else if (solo.never) flag = "nao_amortiza";
      else if (informed > 0 && Math.abs(solo.months - informed) > Math.max(2, informed * 0.15)) flag = "prazo_diverge";
      return { label: d.label || "Dívida", impliedMonths: solo.months, informedMonths: informed, flag: flag };
    });
  }

  /* Amortizar × investir um valor único: patrimônio ao fim do prazo original, nominal.
     A: amortiza (a prestação segue igual e o contrato encurta); a prestação liberada é investida.
     B: investe o valor e segue pagando o contrato. altNetPct = retorno líquido de IR da alternativa (% a.a. nominal). */
  function single(debt, lump) {
    const i = mRate(debt.cet), pay = Math.max(0, num(debt.payment));
    let bal = Math.max(0, num(debt.balance) - Math.max(0, lump)), t = 0, interest = 0;
    const cash = [0];
    if (bal <= EPS) return { months: 0, interest: 0, cash: cash, never: false };
    if (pay <= bal * i + 1e-9) return { months: Infinity, interest: Infinity, cash: cash, never: true };
    while (t < 600 && bal > EPS) {
      t++;
      const int = bal * i; bal += int; interest += int;
      const p = Math.min(pay, bal); bal -= p; cash.push(p);
    }
    return { months: bal > EPS ? Infinity : t, interest: interest, cash: cash, never: bal > EPS };
  }
  function amortizeOrInvest(debt, lump, altNetPct) {
    const L = Math.min(Math.max(0, num(lump)), num(debt.balance));
    const B = single(debt, 0), A = single(debt, L);
    if (B.never || !isFinite(B.months) || L <= 0) return { ok: false, reason: B.never ? "A prestação não amortiza a dívida." : "Informe um valor a amortizar." };
    const n = B.months;
    const wealth = function (altPct) {
      const rm = Math.pow(1 + altPct / 100, 1 / 12) - 1;
      let wA = 0;
      for (let t = 1; t <= n; t++) wA += ((B.cash[t] || 0) - (A.cash[t] || 0)) * Math.pow(1 + rm, n - t);
      return { wA: wA, wB: L * Math.pow(1 + rm, n) };
    };
    const w = wealth(num(altNetPct));
    let lo = 0, hi = 200;
    const d0 = wealth(0); let be;
    if (d0.wA - d0.wB < 0) be = 0;
    else { for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, x = wealth(mid); if (x.wA - x.wB > 0) lo = mid; else hi = mid; } be = (lo + hi) / 2; }
    return {
      ok: true, lump: L, months: n, monthsAfter: A.months, interestSaved: B.interest - A.interest,
      wealthAmortize: w.wA, wealthInvest: w.wB, diff: w.wA - w.wB, breakEvenPct: be,
      verdict: w.wA - w.wB > 1 ? "amortizar" : w.wA - w.wB < -1 ? "investir" : "indiferente"
    };
  }

  /* Ordem de uso do superávit: reserva → dívidas mais caras que o retorno líquido → demais objetivos.
     Prazos estimados com o superávit informado, sem juros sobre os saldos (ordem de grandeza, não projeção). */
  function cascade(p) {
    const surplus = Math.max(0, num(p.surplus));
    const debts = (p.debts || []).filter((d) => num(d.balance) > EPS && num(d.cet) > num(p.altNetPct));
    const debtAmt = debts.reduce((t, d) => t + num(d.balance), 0);
    const steps = [];
    let cursor = 0;
    const add = function (key, label, amount, note) {
      const months = amount <= 0 ? 0 : surplus > 0 ? amount / surplus : null;
      steps.push({ key: key, label: label, amount: amount, months: months, start: months === null ? null : cursor, end: months === null ? null : cursor + months, note: note, done: amount <= 0 });
      if (months !== null) cursor += months;
    };
    add("reserva", "Completar a reserva de contingência", Math.max(0, num(p.reserveGap)), "Antes de acelerar dívidas: reserva protege contra novas dívidas caras.");
    add("dividas", "Quitar dívidas com CET acima do retorno líquido", debtAmt, debts.length ? debts.map((d) => d.label || "Dívida").join(", ") : "Nenhuma dívida acima do retorno líquido esperado.");
    return { surplus: surplus, steps: steps, freeAfter: surplus > 0 ? cursor : null, nextUses: "Depois dessas etapas, o superávit liberado financia as metas e a aposentadoria." };
  }

  return { simulate, compare, consistency, amortizeOrInvest, cascade, mRate, STRATEGY_INFO };
})();
if (typeof module !== "undefined") module.exports = Debt;
/* DEBT:END */
