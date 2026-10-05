/* PLANNING:BEGIN — diagnóstico, indicadores, qualidade dos dados, sugestões e memorando. Puro, sem DOM. */
const Planning = (function (E) {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const sum = (arr, f) => arr.reduce((t, x) => t + num(f(x)), 0);
  const FREQ = { mensal: 1, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 };
  const monthlyOf = (r) => num(r.value) * (FREQ[r.freq] || 1);
  const brl = (v) => (isFinite(v) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(v) + 0) : "—");
  const pct = (v, d) => (isFinite(v) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d == null ? 0 : d }).format(v) + "%" : "—");

  /* ---------- balanço patrimonial ---------- */
  function balanco(s) {
    const A = s.diag.bsAssets, L = s.diag.bsLiabilities;
    const byLiq = { imediata: 0, curta: 0, longa: 0, iliquida: 0 };
    const byPurpose = { reserva: 0, aposentadoria: 0, objetivos: 0, uso: 0, negocio: 0, outro: 0 };
    A.forEach((a) => { byLiq[a.liq] += num(a.value); byPurpose[a.purpose] += num(a.value); });
    const totalAssets = sum(A, (a) => a.value), totalLiab = sum(L, (l) => l.balance);
    const serviceDebt = sum(L, (l) => l.payment);
    const shortDebt = sum(L, (l) => num(l.payment) * Math.min(12, l.months > 0 ? l.months : 12));
    const financial = totalAssets - byLiq.iliquida;
    const retirementFin = sum(A, (a) => (a.purpose === "aposentadoria" && a.liq !== "iliquida" ? a.value : 0));
    const biggestFin = A.filter((a) => a.liq !== "iliquida").reduce((m, a) => (num(a.value) > num(m.value) ? a : m), { value: 0, label: "" });
    return {
      totalAssets, totalLiab, net: totalAssets - totalLiab, financial, retirementFin, illiquid: byLiq.iliquida,
      available: byLiq.imediata + byLiq.curta - shortDebt, shortDebt, serviceDebt, byLiq, byPurpose, biggestFin
    };
  }

  /* ---------- fluxo de caixa normalizado ---------- */
  function fluxo(s, bs) {
    const rows = s.diag.flow;
    const rec = (r) => r.nature !== "extraordinaria";
    const incomeRec = sum(rows.filter((r) => r.kind === "receita" && rec(r)), monthlyOf);
    const incomeExtra = sum(rows.filter((r) => r.kind === "receita" && !rec(r)), monthlyOf);
    const exp = (c) => sum(rows.filter((r) => r.kind === "despesa" && rec(r) && r.control === c), monthlyOf);
    const contractual = exp("contratual"), essential = exp("essencial"), discretionary = exp("discricionaria");
    const expenseExtra = sum(rows.filter((r) => r.kind === "despesa" && !rec(r)), monthlyOf);
    const debt = bs.serviceDebt;
    const expenseTotal = contractual + essential + discretionary + debt;
    const surplus = incomeRec - expenseTotal;
    return {
      incomeRec, incomeExtra, contractual, essential, discretionary, debt, expenseTotal, expenseExtra, surplus,
      essentialMonthly: contractual + essential + debt,
      rigidShare: incomeRec > 0 ? (contractual + debt) / incomeRec * 100 : null,
      flexibleShare: incomeRec > 0 ? (essential + discretionary) / incomeRec * 100 : null,
      adjustable: discretionary + essential
    };
  }

  /* ---------- reserva de contingência dimensionada ---------- */
  const RESERVE_ADD = { variable: 2, single: 2, dependents: 1, health: 1, lowEmploy: 1 };
  const RESERVE_BASE = 3;
  function reserva(s, fl, bs) {
    const d = s.diag;
    const computed = RESERVE_BASE + Object.keys(RESERVE_ADD).reduce((t, k) => t + (d.risk[k] ? RESERVE_ADD[k] : 0), 0);
    const months = d.monthsOverride != null ? d.monthsOverride : computed;
    const target = fl.essentialMonthly * months + num(d.shocks);
    const have = bs.byLiq.imediata;
    return { computedMonths: computed, months, target, have, gap: Math.max(0, target - have), surplus: Math.max(0, have - target), monthsHave: fl.essentialMonthly > 0 ? have / fl.essentialMonthly : null };
  }

  /* ---------- indicadores ---------- */
  function statusOf(v, target, dir) {
    if (v == null || !isFinite(v)) return "na";
    const ok = dir === "min" ? v >= target : v <= target;
    if (ok) return "ok";
    const dev = dir === "min" ? (target - v) / Math.max(target, 1e-9) : (v - target) / Math.max(target, 1e-9);
    return dev <= 0.25 ? "warn" : "crit";
  }

  function indicadores(s, bs, fl, rs, an) {
    const t = s.diag.targets, ex = s.cashflow.executed, inc = fl.incomeRec;
    const need = an && isFinite(an.consume.X) ? ex + an.consume.X : null;
    const list = [
      { key: "liquidez", label: "Meses de liquidez", value: rs.monthsHave, unit: "meses", dec: 1, target: rs.months, dir: "min", formula: "Ativos de liquidez imediata ÷ despesas essenciais mensais", read: "Mede por quanto tempo a família sustenta o essencial sem vender ativos nem se endividar. A meta sobe com renda variável, único provedor, dependentes e saúde." },
      { key: "poupanca", label: "Taxa de aporte", value: inc > 0 ? ex / inc * 100 : null, unit: "%", dec: 1, target: t.savings, dir: "min", formula: "Aporte mensal realizado ÷ renda líquida recorrente", read: "Capacidade de poupança é o superávit do fluxo; aporte é o que de fato é investido. A diferença entre os dois é o primeiro ponto de conversa." },
      { key: "dividas", label: "Comprometimento com dívidas", value: inc > 0 ? fl.debt / inc * 100 : null, unit: "%", dec: 1, target: t.debtLoad, dir: "max", formula: "Prestações mensais ÷ renda líquida recorrente", read: "Rigidez do orçamento. Acima da faixa, qualquer queda de renda vira inadimplência antes de virar ajuste." },
      { key: "alavancagem", label: "Alavancagem patrimonial", value: bs.totalAssets > 0 ? bs.totalLiab / bs.totalAssets * 100 : null, unit: "%", dec: 1, target: t.leverage, dir: "max", formula: "Passivos totais ÷ ativos totais", read: "Dependência de capital de terceiros. Olhe junto com a liquidez e o custo da dívida." },
      { key: "solvencia", label: "Solvência", value: bs.totalAssets > 0 ? bs.net / bs.totalAssets * 100 : null, unit: "%", dec: 1, target: t.solvency, dir: "min", formula: "Patrimônio líquido ÷ ativos totais", read: "Quanto dos ativos é, de fato, da família. Deve crescer ao longo do tempo." },
      { key: "meta", label: "Aporte sobre a meta (aposentadoria)", value: need != null && need > 0 ? ex / need * 100 : null, unit: "%", dec: 0, target: 100, dir: "min", formula: "Aporte atual ÷ (aporte atual + aporte adicional para consumir a reserva)", read: "Distância até o aporte que fecha o objetivo nas premissas atuais. Muda com o retorno real: veja a sensibilidade." },
      { key: "concentracao", label: "Concentração", value: bs.financial > 0 ? num(bs.biggestFin.value) / bs.financial * 100 : null, unit: "%", dec: 1, target: t.concentration, dir: "max", formula: "Maior linha financeira ÷ patrimônio financeiro", read: "Só faz sentido se as posições estiverem listadas por emissor ou produto, e não por classe.", detail: bs.biggestFin.label }
    ];
    list.forEach((i) => { i.status = statusOf(i.value, i.target, i.dir); });
    return list;
  }

  /* ---------- qualidade dos dados ---------- */
  const CRITICAL = [["liquid", "Recursos financeiros"], ["illiquid", "Patrimônio imobilizado"], ["debts", "Dívidas"], ["income", "Receita mensal"], ["expense", "Despesa mensal"], ["executed", "Aporte realizado"], ["desired", "Padrão de vida desejado"], ["rates", "Retorno e inflação"]];
  function quality(s) {
    const items = CRITICAL.map(([k, label]) => ({ label, q: s.quality[k] }));
    const rows = []
      .concat(s.diag.bsAssets.map((r) => ({ label: r.label || "Ativo", q: r.quality })))
      .concat(s.diag.bsLiabilities.map((r) => ({ label: r.label || "Dívida", q: r.quality })))
      .concat(s.diag.flow.map((r) => ({ label: r.label || "Item de fluxo", q: r.quality })));
    const count = (arr, q) => arr.filter((x) => x.q === q).length;
    const pctConf = (arr) => (arr.length ? count(arr, "confirmada") / arr.length * 100 : null);
    return {
      critical: { total: items.length, confirmed: count(items, "confirmada"), pct: pctConf(items), estimated: items.filter((x) => x.q === "estimada").map((x) => x.label), pending: items.filter((x) => x.q === "pendente").map((x) => x.label) },
      rows: { total: rows.length, confirmed: count(rows, "confirmada"), pct: pctConf(rows), estimated: rows.filter((x) => x.q === "estimada").map((x) => x.label), pending: rows.filter((x) => x.q === "pendente").map((x) => x.label) }
    };
  }

  /* ---------- sincronização Diagnóstico → Aposentadoria ---------- */
  function syncPatch(s) {
    const bs = balanco(s), fl = fluxo(s, bs);
    return { liquid: bs.retirementFin, illiquid: bs.illiquid, debts: bs.totalLiab, income: fl.incomeRec, expense: fl.expenseTotal };
  }

  /* ---------- sugestões de ação (apenas planejamento; sem produtos) ---------- */
  function suggestions(s, ctx) {
    const { an, bs, fl, rs, ind, stress, quality: q } = ctx;
    const out = [];
    const add = (key, title, priority, owner, evidence, next) => out.push({ key, title, priority, owner, evidence, next });
    if (rs.gap > 0 && fl.essentialMonthly > 0) {
      add("reserva", "Completar a reserva de contingência", rs.have < rs.target * 0.5 ? "critica" : "alta", "cliente",
        "Liquidez imediata " + brl(rs.have) + " (" + (rs.monthsHave == null ? "—" : rs.monthsHave.toFixed(1).replace(".", ",")) + " meses) para um alvo de " + brl(rs.target) + " (" + String(rs.months).replace(".", ",") + " meses). Faltam " + brl(rs.gap) + ".",
        "Definir uma transferência automática mensal e a conta onde a reserva ficará separada.");
    }
    const exp = s.diag.bsLiabilities.filter((l) => l.cet >= s.rates.nominal && l.balance > 0);
    if (exp.length) {
      add("divida_cara", "Avaliar amortização ou portabilidade de dívida com custo acima do retorno esperado", "alta", "planejador",
        exp.map((l) => (l.label || "Dívida") + ": CET " + pct(l.cet, 1) + " a.a. contra retorno nominal de " + pct(s.rates.nominal, 1)).join("; ") + ".",
        "Levantar saldo devedor, multas e possibilidade de portabilidade; comparar com o retorno líquido e a liquidez perdida.");
    }
    if (an && an.consume.coverage != null && an.consume.coverage < 1) {
      const X = an.consume.X, cut = Math.max(0, 1 - an.consume.coverage);
      add("aposentadoria_lacuna", "Fechar a lacuna do objetivo de aposentadoria", an.consume.coverage < 0.7 ? "critica" : "alta", "planejador",
        "Cobertura de " + pct(an.consume.coverage * 100) + " da renda desejada. Para fechar: aporte adicional de " + (isFinite(X) ? brl(X) + "/mês" : "inviável") + ", ou redução do padrão de vida em " + pct(cut * 100) + ", ou adiamento da aposentadoria.",
        "Apresentar as alternativas ao cliente, registrar a escolhida em um memorando e revisar em 12 meses.");
    }
    if (s.cashflow.executed > E.capacityOf(s) + 1) {
      add("aporte_origem", "Confirmar a origem do aporte acima da capacidade de poupança", "media", "planejador",
        "Aporte informado " + brl(s.cashflow.executed) + " contra capacidade de " + brl(E.capacityOf(s)) + " (receita − despesa informadas).", "Reconciliar com extratos e ajustar receita, despesa ou aporte.");
    }
    if (q && (q.critical.pending.length || q.rows.pending.length)) {
      const names = q.critical.pending.concat(q.rows.pending);
      add("dados_pendentes", "Confirmar dados pendentes", "alta", "cliente", "Pendentes: " + names.slice(0, 6).join(", ") + (names.length > 6 ? " e mais " + (names.length - 6) : "") + ".", "Solicitar os documentos correspondentes e atualizar o rótulo de qualidade de cada dado.");
    }
    const conc = ind.find((i) => i.key === "concentracao");
    if (conc && conc.status !== "ok" && conc.status !== "na") {
      add("concentracao", "Revisar a concentração patrimonial", "media", "planejador", "Maior linha financeira (" + (conc.detail || "—") + ") representa " + pct(conc.value, 1) + " do patrimônio financeiro; faixa de atenção " + pct(conc.target) + ".", "Confirmar se a posição é intencional e qual o papel dela no objetivo que financia.");
    }
    if (stress && stress.crise && stress.crise.coverage != null && stress.crise.coverage < 0.8) {
      add("guardrails", "Definir regra de gasto flexível para o início da aposentadoria", "media", "planejador", "No estresse de crise inicial a cobertura cai para " + pct(stress.crise.coverage * 100) + ".", "Combinar com o cliente quais gastos podem ser reduzidos, em que gatilho e em quanto.");
    }
    const gl = ctx.goals;
    if (gl && gl.ranked.length && gl.totals.gap > 0.5) {
      const essentialOpen = gl.ranked.some((r) => r.priority === "essencial" && (r.status === "sem_recursos" || r.status === "parcial" || r.status === "vencida"));
      add("metas_lacuna", "Fechar a conta das metas de vida", essentialOpen ? "alta" : "media", "planejador",
        "As metas pedem " + brl(gl.totals.required) + "/mês e há " + brl(gl.totals.available) + "/mês livres depois do aporte da aposentadoria (superávit " + brl(gl.totals.surplus) + "). Faltam " + brl(gl.totals.gap) + "/mês.",
        "Decidir com o cliente o que muda: datas, valores, prioridade ou parte do aporte da aposentadoria (veja o efeito na cobertura na aba Objetivos).");
    }
    const pr = ctx.protection;
    if (pr && pr.hasDependents && pr.death.need > 0 && pr.death.gap > 0 && pr.death.status !== "ok") {
      add("protecao_lacuna", "Tratar a lacuna de proteção da família", pr.death.status === "crit" ? "alta" : "media", "planejador",
        "Em caso de morte, o capital estimado como necessário é " + brl(pr.death.need) + " e os recursos disponíveis somam " + brl(pr.death.resources) + ": lacuna de " + brl(pr.death.gap) + (pr.disability.gap > 0 ? ". Em caso de invalidez, a lacuna é de " + brl(pr.disability.gap) : "") + ".",
        "Validar as premissas (renda do cônjuge, anos de sustento, custos) e, se o cliente decidir cobrir a lacuna, encaminhar a análise a um corretor de seguros habilitado.");
    }
    const sc = ctx.succession;
    if (sc && sc.monte > 0 && sc.gap > 0) {
      add("liquidez_sucessao", "Prever o caixa para o inventário da família", sc.gap > sc.total * 0.5 ? "alta" : "media", "planejador",
        "Custos estimados do inventário: " + brl(sc.total) + " (" + pct(sc.totalPct, 1) + " do patrimônio líquido), contra " + brl(sc.liquidOutside) + " de liquidez fora do inventário. Lacuna de caixa imediato: " + brl(sc.gap) + ".",
        "Confirmar com um advogado o regime de bens, a alíquota do ITCMD no estado e o tipo de inventário, e decidir com o cliente como esse caixa será formado.");
    }
    if (ctx.tauEst != null && ctx.tauEst > 0 && !(s.retTax && s.retTax.on)) {
      add("tributacao_resgate", "Considerar o IR do resgate na projeção da aposentadoria", "media", "planejador",
        "Pela estrutura cadastrada, o IR efetivo estimado sobre os saques seria de " + pct(ctx.tauEst * 100, 1) + ", e a projeção atual não o considera.",
        "Ativar a tributação do resgate na aba Aposentadoria e comparar o padrão de vida líquido com o atual.");
    }
    return out;
  }

  /* ---------- rascunho de memorando: aposentadoria ---------- */
  function draftRetirementMemo(s) {
    const an = E.analyze(s, 0), p = s.profile;
    const pa = E.paths(s, an), ex = E.exhaustAge(pa.current);
    const sens = E.sensitivity(s), def = sens.find((x) => x.key === "def").an;
    const alts = [];
    const c = an.consume;
    alts.push("A) Aumentar o aporte em " + (isFinite(c.X) ? brl(c.X) + "/mês" : "valor inviável") + " ou fazer um aporte único de " + (isFinite(c.L) ? brl(c.L) : "valor inviável") + " hoje (estratégia consumir a reserva até os " + p.horizonAge + " anos).");
    alts.push("B) Reduzir o padrão de vida desejado de " + brl(an.D) + " para " + brl(c.maxSpend) + "/mês (corte de " + pct(Math.max(0, 1 - (c.coverage || 0)) * 100) + ").");
    if (p.retireAge + 2 < p.horizonAge) {
      const d2 = JSON.parse(JSON.stringify(s)); d2.profile.retireAge += 2;
      const a2 = E.analyze(d2, 0);
      alts.push("C) Adiar a aposentadoria em 2 anos (para " + d2.profile.retireAge + "): cobertura passa a " + pct((a2.consume.coverage || 0) * 100) + " e o aporte adicional necessário, a " + (isFinite(a2.consume.X) ? brl(a2.consume.X) + "/mês" : "inviável") + ".");
    }
    alts.push("D) Manter o plano atual, sem novos aportes.");
    const cov = c.coverage;
    return {
      title: "Aposentadoria: como fechar a lacuna entre o padrão de vida desejado e o sustentável",
      frame: "planejamento",
      problem: "O padrão de vida desejado de " + brl(an.D) + "/mês (R$ de hoje) a partir dos " + p.retireAge + " anos " + (cov != null && cov < 1 ? "não é totalmente sustentável" : "é sustentável") + " com os aportes atuais de " + brl(s.cashflow.executed) + "/mês.",
      evidence: "Cobertura da renda desejada: " + pct((cov || 0) * 100) + " (consumir) e " + pct((an.preserve.coverage || 0) * 100) + " (preservar). Reserva projetada aos " + p.retireAge + " anos: " + brl(an.reserveNow) + " (R$ de hoje). Padrão de vida máximo sustentável: " + brl(c.maxSpend) + "/mês.",
      alternatives: alts.join("\n"),
      chosen: "[Preencher: alternativa escolhida e por quê]",
      assumptions: "Retorno real " + pct(an.rrAcc * 100, 2) + " a.a. (acumulação) e " + pct(an.rrPost * 100, 2) + " a.a. (aposentadoria); inflação " + pct(s.rates.inflation, 1) + "; horizonte de " + p.horizonAge + " anos; taxa constante; " + (an.P.tau > 0 ? "IR médio de " + pct(an.P.tau * 100, 1) + " sobre os saques da carteira" : "sem tributação sobre resgates") + (s.phases && s.phases.on ? "; gasto por fases (" + s.phaseRows.length + " fase(s) cadastrada(s))" : "") + ". Sensibilidade: no cenário defensivo (−2 p.p.) o aporte adicional vai a " + (isFinite(def.consume.X) ? brl(def.consume.X) + "/mês" : "valor inviável") + ".",
      risks: "Resultado depende do retorno real de longo prazo; não considera risco de sequência" + (an.P.tau > 0 ? "" : ", tributação do resgate") + (s.phases && s.phases.on ? "" : " nem despesas de saúde crescentes") + ". Custos e impostos de qualquer produto utilizado devem ser avaliados à parte.",
      inaction: ex ? "Mantido o aporte atual e o padrão de vida desejado, a reserva financeira se esgota aos " + ex + " anos." : "Mantido o plano atual, a reserva não se esgota até os " + p.horizonAge + " anos nas premissas informadas.",
      owner: "Cliente e planejador",
      review: ""
    };
  }


  /* ---------- aviso legal do profissional ---------- */
  function disclaimer(s) {
    const p = s.pro;
    const filled = !!(p.name && p.scope);
    const cvm = p.cvm === "sim"
      ? "Autorização de consultor de valores mobiliários (CVM): possui" + (p.cvmNo ? " — " + p.cvmNo : "") + "."
      : "Não possui autorização de consultor de valores mobiliários da CVM; este material não contém recomendação individualizada de valores mobiliários.";
    return {
      filled,
      lines: [
        "Material educativo e de apoio ao planejamento financeiro, elaborado com base nas informações fornecidas pelo cliente e nas premissas indicadas. Projeções dependem de premissas e não garantem resultado futuro.",
        "Profissional: " + (p.name || "[preencher]") + (p.cert ? " (" + p.cert + ")" : "") + ". " + cvm,
        "Escopo do serviço: " + (p.scope || "[preencher]") + ". Remuneração: " + (p.fee || "[preencher]") + ". Conflitos de interesse: " + (p.conflicts || "[preencher; informe 'nenhum conhecido' se for o caso]") + "."
      ]
    };
  }

  return { balanco, fluxo, reserva, indicadores, quality, syncPatch, suggestions, draftRetirementMemo, disclaimer, statusOf, monthlyOf, RESERVE_ADD, RESERVE_BASE, FREQ };
})(typeof Engine !== "undefined" ? Engine : require("./engine.js"));
if (typeof module !== "undefined") module.exports = Planning;
/* PLANNING:END */
