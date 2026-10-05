/* IRPF:BEGIN — puro, sem DOM. Tabelas isoladas por vigência para facilitar atualização. */
const Irpf = (function () {
  "use strict";

  const TAX = {
    "2026": {
      label: "2026 em diante — Lei 15.270/2025",
      short: "2026 em diante",
      source: "Lei 15.270/2025 e tabelas divulgadas para 2026 (conferidas em fontes secundárias em 05/10/2026; validar na Receita Federal antes de uso com clientes).",
      monthly: {
        brackets: [[2428.80, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]],
        dep: 189.59, simplified: 607.20,
        reducer: { fullUntil: 5000, partialUntil: 7350, a: 978.62, b: 0.133145 }
      },
      annual: {
        brackets: [[29145.60, 0, 0], [33919.80, 0.075, 2185.92], [45012.60, 0.15, 4729.91], [55976.16, 0.225, 8105.85], [Infinity, 0.275, 10904.66]],
        dep: 2275.08, educationLimit: 3561.50, simplifiedRate: 0.20, simplifiedCap: 17640.00,
        reducer: { cap: 2694.15, fullUntil: 60000, partialUntil: 88200, a: 8429.73, b: 0.095575 },
        pgblRate: 0.12, minTaxFrom: 600000
      }
    },
    "2025": {
      label: "2025 — tabela anterior à Lei 15.270 (do arquivo original)",
      short: "2025 (tabela anterior)",
      source: "Tabela de jan–abr/2025 (base do arquivo original). Não vale para 2026.",
      monthly: {
        brackets: [[2259.20, 0, 0], [2826.65, 0.075, 169.44], [3751.05, 0.15, 381.44], [4664.68, 0.225, 662.77], [Infinity, 0.275, 904.48]],
        dep: 189.59, simplified: 564.80, reducer: null
      },
      annual: {
        brackets: [[27110.40, 0, 0], [33919.80, 0.075, 2033.28], [45012.60, 0.15, 4577.28], [55976.16, 0.225, 7953.24], [Infinity, 0.275, 10853.78]],
        dep: 2275.08, educationLimit: 3561.50, simplifiedRate: 0.20, simplifiedCap: 16754.34,
        reducer: null, pgblRate: 0.12, minTaxFrom: null
      }
    }
  };

  const pos = (x) => Math.max(0, x);

  function tableTax(base, brackets) {
    for (const [lim, rate, ded] of brackets) if (base <= lim) return pos(base * rate - ded);
    return 0;
  }

  function monthlyReducer(rend, gross, R) {
    if (!R) return 0;
    if (rend <= R.fullUntil) return gross;
    if (rend <= R.partialUntil) return Math.min(gross, pos(R.a - R.b * rend));
    return 0;
  }
  function annualReducer(rend, gross, R) {
    if (!R) return 0;
    if (rend <= R.fullUntil) return Math.min(gross, R.cap);
    if (rend <= R.partialUntil) return Math.min(gross, pos(R.a - R.b * rend));
    return 0;
  }

  /* ---------- cálculo mensal (retenção / carnê-leão) ---------- */
  function monthly(inp, vig) {
    const T = TAX[vig].monthly;
    const legal = inp.inss + inp.dep * T.dep + inp.pensao + inp.outras;
    const mode = legal >= T.simplified ? "legal" : "simplificado";
    const used = Math.max(legal, T.simplified);
    const base = pos(inp.rend - used);
    const gross = tableTax(base, T.brackets);
    const red = monthlyReducer(inp.rend, gross, T.reducer);
    const tax = pos(gross - red);
    return { legal, used, mode, base, gross, red, tax, effective: inp.rend > 0 ? tax / inp.rend : 0, simplifiedValue: T.simplified };
  }

  /* ---------- ajuste anual: simplificado × completo × completo + PGBL ---------- */
  function scenario(rend, ded, irrf, T) {
    const base = pos(rend - ded);
    const gross = tableTax(base, T.brackets);
    const red = annualReducer(rend, gross, T.reducer);
    const tax = pos(gross - red);
    return { ded, base, gross, red, tax, result: irrf - tax };
  }

  function annual(inp, vig) {
    const T = TAX[vig].annual;
    const people = 1 + inp.dep;
    const instrCap = people * T.educationLimit;
    const instr = Math.min(inp.instr, instrCap);
    const legal = inp.inss + inp.dep * T.dep + instr + inp.med + inp.outras;
    const simplified = Math.min(inp.rend * T.simplifiedRate, T.simplifiedCap);
    const pgblLimit = inp.rend * T.pgblRate;
    const want = inp.aporte == null ? pgblLimit : inp.aporte;
    const aporte = Math.min(pos(want), pgblLimit);
    const S = scenario(inp.rend, simplified, inp.irrf, T);
    const C = scenario(inp.rend, legal, inp.irrf, T);
    const P = scenario(inp.rend, legal + aporte, inp.irrf, T);
    const bestKey = S.tax < C.tax ? "S" : "C";
    const best = bestKey === "S" ? S : C;
    const saving = best.tax - P.tax;
    return {
      S, C, P, best, bestKey, aporte, pgblLimit, saving,
      flags: {
        aporteClamped: inp.aporte != null && inp.aporte > pgblLimit + 0.005,
        instrCapped: inp.instr > instrCap + 0.005,
        instrCap,
        simplifiedBeatsPgbl: S.tax < P.tax - 0.005,
        minTax: T.minTaxFrom != null && inp.rend > T.minTaxFrom
      }
    };
  }

  /* ---------- PGBL × investimento comum no longo prazo ---------- */
  function pgblRate(years) { return years > 10 ? 0.10 : years > 8 ? 0.15 : years > 6 ? 0.20 : years > 4 ? 0.25 : years > 2 ? 0.30 : 0.35; }
  function fixedIncomeRate(years) { return years <= 1 ? 0.175 : 0.15; }

  function project(p) {
    const aporte = p.renda * p.pct / 100;
    const aliq = p.aliq / 100;
    const econ = aporte * aliq;
    const outOfPocket = aporte - econ;
    const rP = p.cdi / 100 - p.taxa / 100, rA = p.cdi / 100;
    const rows = [];
    let balP = 0, balA = 0, breakEven = null;
    for (let y = 1; y <= p.anos; y++) {
      const jurosP = (balP + aporte) * rP;
      balP = (balP + aporte) * (1 + rP);
      balA = (balA + outOfPocket) * (1 + rA);
      let netP = 0, netA = 0;
      for (let k = 1; k <= y; k++) {
        const held = y - k + 1;
        netP += aporte * Math.pow(1 + rP, held) * (1 - pgblRate(held));
        const fvA = outOfPocket * Math.pow(1 + rA, held);
        netA += outOfPocket + (fvA - outOfPocket) * (1 - fixedIncomeRate(held));
      }
      if (breakEven === null && netP > netA) breakEven = y;
      rows.push({ y, aporte, econ, jurosP, balP, netP, balA, netA, adv: netP - netA });
    }
    const last = rows[rows.length - 1];
    return {
      aporte, econ, outOfPocket, rows, last, breakEven,
      totals: { aportado: aporte * p.anos, econ: econ * p.anos, outOfPocket: outOfPocket * p.anos },
      irP: last.balP - last.netP, irA: last.balA - last.netA
    };
  }

  /* ---------- tributação no resgate: alíquota efetiva sobre o capital de aposentadoria ----------
     Regressiva: pelo tempo médio de aplicação (a regra real é por aporte; usar a média é uma simplificação).
     Progressiva: tabela mensal sobre o saque bruto estimado de cada linha, sem o redutor da Lei 15.270 (estimativa).
     PGBL: IR sobre o valor total; VGBL e investimento tributável: IR só sobre a parcela de ganho. */
  const REGRESSIVE = [[2, 0.35], [4, 0.30], [6, 0.25], [8, 0.20], [10, 0.15], [Infinity, 0.10]];
  function progressiveRate(monthlyBase, vig) {
    const T = TAX[vig].monthly;
    return monthlyBase > 0 ? tableTax(monthlyBase, T.brackets) / monthlyBase : 0;
  }
  function withdrawalTax(rows, vig, manualPct) {
    if (manualPct != null && isFinite(manualPct)) return { tau: Math.max(0, manualPct) / 100, manual: true, parts: [], value: 0, tax: 0 };
    const parts = []; let value = 0, tax = 0;
    (rows || []).forEach(function (r) {
      const v = Math.max(0, Number(r.value) || 0); if (v <= 0) return;
      const gain = Math.min(1, Math.max(0, (Number(r.gainPct) || 0) / 100)), years = Math.max(0, Number(r.years) || 0);
      let base = v, rate = 0, note = "";
      if (r.kind === "isento") { base = 0; note = "isento"; }
      else if (r.kind === "tributavel") { base = v * gain; rate = fixedIncomeRate(years); note = "ganho a " + (rate * 100).toFixed(1).replace(".", ",") + "%"; }
      else {
        base = r.kind === "vgbl" ? v * gain : v;
        if (r.regime === "progressivo") { rate = progressiveRate(Math.max(0, Number(r.monthly) || 0) * (v > 0 ? base / v : 0), vig); note = "tabela progressiva (estimativa)"; }
        else { rate = pgblRate(years); note = "regressiva, " + years + " anos"; }
      }
      const t = base * rate;
      parts.push({ label: r.label || "Linha", kind: r.kind, value: v, base: base, rate: rate, tax: t, eff: t / v, note: note });
      value += v; tax += t;
    });
    return { tau: value > 0 ? tax / value : 0, manual: false, parts: parts, value: value, tax: tax };
  }

  return { TAX, REGRESSIVE, tableTax, monthly, annual, project, pgblRate, fixedIncomeRate, progressiveRate, withdrawalTax };
})();
if (typeof module !== "undefined") module.exports = Irpf;
/* IRPF:END */
