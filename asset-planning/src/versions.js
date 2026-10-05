/* VERSIONS:BEGIN — fotografias do plano e comparação entre versões. Os indicadores são recalculados a cada comparação. Puro, sem DOM. */
const Versions = (function (E, P, G, D, R, S) {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const altNetOf = (s) => (s.debtPlan.altReturn != null ? s.debtPlan.altReturn : s.rates.nominal * 0.85);

  /* better: "up" = maior é melhor · "down" = menor é melhor · "none" = só informativo */
  function kpis(s, now) {
    now = now || new Date();
    const bs = P.balanco(s), fl = P.fluxo(s, bs), rs = P.reserva(s, fl, bs);
    const v = E.validate(s), an = v.errors.length ? null : E.analyze(s, 0);
    const exhaust = an ? E.exhaustAge(E.paths(s, an).current) : null;
    const g = G.analyze(s, fl, bs, now, an), pr = R.analyze(s, { fl: fl, bs: bs, goals: g }), q = P.quality(s);
    const dc = D.simulate(s.diag.bsLiabilities, { strategy: "none" }), sc = S.analyze(s, { bs: bs });
    const lastFin = an && s.profile.horizonAge ? Math.max(0, an.termNow) : null;
    return [
      { key: "net", label: "Patrimônio líquido", fmt: "money", better: "up", value: bs.net },
      { key: "financial", label: "Patrimônio financeiro", fmt: "money", better: "up", value: bs.financial },
      { key: "surplus", label: "Superávit sustentável (mês)", fmt: "money", better: "up", value: fl.surplus },
      { key: "reserve", label: "Meses de liquidez", fmt: "num1", better: "up", value: rs.monthsHave },
      { key: "coverage", label: "Cobertura da renda desejada", fmt: "pct0", better: "up", value: an && an.consume.coverage != null ? an.consume.coverage * 100 : null },
      { key: "extraX", label: "Aporte adicional p/ aposentadoria", fmt: "money", better: "down", value: an && isFinite(an.consume.X) ? an.consume.X : null },
      { key: "exhaust", label: "Reserva se esgota aos", fmt: "age", better: "up", value: an ? (exhaust == null ? s.profile.horizonAge + 1 : exhaust) : null, horizon: s.profile.horizonAge },
      { key: "legacy", label: "Reserva financeira ao fim do horizonte", fmt: "money", better: "up", value: lastFin },
      { key: "debt", label: "Dívidas (saldo)", fmt: "money", better: "down", value: bs.totalLiab },
      { key: "debtMonths", label: "Meses para quitar (contratos atuais)", fmt: "months", better: "down", value: dc.never ? null : dc.months },
      { key: "goalsReq", label: "Metas: aporte mensal necessário", fmt: "money", better: "none", value: g.totals.required },
      { key: "goalsGap", label: "Metas: falta de recursos (mês)", fmt: "money", better: "down", value: g.totals.gap },
      { key: "deathGap", label: "Proteção: lacuna em caso de morte", fmt: "money", better: "down", value: pr.death.gap },
      { key: "disabGap", label: "Proteção: lacuna em caso de invalidez", fmt: "money", better: "down", value: pr.disability.gap },
      { key: "succGap", label: "Sucessão: lacuna de caixa no inventário", fmt: "money", better: "down", value: sc.gap },
      { key: "quality", label: "Dados críticos confirmados", fmt: "pct0", better: "up", value: q.critical.pct }
    ];
  }

  function compare(sa, sb, now) {
    const ka = kpis(sa, now), kb = kpis(sb, now);
    return ka.map(function (a, i) {
      const b = kb[i];
      const bothNum = a.value != null && b.value != null;
      const delta = bothNum ? b.value - a.value : null;
      const tol = Math.max(1e-9, Math.abs(a.value || 0) * 1e-6, a.fmt === "money" ? 0.5 : 0.005);
      let verdict = "same";
      if (a.better === "none") verdict = bothNum && Math.abs(delta) > tol ? "changed" : "same";
      else if (bothNum && Math.abs(delta) > tol) verdict = (delta > 0) === (a.better === "up") ? "better" : "worse";
      else if (!bothNum && (a.value == null) !== (b.value == null)) verdict = "changed";
      return { key: a.key, label: a.label, fmt: a.fmt, better: a.better, a: a.value, b: b.value, ha: a.horizon, hb: b.horizon, delta: delta, verdict: verdict };
    });
  }

  /* Premissas e listas que mudaram entre duas versões. */
  const PATHS = [
    ["profile.currentAge", "Idade atual", "int"], ["profile.retireAge", "Idade de aposentadoria", "int"], ["profile.horizonAge", "Expectativa de vida", "int"],
    ["rates.nominal", "Retorno nominal a.a.", "pct"], ["rates.inflation", "Inflação a.a.", "pct"], ["rates.differentiate", "Taxas diferentes após aposentar", "bool"],
    ["rates.nominalPost", "Retorno nominal após aposentar", "pct"], ["rates.inflationPost", "Inflação após aposentar", "pct"],
    ["cashflow.desiredWithdrawal", "Padrão de vida desejado", "money"], ["cashflow.executed", "Aporte realizado", "money"], ["cashflow.minLegacy", "Legado mínimo", "money"], ["cashflow.escalate", "Reajuste pela inflação", "bool"],
    ["assets.liquid", "Recursos financeiros (Aposentadoria)", "money"], ["assets.illiquid", "Patrimônio imobilizado (Aposentadoria)", "money"], ["assets.debts", "Dívidas (Aposentadoria)", "money"],
    ["phases.on", "Gastos por fase", "bool"], ["retTax.on", "IR sobre o resgate", "bool"], ["retTax.manual", "Alíquota efetiva manual", "pct"],
    ["goalsCfg.realReturn", "Retorno real das metas", "pct"], ["debtPlan.extra", "Recurso extra para dívidas", "money"], ["debtPlan.strategy", "Estratégia de quitação", "text"], ["debtPlan.altReturn", "Retorno líquido da alternativa", "pct"],
    ["protect.needPct", "Proteção: % do custo mantido", "pct"], ["protect.survivorIncome", "Proteção: renda do cônjuge", "money"], ["protect.supportYears", "Proteção: anos de sustento", "int"],
    ["protect.existingLife", "Proteção: capital existente (morte)", "money"], ["protect.existingDisab", "Proteção: capital existente (invalidez)", "money"],
    ["mc.vol", "Volatilidade (Monte Carlo)", "pct"], ["succ.itcmd", "Sucessão: ITCMD", "pct"], ["succ.regime", "Sucessão: regime de bens", "text"], ["succ.months", "Sucessão: prazo do inventário (meses)", "int"],
    ["diag.shocks", "Choques previsíveis da reserva", "money"], ["diag.monthsOverride", "Meses de reserva (manual)", "num1"]
  ];
  const LISTS = [
    ["diag.bsAssets", "Ativo", [["value", "valor", "money"], ["liq", "liquidez", "text"], ["purpose", "finalidade", "text"]]],
    ["diag.bsLiabilities", "Dívida", [["balance", "saldo", "money"], ["cet", "CET", "pct"], ["payment", "prestação", "money"]]],
    ["diag.flow", "Fluxo", [["value", "valor", "money"], ["freq", "periodicidade", "text"]]],
    ["goals", "Meta", [["amount", "valor", "money"], ["year", "ano", "int"], ["saved", "já reservado", "money"], ["priority", "prioridade", "text"]]],
    ["retIncome", "Renda na aposentadoria", [["value", "valor", "money"], ["ageFrom", "a partir da idade", "int"]]],
    ["phaseRows", "Fase de gasto", [["pct", "% do gasto", "pct"], ["health", "saúde extra", "money"]]],
    ["taxRows", "Estrutura tributária", [["value", "valor", "money"], ["kind", "tipo", "text"], ["years", "anos", "int"]]]
  ];
  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const same = (x, y) => (typeof x === "number" && typeof y === "number" ? Math.abs(x - y) < 1e-9 : x === y);

  function changes(sa, sb) {
    const out = [];
    PATHS.forEach(function (p) {
      const a = get(sa, p[0]), b = get(sb, p[0]);
      if (!same(a, b)) out.push({ group: "Premissas", label: p[1], a: a, b: b, fmt: p[2] });
    });
    LISTS.forEach(function (L) {
      const la = get(sa, L[0]) || [], lb = get(sb, L[0]) || [];
      const key = (r, i) => (r.label || ("#" + (i + 1))).trim().toLowerCase();
      const ma = {}, mb = {};
      la.forEach((r, i) => { ma[key(r, i)] = r; }); lb.forEach((r, i) => { mb[key(r, i)] = r; });
      Object.keys(mb).forEach(function (k) {
        if (!ma[k]) out.push({ group: L[1] + "s", label: L[1] + " adicionado(a): " + (mb[k].label || k), a: null, b: null, fmt: "text" });
        else L[2].forEach(function (f) { if (!same(ma[k][f[0]], mb[k][f[0]])) out.push({ group: L[1] + "s", label: L[1] + " “" + (mb[k].label || k) + "”: " + f[1], a: ma[k][f[0]], b: mb[k][f[0]], fmt: f[2] }); });
      });
      Object.keys(ma).forEach(function (k) { if (!mb[k]) out.push({ group: L[1] + "s", label: L[1] + " removido(a): " + (ma[k].label || k), a: null, b: null, fmt: "text" }); });
    });
    return out;
  }

  /* Fotografia: estado completo sem a lista de versões (evita recursão). */
  function make(state, name, note, nowISO, auto) {
    const inner = JSON.parse(JSON.stringify(state)); delete inner.versions;
    const id = (state.versions || []).reduce((m, v) => Math.max(m, v.id || 0), 0) + 1;
    return { id: id, name: String(name || "").slice(0, 80) || "Versão " + id, note: String(note || "").slice(0, 400), date: nowISO, auto: !!auto, state: inner };
  }

  // Estado de uma versão pronto para uso (mantém a lista de versões atual).
  function restoreState(version, currentVersions) {
    const s = JSON.parse(JSON.stringify(version.state));
    s.versions = JSON.parse(JSON.stringify(currentVersions || []));
    return s;
  }

  return { kpis, compare, changes, make, restoreState, altNetOf, PATHS, LISTS };
})(
  typeof Engine !== "undefined" ? Engine : require("./engine.js"),
  typeof Planning !== "undefined" ? Planning : require("./planning.js"),
  typeof Goals !== "undefined" ? Goals : require("./goals.js"),
  typeof Debt !== "undefined" ? Debt : require("./debt.js"),
  typeof Protection !== "undefined" ? Protection : require("./protection.js"),
  typeof Succession !== "undefined" ? Succession : require("./succession.js")
);
if (typeof module !== "undefined") module.exports = Versions;
/* VERSIONS:END */
