/* PROTECTION:BEGIN — proteção por necessidade: capital necessário em morte e invalidez, sem escolha de produto. Puro, sem DOM. */
const Protection = (function () {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const pos = (x) => Math.max(0, num(x));
  // valor presente de uma renda mensal real por `years` anos, a uma taxa real anual
  function annuityPV(pmt, ratePct, years) {
    const n = Math.round(Math.max(0, years) * 12);
    if (n === 0 || pmt <= 0) return 0;
    const i = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
    return i === 0 ? pmt * n : pmt * (1 - Math.pow(1 + i, -n)) / i;
  }

  function status(coverage) {
    if (coverage == null) return "na";
    if (coverage >= 1) return "ok";
    if (coverage >= 0.6) return "warn";
    return "crit";
  }

  /* Método da necessidade (needs analysis): soma o que a família precisaria ter, desconta o que já existe.
     Valores em R$ de hoje; renda convertida a valor presente à taxa real informada.
     ctx = { fl, bs, goals (resultado de Goals.analyze, opcional) } */
  function analyze(s, ctx) {
    const p = s.protect, fl = ctx.fl, bs = ctx.bs;
    const debtTotal = bs && bs.totalLiab > 0 ? bs.totalLiab : num(s.assets.debts);
    const expense = fl ? fl.expenseTotal : num(s.cashflow.expense);
    const essential = fl ? fl.essentialMonthly : expense;
    const educ = ctx.goals ? ctx.goals.rows.filter((g) => g.kind === "educacao" && g.valid && !g.overdue).reduce((t, g) => t + g.amount, 0) : 0;
    const estate = bs ? Math.max(0, bs.net) : 0;
    // recursos que a família poderia usar sem desmontar a aposentadoria: reserva e recursos de outros objetivos, exceto bens ilíquidos
    const liquidUsable = s.diag.bsAssets.reduce((t, a) => t + ((a.purpose === "reserva" || a.purpose === "objetivos") && a.liq !== "iliquida" ? pos(a.value) : 0), 0);
    const retirementShare = (bs ? bs.retirementFin : 0) * Math.min(100, Math.max(0, num(p.usePct))) / 100;
    const resourcesBase = liquidUsable + retirementShare;

    // --- morte
    const monthlyNeed = pos(expense * num(p.needPct) / 100 - num(p.survivorIncome) - num(p.pension));
    const death = {
      parts: [
        { key: "final", label: "Custos finais e inventário", value: pos(p.finalFixed) + estate * pos(p.estatePct) / 100 },
        { key: "dividas", label: "Quitação das dívidas", value: p.debtsPaid ? debtTotal : 0 },
        { key: "transicao", label: "Fundo de transição", value: essential * pos(p.transitionMonths) },
        { key: "renda", label: "Reposição de renda da família", value: annuityPV(monthlyNeed, num(p.rate), num(p.supportYears)) },
        { key: "educ", label: "Educação dos dependentes", value: p.includeEducation ? educ : 0 }
      ],
      monthlyNeed: monthlyNeed
    };
    death.need = death.parts.reduce((t, x) => t + x.value, 0);
    death.resources = resourcesBase + pos(p.existingLife);
    death.gap = Math.max(0, death.need - death.resources);
    death.coverage = death.need > 0 ? Math.min(2, death.resources / death.need) : null;
    death.status = status(death.coverage);

    // --- invalidez: a família continua com 100% do custo de vida, mais custos de cuidado
    const yearsToRetire = Math.max(0, s.profile.retireAge - s.profile.currentAge);
    const monthlyGap = pos(expense - num(p.survivorIncome) - num(p.disabPension));
    const disability = {
      parts: [
        { key: "renda", label: "Reposição de renda até a aposentadoria", value: annuityPV(monthlyGap, num(p.rate), yearsToRetire) },
        { key: "cuidado", label: "Custos de cuidado e adaptação", value: annuityPV(pos(p.careMonthly), num(p.rate), num(p.careYears)) }
      ],
      monthlyGap: monthlyGap, yearsToRetire: yearsToRetire
    };
    disability.need = disability.parts.reduce((t, x) => t + x.value, 0);
    disability.resources = resourcesBase + pos(p.existingDisab);
    disability.gap = Math.max(0, disability.need - disability.resources);
    disability.coverage = disability.need > 0 ? Math.min(2, disability.resources / disability.need) : null;
    disability.status = status(disability.coverage);

    const hasDependents = num(p.deps) > 0 || num(p.survivorIncome) > 0;
    return { death: death, disability: disability, hasDependents: hasDependents, inputs: { debtTotal: debtTotal, expense: expense, essential: essential, estate: estate, educ: educ, liquidUsable: liquidUsable, retirementShare: retirementShare } };
  }

  return { analyze, annuityPV, status };
})();
if (typeof module !== "undefined") module.exports = Protection;
/* PROTECTION:END */
