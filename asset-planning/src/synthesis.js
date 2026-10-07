/* SYNTHESIS:BEGIN — diagnóstico final por área, compromissos sugeridos e modelo do IPS de planejamento. Puro, sem DOM.
   O IPS aqui é uma declaração de política e compromissos de PLANEJAMENTO: objetivos, metas de aporte, reserva, dívidas, regras de revisão
   e responsabilidades. Não contém alocação de ativos nem recomendação de valores mobiliários (isso só cabe a quem tem autorização da CVM). */
const Synthesis = (function (E, P, G, D, R, S, I) {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const brl = (v) => (isFinite(v) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(v) + 0) : "—");
  const pct = (v, d) => (isFinite(v) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d == null ? 0 : d }).format(v) + "%" : "—");
  const num1 = (v) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v);
  const SEV = { crit: 0, warn: 1, ok: 2, info: 3, na: 4 };
  const fromInd = (st) => (st === "ok" ? "ok" : st === "warn" ? "warn" : st === "crit" ? "crit" : "na");

  function isoPlusMonths(now, months) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + months, Math.min(now.getDate(), 28)));
    return d.toISOString().slice(0, 10);
  }

  function context(s, now) {
    now = now || new Date();
    const bs = P.balanco(s), fl = P.fluxo(s, bs), rs = P.reserva(s, fl, bs);
    const v = E.validate(s), an = v.errors.length ? null : E.analyze(s, 0);
    const ind = P.indicadores(s, bs, fl, rs, an), q = P.quality(s);
    const goals = G.analyze(s, fl, bs, now, an), prot = R.analyze(s, { fl: fl, bs: bs, goals: goals }), succ = S.analyze(s, { bs: bs });
    const altNet = s.debtPlan.altReturn != null ? s.debtPlan.altReturn : s.rates.nominal * 0.85;
    return { s: s, now: now, bs: bs, fl: fl, rs: rs, v: v, an: an, ind: ind, q: q, goals: goals, prot: prot, succ: succ, altNet: altNet,
      liabs: s.diag.bsLiabilities.filter((l) => l.balance > 0), crise: an ? E.stress(s, s.stress.crise) : null };
  }

  /* ---------- diagnóstico por área ---------- */
  function areas(c, opts) {
    opts = opts || {};
    const s = c.s, out = [];
    const add = (key, label, status, headline, detail, tab, tabLabel) => out.push({ key: key, label: label, status: status, headline: headline, detail: detail, tab: tab, tabLabel: tabLabel });
    const g = (k) => c.ind.find((i) => i.key === k);

    // dados
    const cr = c.q.critical, pend = cr.pending.concat(c.q.rows.pending);
    const empty = !s.diag.bsAssets.length && !s.diag.flow.length;
    add("dados", "Qualidade dos dados", empty ? "na" : pend.length ? "crit" : cr.confirmed / cr.total < 0.5 ? "warn" : "ok",
      cr.confirmed + " de " + cr.total + " dados críticos confirmados", empty ? "Cadastre ativos, dívidas e fluxo no Diagnóstico." : pend.length ? "Pendentes: " + pend.slice(0, 6).join(", ") + (pend.length > 6 ? " e mais " + (pend.length - 6) : "") + "." : cr.estimated.length ? "Estimados: " + cr.estimated.slice(0, 5).join(", ") + "." : "Sem pendências.", "diag", "Diagnóstico");

    // fluxo e poupança
    const pou = g("poupanca");
    add("fluxo", "Fluxo de caixa e poupança", c.fl.incomeRec <= 0 ? "na" : c.fl.surplus < 0 ? "crit" : fromInd(pou.status),
      c.fl.incomeRec <= 0 ? "Sem renda recorrente cadastrada" : "Superávit de " + brl(c.fl.surplus) + "/mês (" + pct(c.fl.surplus / c.fl.incomeRec * 100) + " da renda)",
      c.fl.incomeRec <= 0 ? "" : "Aporte realizado de " + brl(s.cashflow.executed) + "/mês, taxa de aporte de " + pct(pou.value, 1) + " (faixa: ao menos " + pct(pou.target) + ").", "diag", "Diagnóstico");

    // reserva
    const liq = g("liquidez");
    add("reserva", "Reserva de contingência", c.fl.essentialMonthly <= 0 ? "na" : fromInd(liq.status),
      c.rs.monthsHave == null ? "Sem despesa essencial cadastrada" : num1(c.rs.monthsHave) + " meses de liquidez (alvo: " + num1(c.rs.months) + ")",
      c.rs.gap > 0 ? "Faltam " + brl(c.rs.gap) + " para o alvo de " + brl(c.rs.target) + "." : "Reserva acima do alvo de " + brl(c.rs.target) + ".", "diag", "Diagnóstico");

    // dívidas
    const dl = g("dividas"), costly = c.liabs.filter((l) => l.cet > c.altNet);
    add("dividas", "Dívidas", c.bs.totalLiab <= 0 ? "ok" : costly.length && fromInd(dl.status) === "ok" ? "warn" : fromInd(dl.status),
      c.bs.totalLiab <= 0 ? "Sem dívidas cadastradas" : "Dívidas de " + brl(c.bs.totalLiab) + "; prestações de " + brl(c.bs.serviceDebt) + "/mês" + (c.fl.incomeRec > 0 ? " (" + pct(c.bs.serviceDebt / c.fl.incomeRec * 100, 1) + " da renda)" : ""),
      costly.length ? "Custo acima do retorno líquido esperado (" + pct(c.altNet, 1) + " a.a.): " + costly.map((l) => (l.label || "Dívida") + " (CET " + pct(l.cet, 1) + ")").join("; ") + "." : c.bs.totalLiab > 0 ? "Nenhuma dívida acima do retorno líquido esperado." : "", "cx", "Caixa e dívidas");

    // metas
    const gt = c.goals.totals, essentialOpen = c.goals.ranked.some((r) => r.priority === "essencial" && (r.status === "sem_recursos" || r.status === "vencida"));
    add("metas", "Metas de vida", !c.goals.ranked.length ? "na" : gt.gap > 0.5 ? (essentialOpen ? "crit" : "warn") : "ok",
      !c.goals.ranked.length ? "Nenhuma meta cadastrada" : c.goals.ranked.length + (c.goals.ranked.length === 1 ? " meta" : " metas") + " (" + brl(gt.amount) + " em valor de hoje); exigem " + brl(gt.required) + "/mês",
      !c.goals.ranked.length ? "Cadastre as metas na etapa Objetivos." : gt.gap > 0.5 ? "Há " + brl(gt.available) + "/mês livres depois do aporte da aposentadoria; faltam " + brl(gt.gap) + "/mês." : "Os recursos livres cobrem o aporte necessário.", "obj", "Objetivos");

    // aposentadoria
    const cov = c.an ? c.an.consume.coverage : null;
    add("aposentadoria", "Aposentadoria", !c.an || cov == null ? "na" : cov >= 1 ? "ok" : cov >= 0.8 ? "warn" : "crit",
      !c.an ? "Premissas da aposentadoria com erro" : cov == null ? "Defina o padrão de vida desejado" : "Cobertura de " + pct(cov * 100) + " da renda desejada de " + brl(s.cashflow.desiredWithdrawal) + "/mês",
      !c.an ? c.v.errors[0] : (cov != null && cov < 1 ? "Aporte adicional de " + (isFinite(c.an.consume.X) ? brl(c.an.consume.X) + "/mês" : "valor inviável") + " fecha a lacuna. " : "") + (c.crise && c.crise.coverage != null ? "Em crise no início da aposentadoria a cobertura cairia para " + pct(c.crise.coverage * 100) + "." : ""), "apos", "Aposentadoria");

    // proteção
    const pd = c.prot.death, pi = c.prot.disability;
    const worst = [pd.status, pi.status].sort((a, b) => (SEV[a] === undefined ? 9 : SEV[a]) - (SEV[b] === undefined ? 9 : SEV[b]))[0];
    add("protecao", "Proteção da família", !c.prot.hasDependents && pd.need <= 0 ? "na" : c.prot.hasDependents ? worst : pi.status,
      pd.gap > 0 || pi.gap > 0 ? "Lacuna estimada: " + brl(pd.gap) + " (morte) e " + brl(pi.gap) + " (invalidez)" : "Sem lacuna de capital estimada",
      "Necessidade de " + brl(pd.need) + " em caso de morte e " + brl(pi.need) + " em caso de invalidez; recursos considerados: " + brl(pd.resources) + ".", "prot", "Proteção");

    // sucessão
    const sc = c.succ;
    add("sucessao", "Sucessão (liquidez do inventário)", sc.monte <= 0 ? "na" : sc.gap <= 0 ? "ok" : sc.coverage != null && sc.coverage >= 0.5 ? "warn" : "crit",
      sc.monte <= 0 ? "Sem patrimônio líquido para inventariar" : "Custo estimado de " + brl(sc.total) + " (" + pct(sc.totalPct, 1) + " do monte-mor)",
      sc.monte <= 0 ? "" : sc.gap > 0 ? "Liquidez fora do inventário de " + brl(sc.liquidOutside) + ": lacuna de caixa de " + brl(sc.gap) + "." : "A liquidez fora do inventário cobre o custo estimado.", "succ", "Sucessão");

    // concentração
    const con = g("concentracao");
    add("concentracao", "Concentração do patrimônio financeiro", fromInd(con.status), con.value == null ? "Sem patrimônio financeiro cadastrado" : "Maior posição: " + pct(con.value, 1) + " do patrimônio financeiro", con.detail ? "Maior linha: " + con.detail + " (faixa: até " + pct(con.target) + ")." : "", "diag", "Diagnóstico");

    // tributação (só se a etapa foi vista)
    if (opts.taxVisited) {
      const a = I.annual({ rend: s.irpf.anual.rend, irrf: s.irpf.anual.irrf, inss: s.irpf.anual.inss, dep: Math.floor(s.irpf.anual.dep), instr: s.irpf.anual.instr, med: s.irpf.anual.med, outras: s.irpf.anual.outras, aporte: s.irpf.anual.aporte }, s.irpf.vig);
      add("tributario", "Eficiência tributária", "info", a.saving > 0 ? "PGBL pode reduzir o IR do ano em cerca de " + brl(a.saving) : "Sem economia de IR estimada com PGBL no perfil informado", "Estimativa com os dados da aba IRPF anual; o imposto é adiado, não eliminado. Confirme com o contador.", "ira", "IRPF anual e PGBL");
    } else add("tributario", "Eficiência tributária", "na", "Não analisada nesta reunião", "Etapa opcional: IRPF mensal, anual e PGBL.", "ira", "IRPF anual e PGBL");
    return out;
  }

  function summary(list) {
    const att = list.filter((a) => a.status === "crit" || a.status === "warn").sort((a, b) => SEV[a.status] - SEV[b.status]);
    return { strengths: list.filter((a) => a.status === "ok"), attention: att, counts: { crit: att.filter((a) => a.status === "crit").length, warn: att.filter((a) => a.status === "warn").length, ok: list.filter((a) => a.status === "ok").length, info: list.filter((a) => a.status === "info").length, na: list.filter((a) => a.status === "na").length } };
  }

  function executive(c, list) {
    const sm = summary(list), lines = [];
    lines.push("Patrimônio líquido de " + brl(c.bs.net) + " (financeiro: " + brl(c.bs.financial) + "), superávit sustentável de " + brl(c.fl.surplus) + "/mês e " + (c.rs.monthsHave == null ? "—" : num1(c.rs.monthsHave)) + " meses de liquidez.");
    if (sm.strengths.length) lines.push("Pontos fortes: " + sm.strengths.map((a) => a.label.toLowerCase()).join("; ") + ".");
    if (sm.attention.length) lines.push("Pontos de atenção, do mais ao menos urgente: " + sm.attention.map((a) => a.label.toLowerCase()).join("; ") + ".");
    else lines.push("Nenhum ponto de atenção relevante nas áreas analisadas.");
    return lines;
  }

  /* ---------- compromissos sugeridos (o planejador decide o que entra) ---------- */
  const DOCS = { extratos: "extratos de contas e de investimentos", irpf: "declaração de IRPF e recibo", dividas: "contratos e saldos de dívidas", apolices: "apólices de seguros", previdencia: "extratos de previdência privada", imoveis: "escrituras e valores de imóveis", despesas: "faturas e comprovantes de despesas", testamento: "testamento, doações e regime de bens" };
  function commitments(c, opts) {
    opts = opts || {};
    const s = c.s, out = [], ex = s.cashflow.executed, now = c.now;
    const add = (source, text, kind, value, freq, due, owner, include) => out.push({ source: source, text: text, kind: kind, value: Math.round(num(value) * 100) / 100, freq: freq, due: due || "", owner: owner || "cliente", include: !!include });
    if (ex > 0) add("aporte_apos", "Manter o aporte mensal de " + brl(ex) + " para a aposentadoria", "aporte", ex, "mensal", "", "cliente", true);
    if (c.an && isFinite(c.an.consume.X) && c.an.consume.X > 0.5) {
      add("aporte_apos_extra", "Aporte adicional de " + brl(c.an.consume.X) + "/mês para fechar a lacuna da aposentadoria (alternativas: reduzir o padrão de vida desejado ou adiar a aposentadoria)", "aporte", c.an.consume.X, "mensal", "", "cliente", false);
      add("ajuste_apos", "Ajustar o objetivo de aposentadoria: reduzir o padrão de vida, adiar a data ou combinar as duas medidas, conforme decisão da reunião", "aporte", 0, "na", "", "cliente", false);
    }
    if (c.rs.gap > 0.5) add("reserva", "Completar a reserva de contingência (faltam " + brl(c.rs.gap) + ") e mantê-la em ao menos " + num1(s.ips.reserveMonths != null ? s.ips.reserveMonths : c.rs.months) + " meses de despesas essenciais", "reserva", c.rs.gap, "unico", isoPlusMonths(now, 12), "cliente", true);
    c.liabs.filter((l) => l.cet > c.altNet).forEach((l) => add("divida:" + l.id, "Quitar ou renegociar “" + (l.label || "dívida") + "” (CET " + pct(l.cet, 1) + " a.a., saldo de " + brl(l.balance) + ")" + (s.debtPlan.extra > 0 ? " com recurso extra de " + brl(s.debtPlan.extra) + "/mês" : ""), "divida", s.debtPlan.extra, s.debtPlan.extra > 0 ? "mensal" : "na", "", "cliente", true));
    c.goals.ranked.filter((r) => r.need > 0 && !r.overdue).forEach((r) => add("meta:" + r.id, "Reservar " + brl(r.pmt) + "/mês para “" + r.label + "” até " + r.year + " (" + brl(r.amount) + " em valor de hoje)", "meta", r.pmt, "mensal", r.year + "-01-01", "cliente", r.status === "no_caminho"));
    if (c.prot.hasDependents && c.prot.death.gap > 0.5) add("protecao", "Decidir sobre a cobertura de proteção da família (lacuna estimada de " + brl(c.prot.death.gap) + " em caso de morte e " + brl(c.prot.disability.gap) + " em caso de invalidez), com profissional habilitado", "protecao", c.prot.death.gap, "unico", isoPlusMonths(now, 6), "cliente", false);
    if (c.succ.gap > 0.5) add("sucessao", "Prever o caixa para o inventário (lacuna estimada de " + brl(c.succ.gap) + "), com orientação jurídica", "sucessao", c.succ.gap, "unico", isoPlusMonths(now, 12), "cliente", false);
    const dk = s.meeting.docs, ticked = Object.keys(DOCS).filter((k) => dk[k]), missing = Object.keys(DOCS).filter((k) => !dk[k]);
    if (ticked.length && missing.length) add("docs", "Entregar os documentos que faltam: " + missing.map((k) => DOCS[k]).join("; "), "dados", 0, "na", isoPlusMonths(now, 1), "cliente", false);
    const pend = c.q.critical.pending.concat(c.q.rows.pending);
    if (pend.length) add("dados", "Entregar os dados e documentos pendentes: " + pend.slice(0, 6).join(", ") + (pend.length > 6 ? " e outros" : ""), "dados", 0, "na", isoPlusMonths(now, 1), "cliente", true);
    if (opts.taxVisited) {
      const a = I.annual({ rend: s.irpf.anual.rend, irrf: s.irpf.anual.irrf, inss: s.irpf.anual.inss, dep: Math.floor(s.irpf.anual.dep), instr: s.irpf.anual.instr, med: s.irpf.anual.med, outras: s.irpf.anual.outras, aporte: s.irpf.anual.aporte }, s.irpf.vig);
      if (a.saving > 0) add("pgbl", "Avaliar com o contador o aporte em previdência (PGBL) de até " + brl(a.aporte) + " no ano, com economia de IR estimada de " + brl(a.saving), "tributario", a.aporte, "anual", "", "cliente", false);
    }
    add("comp_resgate", "Não usar o patrimônio destinado à aposentadoria e às metas para consumo sem antes revisar o plano com o planejador", "comportamento", 0, "na", "", "cliente", true);
    add("comp_revisao", "Participar da revisão do plano a cada " + s.ips.reviewMonths + " meses e sempre que ocorrer um evento de revisão", "comportamento", 0, "na", "", "cliente", true);
    add("comp_comunicar", "Comunicar ao planejador mudanças de renda, de família ou de patrimônio em até 30 dias", "comportamento", 0, "na", "", "cliente", true);
    return out;
  }

  /* ---------- etapas da reunião ---------- */
  const STAGE_IDS = ["open", "diag", "obj", "ana", "tax", "syn", "ips"];
  function stages(s, visited) {
    visited = visited || [];
    const seen = (...t) => t.every((x) => visited.indexOf(x) !== -1);
    const done = {
      open: !!(s.client.name && s.pro.name && s.pro.scope),
      diag: s.diag.bsAssets.length > 0 && s.diag.flow.length > 0,
      obj: s.goals.some((g) => g.amount > 0 && g.year > 0),
      ana: seen("cx", "prot", "apos"),
      tax: visited.some((x) => ["irm", "ira", "pgbl"].indexOf(x) !== -1),
      syn: s.actions.length > 0,
      ips: s.ips.status === "aceito"
    };
    const list = STAGE_IDS.map((id) => ({ id: id, done: !!done[id], optional: id === "tax" }));
    const next = list.find((x) => !x.done && !x.optional);
    return { list: list, next: next ? next.id : null };
  }

  /* ---------- modelo do documento (IPS de planejamento) ---------- */
  function ipsModel(c, opts) {
    opts = opts || {};
    const s = c.s, ips = s.ips, now = c.now, pro = s.pro, p = s.profile;
    const inc = s.commitments.filter((x) => x.include);
    const when = ips.status === "aceito" && ips.acceptedOn ? ips.acceptedOn : now.toISOString().slice(0, 10);
    const next = (function () { const d = new Date(when + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + ips.reviewMonths); return d.toISOString().slice(0, 10); })();
    const cov = c.an ? c.an.consume.coverage : null, resMin = ips.reserveMonths != null ? ips.reserveMonths : c.rs.months;
    const situation = [
      { label: "Patrimônio líquido", value: brl(c.bs.net) }, { label: "Patrimônio financeiro", value: brl(c.bs.financial) },
      { label: "Superávit sustentável", value: brl(c.fl.surplus) + "/mês" }, { label: "Aporte realizado", value: brl(s.cashflow.executed) + "/mês" },
      { label: "Liquidez da reserva", value: c.rs.monthsHave == null ? "—" : num1(c.rs.monthsHave) + " meses (alvo " + num1(c.rs.months) + ")" },
      { label: "Dívidas", value: brl(c.bs.totalLiab) + " (prestações de " + brl(c.bs.serviceDebt) + "/mês)" },
      { label: "Cobertura da renda desejada na aposentadoria", value: cov == null ? "—" : pct(cov * 100) }
    ];
    const objectives = [];
    if (c.an) objectives.push({ label: "Aposentadoria aos " + p.retireAge + " anos", detail: "Padrão de vida de " + brl(s.cashflow.desiredWithdrawal) + "/mês (valores de hoje), por " + (p.horizonAge - p.retireAge) + " anos" + (s.cashflow.minLegacy > 0 ? ", deixando ao menos " + brl(s.cashflow.minLegacy) : "") + "." });
    c.goals.ranked.forEach((r) => objectives.push({ label: r.label, detail: brl(r.amount) + " em " + r.year + " (valores de hoje); prioridade " + r.priority + "." }));
    const rt = E.ratesOf(s);
    const assumptions = [
      "Retorno real de " + pct(rt.rrAcc * 100, 2) + " a.a. na acumulação e " + pct(rt.rrPost * 100, 2) + " a.a. na aposentadoria; inflação de " + pct(s.rates.inflation, 1) + " a.a.; horizonte até os " + p.horizonAge + " anos.",
      "Valores em reais de hoje. Projeções dependem das premissas e não garantem resultado futuro; o plano é revisto quando elas mudam."
    ];
    const rules = [
      { key: "cobertura", label: "Cobertura da renda desejada na aposentadoria", rule: "Revisar o plano se ficar abaixo de " + pct(ips.coverageMin) + ".", current: cov == null ? "—" : pct(cov * 100), status: cov == null ? "na" : cov * 100 >= ips.coverageMin ? "ok" : "crit" },
      { key: "reserva", label: "Reserva de contingência", rule: "Manter ao menos " + num1(resMin) + " meses de despesas essenciais; abaixo disso, suspender aportes às metas classificadas como desejo e recompor a reserva.", current: c.rs.monthsHave == null ? "—" : num1(c.rs.monthsHave) + " meses", status: c.rs.monthsHave == null ? "na" : c.rs.monthsHave >= resMin ? "ok" : "crit" },
      { key: "queda", label: "Queda do patrimônio financeiro", rule: "Se cair mais de " + pct(ips.drawdownTrigger) + " em 12 meses, reduzir gastos discricionários em " + pct(ips.spendCut) + " e antecipar a revisão do plano.", current: "Gatilho acionado só por evento", status: "na" },
      { key: "revisao", label: "Revisão do plano", rule: "A cada " + ips.reviewMonths + " meses (próxima: " + next.split("-").reverse().join("/") + ") e nos eventos: " + ips.events, current: "", status: "na" }
    ];
    const responsibilities = {
      client: ["Fornecer informações verdadeiras e atualizadas e os documentos solicitados.", "Cumprir os compromissos acima ou avisar com antecedência quando não puder.", "Comunicar os eventos de revisão.", "Decidir sobre produtos e serviços com profissionais habilitados para cada tipo de decisão."],
      planner: ["Elaborar e manter o plano com base nas informações recebidas.", "Explicar premissas, riscos e limitações das projeções.", "Reavaliar o plano nos prazos combinados e nos eventos de revisão.", "Informar a remuneração e os conflitos de interesse."]
    };
    const needs = [{ label: "Reserva de contingência", detail: "liquidez imediata de " + brl(c.rs.target) + " (" + num1(c.rs.months) + " meses de despesas essenciais)" }];
    c.goals.ranked.forEach((r) => needs.push({ label: r.label, detail: brl(r.amount) + " disponíveis em " + r.year + " (prazo de " + (r.overdue ? "vencido" : num1(r.months / 12) + " anos") + "); baixa tolerância a oscilação perto da data" }));
    if (c.an) needs.push({ label: "Aposentadoria", detail: "horizonte de " + (p.retireAge - p.currentAge) + " anos até aposentar e " + (p.horizonAge - p.retireAge) + " anos de retiradas" });
    const investment = pro.cvm === "sim"
      ? { mode: "autorizado", profileDate: ips.profileDate, profileStale: !ips.profileDate || (now - new Date(ips.profileDate + "T12:00:00Z")) / 864e5 > 730, policy: ips.investmentPolicy, tolerance: s.risk.tolerance, drawdown: s.risk.drawdown, needs: needs }
      : { mode: "cliente", tolerance: s.risk.tolerance, drawdown: s.risk.drawdown, needs: needs };
    const warnings = [];
    if (!s.client.name) warnings.push("Informe o nome do cliente (etapa Abertura).");
    if (!pro.name || !pro.scope) warnings.push("Preencha o profissional e o escopo do serviço (etapa Abertura): eles aparecem no documento.");
    if (!c.an) warnings.push("Corrija as premissas da aposentadoria.");
    if (c.q.critical.pending.length || c.q.rows.pending.length) warnings.push("Há dados pendentes: o compromisso se apoia em números não confirmados.");
    if (!inc.length) warnings.push("Nenhum compromisso foi incluído.");
    if (inc.some((x) => (x.kind === "reserva" || x.kind === "meta") && !x.due)) warnings.push("Há compromisso de reserva ou meta sem prazo.");
    if (cov != null && cov < 1 && !inc.some((x) => x.source === "aporte_apos_extra" || x.source === "ajuste_apos")) warnings.push("A cobertura da aposentadoria está abaixo de 100% e nenhuma medida para fechá-la foi incluída (aporte adicional ou ajuste do objetivo).");
    if (ips.drawdownTrigger > s.risk.drawdown && s.risk.drawdown > 0) warnings.push("O gatilho de queda do patrimônio (" + pct(ips.drawdownTrigger) + ") é maior que a queda que o cliente disse suportar (" + pct(s.risk.drawdown) + ").");
    if (pro.cvm === "sim" && investment.profileStale) warnings.push("O perfil de investidor está sem data ou com mais de 24 meses.");
    return {
      identification: { client: s.client.name, planner: pro.name, cert: pro.cert, cvm: pro.cvm, cvmNo: pro.cvmNo, date: when, reviewMonths: ips.reviewMonths, nextReview: next },
      situation: situation, objectives: objectives, assumptions: assumptions, commitments: inc, rules: rules, responsibilities: responsibilities,
      scope: { scope: pro.scope, fee: pro.fee, conflicts: pro.conflicts }, investment: investment,
      acceptance: { status: ips.status, acceptedOn: ips.acceptedOn }, warnings: warnings, disclaimer: P.disclaimer(s)
    };
  }

  return { context, areas, summary, executive, commitments, stages, ipsModel, STAGE_IDS, DOCS, isoPlusMonths };
})(
  typeof Engine !== "undefined" ? Engine : require("./engine.js"),
  typeof Planning !== "undefined" ? Planning : require("./planning.js"),
  typeof Goals !== "undefined" ? Goals : require("./goals.js"),
  typeof Debt !== "undefined" ? Debt : require("./debt.js"),
  typeof Protection !== "undefined" ? Protection : require("./protection.js"),
  typeof Succession !== "undefined" ? Succession : require("./succession.js"),
  typeof Irpf !== "undefined" ? Irpf : require("./irpf.js")
);
if (typeof module !== "undefined") module.exports = Synthesis;
/* SYNTHESIS:END */
