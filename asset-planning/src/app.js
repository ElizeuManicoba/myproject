/* APP:BEGIN */
(function () {
  "use strict";

  const KEY = "asset-planning-v2", LEGACY = "bussola-aposentadoria-v1", TABKEY = "asset-planning-tab";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ================= estado e persistência ================= */
  function loadState() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY);
      return Engine.normalizeState(raw ? JSON.parse(raw) : null);
    } catch (e) { return Engine.normalizeState(null); }
  }
  let state = loadState();
  let saveTimer = null;
  function saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      try { localStorage.removeItem(LEGACY); } catch (e) { /* ignore */ }
      $("saveIndicator").textContent = "Salvo automaticamente às " + new Date().toLocaleTimeString("pt-BR");
    } catch (e) { $("saveIndicator").textContent = "Não foi possível salvar: o armazenamento deste navegador está bloqueado."; }
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }
  let rowSeq = 1;
  function recomputeRowSeq() {
    rowSeq = 1;
    [state.extraMonthly, state.extraAnnual, state.retIncome, state.actions, state.memos, state.diag.bsAssets, state.diag.bsLiabilities, state.diag.flow, state.goals, state.phaseRows, state.taxRows].forEach((l) => l.forEach((r) => { rowSeq = Math.max(rowSeq, (r.id || 0) + 1); }));
  }
  recomputeRowSeq();

  /* ================= formatadores ================= */
  const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtBRL2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtNum2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (v) => (isFinite(v) ? fmtBRL.format(Math.round(v) + 0) : "—");
  const money2 = (v) => (isFinite(v) ? fmtBRL2.format(Math.round(v * 100) / 100 + 0) : "—");
  const pct1 = (v) => fmtNum1.format(v) + "%";
  const pct2 = (v) => fmtNum2.format(v) + "%";
  function moneyCompact(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return "R$ " + (v / 1e6).toFixed(1).replace(".", ",") + " mi";
    if (a >= 1e3) return "R$ " + Math.round(v / 1e3) + " mil";
    return money(v);
  }
  const axisMoney = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " mi" : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + " mil" : String(v));
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ================= ícones, sparkline e linha do tempo ================= */
  const ICONS = {
    clock: '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M9 5.6V9l2.3 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    wealth: '<svg viewBox="0 0 18 18" fill="none"><circle cx="6.5" cy="7" r="3.6" stroke="currentColor" stroke-width="1.4"/><circle cx="11.5" cy="10.5" r="3.6" stroke="currentColor" stroke-width="1.4"/></svg>',
    reserve: '<svg viewBox="0 0 18 18" fill="none"><circle cx="6.5" cy="7" r="3.6" stroke="currentColor" stroke-width="1.4"/><circle cx="11.5" cy="10.5" r="3.6" stroke="currentColor" stroke-width="1.4"/></svg>',
    rates: '<svg viewBox="0 0 18 18" fill="none"><path d="M3 12.5 7 8.3l2.6 2.4L15 5.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="5.2" r="1.1" fill="currentColor"/></svg>',
    cashflow: '<svg viewBox="0 0 18 18" fill="none"><path d="M3.3 6.3h9.4M12.7 6.3 10 3.8M12.7 6.3 10 8.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.7 11.7H5.3M5.3 11.7 8 9.2M5.3 11.7 8 14.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    monthly: '<svg viewBox="0 0 18 18" fill="none"><rect x="3" y="4" width="12" height="10.5" rx="1.6" stroke="currentColor" stroke-width="1.3"/><path d="M3 7.3h12" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="11" r="1.15" fill="currentColor"/></svg>',
    annual: '<svg viewBox="0 0 18 18" fill="none"><rect x="5.6" y="5.6" width="6.8" height="6.8" rx="1.2" transform="rotate(45 9 9)" stroke="currentColor" stroke-width="1.3"/></svg>',
    backup: '<svg viewBox="0 0 18 18" fill="none"><rect x="3" y="5.5" width="8.5" height="8.5" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M6.3 5.5V4a1 1 0 0 1 1-1H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    income: '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M9 6v6M6 9h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
  };
  document.querySelectorAll("[data-icon]").forEach((el) => { if (ICONS[el.dataset.icon]) el.innerHTML = ICONS[el.dataset.icon]; });

  function sparklineSVG(values, color) {
    if (!values || values.length < 2) return "";
    const w = 100, h = 28, pad = 2.5;
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const pts = values.map((v, i) => [pad + i * (w - 2 * pad) / (values.length - 1), h - pad - ((v - min) / range) * (h - 2 * pad)]);
    const line = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const last = pts[pts.length - 1];
    return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px;display:block;" aria-hidden="true">' +
      '<polygon points="0,' + h + " " + line + " " + w + "," + h + '" fill="' + color + '" opacity="0.10"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4" fill="' + color + '"/></svg>';
  }

  function timelineSVG(compact) {
    const p = state.profile;
    const maxAge = Math.max(110, p.horizonAge + 2), w = 340, h = compact ? 46 : 64, pad = 8, y = compact ? 20 : 26;
    const x = (age) => pad + (Math.max(0, age) / maxAge) * (w - 2 * pad);
    const muted = cssVar("--ink-muted"), brand = cssVar("--brand"), s1 = cssVar("--series-1"), hair = cssVar("--hairline"), surf = cssVar("--surface"), ink = cssVar("--ink");
    const seg = (a, b, c) => '<line x1="' + x(a) + '" y1="' + y + '" x2="' + x(b) + '" y2="' + y + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round"/>';
    let svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" height="' + h + '" role="img" aria-label="Linha do tempo">';
    svg += seg(0, p.currentAge, hair) + seg(p.currentAge, p.retireAge, s1) + seg(p.retireAge, p.horizonAge, brand) + seg(p.horizonAge, maxAge, hair);
    [[p.currentAge, "Hoje"], [p.retireAge, "Aposent."], [p.horizonAge, "Horizonte"]].forEach((m) => {
      svg += '<circle cx="' + x(m[0]) + '" cy="' + y + '" r="5" fill="' + surf + '" stroke="' + muted + '" stroke-width="2"/>';
      svg += '<text x="' + x(m[0]) + '" y="' + (y - 10) + '" font-size="9" text-anchor="middle" fill="' + muted + '" font-family="Public Sans, sans-serif">' + m[1] + "</text>";
      svg += '<text x="' + x(m[0]) + '" y="' + (y + 18) + '" font-size="10" font-weight="700" text-anchor="middle" fill="' + ink + '" font-family="Public Sans, sans-serif">' + esc(m[0]) + "</text>";
    });
    return svg + "</svg>";
  }

  /* ================= vínculo dos campos ================= */
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split("."); let c = o; for (let i = 0; i < ks.length - 1; i++) c = c[ks[i]]; c[ks[ks.length - 1]] = v; };
  const moneyField = (n) => fmtNum2.format(n || 0);
  const pctField = (n) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n || 0);

  function fillField(el) {
    const v = getPath(state, el.dataset.path);
    if (el.type === "checkbox") el.checked = !!v;
    else if (el.dataset.money !== undefined) el.value = v == null ? "" : moneyField(v);
    else if (el.dataset.pct !== undefined) el.value = v == null ? "" : pctField(v);
    else el.value = v == null ? "" : v;
  }
  function readField(el) {
    const d = el.dataset;
    if (el.type === "checkbox") return el.checked;
    if (d.money !== undefined) return d.nullable !== undefined && el.value.trim() === "" ? null : Engine.parseLocaleNumber(el.value);
    if (d.pct !== undefined) return d.nullable !== undefined && el.value.trim() === "" ? null : Engine.parseLocaleNumber(el.value, true);
    if (d.nullable !== undefined && el.type === "number") return el.value.trim() === "" ? null : Number(el.value);
    if (el.type === "number" || el.type === "range" || d.num !== undefined) return Number(el.value) || 0;
    return el.value;
  }

  function wireFields() {
    document.querySelectorAll("[data-path]").forEach((el) => {
      const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, () => {
        setPath(state, el.dataset.path, readField(el));
        if (el.dataset.path === "irpf.vig") document.querySelectorAll('[data-path="irpf.vig"]').forEach((s) => { s.value = state.irpf.vig; });
        if (el.id === "differentiateChk") $("postRatesRow").style.display = el.checked ? "grid" : "none";
        if (el.dataset.path === "pro.cvm") renderCards("memos");
        renderAll(); scheduleSave();
      });
      if (el.dataset.money !== undefined || el.dataset.pct !== undefined) el.addEventListener("blur", () => fillField(el));
    });
  }
  function fillAll() {
    document.querySelectorAll("[data-path]").forEach(fillField);
    $("postRatesRow").style.display = state.rates.differentiate ? "grid" : "none";
  }

  /* ================= linhas dinâmicas (rendas, extras, eventos) ================= */
  const ROW_UI = {
    retIncome: {
      box: "retIncomeTable", add: "addIncomeRow", empty: "Nenhuma renda cadastrada (INSS, previdência, aluguel…).",
      fields: [{ k: "ageFrom", l: "A partir da idade", t: "int" }, { k: "value", l: "Valor mensal (R$)", t: "money" }],
      make: () => ({ ageFrom: state.profile.retireAge, value: 0, label: "INSS" })
    },
    extraMonthly: {
      box: "extraMonthlyTable", add: "addMonthlyRow", empty: "Nenhum aporte/retirada mensal extra.",
      fields: [{ k: "ageFrom", l: "Idade inicial", t: "int" }, { k: "ageTo", l: "Idade final", t: "int" }, { k: "value", l: "Valor mensal (R$)", t: "money" }],
      make: () => ({ ageFrom: state.profile.retireAge, ageTo: state.profile.horizonAge, value: 0, label: "" })
    },
    extraAnnual: {
      box: "extraAnnualTable", add: "addAnnualRow", empty: "Nenhum evento anual ou único.",
      fields: [{ k: "age", l: "Idade", t: "int" }, { k: "ageTo", l: "Até idade (opc.)", t: "intOpt" }, { k: "value", l: "Valor (R$)", t: "money" }],
      make: () => ({ age: state.profile.retireAge, ageTo: null, value: 0, label: "" })
    }
  };

  function renderRows(name) {
    const cfg = ROW_UI[name], box = $(cfg.box);
    box.innerHTML = "";
    if (!state[name].length) { const e = document.createElement("div"); e.className = "rt-empty"; e.textContent = cfg.empty; box.appendChild(e); }
    state[name].forEach((row) => {
      const div = document.createElement("div");
      div.className = "rt-row";
      div.style.gridTemplateColumns = "repeat(" + cfg.fields.length + ", 1fr) auto";
      div.innerHTML = cfg.fields.map((f) => '<div class="mini"><label>' + esc(f.l) + '</label><input type="' + (f.t === "money" ? "text" : "number") + '" ' + (f.t === "money" ? 'inputmode="decimal" ' : "") + 'data-field="' + f.k + '" value="' + esc(f.t === "money" ? moneyField(row[f.k]) : row[f.k] == null ? "" : row[f.k]) + '"></div>').join("") +
        '<button class="rt-remove" type="button" title="Remover" aria-label="Remover">×</button>' +
        '<div class="mini label-line"><label>Descrição (opcional)</label><input type="text" maxlength="80" data-field="label" value="' + esc(row.label) + '"></div>';
      div.querySelectorAll("[data-field]").forEach((inp) => {
        const f = cfg.fields.find((x) => x.k === inp.dataset.field);
        inp.addEventListener("input", () => {
          const k = inp.dataset.field;
          if (!f) row[k] = inp.value.slice(0, 80);
          else if (f.t === "money") row[k] = Engine.parseLocaleNumber(inp.value);
          else if (f.t === "intOpt") row[k] = inp.value === "" ? null : Number(inp.value);
          else row[k] = Number(inp.value) || 0;
          renderAll(); scheduleSave();
        });
        if (f && f.t === "money") inp.addEventListener("blur", () => { inp.value = moneyField(row[f.k]); });
      });
      div.querySelector(".rt-remove").addEventListener("click", () => {
        state[name] = state[name].filter((r) => r.id !== row.id);
        renderRows(name); renderAll(); scheduleSave();
      });
      box.appendChild(div);
    });
  }
  Object.keys(ROW_UI).forEach((name) => {
    $(ROW_UI[name].add).addEventListener("click", () => { state[name].push(Object.assign({ id: rowSeq++ }, ROW_UI[name].make())); renderRows(name); renderAll(); scheduleSave(); });
  });

  /* ================= Fase 1: listas editáveis (balanço, fluxo, ações, memorandos) ================= */
  const L_LIQ = [["imediata", "Imediata"], ["curta", "Curta (até 90 dias)"], ["longa", "Longa (carência)"], ["iliquida", "Ilíquida"]];
  const L_PURPOSE = [["reserva", "Reserva"], ["aposentadoria", "Aposentadoria"], ["objetivos", "Outros objetivos"], ["uso", "Bem de uso"], ["negocio", "Negócio"], ["outro", "Outro"]];
  const L_QUALITY = [["confirmada", "Confirmada"], ["declarada", "Declarada"], ["estimada", "Estimada"], ["pendente", "Pendente"]];
  const L_KIND = [["receita", "Receita"], ["despesa", "Despesa"]];
  const L_FREQ = [["mensal", "Mensal"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]];
  const L_NATURE = [["recorrente", "Recorrente"], ["sazonal", "Sazonal"], ["extraordinaria", "Extraordinária"]];
  const L_CONTROL = [["contratual", "Contratual"], ["essencial", "Ess. variável"], ["discricionaria", "Discricionária"]];
  const L_PRIORITY = [["critica", "Crítica"], ["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]];
  const L_OWNER = [["cliente", "Cliente"], ["planejador", "Planejador"], ["especialista", "Especialista externo"]];
  const L_STATUS = [["nao_iniciada", "Não iniciada"], ["em_curso", "Em curso"], ["bloqueada", "Bloqueada"], ["concluida", "Concluída"]];
  const L_FRAME = [["planejamento", "Planejamento (sem valores mobiliários)"], ["valores_mobiliarios", "Envolve valores mobiliários"]];
  const L_GKIND = [["educacao", "Educação"], ["imovel", "Imóvel"], ["veiculo", "Veículo"], ["viagem", "Viagem"], ["familia", "Família"], ["negocio", "Negócio"], ["saude", "Saúde"], ["outro", "Outro"]];
  const L_GPRIO = [["essencial", "Essencial"], ["importante", "Importante"], ["desejo", "Desejo"]];
  const L_TAXKIND = [["pgbl", "PGBL"], ["vgbl", "VGBL"], ["tributavel", "Investimento tributável"], ["isento", "Isento de IR"]];
  const L_REGIME = [["regressivo", "Regressivo"], ["progressivo", "Progressivo"]];
  const label = (list, k) => { const f = list.find((x) => x[0] === k); return f ? f[1] : k; };
  const todayISO = () => new Date().toLocaleDateString("sv-SE");

  const CARD_UI = {
    bsAssets: {
      path: "diag.bsAssets", box: "bsAssetsRows", add: "addBsAsset", empty: "Nenhum ativo cadastrado.", table: true,
      make: () => ({ label: "", value: 0, liq: "longa", purpose: "aposentadoria", quality: "declarada" }),
      fields: [{ k: "label", l: "Descrição", t: "text" }, { k: "value", l: "Valor (R$)", t: "money", w: 124 }, { k: "liq", l: "Liquidez", t: "select", opts: L_LIQ, w: 136 }, { k: "purpose", l: "Finalidade", t: "select", opts: L_PURPOSE, w: 138 }, { k: "quality", l: "Dado", t: "select", opts: L_QUALITY, w: 112 }]
    },
    bsLiabilities: {
      path: "diag.bsLiabilities", box: "bsLiabRows", add: "addBsLiab", empty: "Nenhuma dívida cadastrada.", table: true,
      make: () => ({ label: "", balance: 0, cet: 0, payment: 0, months: 0, quality: "declarada" }),
      fields: [{ k: "label", l: "Descrição", t: "text" }, { k: "balance", l: "Saldo (R$)", t: "money", w: 116 }, { k: "cet", l: "CET % a.a.", t: "pct", w: 84 }, { k: "payment", l: "Prestação (R$)", t: "money", w: 112 }, { k: "months", l: "Meses", t: "int", w: 72 }, { k: "quality", l: "Dado", t: "select", opts: L_QUALITY, w: 112 }]
    },
    flow: {
      path: "diag.flow", box: "flowRows", add: "addFlow", empty: "Nenhum item de fluxo cadastrado.", table: true,
      make: () => ({ label: "", kind: "despesa", value: 0, freq: "mensal", nature: "recorrente", control: "essencial", quality: "declarada" }),
      fields: [{ k: "label", l: "Descrição", t: "text" }, { k: "kind", l: "Tipo", t: "select", opts: L_KIND, w: 86 }, { k: "value", l: "Valor (R$)", t: "money", w: 100 }, { k: "freq", l: "Periodic.", t: "select", opts: L_FREQ, w: 100 }, { k: "nature", l: "Natureza", t: "select", opts: L_NATURE, w: 120 }, { k: "control", l: "Controle", t: "select", opts: L_CONTROL, w: 120 }, { k: "quality", l: "Dado", t: "select", opts: L_QUALITY, w: 112 }]
    },
    goals: {
      path: "goals", box: "goalRows", add: "addGoal", empty: "Nenhuma meta cadastrada.", table: true,
      make: () => ({ label: "", kind: "outro", amount: 0, year: new Date().getFullYear() + 3, priority: "importante", saved: 0, rate: null }),
      fields: [{ k: "label", l: "Meta", t: "text" }, { k: "kind", l: "Tipo", t: "select", opts: L_GKIND, w: 106 }, { k: "amount", l: "Valor (R$)", t: "money", w: 108 }, { k: "year", l: "Ano", t: "int", w: 68 }, { k: "priority", l: "Prioridade", t: "select", opts: L_GPRIO, w: 108 }, { k: "saved", l: "Reservado (R$)", t: "money", w: 108 }, { k: "rate", l: "Retorno %", t: "pctOpt", w: 80 }]
    },
    phaseRows: {
      path: "phaseRows", box: "phaseRows", add: "addPhase", empty: "Nenhuma fase cadastrada.", table: true,
      make: () => ({ ageFrom: state.profile.retireAge + 10, pct: 85, health: 0, label: "" }),
      fields: [{ k: "label", l: "Fase", t: "text" }, { k: "ageFrom", l: "A partir da idade", t: "int", w: 96 }, { k: "pct", l: "% do gasto desejado", t: "pct", w: 108 }, { k: "health", l: "Saúde extra (R$/mês)", t: "money", w: 120 }]
    },
    taxRows: {
      path: "taxRows", box: "taxRows", add: "addTax", empty: "Nenhuma linha cadastrada. Use “Preencher a partir do Diagnóstico” ou adicione manualmente.", table: true,
      make: () => ({ label: "", kind: "tributavel", value: 0, gainPct: 50, regime: "regressivo", years: 10, monthly: 0 }),
      fields: [{ k: "label", l: "Descrição", t: "text" }, { k: "kind", l: "Tipo", t: "select", opts: L_TAXKIND, w: 140 }, { k: "value", l: "Valor (R$)", t: "money", w: 108 }, { k: "gainPct", l: "% ganho", t: "pct", w: 72 }, { k: "regime", l: "Regime", t: "select", opts: L_REGIME, w: 108 }, { k: "years", l: "Anos", t: "int", w: 60 }, { k: "monthly", l: "Saque/mês (prog.)", t: "money", w: 112 }]
    },
    actions: {
      path: "actions", box: "actionRows", add: "addAction", empty: "Nenhuma ação no plano. Use as sugestões acima ou adicione a primeira.",
      make: () => ({ title: "", priority: "media", owner: "cliente", dep: "", due: "", cost: "", evidence: "", status: "nao_iniciada", next: "", source: "" }),
      fields: [{ k: "title", l: "Ação", t: "text", span: 5, max: 160 }, { k: "priority", l: "Prioridade", t: "select", opts: L_PRIORITY, span: 2 }, { k: "owner", l: "Responsável", t: "select", opts: L_OWNER, span: 2 }, { k: "due", l: "Prazo", t: "date", span: 3 }, { k: "status", l: "Status", t: "select", opts: L_STATUS, span: 3 }, { k: "next", l: "Próximo passo", t: "text", span: 9, max: 400 }, { k: "dep", l: "Dependência", t: "text", span: 4, max: 300 }, { k: "cost", l: "Custo", t: "text", span: 3, max: 200 }, { k: "evidence", l: "Evidência (documento, extrato, protocolo)", t: "textarea", span: 5, max: 2000 }],
      cls: (r) => (r.status === "concluida" ? "done" : r.due && r.due < todayISO() ? "overdue" : ""),
      extra: (r) => (r.status !== "concluida" && r.due && r.due < todayISO() ? '<div class="extra" style="color:var(--status-critical);font-weight:600">Prazo vencido.</div>' : "")
    },
    memos: {
      path: "memos", box: "memoRows", add: "addMemo", empty: "Nenhum memorando registrado.",
      make: () => ({ title: "", frame: "planejamento", problem: "", evidence: "", alternatives: "", chosen: "", assumptions: "", risks: "", inaction: "", owner: "", review: "", actionId: 0 }),
      fields: [{ k: "title", l: "Decisão", t: "text", span: 8, max: 160 }, { k: "frame", l: "Enquadramento", t: "select", opts: L_FRAME, span: 4, rerender: true }, { k: "problem", l: "Qual problema resolve?", t: "textarea", span: 12 }, { k: "evidence", l: "Que evidência sustenta o diagnóstico?", t: "textarea", span: 12 }, { k: "alternatives", l: "Alternativas avaliadas", t: "textarea", span: 12 }, { k: "chosen", l: "Alternativa escolhida e por quê", t: "textarea", span: 12 }, { k: "assumptions", l: "Premissas críticas", t: "textarea", span: 12 }, { k: "risks", l: "Riscos, custos, impostos e conflitos", t: "textarea", span: 12 }, { k: "inaction", l: "O que acontece se nada for feito?", t: "textarea", span: 12 }, { k: "owner", l: "Quem implementa e como será verificado", t: "text", span: 6, max: 300 }, { k: "review", l: "Quando será revisada", t: "text", span: 6, max: 200 }],
      extra: (r) => {
        if (r.frame !== "valores_mobiliarios") return "";
        return state.pro.cvm === "sim"
          ? '<div class="extra banner warn" style="margin:0"><b>Envolve valores mobiliários.</b> Registre suitability, custos, conflitos e as regras aplicáveis à sua autorização de consultor.</div>'
          : '<div class="extra banner err" style="margin:0"><b>Atenção:</b> seu perfil indica que você <b>não possui</b> autorização de consultor de valores mobiliários da CVM. Recomendação individualizada de valores mobiliários não deve ser feita neste memorando. Reescreva como planejamento ou encaminhe a um profissional autorizado.</div>';
      }
    }
  };

  function inputHTML(f, row) {
    const v = row[f.k], k = f.k, aria = ' aria-label="' + esc(f.l) + '"';
    if (f.t === "select") return '<select data-field="' + k + '"' + aria + ">" + f.opts.map((o) => '<option value="' + o[0] + '"' + (v === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
    if (f.t === "textarea") return '<textarea data-field="' + k + '"' + aria + ' maxlength="' + (f.max || 2000) + '">' + esc(v) + "</textarea>";
    if (f.t === "money") return '<input type="text" inputmode="decimal" data-field="' + k + '"' + aria + ' style="text-align:right" value="' + esc(moneyField(v)) + '">';
    if (f.t === "pct") return '<input type="text" inputmode="decimal" data-field="' + k + '"' + aria + ' style="text-align:right" value="' + esc(pctField(v)) + '">';
    if (f.t === "pctOpt") return '<input type="text" inputmode="decimal" data-field="' + k + '"' + aria + ' style="text-align:right" placeholder="padrão" value="' + esc(v == null ? "" : pctField(v)) + '">';
    if (f.t === "int") return '<input type="number" data-field="' + k + '"' + aria + ' style="text-align:right" value="' + esc(v == null ? "" : v) + '">';
    if (f.t === "date") return '<input type="date" data-field="' + k + '"' + aria + ' value="' + esc(v || "") + '">';
    return '<input type="text" maxlength="' + (f.max || 160) + '" data-field="' + k + '"' + aria + ' value="' + esc(v) + '" autocomplete="off">';
  }
  const fieldHTML = (f, row) => '<div class="mini" style="grid-column:span ' + (f.span || 12) + '"><label>' + esc(f.l) + "</label>" + inputHTML(f, row) + "</div>";

  function wireRow(el, cfg, name, row) {
    el.querySelectorAll("[data-field]").forEach((inp) => {
      const f = cfg.fields.find((x) => x.k === inp.dataset.field);
      inp.addEventListener(inp.tagName === "SELECT" || inp.type === "date" ? "change" : "input", () => {
        let v = inp.value;
        if (f.t === "money") v = Engine.parseLocaleNumber(inp.value);
        else if (f.t === "pct") v = Engine.parseLocaleNumber(inp.value, true);
        else if (f.t === "pctOpt") v = inp.value.trim() === "" ? null : Engine.parseLocaleNumber(inp.value, true);
        else if (f.t === "int") v = Number(inp.value) || 0;
        row[f.k] = v;
        if (f.rerender || f.k === "status" || f.k === "due") renderCards(name);
        renderAll(); scheduleSave();
      });
      if (f.t === "money") inp.addEventListener("blur", () => { inp.value = moneyField(row[f.k]); });
      if (f.t === "pct") inp.addEventListener("blur", () => { inp.value = pctField(row[f.k]); });
      if (f.t === "pctOpt") inp.addEventListener("blur", () => { inp.value = row[f.k] == null ? "" : pctField(row[f.k]); });
    });
    el.querySelector(".rm").addEventListener("click", () => { setPath(state, cfg.path, getPath(state, cfg.path).filter((r) => r.id !== row.id)); renderCards(name); renderAll(); scheduleSave(); });
  }

  function renderCards(name) {
    const cfg = CARD_UI[name], box = $(cfg.box), list = getPath(state, cfg.path);
    box.innerHTML = "";
    if (!list.length) { const e = document.createElement("div"); e.className = "erow-empty"; e.textContent = cfg.empty; box.appendChild(e); return; }
    if (cfg.table) {
      const wrap = document.createElement("div"); wrap.className = "table-scroll";
      wrap.innerHTML = '<table class="etable"><thead><tr>' + cfg.fields.map((f) => "<th" + (f.w ? ' style="width:' + f.w + 'px"' : "") + ">" + esc(f.l) + "</th>").join("") + '<th style="width:34px"></th></tr></thead><tbody></tbody></table>';
      const tb = wrap.querySelector("tbody");
      list.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = cfg.fields.map((f) => "<td>" + inputHTML(f, row) + "</td>").join("") + '<td><button class="rm" type="button" title="Remover" aria-label="Remover">×</button></td>';
        wireRow(tr, cfg, name, row); tb.appendChild(tr);
      });
      box.appendChild(wrap); return;
    }
    list.forEach((row) => {
      const div = document.createElement("div");
      div.className = "erow" + (cfg.cls && cfg.cls(row) ? " " + cfg.cls(row) : "");
      div.innerHTML = cfg.fields.map((f) => fieldHTML(f, row)).join("") + '<button class="rm" type="button" title="Remover" aria-label="Remover">×</button>' + (cfg.extra ? cfg.extra(row) : "");
      wireRow(div, cfg, name, row); box.appendChild(div);
    });
  }
  function addCard(name, extra) {
    const cfg = CARD_UI[name];
    getPath(state, cfg.path).push(Object.assign({ id: rowSeq++ }, cfg.make(), extra || {}));
    renderCards(name); renderAll(); scheduleSave();
  }
  Object.keys(CARD_UI).forEach((name) => { $(CARD_UI[name].add).addEventListener("click", () => addCard(name)); });

  /* ================= blocos reutilizáveis ================= */
  const tileHTML = (lab, value, sub, cls) => '<div class="stat-tile"><div class="tile-head"><div class="label">' + lab + '</div></div><div class="value ' + (cls || "") + '">' + value + '</div><div class="sub">' + sub + "</div></div>";
  function stackBar(items) {
    const tot = items.reduce((t, i) => t + Math.max(0, i.value), 0) || 1;
    return '<div class="stack">' + items.map((i) => '<span title="' + esc(i.label) + ": " + money(i.value) + '" style="width:' + Math.max(0, i.value) / tot * 100 + "%;background:" + i.color + '"></span>').join("") + '</div><div class="stack-legend">' + items.map((i) => '<span class="li"><span class="sw" style="background:' + i.color + '"></span>' + esc(i.label) + ' <b style="color:var(--ink)">' + money(i.value) + "</b></span>").join("") + "</div>";
  }
  const fmtD = (v, d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

  function renderDisclaimers() {
    const d = Planning.disclaimer(state);
    const html = '<div class="disclaimer"><b>Aviso.</b> ' + d.lines.map(esc).join(" ") + (d.filled ? "" : '<div class="banner warn no-pdf" style="margin:8px 0 0">Identificação incompleta: preencha em <b>Plano de ação → Profissional e escopo</b>.</div>') + "</div>";
    document.querySelectorAll(".disclaimer-slot").forEach((el) => { el.innerHTML = html; });
  }

  /* ================= Aposentadoria: qualidade dos dados e estresses ================= */
  function renderQualityBanner() {
    const c = Planning.quality(state).critical;
    let html = "";
    if (c.pending.length) html += '<div class="banner warn"><b>Dados críticos pendentes:</b> ' + esc(c.pending.join(", ")) + ". Os resultados abaixo dependem da confirmação.</div>";
    html += '<div class="banner info"><b>Qualidade dos dados críticos:</b> ' + c.confirmed + " de " + c.total + " confirmados" + (c.estimated.length ? "; estimados: " + esc(c.estimated.join(", ")) : "") + ". Detalhes na aba Diagnóstico.</div>";
    $("qualityBanner").innerHTML = html;
  }

  function stressText(p) {
    const sg = (v) => (v > 0 ? "+" : "−") + fmtNum1.format(Math.abs(v));
    const parts = [];
    if (p.dRet) parts.push("retorno real " + sg(p.dRet) + " p.p.");
    if (p.dAporte) parts.push("aporte " + sg(p.dAporte) + "%");
    if (p.dGasto) parts.push("gasto desejado " + sg(p.dGasto) + "%");
    if (p.shock) parts.push("queda de " + fmtNum1.format(p.shock) + "% no patrimônio ao aposentar");
    if (p.custo) parts.push("custo extraordinário de " + money(p.custo) + " aos " + p.custoIdade + " anos");
    if (p.dHor) parts.push("horizonte " + (p.dHor > 0 ? "+" : "−") + Math.abs(p.dHor) + " anos");
    return parts.length ? parts.join("; ") : "Premissas informadas";
  }
  const STRESS_ROWS = [["base", "Base", "O plano fecha nas premissas principais?"], ["cons", "Conservador", "Quanto precisa mudar para permanecer viável?"], ["crise", "Crise inicial", "O gasto e a liquidez aguentam um mau começo?"], ["long", "Longevidade", "A renda dura até uma idade avançada?"], ["flex", "Flexível", "Qual ajuste evita a ruptura?"]];
  const ZERO_STRESS = { dRet: 0, dAporte: 0, dGasto: 0, shock: 0, custo: 0, custoIdade: 70, dHor: 0 };
  function renderStress() {
    const rows = STRESS_ROWS.map(([k, name, q]) => {
      const p = k === "base" ? ZERO_STRESS : state.stress[k], r = Engine.stress(state, p);
      const cov = r.coverage == null ? "—" : Math.round(r.coverage * 100) + "%", w = r.coverage == null ? 0 : Math.min(100, r.coverage * 100) * 0.4;
      const bg = r.coverage == null || r.coverage >= 1 ? "" : r.coverage >= 0.8 ? "background:var(--status-warning);" : "background:var(--status-critical);";
      return '<tr class="' + (k === "base" ? "base" : "") + '"><td class="wrap"><b>' + name + '</b></td><td class="wrap">' + esc(stressText(p)) + '</td><td><div class="cell-bar"><span class="sbar" style="' + bg + "width:" + w + 'px"></span>' + cov + "</div></td>" +
        "<td>" + (r.exhaustAge == null ? "Não esgota até " + r.horizon : r.exhaustAge + " anos") + "</td><td>" + (isFinite(r.X) ? money(r.X) + "/mês" : "Inviável") + "</td><td>" + (r.cut == null ? "—" : r.cut > 0 ? pct1(r.cut * 100) : "Nenhum") + '</td><td class="wrap">' + q + "</td></tr>";
    }).join("");
    $("stressSection").innerHTML = "<h4>Testes de estresse determinísticos</h4>" +
      '<p class="lead">Cada linha altera <b>uma coisa de cada vez</b> no plano atual, na estratégia de consumir a reserva. A cobertura diz quanto do padrão de vida desejado o patrimônio sustenta; o corte de gasto é o ajuste que fecharia o plano naquele cenário. Os parâmetros são ilustrativos e editáveis (lateral, “Cenários de estresse”).</p>' +
      '<div class="table-scroll"><table class="sens"><thead><tr><th class="wrap">Cenário</th><th class="wrap">O que muda</th><th>Cobertura</th><th>Reserva se esgota</th><th>Aporte adicional</th><th>Corte de gasto p/ fechar</th><th class="wrap">Pergunta respondida</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="ledger-note">Não é uma simulação probabilística: mostra caminhos específicos e transparentes. Retorno constante; ' + (state.retTax.on ? 'IR efetivo sobre os saques conforme a seção “IR sobre o resgate”.' : 'sem tributação sobre resgates.') + '</div>';
  }

  /* ================= ABA · DIAGNÓSTICO ================= */
  function indCardHTML(i) {
    const chip = { ok: ["good", "Dentro da faixa", "status-good"], warn: ["warning", "Atenção", "status-warning"], crit: ["critical", "Fora da faixa", "status-critical"], na: ["neutral", "Sem dado", "ink-muted"] }[i.status];
    const val = i.value == null ? "—" : fmtD(i.value, i.dec);
    const scale = Math.max(i.target * 1.6, (i.value || 0) * 1.05, 1e-9), fill = i.value == null ? 0 : Math.min(100, Math.max(0, i.value) / scale * 100), tick = Math.min(100, i.target / scale * 100);
    return '<div class="ind-card"><div class="ih"><span>' + esc(i.label) + '</span><span class="badge ' + chip[0] + '">' + chip[1] + "</span></div>" +
      '<div class="iv">' + val + "<small>" + (i.unit === "%" ? "%" : "meses") + "</small></div>" +
      '<div class="ind-track"><div class="ind-fill" style="width:' + fill + "%;background:var(--" + chip[2] + ')"></div><div class="ind-tick" style="left:' + tick + '%"></div></div>' +
      '<div class="ind-meta">' + (i.dir === "min" ? "Faixa de atenção: ≥ " : "Faixa de atenção: ≤ ") + fmtD(i.target, i.dec === 0 ? 0 : 1) + (i.unit === "%" ? "%" : " meses") + (i.detail && i.status !== "ok" ? " · maior linha: " + esc(i.detail) : "") + "</div>" +
      "<details><summary>Como ler</summary><div style=\"margin-top:4px\"><b>" + esc(i.formula) + "</b>. " + esc(i.read) + "</div></details></div>";
  }

  function renderSync(bs, fl) {
    const patch = Planning.syncPatch(state);
    const cur = { liquid: state.assets.liquid, illiquid: state.assets.illiquid, debts: state.assets.debts, income: state.cashflow.income, expense: state.cashflow.expense };
    const empty = !state.diag.bsAssets.length && !state.diag.bsLiabilities.length && !state.diag.flow.length;
    const rows = [["liquid", "Recursos financeiros (capital da aposentadoria)"], ["illiquid", "Patrimônio imobilizado"], ["debts", "Dívidas"], ["income", "Receita mensal recorrente"], ["expense", "Despesa mensal (inclui prestações)"]];
    $("syncBox").innerHTML = '<div class="table-scroll" style="margin-top:8px"><table class="cmp"><thead><tr><th>Campo</th><th>No diagnóstico</th><th>Hoje na Aposentadoria</th><th>Diferença</th></tr></thead><tbody>' +
      rows.map(([k, l]) => { const d = patch[k] - cur[k]; return "<tr><td>" + l + "</td><td>" + money(patch[k]) + "</td><td>" + money(cur[k]) + "</td><td>" + (Math.abs(d) < 0.5 ? "—" : (d > 0 ? "+" : "−") + money(Math.abs(d))) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="actions" style="margin-top:12px"><button class="btn" id="btnSync" type="button"' + (empty ? " disabled" : "") + '>Usar na Aposentadoria</button><span class="toast" id="syncToast">' + (empty ? "Cadastre ao menos um item para sincronizar." : "") + "</span></div>";
    if (!empty) armed($("btnSync"), "Clique de novo: substituir os campos", () => {
      state.assets.liquid = patch.liquid; state.assets.illiquid = patch.illiquid; state.assets.debts = patch.debts; state.cashflow.income = patch.income; state.cashflow.expense = patch.expense;
      fillAll(); renderAll(); saveNow(); $("syncToast").textContent = "Dados levados para a aba Aposentadoria.";
    });
  }

  function renderDiag() {
    const bs = Planning.balanco(state), fl = Planning.fluxo(state, bs), rs = Planning.reserva(state, fl, bs);
    const v = Engine.validate(state), an = v.errors.length ? null : Engine.analyze(state, 0);
    const ind = Planning.indicadores(state, bs, fl, rs, an), q = Planning.quality(state);
    const s1 = cssVar("--series-1"), s2 = cssVar("--series-2"), s3 = cssVar("--series-3"), grey = cssVar("--grey-line");
    $("diagBanner").innerHTML = (q.critical.pending.length || q.rows.pending.length) ? '<div class="banner warn"><b>Há dados pendentes:</b> ' + esc(q.critical.pending.concat(q.rows.pending).join(", ")) + ". Confirme antes de apresentar o diagnóstico.</div>" : "";

    $("diagKpis").innerHTML =
      tileHTML("Patrimônio líquido", money(bs.net), "Ativos " + money(bs.totalAssets) + " · passivos " + money(bs.totalLiab)) +
      tileHTML("Patrimônio financeiro", money(bs.financial), "Para a aposentadoria: " + money(bs.retirementFin)) +
      tileHTML("Superávit sustentável", money(fl.surplus) + "/mês", fl.incomeRec > 0 ? pct1(fl.surplus / fl.incomeRec * 100) + " da renda recorrente" : "Sem renda recorrente", fl.surplus < 0 ? "neg" : "") +
      tileHTML("Meses de liquidez", rs.monthsHave == null ? "—" : fmtD(rs.monthsHave, 1), "Alvo: " + fmtD(rs.months, 1) + " meses");

    const purposeNames = { reserva: "Reserva", aposentadoria: "Aposentadoria", objetivos: "Outros objetivos", uso: "Bens de uso", negocio: "Negócio", outro: "Outro" };
    const purposeItems = Object.keys(bs.byPurpose).filter((k) => bs.byPurpose[k] > 0).map((k) => ({ label: purposeNames[k], value: bs.byPurpose[k], color: s1 }));
    $("bsResult").innerHTML =
      '<div class="kpi-row" style="margin-bottom:14px">' + tileHTML("Patrimônio total", money(bs.net), "Ativos − passivos") + tileHTML("Patrimônio financeiro", money(bs.financial), "Exclui bens ilíquidos") + tileHTML("Líquido disponível", money(bs.available), "Liquidez imediata e curta − dívidas dos próximos 12 meses") + tileHTML("Para a aposentadoria", money(bs.retirementFin), "Ativos financeiros com essa finalidade") + "</div>" +
      '<div class="two-col"><div class="panel"><h3>Por liquidez</h3>' + stackBar([{ label: "Imediata", value: bs.byLiq.imediata, color: s1 }, { label: "Curta", value: bs.byLiq.curta, color: s3 }, { label: "Longa", value: bs.byLiq.longa, color: s2 }, { label: "Ilíquida", value: bs.byLiq.iliquida, color: grey }]) + "</div>" +
      '<div class="panel"><h3>Por finalidade</h3>' + (purposeItems.length ? miniBarPanelHTML("", purposeItems) : '<div class="empty-note">Sem ativos cadastrados.</div>') + "</div></div>";

    const share = (x) => (fl.incomeRec > 0 ? " <small>(" + pct1(x / fl.incomeRec * 100) + ")</small>" : "");
    const exec = state.cashflow.executed;
    const gap = fl.surplus - exec;
    const alignMsg = Math.abs(gap) < 1 ? "Aporte e superávit estão alinhados." : gap > 0 ? "Há " + money(gap) + "/mês de superávit que não está direcionado a aporte." : "O aporte realizado supera o superávit em " + money(-gap) + "/mês: confirme a origem do recurso.";
    $("flowResult").innerHTML = '<div class="two-col"><div class="panel"><h3>Fluxo mensal normalizado</h3>' +
      irRow("Receitas recorrentes", money(fl.incomeRec)) + irRow("Despesas contratuais" + share(fl.contractual), money(fl.contractual)) + irRow("Despesas essenciais variáveis" + share(fl.essential), money(fl.essential)) + irRow("Despesas discricionárias" + share(fl.discretionary), money(fl.discretionary)) + irRow("Serviço da dívida" + share(fl.debt), money(fl.debt)) +
      irRow("Superávit sustentável", money(fl.surplus), "total " + (fl.surplus < 0 ? "bad" : "good")) +
      (fl.incomeExtra || fl.expenseExtra ? '<div class="ind-meta" style="margin-top:8px">Fora do superávit (extraordinários): receitas ' + money(fl.incomeExtra) + "/mês, despesas " + money(fl.expenseExtra) + "/mês em média.</div>" : "") + "</div>" +
      '<div class="panel"><h3>Para onde vai a renda</h3>' + stackBar([{ label: "Rígidas (contratuais + dívida)", value: fl.contractual + fl.debt, color: s1 }, { label: "Essenciais variáveis", value: fl.essential, color: s3 }, { label: "Discricionárias", value: fl.discretionary, color: s2 }, { label: "Superávit", value: Math.max(0, fl.surplus), color: grey }]) +
      '<div class="ind-meta" style="margin-top:12px">Parcela rígida: <b>' + (fl.rigidShare == null ? "—" : pct1(fl.rigidShare)) + "</b> da renda. Parcela ajustável: <b>" + (fl.incomeRec > 0 ? pct1(fl.adjustable / fl.incomeRec * 100) : "—") + "</b>.<br>Aporte realizado " + money(exec) + "/mês contra superávit de " + money(fl.surplus) + "/mês. " + alignMsg + "</div></div></div>";

    const RISK_LABEL = { variable: "renda variável", single: "único provedor", dependents: "dependentes", health: "saúde", lowEmploy: "recolocação difícil" };
    const risks = Object.keys(Planning.RESERVE_ADD).filter((k) => state.diag.risk[k]);
    $("monthsHint").textContent = "Em branco: usa o valor calculado (" + fmtD(rs.computedMonths, 1) + " meses).";
    $("reserveResult").innerHTML = '<div class="result-card"><h3>Reserva de contingência</h3>' +
      irRow("Meses calculados <small>(3 de base" + (risks.length ? " + fatores de risco" : "") + ")</small>", fmtD(rs.computedMonths, 1)) + irRow("Meses utilizados" + (state.diag.monthsOverride != null ? " <small>(ajuste manual)</small>" : ""), fmtD(rs.months, 1)) +
      irRow("Despesa essencial mensal <small>(contratual + essencial variável + dívida)</small>", money(fl.essentialMonthly)) + irRow("Reserva-alvo", money(rs.target)) + irRow("Liquidez imediata atual", money(rs.have) + (rs.monthsHave == null ? "" : " <small>(" + fmtD(rs.monthsHave, 1) + " meses)</small>")) +
      (rs.gap > 0 ? irRow("Falta para o alvo", money(rs.gap), "total bad") : irRow("Folga sobre o alvo", money(rs.surplus), "total good")) +
      '<div class="ind-meta" style="margin-top:8px">Fatores de risco considerados: ' + (risks.length ? risks.map((k) => RISK_LABEL[k]).join(", ") : "nenhum") + (state.diag.shocks ? " · choques previsíveis " + money(state.diag.shocks) : "") + ". Os acréscimos de meses são uma heurística deste sistema, não um padrão.</div></div>";

    $("indGrid").innerHTML = ind.map(indCardHTML).join("");

    const rowsTxt = q.rows.total ? q.rows.confirmed + " de " + q.rows.total + " linhas confirmadas (" + Math.round(q.rows.pct) + "%)" : "Nenhuma linha cadastrada";
    $("qualitySummary").innerHTML = '<div class="banner ' + (q.critical.pending.length ? "warn" : "info") + '" style="margin:6px 0 0"><b>' + q.critical.confirmed + " de " + q.critical.total + " dados críticos confirmados</b>" + (q.critical.pct != null ? " (" + Math.round(q.critical.pct) + "%)" : "") + ". Balanço e fluxo: " + rowsTxt + "." +
      (q.critical.estimated.concat(q.rows.estimated).length ? "<br>Estimados: " + esc(q.critical.estimated.concat(q.rows.estimated).join(", ")) + "." : "") + (q.critical.pending.concat(q.rows.pending).length ? "<br>Pendentes: " + esc(q.critical.pending.concat(q.rows.pending).join(", ")) + "." : "") + "</div>";
    renderSync(bs, fl);
  }

  /* ================= ABA · PLANO DE AÇÃO ================= */
  const PRIO_RANK = { critica: 0, alta: 1, media: 2, baixa: 3 };
  const PRIO_BADGE = { critica: "critical", alta: "warning", media: "neutral", baixa: "neutral" };
  function renderPlan() {
    const t = todayISO(), open = state.actions.filter((a) => a.status !== "concluida");
    const overdue = open.filter((a) => a.due && a.due < t), blocked = open.filter((a) => a.status === "bloqueada"), done = state.actions.filter((a) => a.status === "concluida");
    $("planKpis").innerHTML = tileHTML("Ações abertas", open.length, open.filter((a) => a.status === "em_curso").length + " em curso") + tileHTML("Prazo vencido", overdue.length, "Abertas com prazo anterior a hoje", overdue.length ? "neg" : "") + tileHTML("Bloqueadas", blocked.length, "Dependem de documento, liquidez ou decisão") + tileHTML("Concluídas", done.length, state.actions.length ? Math.round(done.length / state.actions.length * 100) + "% do plano" : "Sem ações cadastradas");

    const sorted = open.slice().sort((a, b) => (PRIO_RANK[a.priority] - PRIO_RANK[b.priority]) || ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0) || a.id - b.id).slice(0, 3);
    $("top3").innerHTML = sorted.length ? '<div class="top3">' + sorted.map((a, i) => '<div class="t"><div class="n">' + (i + 1) + '</div><div><div class="tt">' + esc(a.title || "(sem título)") + '</div><div class="tm">' + label(L_OWNER, a.owner) + " · " + (a.due ? "prazo " + a.due.split("-").reverse().join("/") : "sem prazo") + " · " + label(L_STATUS, a.status) + (a.next ? " · próximo passo: " + esc(a.next) : "") + '</div></div><span class="badge ' + PRIO_BADGE[a.priority] + '">' + label(L_PRIORITY, a.priority) + "</span></div>").join("") + "</div>" : '<div class="empty-note">Nenhuma ação aberta. Adicione ações abaixo ou use as sugestões do sistema.</div>';

    const bs = Planning.balanco(state), fl = Planning.fluxo(state, bs), rs = Planning.reserva(state, fl, bs);
    const v = Engine.validate(state), an = v.errors.length ? null : Engine.analyze(state, 0);
    const ind = Planning.indicadores(state, bs, fl, rs, an), q = Planning.quality(state);
    const gl = Goals.analyze(state, fl, bs, new Date(), an), pr = Protection.analyze(state, { fl, bs, goals: gl }), tauEst = state.taxRows.length ? taxOf().tau : null, sc = Succession.analyze(state, { bs });
    const sug = Planning.suggestions(state, { an, bs, fl, rs, ind, quality: q, goals: gl, protection: pr, succession: sc, tauEst, stress: an ? { crise: Engine.stress(state, state.stress.crise) } : {} }).filter((s) => !state.actions.some((a) => a.source === s.key));
    $("suggestBox").innerHTML = sug.length ? '<div class="sug-box">' + sug.map((s) => '<div class="sug"><div><div class="st">' + esc(s.title) + ' <span class="badge ' + PRIO_BADGE[s.priority] + '">' + label(L_PRIORITY, s.priority) + '</span></div><div class="se">' + esc(s.evidence) + '</div><div class="sn">Próximo passo: ' + esc(s.next) + '</div></div><button class="btn ghost" type="button" data-sug="' + s.key + '">Adicionar ao plano</button></div>').join("") + "</div>" : '<div class="empty-note">Nenhuma sugestão pendente: os indicadores atuais não apontam novas ações, ou as sugestões já foram adicionadas.</div>';
    $("suggestBox").querySelectorAll("[data-sug]").forEach((btn) => btn.addEventListener("click", () => {
      const s = sug.find((x) => x.key === btn.dataset.sug); if (!s) return;
      addCard("actions", { title: s.title, priority: s.priority, owner: s.owner, evidence: s.evidence, next: s.next, source: s.key });
    }));
  }
  $("addMemoRet").addEventListener("click", () => {
    const v = Engine.validate(state);
    if (v.errors.length) { $("memoToast").textContent = "Corrija as premissas da Aposentadoria antes de gerar o rascunho."; return; }
    addCard("memos", Planning.draftRetirementMemo(state));
    $("memoToast").textContent = "Rascunho criado: revise, escolha a alternativa e registre a decisão.";
  });

  /* ================= gráficos (Chart.js) ================= */
  const charts = { donut: null, main: null, ira: null, pgbl: null, goals: null, debt: null, phase: null, mc: null, seq: null };
  function mount(name, canvasId, cfg) {
    if (charts[name]) charts[name].destroy();
    charts[name] = new Chart($(canvasId).getContext("2d"), cfg);
  }
  Chart.register({
    id: "retirementLine",
    afterDatasetsDraw(chart) {
      const o = chart.config.options.plugins.retirementLine; if (!o || !chart.scales.x) return;
      const idx = chart.data.labels.indexOf(o.age); if (idx === -1) return;
      const x = chart.scales.x.getPixelForValue(idx), a = chart.chartArea, c = chart.ctx;
      c.save(); c.strokeStyle = o.color; c.setLineDash([4, 4]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, a.top); c.lineTo(x, a.bottom); c.stroke(); c.setLineDash([]);
      c.fillStyle = o.color; c.font = "600 10.5px 'Public Sans', sans-serif"; c.textAlign = "left"; c.fillText(o.label, x + 6, a.bottom - 8); c.restore();
    }
  });
  Chart.register({
    id: "phaseZone",
    beforeDraw(chart) {
      const o = chart.config.options.plugins.phaseZone; if (!o || !chart.scales.x) return;
      const idx = chart.data.labels.indexOf(o.retireAge); if (idx === -1) return;
      const xs = chart.scales.x.getPixelForValue(idx), a = chart.chartArea, c = chart.ctx;
      c.save(); c.fillStyle = o.accColor; c.fillRect(a.left, a.top, xs - a.left, a.bottom - a.top);
      c.fillStyle = o.retColor; c.fillRect(xs, a.top, a.right - xs, a.bottom - a.top); c.restore();
    }
  });
  Chart.register({
    id: "valueLabels",
    afterDatasetsDraw(chart) {
      if (!chart.config.options.plugins.valueLabels) return;
      const c = chart.ctx; c.save(); c.fillStyle = cssVar("--ink"); c.font = "600 11px 'Public Sans', sans-serif"; c.textAlign = "center";
      chart.getDatasetMeta(0).data.forEach((bar, i) => { c.fillText(money(chart.data.datasets[0].data[i]), bar.x, bar.y - 6); });
      c.restore();
    }
  });
  const vGradient = (ctx, area, top) => { if (!area) return top; const g = ctx.createLinearGradient(0, area.top, 0, area.bottom); g.addColorStop(0, top); g.addColorStop(1, "transparent"); return g; };
  const axisStyle = () => ({ ticks: { color: cssVar("--ink-secondary"), font: { size: 10.5 } }, grid: { color: cssVar("--hairline"), drawTicks: false } });

  /* ================= ABA 1 · APOSENTADORIA ================= */
  function renderBanners(v) {
    let html = "";
    if (v.errors.length) html += '<div class="banner err"><b>Corrija antes de continuar:</b><ul>' + v.errors.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul></div>";
    if (v.warnings.length) html += '<div class="banner warn"><b>Atenção às premissas:</b><ul>' + v.warnings.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul></div>";
    $("validationBanner").innerHTML = html;
  }

  function covBadge(cov) {
    if (cov == null) return { cls: "", label: "Defina o padrão de vida", color: "ink-muted" };
    if (cov >= 1.1) return { cls: "good", label: "Com folga de segurança", color: "status-good" };
    if (cov >= 1.0) return { cls: "warning", label: "No limite, sem margem", color: "status-warning" };
    if (cov >= 0.8) return { cls: "warning", label: "Abaixo da meta", color: "status-warning" };
    return { cls: "critical", label: "Muito abaixo da meta", color: "status-critical" };
  }
  const iconConsume = '<svg viewBox="0 0 30 22" fill="none"><path d="M2 15 L11 15 L26 4" stroke="var(--series-1)" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="26" cy="4" r="2.3" fill="var(--series-1)"/></svg>';
  const iconPreserve = '<svg viewBox="0 0 30 22" fill="none"><path d="M2 15 L11 9 L26 9" stroke="var(--series-2)" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="26" cy="9" r="2.3" fill="var(--series-2)"/></svg>';

  function strategyCardHTML(title, icon, desc, d, an) {
    const p = state.profile, cov = d.coverage, b = covBadge(cov), infeasible = !isFinite(d.X);
    const pct = cov == null ? "—" : Math.round(cov * 100) + "%";
    const fill = cov == null ? 0 : Math.min(100, cov * 100);
    const illAt = state.assets.illiquid * Math.pow(1 + state.assets.illiquidRealGrowth / 100, p.horizonAge - p.currentAge);
    const fin = Math.max(0, isFinite(d.term) ? d.term : an.termNow);
    let sit;
    if (infeasible) sit = '<span style="color:var(--status-critical)">Inviável com a premissa atual: o retorno real após a aposentadoria é ≤ 0.</span>';
    else if (d.gap > 0) sit = "Sem novos aportes, faltam <b>" + money(d.gap) + "</b> na reserva aos " + p.retireAge + " anos para cobrir a meta.";
    else if (d.surplus > 0) sit = '<span style="color:var(--status-good)">Sem novos aportes, a reserva já cobre a meta, com folga de <b>' + money(d.surplus) + "</b> aos " + p.retireAge + " anos.</span>";
    else sit = "A reserva projetada cobre exatamente a meta.";
    return '<div class="strategy-card">' +
      '<div class="sc-head"><span class="sc-icon">' + icon + '</span><div><div class="sc-title">' + title + '</div><div class="sc-desc">' + desc + "</div></div></div>" +
      "<div>" +
        '<div class="meter-row"><span>Cobertura da renda desejada</span><span class="pct" style="color:var(--' + b.color + ')">' + pct + "</span></div>" +
        '<div class="meter"><div class="track" style="background:var(--surface-2)"></div><div class="fill" style="width:' + fill + "%; background:var(--" + b.color + ')"></div></div>' +
        '<div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span class="badge ' + b.cls + '">' + b.label + '</span><span style="font-size:10.5px;color:var(--ink-muted)">Retirada sustentável ÷ desejada. Não é probabilidade.</span></div>' +
      "</div>" +
      '<div class="sc-figures">' +
        '<div class="sc-fig"><div class="flabel">Aporte mensal adicional</div><div class="fvalue">' + (infeasible ? "Inviável" : money(d.X)) + "</div></div>" +
        '<div class="sc-fig"><div class="flabel">Ou aporte único hoje</div><div class="fvalue">' + (infeasible ? "Inviável" : money(d.L)) + "</div></div>" +
        '<div class="sc-fig"><div class="flabel">Reserva necessária aos ' + p.retireAge + '</div><div class="fvalue">' + money(d.reserve) + "</div></div>" +
        '<div class="sc-fig"><div class="flabel">Padrão de vida máx. (sem novos aportes)</div><div class="fvalue">' + money(d.maxSpend) + "/mês</div></div>" +
        '<div class="sc-fig" style="grid-column:1/-1;"><div class="flabel">Situação sem novos aportes</div><div class="fvalue" style="font-size:12.5px;font-weight:500;color:var(--ink-secondary);">' + sit + "</div></div>" +
      "</div>" +
      '<div class="sc-legacy">Legado estimado aos ' + p.horizonAge + " anos: <b>" + money(illAt + fin) + "</b> (imobilizado " + money(illAt) + " + reserva financeira " + money(fin) + ")</div>" +
    "</div>";
  }

  function miniBarPanelHTML(title, items) {
    const finite = items.map((it) => it.value).filter(isFinite);
    const max = Math.max(1, ...finite);
    const rows = items.map((it) => {
      const w = isFinite(it.value) ? Math.min(100, Math.max(0, it.value) / max * 100) : 0;
      return '<div class="mbar-row"><div class="mbar-label">' + it.label + '</div><div class="mbar-track"><div class="mbar-fill" style="width:' + w + "%; background:" + it.color + ';"></div></div><div class="mbar-value">' + (isFinite(it.value) ? money(it.value) : "Inviável") + "</div></div>";
    }).join("");
    return '<div><div class="mbar-panel-title">' + title + "</div>" + rows + "</div>";
  }
  function renderMiniBars(an) {
    const s1 = cssVar("--series-1"), s2 = cssVar("--series-2");
    $("miniBarSection").innerHTML =
      '<div class="mbs-head"><h4>Comparação rápida entre estratégias</h4><div class="mbs-legend"><span class="li"><span class="sw" style="background:' + s1 + '"></span>Consumir Reserva</span><span class="li"><span class="sw" style="background:' + s2 + '"></span>Preservar Reserva</span></div></div>' +
      '<div class="mini-bar-grid">' +
      miniBarPanelHTML("Aporte mensal adicional necessário", [{ label: "Consumir Reserva", value: an.consume.X, color: s1 }, { label: "Preservar Reserva", value: an.preserve.X, color: s2 }]) +
      miniBarPanelHTML("Ou aporte único hoje", [{ label: "Consumir Reserva", value: an.consume.L, color: s1 }, { label: "Preservar Reserva", value: an.preserve.L, color: s2 }]) +
      "</div>";
  }

  function renderSensitivity() {
    const p = state.profile, sens = Engine.sensitivity(state);
    const get = (k) => sens.find((s) => s.key === k).an;
    const maxX = Math.max(1, ...sens.flatMap((s) => [s.an.consume.X, s.an.preserve.X]).filter(isFinite));
    const rowsHtml = sens.map((s) => {
      const a = s.an, wc = isFinite(a.consume.X) ? a.consume.X / maxX * 100 : 0, wp = isFinite(a.preserve.X) ? a.preserve.X / maxX * 100 : 0;
      const cc = a.consume.coverage == null ? "—" : Math.round(a.consume.coverage * 100) + "%", cp = a.preserve.coverage == null ? "—" : Math.round(a.preserve.coverage * 100) + "%";
      return '<tr class="' + (s.key === "base" ? "base" : "") + '"><td>' + s.label + (s.pp ? " (" + (s.pp > 0 ? "+" : "−") + Math.abs(s.pp) + " p.p.)" : "") + "</td>" +
        "<td>" + pct2(s.rrAcc * 100) + "</td><td>" + money(a.reserveNow) + "</td><td>" + cc + " / " + cp + "</td>" +
        '<td><div class="cell-bar"><span class="sbar" style="width:' + wc * 0.6 + 'px"></span>' + (isFinite(a.consume.X) ? money(a.consume.X) : "Inviável") + "</div></td>" +
        '<td><div class="cell-bar"><span class="sbar p" style="width:' + wp * 0.6 + 'px"></span>' + (isFinite(a.preserve.X) ? money(a.preserve.X) : "Inviável") + "</div></td></tr>";
    }).join("");
    const fav = get("fav"), st = get("stress"), base = get("base");
    let lead = "Mesma vida, premissas diferentes: com o retorno real variando de <b>" + pct2(sens[0].rrAcc * 100) + "</b> a <b>" + pct2(sens[4].rrAcc * 100) + "</b> ao ano, a reserva aos " + p.retireAge + " anos vai de <b>" + money(st.reserveNow) + "</b> a <b>" + money(fav.reserveNow) + "</b>.";
    if (isFinite(st.consume.X) && isFinite(fav.consume.X)) lead += " O aporte adicional para consumir a reserva vai de <b>" + money(fav.consume.X) + "</b> a <b>" + money(st.consume.X) + "</b> por mês. Por isso o resultado é uma <b>faixa</b>, não um número.";
    $("sensSection").innerHTML = "<h4>Teste de sensibilidade ao retorno real</h4>" +
      '<p class="lead">' + lead + "</p>" +
      '<div class="table-scroll"><table class="sens"><thead><tr><th>Cenário</th><th>Retorno real</th><th>Reserva aos ' + p.retireAge + '</th><th>Cobertura c / p</th><th>Aporte extra: consumir</th><th>Aporte extra: preservar</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" +
      '<div class="ledger-note">Cada linha desloca o retorno real da acumulação e da aposentadoria pelo mesmo número de pontos percentuais, mantendo todo o resto. Retorno real médio de longo prazo é incerto; use a linha defensiva como referência de conversa, não como previsão.</div>';
    return base;
  }

  function renderMainChart(an) {
    const p = state.profile, pa = Engine.paths(state, an), labels = pa.current.map((pt) => pt.age);
    const grey = cssVar("--grey-line"), greyFill = cssVar("--grey-fill"), s1 = cssVar("--series-1"), s1w = cssVar("--series-1-wash"), s2 = cssVar("--series-2"), s2w = cssVar("--series-2-wash");
    const crit = cssVar("--status-critical"), critW = cssVar("--status-critical-wash"), ink = cssVar("--ink-secondary"), surf = cssVar("--surface"), hair = cssVar("--hairline");
    const infeasibleP = !isFinite(an.preserve.X);
    const ds = [
      { label: "Sem novos aportes", data: pa.current.map((pt) => Math.max(0, pt.bal)), borderColor: grey, backgroundColor: (c) => vGradient(c.chart.ctx, c.chart.chartArea, greyFill), borderDash: [5, 3], borderWidth: 2, pointRadius: 0, fill: "origin", tension: 0.15 },
      { label: "Déficit", data: pa.current.map((pt) => Math.min(0, pt.bal)), borderColor: crit, backgroundColor: critW, borderWidth: 2, pointRadius: 0, fill: "origin", tension: 0.15 },
      { label: "Plano: Consumir Reserva", data: pa.consume.map((pt) => pt.bal), borderColor: s1, backgroundColor: (c) => vGradient(c.chart.ctx, c.chart.chartArea, s1w), borderWidth: 2.5, pointRadius: 0, fill: "origin", tension: 0.15 }
    ];
    if (!infeasibleP) ds.push({ label: "Plano: Preservar Reserva", data: pa.preserve.map((pt) => pt.bal), borderColor: s2, backgroundColor: (c) => vGradient(c.chart.ctx, c.chart.chartArea, s2w), borderWidth: 2.5, pointRadius: 0, fill: "origin", tension: 0.15 });
    mount("main", "mainChart", {
      type: "line", data: { labels, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8 } }, interaction: { mode: "index", intersect: false },
        scales: { x: Object.assign({ title: { display: true, text: "Idade", color: ink, font: { size: 11 } } }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, maxTicksLimit: 12 } }), y: Object.assign({}, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
        plugins: {
          legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 3, filter: (i) => i.text !== "Déficit", font: { size: 11.5 } } },
          tooltip: { backgroundColor: surf, titleColor: ink, bodyColor: ink, borderColor: hair, borderWidth: 1, callbacks: { title: (it) => "Idade " + it[0].label, label: (it) => (it.dataset.label === "Déficit" && it.raw === 0 ? null : it.dataset.label + ": " + money(it.raw)) } },
          retirementLine: { age: p.retireAge, color: cssVar("--brand"), label: "Aposentadoria" },
          phaseZone: { retireAge: p.retireAge, accColor: cssVar("--zone-acc"), retColor: cssVar("--zone-ret") }
        }
      }
    });
  }

  function renderLedger(an) {
    const scen = $("scenarioPick").value;
    const X = scen === "consume" ? an.consume.X : scen === "preserve" ? an.preserve.X : 0;
    const rows = Engine.ledger(state, an, X, new Date().getFullYear() - 1);
    const neg = (v) => (Math.round(v) < 0 ? "negative" : "");
    $("ledgerTable").innerHTML = "<thead><tr><th>Ano</th><th>Idade</th><th>Saldo início (nominal)</th><th>Entradas no ano</th><th>Saídas no ano</th><th>Saldo fim (nominal)</th><th>Saldo fim (R$ de hoje)</th></tr></thead><tbody>" +
      rows.map((r) => '<tr class="' + (r.isRetireYear ? "retire-row" : "") + '"><td>' + r.year + "</td><td>" + r.age + '</td><td class="' + neg(r.startNom) + '">' + money(r.startNom) + '</td><td class="muted">' + (r.inflow ? money(r.inflow) : "—") + '</td><td class="muted">' + (r.outflow ? money(-r.outflow) : "—") + '</td><td class="' + neg(r.endNom) + '">' + money(r.endNom) + '</td><td class="' + neg(r.endReal) + '">' + money(r.endReal) + "</td></tr>").join("") + "</tbody>";
    const last = rows[rows.length - 1], label = scen === "consume" ? "Plano Consumir Reserva" : scen === "preserve" ? "Plano Preservar Reserva" : "sem novos aportes";
    $("ledgerNote").innerHTML = "Cenário exibido: <b>" + label + "</b>. " + (state.cashflow.escalate ? "Aportes, retiradas e eventos são reajustados pela inflação (poder de compra constante). " : "Aportes, retiradas e eventos ficam fixos em R$ nominais: o poder de compra encolhe com o tempo. ") +
      (an.P.tau > 0 ? "As saídas na aposentadoria incluem o IR estimado sobre os saques (" + pct1(an.P.tau * 100) + "). " : "") + "Saldo final aos " + last.age + " anos: " + money(last.endNom) + " nominais (" + money(last.endReal) + " em R$ de hoje).";
  }

  function renderAllocation() {
    const a = state.assets, total = a.illiquid + a.liquid;
    const s1 = cssVar("--series-2"), s2 = cssVar("--series-1");
    $("donutCenterValue").textContent = moneyCompact(total);
    $("allocLegend").innerHTML =
      '<div class="li"><span class="dot" style="background:' + s1 + '"></span>Imobilizado <span class="amt">' + pct1(total > 0 ? a.illiquid / total * 100 : 0) + "</span></div>" +
      '<div class="li"><span class="dot" style="background:' + s2 + '"></span>Recursos financeiros <span class="amt">' + pct1(total > 0 ? a.liquid / total * 100 : 0) + "</span></div>";
    mount("donut", "allocDonut", {
      type: "doughnut",
      data: { labels: ["Imobilizado", "Recursos financeiros"], datasets: [{ data: [a.illiquid, a.liquid], backgroundColor: [s1, s2], borderColor: cssVar("--surface"), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.label + ": " + money(c.raw) } } } }
    });
  }

  function clearApos() {
    ["strategyCards", "miniBarSection", "sensSection", "stressSection", "ledgerNote", "reserveSpark", "phaseResult", "taxResult", "mcResult"].forEach((id) => { $(id).innerHTML = ""; });
    $("ledgerTable").innerHTML = "";
    if (charts.main) { charts.main.destroy(); charts.main = null; }
    if (charts.phase) { charts.phase.destroy(); charts.phase = null; }
    if (charts.mc) { charts.mc.destroy(); charts.mc = null; }
    if (charts.seq) { charts.seq.destroy(); charts.seq = null; }
  }

  function renderApos() {
    const v = Engine.validate(state), p = state.profile, a = state.assets, c = state.cashflow;
    renderBanners(v); renderQualityBanner();
    $("clientLine").textContent = state.client.name ? "Cliente: " + state.client.name : "Cenário sem nome de cliente";
    $("todayDate").textContent = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const cap = Engine.capacityOf(state);
    $("capacityNote").textContent = "Capacidade de poupança (receita − despesa): " + money(cap) + (cap < 0 ? " — as despesas superam a receita" : "");
    const net = a.illiquid + a.liquid - a.debts;
    $("kpiTotal").textContent = money(net);
    $("kpiTotalSub").textContent = "Ativos " + money(a.illiquid + a.liquid) + " · dívidas " + money(a.debts);
    $("kpiReserve").textContent = money(a.liquid);
    const ok = !v.errors.length;
    $("kpiYearsToRetire").textContent = ok ? p.retireAge - p.currentAge : "—";
    $("kpiYearsToRetireSub").textContent = ok ? (p.horizonAge - p.retireAge) + " anos planejados na aposentadoria" : "";
    $("kpiCapacity").textContent = money(c.executed);
    $("kpiCapacitySub").textContent = c.executed < cap - 1 ? "Capacidade de " + money(cap) + ": folga de " + money(cap - c.executed) : c.executed > cap + 1 ? "Acima da capacidade informada (" + money(cap) + ")" : "Igual à capacidade de poupança";
    $("minLegacyHint").textContent = "R$ de hoje, aos " + p.horizonAge + " anos";
    $("whoLine").textContent = state.client.name || "";
    renderAllocation();
    $("timelineViz").innerHTML = timelineSVG(true);
    $("timelineBig").innerHTML = timelineSVG(false) + '<div style="display:flex;gap:14px;font-size:11px;color:var(--ink-secondary);margin-top:6px;flex-wrap:wrap;"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + cssVar("--series-1") + ';margin-right:5px;"></span>Acumulação</span><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + cssVar("--brand") + ';margin-right:5px;"></span>Aposentadoria</span></div>';
    const rt = Engine.ratesOf(state);
    $("realRateNote").textContent = "Taxa real (Fisher): " + pct2(rt.rrAcc * 100) + " a.a." + (state.rates.differentiate ? " · após a aposentadoria: " + pct2(rt.rrPost * 100) + " a.a." : "") + " — é ela que preserva ou consome poder de compra.";
    if (!ok) { clearApos(); return; }

    const an = Engine.analyze(state, 0);
    $("strategyCards").innerHTML =
      strategyCardHTML("Consumir a Reserva", iconConsume, "Gasta o patrimônio financeiro até " + p.horizonAge + " anos" + (c.minLegacy > 0 ? ", deixando " + money(c.minLegacy) : ""), an.consume, an) +
      strategyCardHTML("Preservar a Reserva", iconPreserve, "Vive do retorno real; o valor real da reserva é mantido", an.preserve, an);
    renderMiniBars(an);
    renderSensitivity(); renderStress(); renderPhases(); renderTax(); renderMc(an);
    const pa = Engine.paths(state, an);
    $("reserveSpark").innerHTML = sparklineSVG(pa.current.slice(0, p.retireAge - p.currentAge + 1).map((pt) => pt.bal), cssVar("--series-1"));
    renderMainChart(an);
    renderLedger(an);
  }

  /* ================= ABA 2 · IRPF MENSAL ================= */
  const nn = (x) => Math.max(0, Number(x) || 0);
  function irRow(label, value, cls) { return '<div class="rline ' + (cls || "") + '"><span>' + label + "</span><span>" + value + "</span></div>"; }

  function renderIrm() {
    const vig = state.irpf.vig, T = Irpf.TAX[vig].monthly, m = state.irpf.mensal;
    const inp = { rend: nn(m.rend), inss: nn(m.inss), dep: Math.floor(nn(m.dep)), pensao: nn(m.pensao), outras: nn(m.outras) };
    $("depHintM").textContent = money2(T.dep) + " de dedução por dependente ao mês.";
    const r = Irpf.monthly(inp, vig);
    let html = "";
    if (T.reducer && inp.rend > T.reducer.fullUntil && inp.rend <= T.reducer.partialUntil) html += '<div class="banner warn"><b>Faixa de transição:</b> rendimentos entre ' + money(T.reducer.fullUntil) + " e " + money(T.reducer.partialUntil) + " têm redução parcial do imposto.</div>";
    if (T.reducer && inp.rend <= T.reducer.fullUntil) html += '<div class="banner info"><b>Isento no mês:</b> rendimentos até ' + money(T.reducer.fullUntil) + " têm o imposto zerado pela redução da Lei 15.270/2025.</div>";
    html += '<div class="result-card"><h3>Resultado do mês</h3>' +
      irRow("Rendimentos tributáveis", money2(inp.rend)) +
      irRow("Deduções legais informadas <small>(INSS + dependentes + pensão + outras)</small>", money2(r.legal)) +
      irRow("Desconto simplificado mensal", money2(r.simplifiedValue)) +
      irRow("Dedução utilizada <small>(" + (r.mode === "legal" ? "deduções legais" : "desconto simplificado, mais vantajoso") + ")</small>", money2(r.used)) +
      irRow("Base de cálculo", money2(r.base)) +
      irRow("Imposto pela tabela progressiva", money2(r.gross)) +
      (r.red > 0 ? irRow("(−) Redução da Lei 15.270/2025", "−" + money2(r.red), "good") : "") +
      irRow("Imposto devido no mês", money2(r.tax), "total bad") +
      irRow("Alíquota efetiva sobre os rendimentos", pct2(r.effective * 100)) +
      irRow("Rendimento após imposto e INSS", money2(inp.rend - r.tax - inp.inss)) + "</div>";
    $("irmResult").innerHTML = html;
    $("irmSrc").textContent = Irpf.TAX[vig].label + ". " + Irpf.TAX[vig].source;
  }

  /* ================= ABA 3 · IRPF ANUAL & PGBL ================= */
  function renderIra() {
    const vig = state.irpf.vig, T = Irpf.TAX[vig].annual, m = state.irpf.anual;
    const inp = { rend: nn(m.rend), irrf: nn(m.irrf), inss: nn(m.inss), dep: Math.floor(nn(m.dep)), instr: nn(m.instr), med: nn(m.med), outras: nn(m.outras), aporte: m.aporte == null ? null : nn(m.aporte) };
    $("depHintA").textContent = money2(T.dep) + " de dedução por dependente ao ano.";
    $("instrHint").textContent = "Limite de " + money2(T.educationLimit) + " por pessoa (titular + dependentes): teto de " + money2((1 + inp.dep) * T.educationLimit) + ".";
    $("aporteHint").textContent = "Em branco: usa o teto de " + Math.round(T.pgblRate * 100) + "% dos rendimentos tributáveis (" + money2(inp.rend * T.pgblRate) + ").";
    const a = Irpf.annual(inp, vig), f = a.flags;
    let b = "";
    if (f.aporteClamped) b += '<div class="banner warn">O aporte informado excede o teto legal; a simulação usa <b>' + money2(a.aporte) + "</b> (" + Math.round(T.pgblRate * 100) + "% dos rendimentos).</div>";
    if (f.instrCapped) b += '<div class="banner warn">As despesas com instrução excedem o limite de ' + money2(f.instrCap) + "; apenas esse valor foi deduzido.</div>";
    if (f.simplifiedBeatsPgbl) b += '<div class="banner warn"><b>O modelo simplificado resulta em menos imposto</b> do que o completo com PGBL neste perfil. O PGBL só é dedutível no modelo completo; nesse caso ele não gera economia no ano.</div>';
    if (f.minTax) b += '<div class="banner err"><b>Imposto mínimo (IRPFM).</b> Rendimentos anuais acima de ' + money(T.minTaxFrom) + " podem ter tributação mínima adicional (Lei 15.270/2025), que esta simulação não calcula. Valide com o contador.</div>";
    if (a.saving > 0 && a.bestKey === "S") b += '<div class="banner info">Economia calculada contra o modelo simplificado, que é o melhor sem PGBL neste perfil.</div>';
    $("iraBanners").innerHTML = b;

    const sc = [a.S, a.C, a.P], names = ["Simplificado", "Completo", "Completo + PGBL"];
    const minTax = Math.min(...sc.map((s) => s.tax)), bestIdx = sc.findIndex((s) => s.tax === minTax);
    const th = names.map((n, i) => "<th" + (i === bestIdx ? ' class="best"' : "") + ">" + n + (i === bestIdx ? '<span class="badge-best">menor imposto</span>' : "") + "</th>").join("");
    const tr = (label, fn, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td>" + sc.map((s, i) => "<td" + (i === bestIdx ? ' class="best"' : "") + ">" + fn(s, i) + "</td>").join("") + "</tr>";
    const signed = (v) => (v >= 0 ? '<span class="pos">' + money2(v) + "</span>" : '<span class="neg">−' + money2(-v) + "</span>");
    $("iraResult").innerHTML = '<div class="form-card" style="padding-bottom:14px"><h3>Comparação dos modelos</h3><div class="table-scroll" style="margin-top:10px"><table class="cmp"><thead><tr><th>Item</th>' + th + "</tr></thead><tbody>" +
      tr("Deduções", (s, i) => money2(s.ded)) + tr("Base de cálculo", (s) => money2(s.base)) + tr("Imposto pela tabela", (s) => money2(s.gross)) +
      tr("(−) Redução Lei 15.270/2025", (s) => (s.red > 0 ? "−" + money2(s.red) : "—")) + tr("Imposto devido", (s) => money2(s.tax), "sum") +
      tr("IRRF já retido", () => money2(inp.irrf)) + tr("Restituição / (imposto a pagar)", (s) => signed(s.result), "sum") + "</tbody></table></div></div>" +
      '<div class="result-card"><h3>Efeito do PGBL</h3>' +
      irRow("Aporte em PGBL considerado <small>(teto " + money2(a.pgblLimit) + ")</small>", money2(a.aporte)) +
      irRow("Melhor modelo sem PGBL <small>(" + (a.bestKey === "S" ? "simplificado" : "completo") + ")</small>", money2(a.best.tax)) +
      irRow("Economia de IR no ano <small>(imposto adiado, não eliminado)</small>", money2(a.saving), a.saving > 0 ? "total good" : "total") +
      "</div>";
    $("iraSrc").textContent = Irpf.TAX[vig].label + ". " + Irpf.TAX[vig].source + " O PGBL será tributado no resgate; veja a aba “PGBL no longo prazo”.";

    const s1 = cssVar("--series-1"), grey = cssVar("--grey-line");
    mount("ira", "chartIra", {
      type: "bar",
      data: { labels: names, datasets: [{ data: sc.map((s) => s.tax), backgroundColor: sc.map((s, i) => (i === bestIdx ? s1 : grey)), borderRadius: 4, maxBarThickness: 64 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 22 } }, scales: { x: Object.assign({}, axisStyle(), { grid: { display: false } }), y: Object.assign({ beginAtZero: true }, axisStyle(), { ticks: { color: cssVar("--ink-secondary"), font: { size: 10.5 }, callback: axisMoney } }) }, plugins: { legend: { display: false }, valueLabels: true, tooltip: { callbacks: { label: (c) => "Imposto devido: " + money2(c.raw) } } } }
    });
  }

  /* ================= ABA 4 · PGBL NO LONGO PRAZO ================= */
  function renderPgbl() {
    const q = state.irpf.proj;
    const p = { renda: q.renda, pct: q.pct, cdi: q.cdi, taxa: q.taxa, anos: Math.max(3, Math.round(q.anos)), aliq: Number(q.aliq) };
    $("rv_renda").textContent = money(p.renda); $("rv_pct").textContent = pct1(p.pct); $("rv_cdi").textContent = pct1(p.cdi); $("rv_taxa").textContent = pct2(p.taxa); $("rv_anos").textContent = p.anos + " anos";
    const r = Irpf.project(p), L = r.last;
    const lead = L.adv >= 0;
    $("pgBanner").innerHTML = (r.breakEven === null || r.breakEven > p.anos)
      ? '<div class="banner warn"><b>Neste prazo o investimento comum rende mais, líquido de IR.</b> A tabela regressiva cobra até 35% sobre aportes recentes; o PGBL passa à frente depois de alguns anos' + (r.breakEven ? ' (a partir do ano ' + r.breakEven + ")." : " — aumente o prazo ou reduza a taxa de administração para ver o ponto de equilíbrio.") + "</div>"
      : '<div class="banner info">Ponto de equilíbrio: o PGBL passa à frente do investimento comum, líquido de IR, a partir do <b>ano ' + r.breakEven + "</b>.</div>";
    const tile = (label, value, sub, cls) => '<div class="stat-tile"><div class="tile-head"><div class="label">' + label + '</div></div><div class="value ' + (cls || "") + '">' + value + '</div><div class="sub">' + sub + "</div></div>";
    $("pgMetrics").innerHTML =
      tile("Aporte anual no PGBL", money(r.aporte), pct1(p.pct) + " da renda") +
      tile("Economia de IR por ano", money(r.econ), "Adiada: cobrada no resgate") +
      tile("Desembolso líquido total", money(r.totals.outOfPocket), "Aportes − economia de IR") +
      tile("Vantagem líquida no prazo", (L.adv >= 0 ? "+" : "−") + money(Math.abs(L.adv)), lead ? "PGBL à frente do comum" : "Comum à frente do PGBL", lead ? "pos" : "neg");
    $("pgCompare").innerHTML = "<thead><tr><th>Indicador</th><th>PGBL</th><th>Investimento comum</th><th>PGBL − comum</th></tr></thead><tbody>" +
      "<tr><td>Capital aplicado ao longo do prazo</td><td>" + money(r.totals.aportado) + "</td><td>" + money(r.totals.outOfPocket) + "</td><td>" + money(r.totals.aportado - r.totals.outOfPocket) + "</td></tr>" +
      "<tr><td>Saldo bruto ao final</td><td>" + money(L.balP) + "</td><td>" + money(L.balA) + "</td><td>" + money(L.balP - L.balA) + "</td></tr>" +
      "<tr><td>Imposto no resgate</td><td>−" + money(r.irP) + "</td><td>−" + money(r.irA) + "</td><td>" + money(r.irA - r.irP) + "</td></tr>" +
      '<tr class="sum"><td>Saldo líquido de IR</td><td>' + money(L.netP) + "</td><td>" + money(L.netA) + '</td><td class="' + (lead ? "pos" : "neg") + '">' + (lead ? "+" : "−") + money(Math.abs(L.adv)) + "</td></tr></tbody>";
    $("pgTable").innerHTML = "<thead><tr><th>Ano</th><th>Aporte PGBL</th><th>Economia de IR</th><th>Saldo PGBL (bruto)</th><th>Líquido PGBL</th><th>Saldo comum (bruto)</th><th>Líquido comum</th><th>Vantagem líquida</th></tr></thead><tbody>" +
      r.rows.map((x) => "<tr><td>" + x.y + "</td><td>" + money(x.aporte) + "</td><td>" + money(x.econ) + "</td><td>" + money(x.balP) + "</td><td>" + money(x.netP) + "</td><td>" + money(x.balA) + "</td><td>" + money(x.netA) + '</td><td class="' + (x.adv >= 0 ? "pos" : "neg") + '">' + (x.adv >= 0 ? "+" : "−") + money(Math.abs(x.adv)) + "</td></tr>").join("") + "</tbody>";
    const ink = cssVar("--ink-secondary"), s1 = cssVar("--series-1"), s2 = cssVar("--series-2"), surf = cssVar("--surface"), hair = cssVar("--hairline");
    mount("pgbl", "chartPgbl", {
      type: "line",
      data: { labels: r.rows.map((x) => x.y), datasets: [
        { label: "PGBL, líquido de IR", data: r.rows.map((x) => Math.round(x.netP)), borderColor: s1, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
        { label: "Investimento comum, líquido de IR", data: r.rows.map((x) => Math.round(x.netA)), borderColor: s2, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, tension: 0.15, borderDash: [5, 3] }
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { x: Object.assign({ title: { display: true, text: "Ano de resgate", color: ink, font: { size: 11 } } }, axisStyle()), y: Object.assign({}, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
        plugins: { legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 3, font: { size: 11.5 } } }, tooltip: { backgroundColor: surf, titleColor: ink, bodyColor: ink, borderColor: hair, borderWidth: 1, callbacks: { title: (it) => "Resgate no ano " + it[0].label, label: (it) => it.dataset.label + ": " + money(it.raw) } } } }
    });
  }

  /* ================= FASE 2 · helpers ================= */
  const cloneState = (o) => JSON.parse(JSON.stringify(o));
  const durLabel = (m) => {
    if (!isFinite(m)) return "Não quita";
    if (m <= 0) return "Quitada";
    const y = Math.floor(m / 12), r = Math.round(m - y * 12);
    return (y ? y + (y === 1 ? " ano" : " anos") : "") + (y && r ? " e " : "") + (r ? r + (r === 1 ? " mês" : " meses") : "");
  };
  const ymLabel = (months) => { const d = new Date(); d.setMonth(d.getMonth() + Math.round(months)); return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(" de ", "/"); };
  const signed = (v, f) => (Math.abs(v) < 1e-9 ? "—" : (v > 0 ? "+" : "−") + f(Math.abs(v)));
  const altNetOf = () => (state.debtPlan.altReturn != null ? state.debtPlan.altReturn : state.rates.nominal * 0.85);
  const taxOf = () => Irpf.withdrawalTax(state.taxRows, state.irpf.vig, state.retTax.manual);
  function gaugeHTML(label, value, color, note) {
    return '<div class="meter-row"><span>' + label + '</span><span class="pct" style="color:var(--' + color + ')">' + value + '</span></div>' + note;
  }

  /* ================= ABA · OBJETIVOS ================= */
  const G_STATUS = { financiada: ["good", "Financiada"], no_caminho: ["good", "No caminho"], parcial: ["warning", "Parcial"], sem_recursos: ["critical", "Sem recursos"], vencida: ["critical", "Data vencida"], sem_dados: ["neutral", "Preencha valor e ano"], pendente: ["neutral", "—"] };
  function renderObj() {
    const bs = Planning.balanco(state), fl = Planning.fluxo(state, bs);
    const v = Engine.validate(state), an = v.errors.length ? null : Engine.analyze(state, 0);
    const g = Goals.analyze(state, fl, bs, new Date(), an), T = g.totals;
    let ban = "";
    if (T.savedMismatch > 0) ban += '<div class="banner warn"><b>Reservado acima do balanço.</b> As metas somam ' + money(T.saved) + " já reservados, mas o Diagnóstico tem apenas " + money(T.pool) + ' com a finalidade “Outros objetivos”. Ajuste um dos dois.</div>';
    if (!g.ranked.length) ban += '<div class="banner info">Nenhuma meta com valor e ano preenchidos. Cadastre ao menos uma para ver o aporte necessário.</div>';
    $("objBanner").innerHTML = ban;
    $("objKpis").innerHTML =
      tileHTML("Metas ativas", g.ranked.length, money(T.amount) + " em valor de hoje") +
      tileHTML("Aporte necessário", money(T.required) + "/mês", "para financiar todas as metas") +
      tileHTML("Livre após a aposentadoria", money(T.available) + "/mês", "superávit " + money(T.surplus) + " − aporte atual " + money(T.executed)) +
      (T.gap > 0 ? tileHTML("Falta por mês", money(T.gap), "recursos livres menores que o necessário", "neg") : tileHTML("Folga por mês", money(T.slack), "depois de financiar as metas"));

    const order = g.ranked.concat(g.rows.filter((r) => !r.valid));
    const prioL = { essencial: "Essencial", importante: "Importante", desejo: "Desejo" };
    $("goalResult").innerHTML = order.length ?
      '<div class="sens-wrap" style="margin-top:0"><div class="table-scroll"><table class="sens"><thead><tr><th class="l">Meta</th><th>Prazo</th><th>Valor de hoje¹</th><th>Reservado na data</th><th>Aporte necessário</th><th>Alcança</th><th>Situação</th></tr></thead><tbody>' +
      order.map((r) => {
        const st = G_STATUS[r.status] || G_STATUS.pendente, sm = (t) => '<br><small style="color:var(--ink-muted)">' + t + "</small>";
        return '<tr><td class="l" style="min-width:150px"><b>' + esc(r.label) + "</b>" + sm(label(L_GKIND, r.kind) + " · " + prioL[r.priority]) + "</td>" +
          "<td>" + (r.valid ? r.year + sm(r.overdue ? "vencida" : r.months + " meses") : "—") + "</td>" +
          "<td>" + money(r.amount) + (r.valid ? sm("na data: " + money(r.future)) : "") + "</td><td>" + (r.valid ? money(r.fvSaved) : "—") + "</td>" +
          "<td>" + (r.valid && r.pmt > 0 ? money(r.pmt) + "/mês" + sm(r.alloc > 0 ? "alocado " + money(r.alloc) : "nada alocado") : "—") + "</td>" +
          '<td><div class="cell-bar"><span class="sbar" style="width:' + Math.round(r.reachPct * 40) + 'px;' + (r.reachPct < 1 ? "background:var(--status-warning)" : "background:var(--status-good)") + '"></span>' + Math.round(r.reachPct * 100) + "%</div></td>" +
          '<td><span class="badge ' + st[0] + '">' + st[1] + "</span></td></tr>";
      }).join("") + '</tbody></table></div><div class="ledger-note">¹ “Na data” é o valor corrigido pela inflação das premissas (' + pct1(state.rates.inflation) + " a.a.). Aportes e valores reservados são calculados em termos reais, à taxa real de cada meta. “Alcança” é a fração do valor que os recursos alocados cobrem na data.</div></div>"
      : '<div class="empty-note">Sem metas cadastradas.</div>';

    // mapa de metas
    const items = g.ranked.slice().sort((a, b) => a.months - b.months);
    const cv = $("goalsCv");
    if (!items.length) { cv.style.display = "none"; if (charts.goals) { charts.goals.destroy(); charts.goals = null; } }
    else {
      cv.style.display = ""; cv.style.height = Math.max(150, 40 * items.length + 70) + "px";
      const now = new Date(), y0 = now.getFullYear() + now.getMonth() / 12, ink = cssVar("--ink-secondary");
      const col = (s) => cssVar(s === "financiada" || s === "no_caminho" ? "--status-good" : s === "parcial" ? "--status-warning" : "--status-critical");
      mount("goals", "chartGoals", {
        type: "bar",
        data: { labels: items.map((r) => r.label + " · " + moneyCompact(r.amount)), datasets: [{ data: items.map((r) => [y0, Math.max(y0 + 0.1, r.year)]), backgroundColor: items.map((r) => col(r.status)), borderRadius: 4, barThickness: 16 }] },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          scales: { x: Object.assign({}, axisStyle(), { min: Math.floor(y0), max: Math.ceil(Math.max(...items.map((r) => r.year))) + 1, ticks: { color: ink, font: { size: 10.5 }, stepSize: 1, callback: (x) => (Number.isInteger(x) ? x : "") } }), y: Object.assign({}, axisStyle(), { grid: { display: false }, ticks: { color: ink, font: { size: 11 } } }) },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => { const r = items[c.dataIndex]; return money(r.amount) + " em " + r.year + " · " + (G_STATUS[r.status] || G_STATUS.pendente)[1]; } } } }
        }
      });
    }

    // origem dos recursos
    let fund = '<div class="result-card"><h3>Do superávit às metas (por mês)</h3>' +
      irRow("Superávit sustentável <small>(Diagnóstico)</small>", money(T.surplus)) +
      irRow("(−) Aporte atual para a aposentadoria", "−" + money(T.executed), "") +
      irRow("Livre para metas", money(T.available), "") +
      irRow("Aporte necessário para todas as metas", money(T.required)) +
      (T.gap > 0 ? irRow("Falta por mês", money(T.gap), "total bad") : irRow("Folga por mês", money(T.slack), "total good")) + "</div>";
    const notes = [];
    if (T.gap > 0 && an && T.executed > 0) {
      const imp = Goals.retirementImpact(state, Math.min(T.gap, T.executed));
      notes.push("<b>Redirecionar aporte.</b> Mover " + money(imp.cut) + "/mês do aporte da aposentadoria para as metas reduziria a cobertura da renda desejada de " + (an.consume.coverage == null ? "—" : Math.round(an.consume.coverage * 100) + "%") + " para " + (imp.coverage == null ? "—" : Math.round(imp.coverage * 100) + "%") + (isFinite(imp.X) && imp.X > 0 ? ", e a aposentadoria passaria a pedir mais " + money(imp.X) + "/mês." : "."));
    }
    if (T.retirementExtra > 0) notes.push("<b>Aposentadoria.</b> Mesmo sem as metas, o plano de aposentadoria ainda pede " + money(T.retirementExtra) + "/mês adicionais para fechar o objetivo.");
    if (T.gap > 0) notes.push("<b>Outras saídas.</b> Adiar datas, reduzir valores, aumentar a receita ou cortar despesas discricionárias (hoje " + money(fl.discretionary) + "/mês).");
    if (notes.length) fund += '<div class="note-box"><ul>' + notes.map((x) => "<li>" + x + "</li>").join("") + "</ul></div>";
    $("goalFunding").innerHTML = fund;
  }

  /* ================= ABA · CAIXA E DÍVIDAS ================= */
  const DEBT_FLAG = { sem_prestacao: "Sem prestação informada: a dívida não amortiza no modelo.", nao_amortiza: "A prestação não cobre os juros: o saldo cresce.", prazo_diverge: "O prazo informado difere do calculado com saldo, CET e prestação." };
  function renderCx() {
    const bs = Planning.balanco(state), fl = Planning.fluxo(state, bs), rs = Planning.reserva(state, fl, bs);
    const liabs = state.diag.bsLiabilities.filter((l) => l.balance > 0), extra = state.debtPlan.extra, altNet = altNetOf();
    $("altHint").textContent = "% a.a. nominal, já líquido de IR e custos. Em branco: usa 85% do retorno nominal das premissas (" + pct1(state.rates.nominal * 0.85) + ").";
    $("cxBanner").innerHTML = liabs.length ? "" : '<div class="banner info">Nenhuma dívida com saldo cadastrada. Cadastre os passivos na aba Diagnóstico para comparar estratégias.</div>';
    const cmp = Debt.compare(liabs, extra), base = cmp.none, chk = Debt.consistency(liabs);

    $("cxKpis").innerHTML =
      tileHTML("Superávit sustentável", money(fl.surplus) + "/mês", fl.incomeRec > 0 ? pct1(fl.surplus / fl.incomeRec * 100) + " da renda recorrente" : "Sem renda recorrente", fl.surplus < 0 ? "neg" : "") +
      tileHTML("Dívidas", money(bs.totalLiab), liabs.length + (liabs.length === 1 ? " contrato" : " contratos")) +
      tileHTML("Prestações", money(bs.serviceDebt) + "/mês", fl.incomeRec > 0 ? pct1(bs.serviceDebt / fl.incomeRec * 100) + " da renda recorrente" : "—") +
      tileHTML("Quitação nos contratos", liabs.length ? durLabel(base.months) : "—", liabs.length && isFinite(base.months) ? "até " + ymLabel(base.months) : liabs.length ? "revise prestação, CET e saldo" : "sem dívidas");

    // cascata
    const cas = Debt.cascade({ surplus: fl.surplus, reserveGap: rs.gap, debts: liabs, altNetPct: altNet });
    const s1 = cssVar("--series-1"), s2 = cssVar("--series-2"), grey = cssVar("--grey-line");
    const total = cas.steps.reduce((t, x) => t + (x.months || 0), 0);
    let casHtml = '<div class="result-card"><h3>Se o superávit de ' + money(fl.surplus) + "/mês fosse direcionado, nesta ordem</h3>";
    if (fl.surplus <= 0) casHtml += '<div class="banner warn" style="margin-top:6px">Sem superávit sustentável: antes de qualquer ordem de prioridade, o orçamento precisa fechar.</div>';
    cas.steps.forEach((st, i) => {
      casHtml += '<div class="step-row"><div class="n">' + (i + 1) + '</div><div><div class="t">' + st.label + '</div><div class="d">' + esc(st.note) + '</div></div><div class="v">' + (st.done ? "Concluída" : money(st.amount) + "<small>" + (st.months === null ? "sem superávit" : "≈ " + fmtD(st.months, 1) + " meses") + "</small>") + "</div></div>";
    });
    casHtml += '<div class="step-row"><div class="n">3</div><div><div class="t">Metas e aposentadoria</div><div class="d">' + esc(cas.nextUses) + '</div></div><div class="v">' + (cas.freeAfter == null ? "—" : "a partir de " + ymLabel(cas.freeAfter)) + "</div></div>";
    if (fl.surplus > 0 && total > 0) {
      casHtml += '<div class="tl-bar">' + cas.steps.filter((x) => x.months).map((x) => '<span title="' + esc(x.label) + '" style="width:' + x.months / total * 100 + "%;background:" + (x.key === "reserva" ? s1 : s2) + '"></span>').join("") + '</div><div class="tl-legend"><span class="li"><span class="sw" style="background:' + s1 + '"></span>Reserva</span><span class="li"><span class="sw" style="background:' + s2 + '"></span>Dívidas caras</span></div>';
    }
    casHtml += '<div class="ind-meta" style="margin-top:10px">Prazos aproximados: dividem o valor de cada etapa pelo superávit, sem juros sobre os saldos. Dívida cara = CET acima do retorno líquido da alternativa (' + pct1(altNet) + " a.a.). O aporte atual da aposentadoria (" + money(state.cashflow.executed) + "/mês) faz parte desse superávit: redirecioná-lo é uma decisão, não um automático.</div></div>";
    $("cxCascade").innerHTML = casHtml;

    // tabela de dívidas
    $("cxDebtTable").innerHTML = liabs.length ?
      '<div class="sens-wrap" style="margin-top:0"><div class="table-scroll"><table class="sens"><thead><tr><th class="l">Dívida</th><th>Saldo</th><th>CET a.a.</th><th>Prestação</th><th>Prazo informado</th><th>Prazo calculado</th><th class="l">Observação</th></tr></thead><tbody>' +
      liabs.map((l, i) => { const c = chk[i]; return '<tr><td class="l"><b>' + esc(l.label || "Dívida") + "</b></td><td>" + money(l.balance) + "</td><td>" + pct1(l.cet) + "</td><td>" + money(l.payment) + "</td><td>" + (l.months ? l.months + " meses" : "—") + "</td><td>" + (isFinite(c.impliedMonths) ? c.impliedMonths + " meses" : "Não quita") + '</td><td class="l">' + (c.flag ? '<span style="color:var(--status-warning)">' + DEBT_FLAG[c.flag] + "</span>" : "—") + "</td></tr>"; }).join("") +
      '<tr class="hl"><td class="l">Total</td><td>' + money(bs.totalLiab) + "</td><td></td><td>" + money(bs.serviceDebt) + "</td><td></td><td></td><td></td></tr></tbody></table></div></div>"
      : '<div class="empty-note">Sem dívidas cadastradas.</div>';

    // estratégias
    const keys = ["none", "avalanche", "bola", "fluxo"], sel = state.debtPlan.strategy;
    $("cxCompare").innerHTML = liabs.length ?
      '<div class="sens-wrap" style="margin-top:0"><p class="lead">Mesmo recurso extra de <b>' + money(extra) + "/mês</b>" + (extra > 0 ? "" : " (nenhum)") + ", mais as prestações das dívidas já quitadas, em cada estratégia. “Só as prestações atuais” é a referência." + (liabs.length < 2 ? " Com um único contrato as três estratégias coincidem; a diferença aparece com duas ou mais dívidas." : "") + "</p>" +
      '<div class="table-scroll"><table class="sens"><thead><tr><th class="l">Estratégia</th><th>Quita em</th><th>Juros totais</th><th>Juros poupados</th><th>Tempo poupado</th></tr></thead><tbody>' +
      keys.map((k) => { const r = cmp[k]; return '<tr class="' + (k === sel ? "hl" : "") + '"><td class="l"><b>' + Debt.STRATEGY_INFO[k].label + '</b><br><small style="color:var(--ink-muted)">' + Debt.STRATEGY_INFO[k].desc + "</small></td><td>" + (r.never ? "Não quita" : durLabel(r.months) + "<br><small style=\"color:var(--ink-muted)\">" + ymLabel(r.months) + "</small>") + "</td><td>" + (r.never ? "—" : money(r.totalInterest)) + "</td><td>" + (r.interestSaved == null || k === "none" ? "—" : '<span class="pos">' + money(r.interestSaved) + "</span>") + "</td><td>" + (r.monthsSaved == null || k === "none" ? "—" : r.monthsSaved + " meses") + "</td></tr>"; }).join("") +
      '</tbody></table></div><div class="ledger-note">Juros e prazos nominais, com CET e prestação constantes. A avalanche minimiza o juro total; a bola de neve e o fluxo de caixa trocam um pouco de juro por disciplina ou por alívio mensal. Confira multas, tarifas e a regra de abatimento proporcional de juros do contrato antes de amortizar.</div></div>'
      : "";
    const cvEl = $("chartDebt").parentNode;
    if (!liabs.length) { cvEl.style.display = "none"; if (charts.debt) { charts.debt.destroy(); charts.debt = null; } }
    else {
      cvEl.style.display = "";
      const cols = { none: cssVar("--grey-line"), avalanche: s1, bola: s2, fluxo: cssVar("--series-3") }, ink = cssVar("--ink-secondary");
      const maxLen = Math.min(240, Math.max(...keys.map((k) => cmp[k].series.length)));
      const pad = (arr) => Array.from({ length: maxLen }, (_, i) => (i < arr.length ? Math.round(arr[i]) : 0));
      mount("debt", "chartDebt", {
        type: "line",
        data: { labels: Array.from({ length: maxLen }, (_, i) => i), datasets: keys.map((k) => ({ label: Debt.STRATEGY_INFO[k].label.split(" (")[0], data: pad(cmp[k].series), borderColor: cols[k], borderWidth: k === sel ? 3 : 1.8, borderDash: k === "none" ? [5, 3] : [], pointRadius: 0, tension: 0.1 })) },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8 } }, interaction: { mode: "index", intersect: false },
          scales: { x: Object.assign({ title: { display: true, text: "Meses a partir de hoje", color: ink, font: { size: 11 } } }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, maxTicksLimit: 10 } }), y: Object.assign({}, axisStyle(), { beginAtZero: true, ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
          plugins: { legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 3, font: { size: 11.5 } } }, tooltip: { callbacks: { title: (it) => "Mês " + it[0].label, label: (it) => it.dataset.label + ": " + money(it.raw) } } } }
      });
    }

    // amortizar × investir
    const pickEl = $("aoiPick");
    pickEl.innerHTML = liabs.map((l) => '<option value="' + l.id + '"' + (l.id === state.debtPlan.pickId ? " selected" : "") + ">" + esc((l.label || "Dívida") + " · " + money(l.balance)) + "</option>").join("") || "<option>Sem dívidas</option>";
    const pick = liabs.find((l) => l.id === state.debtPlan.pickId) || liabs[0];
    if (!pick) { $("cxAoi").innerHTML = ""; return; }
    const r = Debt.amortizeOrInvest(pick, state.debtPlan.lump, altNet);
    if (!r.ok) { $("cxAoi").innerHTML = '<div class="banner warn">' + esc(r.reason) + "</div>"; return; }
    const vb = { amortizar: ["info", "<b>Amortizar rende mais.</b> A dívida custa " + pct1(pick.cet) + " a.a. e a alternativa rende " + pct1(altNet) + " a.a. líquidos: quitar é um retorno certo, sem oscilação."], investir: ["warn", "<b>A dívida é mais barata que a alternativa.</b> Com CET de " + pct1(pick.cet) + " contra " + pct1(altNet) + " líquidos esperados, manter a dívida e investir tende a render mais, mas o retorno do investimento não é garantido e a dívida é."], indiferente: ["info", "<b>Empate.</b> Custo da dívida e retorno esperado praticamente iguais; decidam pela liquidez e pela tranquilidade."] }[r.verdict];
    $("cxAoi").innerHTML = '<div class="banner ' + vb[0] + '">' + vb[1] + "</div>" +
      '<div class="result-card"><h3>' + esc(pick.label || "Dívida") + ": " + money(r.lump) + "</h3>" +
      irRow("Prazo do contrato hoje", durLabel(r.months)) + irRow("Prazo se amortizar", durLabel(r.monthsAfter)) + irRow("Juros poupados ao amortizar", money(r.interestSaved), "good") +
      irRow("Patrimônio ao fim do prazo: amortizar e investir a prestação liberada", money(r.wealthAmortize)) +
      irRow("Patrimônio ao fim do prazo: investir o valor e manter a dívida", money(r.wealthInvest)) +
      irRow("Diferença a favor de " + (r.diff >= 0 ? "amortizar" : "investir"), money(Math.abs(r.diff)), "total " + (r.diff >= 0 ? "good" : "bad")) +
      irRow("Retorno líquido da alternativa que empataria", pct2(r.breakEvenPct) + " a.a.") + "</div>" +
      '<div class="note-box"><b>Antes de decidir:</b><ul><li>A reserva de contingência precisa estar completa' + (rs.gap > 0 ? " (hoje faltam " + money(rs.gap) + ")" : "") + ": amortizar com a reserva incompleta troca juro por risco de nova dívida cara.</li><li>Confirme no contrato multa, tarifas e como o banco abate os juros na quitação antecipada.</li><li>Valores nominais, retorno constante e sem imposto sobre ganhos além do informado. O comparativo ignora a liquidez perdida ao amortizar.</li></ul></div>";
  }

  /* ================= ABA · PROTEÇÃO ================= */
  function protCard(title, r, sub, kind) {
    const st = { ok: ["good", "Coberta"], warn: ["warning", "Cobertura parcial"], crit: ["critical", "Lacuna relevante"], na: ["neutral", "Sem necessidade calculada"] }[r.status];
    const color = { ok: "status-good", warn: "status-warning", crit: "status-critical", na: "ink-muted" }[r.status];
    const cov = r.coverage == null ? 0 : Math.min(100, r.coverage * 100);
    return '<div class="panel"><h3>' + title + '</h3><div class="sub">' + sub + "</div>" +
      '<div class="gapnum ' + (r.gap > 0 ? (r.status === "warn" ? "warn" : "bad") : "good") + '">' + (r.gap > 0 ? money(r.gap) : "Sem lacuna") + '</div><div class="sub-note">' + (r.gap > 0 ? "capital que falta" : "recursos cobrem a necessidade estimada") + "</div>" +
      '<div class="meter"><div class="track" style="background:var(--surface-2)"></div><div class="fill" style="width:' + cov + "%;background:var(--" + color + ')"></div></div>' +
      '<div style="margin-bottom:10px"><span class="badge ' + st[0] + '">' + st[1] + '</span> <span class="sub-note">' + (r.coverage == null ? "" : "recursos cobrem " + Math.round(r.coverage * 100) + "% da necessidade") + "</span></div>" +
      r.parts.filter((p) => p.value > 0).map((p) => irRow(esc(p.label), money(p.value))).join("") + irRow("<b>Necessidade total</b>", "<b>" + money(r.need) + "</b>") +
      irRow("(−) Recursos disponíveis", "−" + money(r.resources - (kind === "death" ? state.protect.existingLife : state.protect.existingDisab))) +
      irRow("(−) Cobertura já contratada", "−" + money(kind === "death" ? state.protect.existingLife : state.protect.existingDisab)) + "</div>";
  }
  function renderProt() {
    const bs = Planning.balanco(state), fl = Planning.fluxo(state, bs);
    const v = Engine.validate(state), an = v.errors.length ? null : Engine.analyze(state, 0);
    const g = Goals.analyze(state, fl, bs, new Date(), an), r = Protection.analyze(state, { fl, bs, goals: g }), p = state.protect;
    const chip = (t, x) => '<span class="sum-chip"><span>' + t + "</span><b class=\"" + (x.gap > 0 ? "neg" : "pos") + "\">" + (x.gap > 0 ? "lacuna " + money(x.gap) : "sem lacuna") + "</b></span>";
    $("protSticky").innerHTML = chip("Morte", r.death) + chip("Invalidez", r.disability) + '<span class="sum-chip"><span>Recursos</span><b>' + money(r.death.resources - p.existingLife) + "</b></span>";
    $("protKpis").innerHTML =
      tileHTML("Lacuna em caso de morte", r.death.gap > 0 ? money(r.death.gap) : "Sem lacuna", "necessidade " + money(r.death.need), r.death.gap > 0 ? "neg" : "") +
      tileHTML("Lacuna em caso de invalidez", r.disability.gap > 0 ? money(r.disability.gap) : "Sem lacuna", "necessidade " + money(r.disability.need), r.disability.gap > 0 ? "neg" : "") +
      tileHTML("Recursos que a família usaria", money(r.death.resources - p.existingLife), "reserva e outros objetivos" + (r.inputs.retirementShare > 0 ? " + " + money(r.inputs.retirementShare) + " da aposentadoria" : "")) +
      tileHTML("Cobertura já contratada", money(p.existingLife), "morte · invalidez " + money(p.existingDisab));
    $("protResult").innerHTML = '<div class="prot-grid">' + protCard("Em caso de morte", r.death, "Dinheiro para a família manter o rumo sem a renda de quem falece.", "death") + protCard("Em caso de invalidez", r.disability, "Dinheiro para sustentar a casa e o cuidado até a aposentadoria.", "disab") + "</div>";
    $("protNotes").innerHTML = '<div class="note-box"><b>Premissas usadas.</b><ul>' +
      "<li>Despesa mensal do Diagnóstico: " + money(r.inputs.expense) + "; em caso de morte a família mantém " + pct1(p.needPct) + " (" + money(r.death.monthlyNeed + p.survivorIncome + p.pension) + "/mês), com renda de quem fica de " + money(p.survivorIncome) + (p.pension ? " e benefício de " + money(p.pension) : "") + " → reposição de " + money(r.death.monthlyNeed) + "/mês por " + p.supportYears + " anos.</li>" +
      "<li>Em caso de invalidez a família mantém 100% do custo de vida (" + money(r.inputs.expense) + "/mês) até a aposentadoria (" + r.disability.yearsToRetire + " anos), com renda de quem fica" + (p.disabPension ? " e benefício de " + money(p.disabPension) : "") + " → reposição de " + money(r.disability.monthlyGap) + "/mês" + (p.careMonthly ? ", mais " + money(p.careMonthly) + "/mês de cuidados por " + p.careYears + " anos" : "") + ".</li>" +
      "<li>Rendas futuras trazidas a valor presente à taxa real de " + pct1(p.rate) + " a.a. Tudo em R$ de hoje.</li>" +
      "<li>Recursos considerados: reserva e recursos de outros objetivos (exceto bens ilíquidos) = " + money(r.inputs.liquidUsable) + (p.usePct > 0 ? ", mais " + pct1(p.usePct) + " do capital de aposentadoria" : "; o capital de aposentadoria não é tocado") + ".</li></ul>" +
      "<b>Limites.</b><ul><li>Estimativa por necessidade, não é cálculo atuarial nem oferta de cobertura. Pensão por morte, benefícios por incapacidade e coberturas existentes devem ser confirmados nos documentos.</li><li>Não considera inflação médica acima da geral, mudanças na família, nem a necessidade de proteger a renda do cônjuge em caso de invalidez dele.</li><li>Escolher e contratar cobertura é uma etapa à parte, com profissional habilitado (corretor de seguros). Este material não indica produto.</li></ul></div>";
  }

  /* ================= ABA · VERSÕES ================= */
  let verSel = { a: null, b: "cur" };
  const fmtVal = (fmt, v, h) => {
    if (v == null) return "—";
    switch (fmt) {
      case "money": return money(v);
      case "num1": return fmtD(v, 1);
      case "pct0": return Math.round(v) + "%";
      case "pct": return pct2(v);
      case "age": return h != null && v > h ? "Não esgota até " + h : Math.round(v) + " anos";
      case "months": return durLabel(v);
      case "int": return String(v);
      case "bool": return v ? "Sim" : "Não";
      default: return String(v);
    }
  };
  const fmtDelta = (fmt, d) => (d == null ? "—" : fmt === "money" ? signed(d, money) : fmt === "pct0" ? signed(d, (x) => Math.round(x) + " p.p.") : fmt === "num1" ? signed(d, (x) => fmtD(x, 1)) : fmt === "age" ? signed(d, (x) => Math.round(x) + " anos") : fmt === "months" ? signed(d, (x) => Math.round(x) + " meses") : signed(d, (x) => String(x)));
  const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const verState = (id) => (id === "cur" ? state : (state.versions.find((v) => String(v.id) === String(id)) || {}).state);
  const verName = (id) => (id === "cur" ? "Plano atual" : ((state.versions.find((v) => String(v.id) === String(id)) || {}).name || "—"));

  function renderVer() {
    const vers = state.versions;
    if (verSel.a != null && verSel.a !== "cur" && !vers.some((v) => String(v.id) === String(verSel.a))) verSel.a = null;
    if (verSel.b !== "cur" && !vers.some((v) => String(v.id) === String(verSel.b))) verSel.b = "cur";
    if (verSel.a == null) verSel.a = vers.length ? String(vers[vers.length - 1].id) : "cur";
    const opts = (cur) => '<option value="cur">Plano atual (não salvo)</option>' + vers.slice().reverse().map((v) => '<option value="' + v.id + '">' + esc(v.name) + " · " + fmtDate(v.date) + "</option>").join("");
    $("verPickA").innerHTML = opts(); $("verPickA").value = String(verSel.a);
    $("verPickB").innerHTML = opts(); $("verPickB").value = String(verSel.b);

    $("verList").innerHTML = vers.length ? vers.slice().reverse().map((v) =>
      '<div class="ver-row"><div><div class="vn">' + esc(v.name) + (v.auto ? ' <span class="badge neutral">automática</span>' : "") + '</div><div class="vm">' + fmtDate(v.date) + (v.note ? " · " + esc(v.note) : "") + " · " + (v.state.client.name ? esc(v.state.client.name) + " · " : "") + "patrimônio líquido " + money(Planning.balanco(v.state).net) + '</div></div><div class="vb no-pdf"><button class="btn-small" type="button" data-vcmp="' + v.id + '">Comparar com o atual</button><button class="btn-small" type="button" data-vrest="' + v.id + '">Restaurar</button><button class="btn-danger" type="button" data-vdel="' + v.id + '">Excluir</button></div></div>').join("")
      : '<div class="empty-note">Nenhuma versão salva ainda. Salve a primeira antes de mudar premissas.</div>';
    $("verList").querySelectorAll("[data-vcmp]").forEach((b) => b.addEventListener("click", () => { verSel = { a: b.dataset.vcmp, b: "cur" }; renderVer(); $("verCompare").scrollIntoView({ block: "nearest" }); }));
    $("verList").querySelectorAll("[data-vrest]").forEach((b) => armed(b, "Clique de novo: substituir o plano atual", () => restoreVersion(b.dataset.vrest)));
    $("verList").querySelectorAll("[data-vdel]").forEach((b) => armed(b, "Clique de novo: excluir", () => { state.versions = state.versions.filter((x) => String(x.id) !== b.dataset.vdel); saveNow(); renderVer(); }));

    const sa = verState(verSel.a), sb = verState(verSel.b);
    if (!sa || !sb) { $("verCompare").innerHTML = ""; return; }
    if (verSel.a === verSel.b) { $("verCompare").innerHTML = '<div class="banner info">Escolha duas versões diferentes para comparar.</div>'; return; }
    const rows = Versions.compare(sa, sb, new Date()), ch = Versions.changes(sa, sb);
    const badge = { better: '<span class="badge good">melhor</span>', worse: '<span class="badge critical">pior</span>', changed: '<span class="badge neutral">mudou</span>', same: "—" };
    const better = rows.filter((r) => r.verdict === "better").length, worse = rows.filter((r) => r.verdict === "worse").length;
    $("verCompare").innerHTML = '<div class="sens-wrap" style="margin-top:0"><p class="lead"><b>' + esc(verName(verSel.a)) + "</b> → <b>" + esc(verName(verSel.b)) + "</b>: " + better + " indicador(es) melhoraram, " + worse + " pioraram. “Melhor” e “pior” seguem o sentido de cada indicador (mais patrimônio é melhor; mais dívida, pior).</p>" +
      '<div class="table-scroll"><table class="sens"><thead><tr><th class="l">Indicador</th><th>' + esc(verName(verSel.a)) + "</th><th>" + esc(verName(verSel.b)) + "</th><th>Variação</th><th>Leitura</th></tr></thead><tbody>" +
      rows.map((r) => "<tr><td class=\"l\">" + r.label + "</td><td>" + fmtVal(r.fmt, r.a, r.ha) + "</td><td>" + fmtVal(r.fmt, r.b, r.hb) + '</td><td class="delta ' + (r.verdict === "better" ? "better" : r.verdict === "worse" ? "worse" : "") + '">' + fmtDelta(r.fmt, r.delta) + "</td><td>" + badge[r.verdict] + "</td></tr>").join("") + "</tbody></table></div></div>" +
      '<div class="sens-wrap"><h4>O que mudou nas premissas e nos cadastros</h4>' + (ch.length ?
        '<div class="table-scroll"><table class="sens"><thead><tr><th class="l">Item</th><th>Antes</th><th>Depois</th></tr></thead><tbody>' + ch.map((c) => '<tr><td class="l">' + esc(c.label) + "</td><td>" + (c.fmt === "text" && c.a == null ? "—" : esc(fmtVal(c.fmt, c.a))) + "</td><td>" + (c.fmt === "text" && c.b == null ? "—" : esc(fmtVal(c.fmt, c.b))) + "</td></tr>").join("") + "</tbody></table></div>"
        : '<p class="lead">Nenhuma premissa ou cadastro mudou entre as duas versões.</p>') + "</div>";
  }
  function restoreVersion(id) {
    const v = state.versions.find((x) => String(x.id) === String(id)); if (!v) return;
    const msg = $("verToast");
    if (state.versions.length >= Engine.MAX_VERSIONS) { const i = state.versions.findIndex((x) => x.auto); if (i >= 0) state.versions.splice(i, 1); }
    if (state.versions.length < Engine.MAX_VERSIONS) state.versions.push(Versions.make(state, "Antes de restaurar “" + v.name + "”", "Cópia automática do plano atual", new Date().toISOString(), true));
    else msg.textContent = "Lista cheia: não foi possível criar a cópia automática do plano atual.";
    const restored = Versions.restoreState(v, state.versions);
    applyState(Engine.normalizeState(restored));
    $("verToast").textContent = "Versão restaurada. O plano anterior foi guardado como versão automática.";
  }
  $("btnVerSave").addEventListener("click", () => {
    const toast = $("verToast");
    if (state.versions.length >= Engine.MAX_VERSIONS) { toast.textContent = "Limite de " + Engine.MAX_VERSIONS + " versões: exclua uma antes de salvar."; return; }
    const v = Versions.make(state, $("verName").value.trim(), $("verNote").value.trim(), new Date().toISOString(), false);
    state.versions.push(v); $("verName").value = ""; $("verNote").value = "";
    verSel = { a: String(v.id), b: "cur" };
    saveNow(); renderVer(); toast.textContent = "Versão “" + v.name + "” salva.";
  });
  $("verPickA").addEventListener("change", () => { verSel.a = $("verPickA").value; renderVer(); });
  $("verPickB").addEventListener("change", () => { verSel.b = $("verPickB").value; renderVer(); });

  /* ================= APOSENTADORIA · fases de gasto e IR no resgate ================= */
  function renderPhases() {
    const on = state.phases.on, off = cloneState(state); off.phases.on = false;
    const aOff = Engine.analyze(off, 0), aOn = Engine.analyze(state, 0), prof = Engine.spendingProfile(state);
    const covTxt = (a) => (a.consume.coverage == null ? "—" : Math.round(a.consume.coverage * 100) + "%");
    $("phaseResult").innerHTML = (on && !state.phaseRows.length ? '<div class="banner warn">O gasto por fases está ativo, mas não há nenhuma fase cadastrada.</div>' : "") +
      '<div class="kpi-row" style="margin-bottom:14px">' +
      tileHTML("Gasto desejado no início", money(state.cashflow.desiredWithdrawal) + "/mês", "aos " + state.profile.retireAge + " anos, em R$ de hoje") +
      tileHTML("Cobertura sem fases", covTxt(aOff), "gasto constante até o fim") +
      tileHTML("Cobertura com as fases", on ? covTxt(aOn) : "Desativado", on ? "efeito: " + signed((aOn.consume.coverage - aOff.consume.coverage) * 100, (x) => Math.round(x) + " p.p.") : "ative o interruptor para aplicar") +
      tileHTML("Aporte adicional", on ? (isFinite(aOn.consume.X) ? money(aOn.consume.X) + "/mês" : "Inviável") : (isFinite(aOff.consume.X) ? money(aOff.consume.X) + "/mês" : "Inviável"), on ? "sem fases: " + (isFinite(aOff.consume.X) ? money(aOff.consume.X) + "/mês" : "inviável") : "estratégia consumir a reserva") + "</div>" +
      '<div class="chart-box"><h3>Gasto e origem do dinheiro ao longo da aposentadoria</h3><div class="sub">R$ de hoje por mês. A parte escura vem da carteira; a clara, de renda como INSS e aluguéis.</div><div class="cv"><canvas id="chartPhase"></canvas></div></div>';
    const ink = cssVar("--ink-secondary"), s1 = cssVar("--series-1"), s2 = cssVar("--series-2");
    mount("phase", "chartPhase", {
      type: "bar",
      data: { labels: prof.map((r) => r.age), datasets: [
        { label: "Renda da aposentadoria", data: prof.map((r) => Math.min(r.income, r.spend)), backgroundColor: s2, stack: "a" },
        { label: "Saque da carteira", data: prof.map((r) => r.draw), backgroundColor: s1, stack: "a" }
      ] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8 } }, interaction: { mode: "index", intersect: false },
        scales: { x: Object.assign({ stacked: true, title: { display: true, text: "Idade", color: ink, font: { size: 11 } } }, axisStyle(), { grid: { display: false }, ticks: { color: ink, font: { size: 10.5 }, maxTicksLimit: 14 } }), y: Object.assign({ stacked: true }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
        plugins: { legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 8, font: { size: 11.5 } } }, tooltip: { callbacks: { title: (it) => "Idade " + it[0].label, footer: (it) => "Gasto: " + money(prof[it[0].dataIndex].spend), label: (it) => it.dataset.label + ": " + money(it.raw) } } } }
    });
  }

  const REG_ROWS = [["até 2 anos", 0.35], ["2 a 4 anos", 0.30], ["4 a 6 anos", 0.25], ["6 a 8 anos", 0.20], ["8 a 10 anos", 0.15], ["mais de 10 anos", 0.10]];
  function renderTax() {
    const on = state.retTax.on, tx = taxOf(), off = cloneState(state); off.retTax.on = false;
    const aOff = Engine.analyze(off, 0), aOn = Engine.analyze(state, 0), prof = Engine.spendingProfile(state), p0 = prof[0] || { draw: 0 };
    const gross = tx.tau < 1 ? p0.draw / (1 - tx.tau) : p0.draw;
    $("taxResult").innerHTML =
      (on && !state.taxRows.length && state.retTax.manual == null ? '<div class="banner warn">O IR sobre o resgate está ativo, mas não há estrutura cadastrada nem alíquota manual: nenhum IR foi aplicado.</div>' : "") +
      '<div class="kpi-row" style="margin-bottom:14px">' +
      tileHTML("IR efetivo estimado", pct1(tx.tau * 100), tx.manual ? "alíquota manual" : tx.parts.length ? "média ponderada de " + tx.parts.length + " linha(s)" : "sem estrutura cadastrada") +
      tileHTML("Padrão de vida sustentável", money(on ? aOn.consume.maxSpend : aOff.consume.maxSpend) + "/mês", on ? "sem IR: " + money(aOff.consume.maxSpend) + "/mês" : "sem considerar IR") +
      tileHTML("Cobertura", on ? (aOn.consume.coverage == null ? "—" : Math.round(aOn.consume.coverage * 100) + "%") : "Desativado", on ? "sem IR: " + (aOff.consume.coverage == null ? "—" : Math.round(aOff.consume.coverage * 100) + "%") : "ative o interruptor para aplicar") +
      tileHTML("Saque bruto no 1º ano", money(gross) + "/mês", "para " + money(p0.draw) + "/mês líquidos da carteira") + "</div>" +
      (tx.parts.length ? '<div class="sens-wrap" style="margin-top:0"><div class="table-scroll"><table class="sens"><thead><tr><th class="l">Linha</th><th class="l">Tipo</th><th>Valor</th><th>Base tributável</th><th>Alíquota</th><th>IR estimado</th><th class="l">Regra usada</th></tr></thead><tbody>' +
        tx.parts.map((x) => '<tr><td class="l"><b>' + esc(x.label) + '</b></td><td class="l">' + label(L_TAXKIND, x.kind) + "</td><td>" + money(x.value) + "</td><td>" + money(x.base) + "</td><td>" + pct1(x.rate * 100) + "</td><td>" + money(x.tax) + '</td><td class="l">' + esc(x.note) + "</td></tr>").join("") +
        '<tr class="hl"><td class="l">Total</td><td></td><td>' + money(tx.value) + "</td><td></td><td>" + pct1(tx.tau * 100) + "</td><td>" + money(tx.tax) + "</td><td></td></tr></tbody></table></div>" +
        '<div class="ledger-note">Tabela regressiva (PGBL e VGBL): ' + REG_ROWS.map((r) => r[0] + " " + Math.round(r[1] * 100) + "%").join(" · ") + ". Dedução do IR no cálculo: aplicado ao saque líquido da carteira (a renda de INSS e semelhantes não entra). Estimativa, sem o ajuste anual e sem o IR dos rendimentos durante a acumulação.</div></div>" : "");
  }

  /* ================= ABA · SUCESSÃO ================= */
  function renderSucc() {
    const bs = Planning.balanco(state), r = Succession.analyze(state, { bs }), c = state.succ;
    const s1 = cssVar("--series-1"), s2 = cssVar("--series-2"), s3 = cssVar("--series-3"), grey = cssVar("--grey-line");
    $("succCommonRow").style.display = c.regime === "comunhao_parcial" && c.spouse ? "" : "none";
    $("succPensionHint").textContent = "Em branco: soma os ativos cujo nome indica PGBL, VGBL ou previdência (hoje " + money(r.pensionAuto) + ").";
    const chip = (t, v, cls) => '<span class="sum-chip"><span>' + t + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + v + "</b></span>";
    $("succSticky").innerHTML = chip("Custo estimado", money(r.total)) + chip("Liquidez fora do inventário", money(r.liquidOutside)) + chip(r.gap > 0 ? "Lacuna de caixa" : "Folga", money(r.gap > 0 ? r.gap : r.liquidOutside - r.total), r.gap > 0 ? "neg" : "pos");
    $("succKpis").innerHTML =
      tileHTML("Monte-mor líquido", money(r.monte), "ativos − previdência − dívidas") +
      tileHTML("Custo estimado", money(r.total), r.totalPct == null ? "—" : pct1(r.totalPct) + " do monte-mor") +
      tileHTML("Liquidez fora do inventário", money(r.liquidOutside), "previdência " + money(r.pension) + " + cobertura de morte " + money(r.life)) +
      (r.gap > 0 ? tileHTML("Lacuna de caixa", money(r.gap), "custo − liquidez fora do inventário", "neg") : tileHTML("Folga de caixa", money(r.liquidOutside - r.total), "a liquidez fora do inventário cobre o custo"));

    $("succFlow").innerHTML = '<div class="result-card"><h3>Da herança à base do imposto</h3>' +
      irRow("Ativos totais <small>(Diagnóstico)</small>", money(r.assets)) +
      irRow("(−) Previdência privada <small>(paga aos beneficiários, fora do inventário)</small>", "−" + money(r.pension)) +
      irRow("(−) Dívidas", "−" + money(r.debts)) +
      irRow("<b>Monte-mor líquido</b>", "<b>" + money(r.monte) + "</b>") +
      (r.community ? irRow("(−) Meação do cônjuge <small>(" + Succession.REGIME_LABEL[c.regime].toLowerCase() + (c.regime === "comunhao_parcial" ? ", " + pct1(c.commonPct) + " em comum" : "") + ")</small>", "−" + money(r.meacao)) : irRow("Meação do cônjuge <small>(" + (c.spouse ? Succession.REGIME_LABEL[c.regime].toLowerCase() : "sem cônjuge") + ")</small>", money(0))) +
      irRow("Base de cálculo do ITCMD", money(r.base), "total") +
      (c.heirs > 0 ? '<div class="ind-meta" style="margin-top:8px">Com herdeiros necessários, ' + money(r.legitima) + " (50% do monte-mor) é a parte indisponível, a legítima. " + c.heirs + (c.heirs === 1 ? " herdeiro informado." : " herdeiros informados.") + "</div>" : "") + "</div>";

    $("succCosts").innerHTML = '<div class="two-col"><div class="panel"><h3>Custos estimados do inventário</h3>' +
      stackBar([{ label: "ITCMD", value: r.itcmd, color: s1 }, { label: "Honorários", value: r.fees, color: s2 }, { label: "Custas", value: r.costs, color: s3 }, { label: "Manutenção dos bens", value: r.carry, color: grey }]) +
      '<div style="margin-top:10px">' + r.parts.map((p) => irRow(esc(p.label) + (p.key === "itcmd" ? " <small>(" + pct1(c.itcmd) + " sobre a base)</small>" : p.key === "fees" ? " <small>(" + pct1(c.fees) + " do monte)</small>" : p.key === "costs" ? " <small>(" + pct1(c.costs) + " do monte)</small>" : " <small>(" + money(c.carry) + " × " + c.months + " meses)</small>"), money(p.value))).join("") + irRow("Total", money(r.total), "total bad") + "</div></div>" +
      '<div class="panel"><h3>Caixa para pagar</h3>' +
      irRow("Previdência privada <small>(fora do inventário)</small>", money(r.pension)) + irRow("Cobertura de morte já contratada <small>(aba Proteção)</small>", money(r.life)) + irRow("Liquidez fora do inventário", money(r.liquidOutside)) + irRow("Custo estimado", money(r.total)) +
      (r.gap > 0 ? irRow("Lacuna de caixa imediato", money(r.gap), "total bad") : irRow("Folga de caixa", money(r.liquidOutside - r.total), "total good")) +
      '<div class="ind-meta" style="margin-top:10px">Contas e investimentos no nome de quem falece (' + money(r.liquidInside) + " em liquidez imediata ou curta) em geral ficam bloqueados até a autorização do inventário" + (r.gap > 0 ? (r.gapAfterRelease > 0 ? ", e mesmo depois dela não cobririam toda a lacuna" : ": depois dela cobririam a lacuna, mas a família passaria o período sem esse caixa") : "") + ". Bens ilíquidos (imóveis, participações) são " + pct1(r.illiquidShare) + " do patrimônio no inventário: se a liquidez faltar, a alternativa passa a ser vender bens sob pressão de prazo.</div></div></div>";

    const sens = Succession.sensitivity(state, { bs });
    $("succSens").innerHTML = '<div class="sens-wrap" style="margin-top:0"><p class="lead">A alíquota do ITCMD é fixada pelo estado e pode ser progressiva. Veja quanto o custo e a lacuna mudam dentro da faixa usual; as demais premissas ficam como estão.</p><div class="table-scroll"><table class="sens"><thead><tr><th class="l">ITCMD</th><th>Custo total</th><th>% do monte-mor</th><th>Lacuna de caixa</th></tr></thead><tbody>' +
      sens.map((x) => '<tr class="' + (Math.abs(x.itcmd - c.itcmd) < 1e-9 ? "hl" : "") + '"><td class="l">' + x.itcmd + "%" + (Math.abs(x.itcmd - c.itcmd) < 1e-9 ? " (premissa atual)" : "") + "</td><td>" + money(x.total) + "</td><td>" + (x.totalPct == null ? "—" : pct1(x.totalPct)) + "</td><td>" + (x.gap > 0 ? '<span class="neg">' + money(x.gap) + "</span>" : "sem lacuna") + "</td></tr>").join("") + "</tbody></table></div></div>";

    $("succNotes").innerHTML = '<div class="note-box"><b>Premissas usadas.</b><ul>' +
      "<li>" + (c.spouse ? "Há cônjuge sobrevivente; regime: " + Succession.REGIME_LABEL[c.regime].toLowerCase() + (c.regime === "comunhao_parcial" ? " (" + pct1(c.commonPct) + " do patrimônio em comum)" : "") + "." : "Sem cônjuge sobrevivente: não há meação.") + "</li>" +
      "<li>ITCMD de " + pct1(c.itcmd) + " sobre a base (sem a meação); honorários de " + pct1(c.fees) + " e custas de " + pct1(c.costs) + " sobre o monte-mor; inventário de " + c.months + " meses, com " + money(c.carry) + "/mês para manter os bens.</li>" +
      "<li>Previdência privada e cobertura de morte tratadas como pagas a beneficiários, fora do inventário e sem ITCMD.</li></ul>" +
      "<b>Limites.</b><ul>" +
      "<li>Estimativa de ordem de grandeza, não cálculo de inventário. O tratamento de previdência e de capital segurado pelo ITCMD, o regime de bens e as tabelas de honorários variam por estado, comarca e decisão judicial.</li>" +
      "<li>Não considera imposto de renda sobre ganho de capital em bens transmitidos, dívidas ocultas, partilha de empresas, bens no exterior nem planejamento prévio (doação, testamento, estruturas societárias): são matéria jurídica e tributária específica, com advogado e contador.</li>" +
      "<li>Planejamento sucessório não é recomendação de produto. Este material não indica instrumentos nem valores mobiliários.</li></ul></div>";
  }
  const succPreset = (k) => () => { Object.assign(state.succ, { fees: Succession.PRESETS[k].fees, costs: Succession.PRESETS[k].costs, months: Succession.PRESETS[k].months }); fillAll(); renderAll(); scheduleSave(); $("succToast").textContent = "Aplicado: " + Succession.PRESETS[k].label + ". São pontos de partida; confirme com o advogado."; };

  /* ================= APOSENTADORIA · cenários simulados (Monte Carlo) ================= */
  const MC_VOLS = [6, 10, 14, 18];
  let mcCache = { key: "", val: null };
  function mcCompute(an) {
    const m = state.mc, X = m.scenario === "consumir" && isFinite(an.consume.X) ? an.consume.X : 0;
    const key = JSON.stringify([state.profile, state.assets.liquid, state.rates, state.cashflow, state.extraMonthly, state.extraAnnual, state.retIncome, state.phases, state.phaseRows, state.retTax, state.taxRows, state.irpf.vig, m, X]);
    if (mcCache.key === key) return mcCache.val;
    const base = Engine.monteCarlo(state, { sims: m.sims, vol: m.vol, dist: m.dist, seed: m.seed, X: X });
    const sens = MC_VOLS.map((v) => Engine.monteCarlo(state, { sims: Math.min(m.sims, 1000), vol: v, dist: m.dist, seed: m.seed, X: X }));
    const seq = Engine.sequenceDemo(state, { vol: m.vol, X: X });
    const val = { X: X, base: base, sens: sens, seq: seq };
    mcCache = { key: key, val: val };
    return val;
  }
  const rangeCompact = (a, b) => (a >= 1e6 && b >= 1e6 ? "R$ " + (a / 1e6).toFixed(1).replace(".", ",") + " a " + (b / 1e6).toFixed(1).replace(".", ",") + " mi" : moneyCompact(Math.max(0, a)) + " a " + moneyCompact(b));
  const floor0 = (arr) => arr.map((v) => Math.max(0, Math.round(v)));
  const balTxt = (v) => (v <= 0.5 ? "Esgotada" : money(v));
  const exTxt = (age, h) => (age == null ? "não esgota até " + h : "aos " + age + " anos");
  function renderMc(an) {
    const m = state.mc, R = mcCompute(an), B = R.base, p = state.profile, ri = p.retireAge - p.currentAge, last = B.ages.length - 1;
    const rt = Engine.ratesOf(state), distTxt = m.dist === "tstudent" ? "caudas pesadas (t de Student, 4 g.l., mesma volatilidade)" : "normal";
    const s1 = cssVar("--series-1"), s1w = cssVar("--series-1-wash"), grey = cssVar("--grey-line"), ink = cssVar("--ink-secondary"), s2 = cssVar("--series-2"), s3 = cssVar("--series-3");
    const ageIdx = [ri, ri + 10, ri + 20, last].filter((v, i, a) => v <= last && a.indexOf(v) === i);
    const band = (k, i) => B.bands[k][i];
    $("mcResult").innerHTML =
      '<div class="banner warn"><b>Isto não é probabilidade de sucesso nem previsão.</b> É a faixa de resultados que as premissas abaixo produzem. Com outra volatilidade, outra distribuição ou outro plano, a faixa muda, e ninguém conhece essas premissas com precisão. Use a faixa para conversar sobre margem de segurança e regras de ajuste de gasto, não para prometer um resultado.</div>' +
      (m.vol === 0 ? '<div class="banner info">Com volatilidade zero todos os cenários coincidem com o caminho determinístico.</div>' : "") +
      '<div class="note-box" style="margin-bottom:14px"><b>Premissas desta simulação.</b><ul>' +
      "<li>" + fmtD(B.sims, 0) + " cenários; retornos reais mensais independentes, média igual à das premissas (" + pct2(rt.rrAcc * 100) + " a.a. na acumulação, " + pct2(rt.rrPost * 100) + " a.a. na aposentadoria) e volatilidade de " + pct1(m.vol) + " a.a.; distribuição " + distTxt + ". Semente " + m.seed + " (mesma semente, mesmo resultado).</li>" +
      "<li>Plano: " + (m.scenario === "consumir" && R.X > 0 ? "aporte realizado + " + money(R.X) + "/mês adicionais (consumir a reserva)" : "aporte realizado de " + money(state.cashflow.executed) + "/mês") + "; gasto desejado de " + money(state.cashflow.desiredWithdrawal) + "/mês a partir dos " + p.retireAge + " anos, horizonte de " + p.horizonAge + " anos" + (state.phases.on ? ", com gasto por fases" : "") + (an.P.tau > 0 ? ", com IR de " + pct1(an.P.tau * 100) + " sobre os saques" : "") + ". Valores em R$ de hoje; inflação não oscila.</li>" +
      "<li>Não modelam: inflação variável, correlação entre retornos de anos diferentes, mudança de comportamento de gasto, longevidade incerta nem custos de transação.</li></ul></div>" +
      '<div class="kpi-row" style="margin-bottom:14px">' +
      tileHTML("Saldo na aposentadoria", balTxt(band("p50", ri)), "mediana; determinístico " + balTxt(B.det[ri])) +
      tileHTML("Faixa na aposentadoria", rangeCompact(band("p10", ri), band("p90", ri)), "do percentil 10 ao 90") +
      tileHTML("Saldo aos " + p.horizonAge + " anos", balTxt(band("p50", last)), "mediana; determinístico " + balTxt(B.det[last])) +
      tileHTML("Caminho desfavorável", exTxt(B.exhaust.p10, p.horizonAge), "percentil 10: a reserva dura até") + "</div>" +
      '<div class="chart-box"><h3>Faixa de saldos da reserva financeira</h3><div class="sub">R$ de hoje. A faixa escura vai do percentil 25 ao 75; a clara, do 10 ao 90. Saldos negativos aparecem como zero (reserva esgotada).</div><div class="cv" style="height:330px"><canvas id="chartMc"></canvas></div></div>' +
      '<div class="sens-wrap" style="margin-top:0"><h4>Faixas por idade</h4><div class="table-scroll"><table class="sens"><thead><tr><th class="l">Idade</th><th>Percentil 10</th><th>Percentil 25</th><th>Mediana</th><th>Percentil 75</th><th>Percentil 90</th><th>Determinístico</th></tr></thead><tbody>' +
      ageIdx.map((i) => '<tr><td class="l">' + B.ages[i] + (i === ri ? " (aposentadoria)" : i === last ? " (horizonte)" : "") + "</td><td>" + balTxt(band("p10", i)) + "</td><td>" + balTxt(band("p25", i)) + "</td><td>" + balTxt(band("p50", i)) + "</td><td>" + balTxt(band("p75", i)) + "</td><td>" + balTxt(band("p90", i)) + "</td><td>" + balTxt(B.det[i]) + "</td></tr>").join("") +
      '</tbody></table></div><div class="ledger-note">Até quando a reserva dura em cada caminho: mediana ' + exTxt(B.exhaust.p50, p.horizonAge) + "; percentil 25, " + exTxt(B.exhaust.p25, p.horizonAge) + "; percentil 10, " + exTxt(B.exhaust.p10, p.horizonAge) + "; caminho determinístico, " + exTxt(B.exhaust.det, p.horizonAge) + ". A mediana fica abaixo do determinístico porque, com a mesma média de retorno, a oscilação reduz o crescimento composto.</div></div>" +
      '<div class="sens-wrap"><h4>E se a volatilidade for outra?</h4><p class="lead">Mesmo plano, mesma média de retorno, só a volatilidade muda (' + fmtD(R.sens[0].sims, 0) + " cenários cada). A diferença mostra o quanto a faixa depende de uma premissa que ninguém conhece com precisão.</p>" +
      '<div class="table-scroll"><table class="sens"><thead><tr><th class="l">Volatilidade</th><th>Saldo na aposentadoria: P10</th><th>Mediana</th><th>P90</th><th>Saldo ao fim: P10</th><th>Percentil 10: reserva dura até</th></tr></thead><tbody>' +
      R.sens.map((x) => '<tr class="' + (Math.abs(x.vol - m.vol) < 1e-9 ? "hl" : "") + '"><td class="l">' + pct1(x.vol) + (Math.abs(x.vol - m.vol) < 1e-9 ? " (atual)" : "") + "</td><td>" + balTxt(x.bands.p10[ri]) + "</td><td>" + balTxt(x.bands.p50[ri]) + "</td><td>" + balTxt(x.bands.p90[ri]) + "</td><td>" + balTxt(x.terminal.p10) + "</td><td>" + exTxt(x.exhaust.p10, p.horizonAge) + "</td></tr>").join("") + "</tbody></table></div></div>" +
      '<div class="chart-box"><h3>A ordem dos retornos importa</h3><div class="sub">Mesmo conjunto de ' + R.seq.years + " retornos anuais na aposentadoria (do pior ao melhor ano: " + pct1(R.seq.worst * 100) + " e " + pct1(R.seq.best * 100) + "), mesmo aporte e mesmo gasto. Só mudam de lugar os " + R.seq.window + " piores e os " + R.seq.window + " melhores anos: " + (R.seq.bad.exhaust == null ? "nenhuma das duas ordens esgota a reserva" : "com os piores no início a reserva esgota " + exTxt(R.seq.bad.exhaust, p.horizonAge) + (R.seq.good.exhaust == null ? "; com os melhores no início, ela não esgota" : ", e com os melhores no início, " + exTxt(R.seq.good.exhaust, p.horizonAge))) + '.</div><div class="cv" style="height:240px"><canvas id="chartSeq"></canvas></div></div>' +
      '<div class="note-box"><b>Por que a seção não mostra uma “probabilidade de sucesso”.</b><ul>' +
      "<li>Ela depende de volatilidade e distribuição, que ninguém conhece: a tabela acima mostra como o mesmo plano muda de cara.</li>" +
      "<li>Retornos reais têm caudas pesadas e dependência no tempo, que modelos simples subestimam; e ninguém gasta de forma mecânica: a família ajusta o gasto no meio do caminho.</li>" +
      "<li>Um número único passa precisão que a análise não tem. A decisão útil é qual margem de segurança e qual regra de ajuste de gasto o cliente aceita; veja também os testes de estresse e o gasto por fases.</li></ul></div>";

    const dsBand = (label, data, fill, color) => ({ label: label, data: floor0(data), borderColor: "transparent", backgroundColor: color, borderWidth: 0, pointRadius: 0, fill: fill, tension: 0.15 });
    mount("mc", "chartMc", {
      type: "line",
      data: { labels: B.ages, datasets: [
        dsBand("_p10", B.bands.p10, false, "transparent"),
        dsBand("Faixa P10 a P90", B.bands.p90, "-1", s1w),
        dsBand("_p25", B.bands.p25, false, "transparent"),
        dsBand("Faixa P25 a P75", B.bands.p75, "-1", s1w),
        { label: "Mediana", data: floor0(B.bands.p50), borderColor: s1, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
        { label: "Caminho determinístico (retorno constante)", data: floor0(B.det), borderColor: grey, backgroundColor: "transparent", borderWidth: 2, borderDash: [5, 3], pointRadius: 0, tension: 0.15 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8 } }, interaction: { mode: "index", intersect: false },
        scales: { x: Object.assign({ title: { display: true, text: "Idade", color: ink, font: { size: 11 } } }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, maxTicksLimit: 12 } }), y: Object.assign({ beginAtZero: true }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
        plugins: { legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 8, font: { size: 11.5 }, filter: (i) => i.text[0] !== "_" } },
          tooltip: { filter: (it) => it.dataset.label[0] !== "_", callbacks: { title: (it) => "Idade " + it[0].label, label: (it) => it.dataset.label + ": " + balTxt(it.raw) } },
          retirementLine: { age: p.retireAge, color: cssVar("--brand"), label: "Aposentadoria" } } }
    });
    const sq = R.seq;
    mount("seq", "chartSeq", {
      type: "line",
      data: { labels: sq.flat.yearly.map((x) => x.age), datasets: [
        { label: "Piores anos no início", data: floor0(sq.bad.yearly.map((x) => x.bal)), borderColor: s2, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
        { label: "Melhores anos no início", data: floor0(sq.good.yearly.map((x) => x.bal)), borderColor: s3, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
        { label: "Retorno constante (determinístico)", data: floor0(sq.flat.yearly.map((x) => x.bal)), borderColor: grey, backgroundColor: "transparent", borderWidth: 2, borderDash: [5, 3], pointRadius: 0, tension: 0.15 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8 } }, interaction: { mode: "index", intersect: false },
        scales: { x: Object.assign({ title: { display: true, text: "Idade", color: ink, font: { size: 11 } } }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, maxTicksLimit: 12 } }), y: Object.assign({ beginAtZero: true }, axisStyle(), { ticks: { color: ink, font: { size: 10.5 }, callback: axisMoney } }) },
        plugins: { legend: { position: "top", align: "start", labels: { color: ink, boxWidth: 14, boxHeight: 3, font: { size: 11.5 } } }, tooltip: { callbacks: { title: (it) => "Idade " + it[0].label, label: (it) => it.dataset.label + ": " + balTxt(it.raw) } },
          retirementLine: { age: p.retireAge, color: cssVar("--brand"), label: "Aposentadoria" } } }
    });
  }

  /* ================= abas, render global e tema ================= */
  const TABS = ["diag", "obj", "cx", "prot", "succ", "apos", "irm", "ira", "pgbl", "plan", "ver"];
  let active = "apos";
  try { const t = localStorage.getItem(TABKEY); if (TABS.includes(t)) active = t; } catch (e) { /* ignore */ }
  const RENDER = { diag: renderDiag, obj: renderObj, cx: renderCx, prot: renderProt, succ: renderSucc, apos: renderApos, irm: renderIrm, ira: renderIra, pgbl: renderPgbl, plan: renderPlan, ver: renderVer };
  function renderAll() {
    document.querySelectorAll("[data-client-line]").forEach((el) => { el.textContent = state.client.name ? "Cliente: " + state.client.name : "Cenário sem nome de cliente"; });
    $("whoLine").textContent = state.client.name || "";
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    document.querySelectorAll("[data-today]").forEach((el) => { el.textContent = today; });
    RENDER[active]();
    renderDisclaimers();
    const bk = $("backupExport").closest("details"); if (bk && bk.open) $("backupExport").value = JSON.stringify(state, null, 2);
  }
  function setTab(t) {
    active = t;
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    document.querySelectorAll(".pane").forEach((pn) => pn.classList.toggle("active", pn.id === "pane-" + t));
    try { localStorage.setItem(TABKEY, t); } catch (e) { /* ignore */ }
    const sel = document.querySelector('.tab[data-tab="' + t + '"]'), box = $("tabs");
    if (sel && box) box.scrollLeft = Math.max(0, sel.offsetLeft - (box.clientWidth - sel.offsetWidth) / 2);
    renderAll();
  }
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      const tabs = [...document.querySelectorAll(".tab")], i = tabs.indexOf(b);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setTab(n.dataset.tab); }
    });
  });
  $("scenarioPick").addEventListener("change", renderAll);
  let themeTimer = null;
  const rerenderTheme = () => { clearTimeout(themeTimer); themeTimer = setTimeout(renderAll, 80); };
  new MutationObserver(rerenderTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rerenderTheme);

  /* ================= backup, privacidade e arquivos ================= */
  let downloadsNS = null;
  function updateDownloadUI() {
    const has = !!downloadsNS, pdfOk = has && typeof window.html2pdf === "function";
    $("btnExportFile").hidden = !has;
    ["btnPdfDiag", "btnPdfApos", "btnPdfIrm", "btnPdfIra", "btnPdfPgbl", "btnPdfPlan", "btnPdfObj", "btnPdfCx", "btnPdfProt", "btnPdfSucc", "btnPdfVer"].forEach((id) => { $(id).hidden = !pdfOk; });
  }
  // Fora do claude.ai (arquivo aberto no navegador, site próprio): o salvamento vira um download comum.
  function anchorSave(opts) {
    return new Promise((resolve, reject) => {
      try {
        const data = opts.data, blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(opts.filename) ? "application/json" : "text/plain" });
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = opts.filename; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000); resolve({ status: "saved" });
      } catch (e) { reject(e); }
    });
  }
  (async function () {
    try {
      if (window.claude && typeof window.claude.use === "function") downloadsNS = await window.claude.use("downloads");
      else if (typeof window.claude === "undefined") downloadsNS = { save: anchorSave };
    } catch (e) { downloadsNS = null; }
    updateDownloadUI();
  })();
  const say = (msg) => { $("saveIndicator").textContent = msg; };
  function dlError(e) { say(e && e.code === "declined" ? "Salvamento cancelado." : "Não foi possível salvar o arquivo neste ambiente."); }

  $("btnExportFile").addEventListener("click", async () => {
    if (!downloadsNS) return;
    try { await downloadsNS.save({ filename: "asset-planning-backup.json", data: JSON.stringify(state, null, 2) }); say("Backup salvo."); } catch (e) { dlError(e); }
  });

  // PDF: campos de formulário viram texto que quebra linha (input/textarea cortam texto longo); "Como ler" aberto
  function flattenForPdf(root) {
    root.querySelectorAll(".ind-card details").forEach((d) => {
      const w = document.createElement("div"); w.className = "how";
      w.innerHTML = "<b class=\"how-t\">Como ler</b>" + d.querySelector("div").innerHTML;
      d.replaceWith(w);
    });
    root.querySelectorAll(".erow input, .erow select, .erow textarea, table.etable input, table.etable select").forEach((f) => {
      let v = "";
      if (f.tagName === "SELECT") v = f.selectedIndex >= 0 ? f.options[f.selectedIndex].text : "";
      else if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(f.value)) v = f.value.split("-").reverse().join("/");
      else v = f.value || "";
      const d = document.createElement("div");
      d.className = "flat" + (f.tagName === "TEXTAREA" ? " flat-block" : "");
      d.textContent = v;
      f.replaceWith(d);
    });
  }

  const PDF_SHEETS = { btnPdfDiag: ["sheetDiag", "asset-planning-diagnostico.pdf"], btnPdfPlan: ["sheetPlan", "asset-planning-plano-de-acao.pdf"], btnPdfApos: ["sheetApos", "asset-planning-aposentadoria.pdf"], btnPdfIrm: ["sheetIrm", "asset-planning-irpf-mensal.pdf"], btnPdfIra: ["sheetIra", "asset-planning-irpf-anual-pgbl.pdf"], btnPdfPgbl: ["sheetPgbl", "asset-planning-pgbl-longo-prazo.pdf"], btnPdfObj: ["sheetObj", "asset-planning-objetivos.pdf"], btnPdfCx: ["sheetCx", "asset-planning-caixa-e-dividas.pdf"], btnPdfProt: ["sheetProt", "asset-planning-protecao.pdf"], btnPdfSucc: ["sheetSucc", "asset-planning-sucessao.pdf"], btnPdfVer: ["sheetVer", "asset-planning-versoes.pdf"] };
  Object.keys(PDF_SHEETS).forEach((id) => {
    $(id).addEventListener("click", async () => {
      if (!downloadsNS || typeof window.html2pdf !== "function") return;
      const btn = $(id), el = $(PDF_SHEETS[id][0]), root = document.documentElement, prev = root.getAttribute("data-theme");
      const prevStyle = el.getAttribute("style");
      btn.disabled = true; btn.textContent = "Gerando PDF…";
      root.setAttribute("data-theme", "light"); document.body.classList.add("pdf-mode");
      el.style.width = "732px"; el.style.maxWidth = "732px";  // margens laterais de 8,05 mm = 732,9 px: largura do canvas = 733 = clientWidth, sem deriva nas quebras de página
      el.style.margin = "0"; el.style.padding = "0 0 10px";
      try {
        renderAll();
        await new Promise((r) => setTimeout(r, 650));
        flattenForPdf(el);  // depois da espera: a troca de tema re-renderiza os resultados e desfaria a conversão
        const blob = await window.html2pdf().set({ margin: [10, 8.05, 10, 8.05], image: { type: "jpeg", quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"], avoid: ["tr, .keep, .kpi-row, .split-row, .card-pair, .two-col, .ind-grid, .top3, .erow, .sug, .mini-bar-section, .sens-wrap, .form-card, .result-card, .chart-box, .chart-panel, .banner"] } }).from(el).outputPdf("blob");
        await downloadsNS.save({ filename: PDF_SHEETS[id][1], data: blob });
      } catch (e) { console.error("[asset-planning] falha ao gerar PDF:", e && (e.stack || e.message || e)); if (e && e.code) dlError(e); else say("Não foi possível gerar o PDF neste ambiente."); }
      finally {
        if (prev === null) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", prev);
        document.body.classList.remove("pdf-mode");
        if (prevStyle === null) el.removeAttribute("style"); else el.setAttribute("style", prevStyle);
        document.querySelectorAll(".html2pdf__overlay").forEach((n) => n.remove());
        btn.disabled = false; btn.textContent = "Salvar relatório (PDF)";
        renderAll();
      }
    });
  });

  function armed(btn, armedLabel, action) {
    const idle = btn.textContent; let timer = null;
    btn.addEventListener("click", () => {
      if (!timer) { btn.textContent = armedLabel; timer = setTimeout(() => { btn.textContent = idle; timer = null; }, 4000); return; }
      clearTimeout(timer); timer = null; btn.textContent = idle; action();
    });
  }
  function applyState(s) {
    state = s; recomputeRowSeq(); verSel = { a: null, b: "cur" };
    fillAll(); Object.keys(ROW_UI).forEach(renderRows); Object.keys(CARD_UI).forEach(renderCards); renderAll(); saveNow();
  }
  $("btnImport").addEventListener("click", () => {
    const txt = $("backupImport").value.trim(); if (!txt) return;
    try { const parsed = JSON.parse(txt); if (!parsed || typeof parsed !== "object") throw new Error("formato"); applyState(Engine.normalizeState(parsed)); $("backupImport").value = ""; say("Backup restaurado e validado."); }
    catch (e) { say("Não foi possível ler este backup: o texto está incompleto ou não é um JSON válido."); }
  });
  armed($("btnReset"), "Clique de novo: substituir pelo exemplo", () => applyState(Engine.normalizeState(null)));
  armed($("btnWipe"), "Clique de novo: apagar tudo", () => {
    try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY); localStorage.removeItem(TABKEY); } catch (e) { /* ignore */ }
    applyState(Engine.normalizeState(null)); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    say("Dados apagados deste navegador. O exemplo padrão está carregado na tela (não salvo).");
  });

  /* ================= inicialização ================= */
  document.querySelectorAll(".sel-vig").forEach((s) => { s.innerHTML = Object.keys(Irpf.TAX).sort().reverse().map((k) => '<option value="' + k + '">' + esc(Irpf.TAX[k].short) + "</option>").join(""); });
  const STRESS_FIELDS = [["dRet", "Δ retorno real (p.p.)", "pct"], ["dAporte", "Δ aporte mensal (%)", "pct"], ["dGasto", "Δ gasto desejado (%)", "pct"], ["shock", "Queda do patrimônio ao aposentar (%)", "pct"], ["custo", "Custo extraordinário (R$)", "money"], ["custoIdade", "…aos (idade)", "int"], ["dHor", "Δ horizonte (anos)", "int"]];
  $("stressForm").innerHTML = [["cons", "Conservador"], ["crise", "Crise inicial"], ["long", "Longevidade"], ["flex", "Flexível"]].map(([k, name]) => '<div class="stress-card"><div class="stress-title">' + name + '</div><div class="field-row">' + STRESS_FIELDS.map(([f, l, t]) => '<div class="field"><label>' + l + "</label><input " + (t === "int" ? 'type="number"' : 'type="text" inputmode="decimal" ' + (t === "pct" ? 'data-pct="1"' : 'data-money="1"')) + ' data-path="stress.' + k + "." + f + '"></div>').join("") + "</div></div>").join("");
  $("qualGrid").innerHTML = [["liquid", "Recursos financeiros"], ["illiquid", "Patrimônio imobilizado"], ["debts", "Dívidas"], ["income", "Receita mensal"], ["expense", "Despesa mensal"], ["executed", "Aporte realizado"], ["desired", "Padrão de vida desejado"], ["rates", "Retorno e inflação"]].map(([k, l]) => "<div><label>" + l + '</label><select data-path="quality.' + k + '">' + L_QUALITY.map((o) => '<option value="' + o[0] + '">' + o[1] + "</option>").join("") + "</select></div>").join("");
  Engine.setTaxProvider((m) => Irpf.withdrawalTax(m.taxRows, m.irpf.vig, m.retTax.manual).tau);
  $("goDiag").addEventListener("click", () => setTab("diag"));
  $("succPresetExtra").addEventListener("click", succPreset("extrajudicial"));
  $("succPresetJud").addEventListener("click", succPreset("judicial"));
  $("mcReseed").addEventListener("click", () => { state.mc.seed = 1 + Math.floor(Math.random() * 999999); fillAll(); renderAll(); scheduleSave(); });
  $("aoiPick").addEventListener("change", () => { state.debtPlan.pickId = Number($("aoiPick").value) || 0; renderAll(); scheduleSave(); });
  armed($("addPhaseEx"), "Clique de novo: substituir as fases", () => {
    const D = state.cashflow.desiredWithdrawal, r = state.profile.retireAge;
    state.phases.on = true;
    state.phaseRows = [{ id: rowSeq++, ageFrom: Math.min(r + 10, state.profile.horizonAge - 1), pct: 85, health: 0, label: "Fase mais lenta" }, { id: rowSeq++, ageFrom: Math.min(r + 20, state.profile.horizonAge - 1), pct: 75, health: Math.round(D * 0.08 / 100) * 100, label: "Fase tardia: menos consumo, mais saúde" }];
    fillAll(); renderCards("phaseRows"); renderAll(); scheduleSave();
  });
  armed($("fillTax"), "Clique de novo: substituir as linhas", () => {
    const kindOf = (l) => (/pgbl/i.test(l) ? "pgbl" : /vgbl|previd/i.test(l) ? "vgbl" : /\b(lci|lca|cri|cra)\b|poupan|isent/i.test(l) ? "isento" : "tributavel");
    state.taxRows = state.diag.bsAssets.filter((x) => x.purpose === "aposentadoria" && x.liq !== "iliquida" && x.value > 0).map((x) => { const k = kindOf(x.label); return { id: rowSeq++, label: x.label, kind: k, value: x.value, gainPct: k === "pgbl" || k === "isento" ? 100 : 50, regime: "regressivo", years: k === "tributavel" ? 5 : 10, monthly: 0 }; });
    renderCards("taxRows"); renderAll(); scheduleSave(); say(state.taxRows.length ? "Linhas criadas por palavras-chave do nome: revise tipo, % de ganho e anos." : "Nenhum ativo de aposentadoria no Diagnóstico.");
  });
  { const bk = $("backupExport").closest("details"); if (bk) bk.addEventListener("toggle", () => { if (bk.open) $("backupExport").value = JSON.stringify(state, null, 2); }); }
  fillAll(); wireFields(); Object.keys(ROW_UI).forEach(renderRows); Object.keys(CARD_UI).forEach(renderCards);
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === active)));
  document.querySelectorAll(".pane").forEach((pn) => pn.classList.toggle("active", pn.id === "pane-" + active));
  renderAll(); saveNow();
})();
/* APP:END */
