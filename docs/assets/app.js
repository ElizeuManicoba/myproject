/* ENGINE:BEGIN — puro, sem DOM. Valores em R$ de hoje (poder de compra constante). */
const Engine = (function () {
  "use strict";

  /* ---------- números e estado ---------- */
  function parseLocaleNumber(v, percent) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    let s = String(v == null ? "" : v).trim().replace(/[^\d.,\-]/g, "");
    if (!s || s === "-") return 0;
    const neg = s.charAt(0) === "-";
    s = s.replace(/-/g, "");
    const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
    let out;
    if (lc > -1 && ld > -1) {
      out = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    } else if (lc > -1) {
      out = s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
    } else if (ld > -1) {
      const parts = s.split(".");
      if (parts.length === 2) {
        const thousandsLike = parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== "0";
        out = (thousandsLike && !percent) ? parts.join("") : s;
      } else out = parts.join("");
    } else out = s;
    const n = parseFloat(out);
    return isNaN(n) ? 0 : (neg ? -n : n);
  }

  function defaultState() {
    return {
      meta: { version: 6 },
      client: { name: "" },
      profile: { currentAge: 45, retireAge: 65, horizonAge: 100 },
      assets: { illiquid: 1000000, liquid: 1000000, illiquidRealGrowth: 0, debts: 40000 },
      rates: { nominal: 11, inflation: 5.5, differentiate: false, nominalPost: 11, inflationPost: 5.5 },
      cashflow: { income: 25000, expense: 18000, executed: 7000, desiredWithdrawal: 30000, minLegacy: 0, escalate: true },
      extraMonthly: [],
      extraAnnual: [],
      retIncome: [],
      quality: { liquid: "declarada", illiquid: "declarada", debts: "declarada", income: "declarada", expense: "declarada", executed: "declarada", desired: "declarada", rates: "estimada" },
      stress: {
        cons: { dRet: -1.5, dAporte: -15, dGasto: 0, shock: 0, custo: 100000, custoIdade: 70, dHor: 0 },
        crise: { dRet: -1, dAporte: 0, dGasto: 0, shock: 30, custo: 0, custoIdade: 70, dHor: 0 },
        long: { dRet: 0, dAporte: 0, dGasto: 0, shock: 0, custo: 0, custoIdade: 70, dHor: 10 },
        flex: { dRet: 0, dAporte: 0, dGasto: -20, shock: 0, custo: 0, custoIdade: 70, dHor: 0 }
      },
      diag: {
        shocks: 0, monthsOverride: null,
        risk: { variable: false, single: false, dependents: false, health: false, lowEmploy: false },
        targets: { savings: 20, debtLoad: 30, leverage: 40, solvency: 60, concentration: 30 },
        bsAssets: [
          { id: 1, label: "Imóvel residencial", value: 1000000, liq: "iliquida", purpose: "uso", quality: "declarada" },
          { id: 2, label: "Tesouro Selic (reserva)", value: 100000, liq: "imediata", purpose: "reserva", quality: "confirmada" },
          { id: 3, label: "CDB — Banco A", value: 200000, liq: "longa", purpose: "aposentadoria", quality: "confirmada" },
          { id: 4, label: "CDB — Banco B", value: 150000, liq: "longa", purpose: "aposentadoria", quality: "confirmada" },
          { id: 5, label: "LCI/LCA", value: 150000, liq: "longa", purpose: "aposentadoria", quality: "confirmada" },
          { id: 6, label: "Fundo multimercado X", value: 150000, liq: "longa", purpose: "aposentadoria", quality: "declarada" },
          { id: 7, label: "Fundo de ações Y", value: 150000, liq: "longa", purpose: "aposentadoria", quality: "declarada" },
          { id: 8, label: "Fundos imobiliários", value: 100000, liq: "curta", purpose: "aposentadoria", quality: "declarada" },
          { id: 9, label: "Previdência privada (PGBL)", value: 100000, liq: "longa", purpose: "aposentadoria", quality: "confirmada" }
        ],
        bsLiabilities: [
          { id: 1, label: "Financiamento de veículo", balance: 40000, cet: 18.5, payment: 1800, months: 24, quality: "confirmada" }
        ],
        flow: [
          { id: 1, label: "Salário líquido", kind: "receita", value: 25000, freq: "mensal", nature: "recorrente", control: "essencial", quality: "confirmada" },
          { id: 2, label: "Bônus anual", kind: "receita", value: 30000, freq: "anual", nature: "extraordinaria", control: "essencial", quality: "estimada" },
          { id: 3, label: "Moradia e condomínio", kind: "despesa", value: 4500, freq: "mensal", nature: "recorrente", control: "contratual", quality: "confirmada" },
          { id: 4, label: "Plano de saúde", kind: "despesa", value: 1500, freq: "mensal", nature: "recorrente", control: "contratual", quality: "confirmada" },
          { id: 5, label: "Educação", kind: "despesa", value: 1000, freq: "mensal", nature: "recorrente", control: "contratual", quality: "declarada" },
          { id: 6, label: "IPTU, IPVA e seguros", kind: "despesa", value: 14400, freq: "anual", nature: "sazonal", control: "contratual", quality: "estimada" },
          { id: 7, label: "Alimentação", kind: "despesa", value: 3500, freq: "mensal", nature: "recorrente", control: "essencial", quality: "declarada" },
          { id: 8, label: "Transporte", kind: "despesa", value: 1200, freq: "mensal", nature: "recorrente", control: "essencial", quality: "declarada" },
          { id: 9, label: "Lazer e viagens", kind: "despesa", value: 2000, freq: "mensal", nature: "recorrente", control: "discricionaria", quality: "estimada" },
          { id: 10, label: "Outras despesas", kind: "despesa", value: 1300, freq: "mensal", nature: "recorrente", control: "discricionaria", quality: "estimada" }
        ]
      },
      actions: [],
      memos: [],
      phases: { on: false },
      phaseRows: [],
      retTax: { on: false, manual: null },
      taxRows: [],
      goalsCfg: { realReturn: 3 },
      goals: [
        { id: 1, label: "Faculdade dos filhos", kind: "educacao", amount: 120000, year: 2032, priority: "essencial", saved: 0, rate: null },
        { id: 2, label: "Troca de carro", kind: "veiculo", amount: 80000, year: 2029, priority: "importante", saved: 0, rate: null },
        { id: 3, label: "Viagem em família", kind: "viagem", amount: 40000, year: 2028, priority: "desejo", saved: 0, rate: null }
      ],
      debtPlan: { extra: 1000, strategy: "avalanche", altReturn: null, lump: 20000, pickId: 0 },
      protect: {
        deps: 2, supportYears: 15, survivorIncome: 8000, needPct: 75, pension: 0,
        finalFixed: 20000, estatePct: 4, debtsPaid: true, transitionMonths: 6, includeEducation: true, existingLife: 0,
        disabPension: 0, careMonthly: 0, careYears: 20, existingDisab: 0, usePct: 0, rate: 3
      },
      meeting: { date: "", participants: "", purpose: "", docs: { extratos: false, irpf: false, dividas: false, apolices: false, previdencia: false, imoveis: false, despesas: false, testamento: false },
        seen: { open: false, diag: false, obj: false, cx: false, prot: false, apos: false, succ: false, irm: false, ira: false, pgbl: false, syn: false, plan: false, ips: false } },
      risk: { tolerance: "", drawdown: 20, notes: "" },
      ips: { status: "rascunho", acceptedOn: "", acceptedVersion: 0, reviewMonths: 12, coverageMin: 90, reserveMonths: null, drawdownTrigger: 20, spendCut: 10, events: "Mudança de emprego ou de renda; nascimento ou saída de dependente; herança, venda ou compra relevante de bens; separação ou falecimento; mudança relevante na legislação tributária.", profileDate: "", investmentPolicy: "", notes: "" },
      commitments: [],
      mc: { sims: 2000, vol: 10, dist: "normal", seed: 1, scenario: "atual" },
      succ: { spouse: true, regime: "comunhao_parcial", commonPct: 100, heirs: 2, itcmd: 4, fees: 4, costs: 1.5, months: 6, carry: 1500, pensionOverride: null },
      versions: [],
      pro: { name: "", cert: "", cvm: "nao", cvmNo: "", scope: "", fee: "", conflicts: "" },
      irpf: {
        vig: "2026",
        mensal: { rend: 25000, inss: 900, dep: 0, pensao: 0, outras: 0 },
        anual: { rend: 300000, irrf: 68000, inss: 11000, dep: 0, instr: 0, med: 10000, outras: 0, aporte: null },
        proj: { renda: 300000, pct: 12, cdi: 10.5, taxa: 0.5, anos: 15, aliq: 27.5 }
      }
    };
  }

  const ROW_SCHEMAS = {
    extraMonthly: { ageFrom: 65, ageTo: 100, value: 0, label: "" },
    extraAnnual: { age: 65, ageTo: null, value: 0, label: "" },
    retIncome: { ageFrom: 65, value: 0, label: "" },
    bsAssets: { label: "", value: 0, liq: "longa", purpose: "aposentadoria", quality: "declarada" },
    bsLiabilities: { label: "", balance: 0, cet: 0, payment: 0, months: 0, quality: "declarada" },
    flow: { label: "", kind: "despesa", value: 0, freq: "mensal", nature: "recorrente", control: "essencial", quality: "declarada" },
    actions: { title: "", priority: "media", owner: "cliente", dep: "", due: "", cost: "", evidence: "", status: "nao_iniciada", next: "", source: "" },
    memos: { title: "", frame: "planejamento", problem: "", evidence: "", alternatives: "", chosen: "", assumptions: "", risks: "", inaction: "", owner: "", review: "", actionId: 0 },
    phaseRows: { ageFrom: 75, pct: 100, health: 0, label: "" },
    taxRows: { label: "", kind: "tributavel", value: 0, gainPct: 50, regime: "regressivo", years: 10, monthly: 0 },
    goals: { label: "", kind: "outro", amount: 0, year: 0, priority: "importante", saved: 0, rate: null },
    commitments: { text: "", kind: "outro", value: 0, freq: "mensal", due: "", owner: "cliente", include: true, source: "" }
  };
  const QUALITY = ["confirmada", "declarada", "estimada", "pendente"];
  const ENUMS = {
    "bsAssets.liq": ["imediata", "curta", "longa", "iliquida"],
    "bsAssets.purpose": ["reserva", "aposentadoria", "objetivos", "uso", "negocio", "outro"],
    "bsAssets.quality": QUALITY, "bsLiabilities.quality": QUALITY, "flow.quality": QUALITY,
    "flow.kind": ["receita", "despesa"], "flow.freq": ["mensal", "trimestral", "semestral", "anual"],
    "flow.nature": ["recorrente", "sazonal", "extraordinaria"], "flow.control": ["contratual", "essencial", "discricionaria"],
    "actions.priority": ["critica", "alta", "media", "baixa"], "actions.owner": ["cliente", "planejador", "especialista"],
    "actions.status": ["nao_iniciada", "em_curso", "bloqueada", "concluida"], "memos.frame": ["planejamento", "valores_mobiliarios"],
    "taxRows.kind": ["pgbl", "vgbl", "tributavel", "isento"], "taxRows.regime": ["regressivo", "progressivo"],
    "commitments.kind": ["aporte", "reserva", "divida", "meta", "protecao", "sucessao", "tributario", "dados", "comportamento", "outro"], "commitments.freq": ["mensal", "anual", "unico", "na"], "commitments.owner": ["cliente", "planejador", "especialista"],
    "goals.kind": ["educacao", "imovel", "veiculo", "viagem", "familia", "negocio", "saude", "outro"], "goals.priority": ["essencial", "importante", "desejo"]
  };
  const STRATEGIES = ["avalanche", "bola", "fluxo"];
  const MC_DISTS = ["normal", "tstudent"], MC_SCEN = ["atual", "consumir"], REGIMES = ["comunhao_parcial", "comunhao_universal", "separacao", "participacao"];
  const MAX_VERSIONS = 12;
  const MAXLEN = { text: 300, source: 60, participants: 300, purpose: 600, events: 600, investmentPolicy: 2000, notes: 1000, problem: 2000, evidence: 2000, alternatives: 2000, chosen: 2000, assumptions: 2000, risks: 2000, inaction: 1000, scope: 1000, fee: 500, conflicts: 1000, dep: 300, cost: 200, next: 400, title: 160 };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function coerce(def, src, key) {
    if (typeof def === "number") {
      if (typeof src === "number") return isFinite(src) ? src : def;
      if (typeof src === "string" && /\d/.test(src)) return parseLocaleNumber(src);
      return def;
    }
    if (typeof def === "boolean") return src === undefined ? def : !!src;
    if (typeof def === "string") return src == null ? def : String(src).slice(0, MAXLEN[key] || 200);
    if (def === null) {
      if (src === null || src === undefined || src === "") return null;
      const n = Number(src);
      return isFinite(n) ? n : null;
    }
    return def;
  }

  function mergeObj(def, src) {
    const out = {};
    Object.keys(def).forEach(function (k) {
      const d = def[k], s = src && typeof src === "object" ? src[k] : undefined;
      if (ROW_SCHEMAS[k]) {
        out[k] = (Array.isArray(s) ? s : []).slice(0, 80).map(function (row, i) {
          const r = mergeObj(ROW_SCHEMAS[k], row);
          Object.keys(r).forEach(function (f) { const list = ENUMS[k + "." + f]; if (list && list.indexOf(r[f]) === -1) r[f] = ROW_SCHEMAS[k][f]; });
          if ("due" in r && r.due && !DATE_RE.test(r.due)) r.due = "";
          r.id = (row && Number.isFinite(row.id)) ? row.id : i + 1;
          return r;
        });
      } else if (d && typeof d === "object" && !Array.isArray(d)) out[k] = mergeObj(d, s);
      else out[k] = coerce(d, s, k);
    });
    return out;
  }

  function normalizeState(raw) {
    if (raw == null) return defaultState();
    const out = mergeObj(defaultState(), raw);
    if (!(raw && raw.cashflow && "executed" in raw.cashflow)) {
      out.cashflow.executed = Math.max(0, out.cashflow.income - out.cashflow.expense);
    }
    Object.keys(out.quality).forEach(function (k) { if (QUALITY.indexOf(out.quality[k]) === -1) out.quality[k] = "declarada"; });
    if (["nao", "sim"].indexOf(out.pro.cvm) === -1) out.pro.cvm = "nao";
    if (STRATEGIES.indexOf(out.debtPlan.strategy) === -1) out.debtPlan.strategy = "avalanche";
    if (["", "conservadora", "moderada", "arrojada"].indexOf(out.risk.tolerance) === -1) out.risk.tolerance = "";
    out.risk.drawdown = Math.min(90, Math.max(0, out.risk.drawdown));
    if (["rascunho", "aceito"].indexOf(out.ips.status) === -1) out.ips.status = "rascunho";
    ["acceptedOn", "profileDate"].forEach(function (k) { if (out.ips[k] && !DATE_RE.test(out.ips[k])) out.ips[k] = ""; });
    if (out.meeting.date && !DATE_RE.test(out.meeting.date)) out.meeting.date = "";
    out.ips.acceptedVersion = Math.max(0, Math.round(out.ips.acceptedVersion) || 0);
    out.ips.reviewMonths = Math.min(60, Math.max(3, Math.round(out.ips.reviewMonths) || 12));
    out.ips.coverageMin = Math.min(200, Math.max(0, out.ips.coverageMin));
    out.ips.drawdownTrigger = Math.min(80, Math.max(0, out.ips.drawdownTrigger));
    out.ips.spendCut = Math.min(60, Math.max(0, out.ips.spendCut));
    if (out.ips.reserveMonths != null) out.ips.reserveMonths = Math.min(60, Math.max(0, out.ips.reserveMonths));
    if (MC_DISTS.indexOf(out.mc.dist) === -1) out.mc.dist = "normal";
    if (MC_SCEN.indexOf(out.mc.scenario) === -1) out.mc.scenario = "atual";
    out.mc.sims = Math.min(10000, Math.max(200, Math.round(out.mc.sims) || 2000));
    out.mc.vol = Math.min(60, Math.max(0, out.mc.vol));
    out.mc.seed = Math.max(1, Math.round(out.mc.seed) || 1);
    if (REGIMES.indexOf(out.succ.regime) === -1) out.succ.regime = "comunhao_parcial";
    out.succ.commonPct = Math.min(100, Math.max(0, out.succ.commonPct));
    ["itcmd", "fees", "costs"].forEach(function (k) { out.succ[k] = Math.min(30, Math.max(0, out.succ[k])); });
    out.succ.months = Math.min(120, Math.max(0, Math.round(out.succ.months)));
    out.succ.heirs = Math.min(30, Math.max(0, Math.round(out.succ.heirs)));
    out.succ.carry = Math.max(0, out.succ.carry);
    if (!(raw && raw.protect)) Object.assign(out.protect, { deps: 0, supportYears: 10, survivorIncome: 0, needPct: 75, pension: 0, finalFixed: 0, estatePct: 0, transitionMonths: 6, existingLife: 0, disabPension: 0, careMonthly: 0, existingDisab: 0, usePct: 0 }); // estado antigo: não injeta números de exemplo
    out.versions = sanitizeVersions(raw && raw.versions);
    out.meta.version = 6;
    return out;
  }

  function sanitizeVersions(list) {
    if (!Array.isArray(list)) return [];
    const res = [];
    list.slice(0, MAX_VERSIONS).forEach(function (v, i) {
      if (!v || typeof v !== "object" || !v.state || typeof v.state !== "object") return;
      const inner = Object.assign({}, v.state); delete inner.versions;
      res.push({
        id: Number.isFinite(v.id) ? v.id : i + 1,
        name: String(v.name == null ? "" : v.name).slice(0, 80) || "Versão",
        note: String(v.note == null ? "" : v.note).slice(0, 400),
        date: /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(String(v.date)) ? String(v.date) : "",
        auto: !!v.auto,
        state: normalizeState(inner)
      });
    });
    return res;
  }

  /* ---------- taxas ---------- */
  const annualToMonthly = (r) => Math.pow(1 + r, 1 / 12) - 1;
  const realRate = (n, i) => (1 + n) / (1 + i) - 1;

  function ratesOf(m) {
    const r = m.rates;
    const rnAcc = r.nominal / 100, iAcc = r.inflation / 100;
    const rnPost = r.differentiate ? r.nominalPost / 100 : rnAcc;
    const iPost = r.differentiate ? r.inflationPost / 100 : iAcc;
    return { rnAcc, iAcc, rnPost, iPost, rrAcc: realRate(rnAcc, iAcc), rrPost: realRate(rnPost, iPost) };
  }

  const capacityOf = (m) => m.cashflow.income - m.cashflow.expense;

  /* ---------- validação ---------- */
  function validate(m) {
    const e = [], w = [];
    const p = m.profile, c = m.cashflow, a = m.assets, r = m.rates;
    if (!(p.currentAge >= 18 && p.currentAge <= 100)) e.push("A idade atual deve estar entre 18 e 100 anos.");
    if (!(p.retireAge > p.currentAge)) e.push("A aposentadoria precisa ser depois da idade atual.");
    if (!(p.horizonAge > p.retireAge)) e.push("A expectativa de vida precisa ser depois da aposentadoria.");
    if (p.horizonAge > 120) e.push("A expectativa de vida máxima aceita é 120 anos.");
    const sane = (x) => x > -50 && x < 200;
    if (!sane(r.nominal) || !sane(r.inflation)) e.push("Juros nominal ou inflação fora de uma faixa plausível (−50% a 200% a.a.).");
    if (r.differentiate && (!sane(r.nominalPost) || !sane(r.inflationPost))) e.push("Taxas pós-aposentadoria fora de uma faixa plausível.");
    if (a.liquid < 0 || a.illiquid < 0 || a.debts < 0) e.push("Patrimônio e dívidas não podem ser negativos — use o campo de dívidas para saldo devedor.");
    if (e.length) return { errors: e, warnings: w };

    const rt = ratesOf(m);
    if (c.desiredWithdrawal <= 0) w.push("Defina o padrão de vida desejado (maior que zero) para calcular cobertura e aportes.");
    if (rt.rrAcc <= 0) w.push("Retorno real ≤ 0 na fase de acumulação: os juros não compensam a inflação.");
    if (rt.rrPost <= 0) w.push("Retorno real ≤ 0 após a aposentadoria: preservar o principal é inviável; consumir exige reserva muito maior.");
    if (c.executed < 0) w.push("Aporte mensal negativo equivale a retirar dinheiro durante a acumulação.");
    const cap = capacityOf(m);
    if (c.executed > cap + 1) w.push("O aporte executado supera a capacidade de poupança (receita − despesa). Confirme a origem desse recurso.");
    if (!c.escalate) w.push("Valores fixos em R$ nominais perdem poder de compra: o diagnóstico já considera isso e fica mais otimista do que a realidade se você pretende reajustar.");
    if (m.phases && m.phases.on) {
      if (!m.phaseRows.length) w.push("Gastos por fase ativados sem nenhuma fase cadastrada: o gasto desejado segue constante.");
      m.phaseRows.forEach(function (row, i) { if (row.ageFrom < p.retireAge) w.push("Fase #" + (i + 1) + ": começa antes da aposentadoria e vale a partir da idade de aposentar."); if (row.pct > 150) w.push("Fase #" + (i + 1) + ": gasto acima de 150% do desejado, confirme."); });
    }
    if (m.retTax && m.retTax.on && !m.taxRows.length && m.retTax.manual == null) w.push("Tributação do resgate ativada sem estrutura informada: nenhum IR foi aplicado. Cadastre onde está o capital (PGBL, VGBL, tributável, isento) ou informe uma alíquota efetiva.");
    m.extraMonthly.forEach(function (row, i) { if (!(row.ageTo > row.ageFrom)) w.push("Aporte/retirada mensal #" + (i + 1) + ": a idade final deve ser maior que a inicial (linha ignorada)."); });
    m.extraAnnual.forEach(function (row, i) { if (row.age < p.currentAge && !(row.ageTo > p.currentAge)) w.push("Evento anual #" + (i + 1) + ": ocorre antes da idade atual e é ignorado."); });
    return { errors: e, warnings: w };
  }

  /* ---------- tributação do resgate: o módulo fiscal informa a alíquota efetiva ---------- */
  let taxProvider = null;
  function setTaxProvider(fn) { taxProvider = typeof fn === "function" ? fn : null; }

  /* ---------- simulação mensal em R$ de hoje ---------- */
  function prep(m, shift, opts) {
    const p = m.profile, rt = ratesOf(m), sh = shift || 0;
    const N = Math.round((p.horizonAge - p.currentAge) * 12);
    const n1 = Math.round((p.retireAge - p.currentAge) * 12);
    const rrAcc = Math.max(-0.95, rt.rrAcc + sh), rrPost = Math.max(-0.95, rt.rrPost + sh);
    const rAccM = annualToMonthly(rrAcc), rPostM = annualToMonthly(rrPost);
    const iAccM = annualToMonthly(rt.iAcc), iPostM = annualToMonthly(rt.iPost);
    const esc = !!m.cashflow.escalate;
    const infl = new Float64Array(N + 1); infl[0] = 1;
    for (let t = 0; t < N; t++) infl[t + 1] = infl[t] * (1 + (t < n1 ? iAccM : iPostM));

    const idx = (age) => Math.round((age - p.currentAge) * 12);
    const phRows = m.phases && m.phases.on ? m.phaseRows.filter(function (r) { return r.pct >= 0; }).slice().sort(function (a, b) { return a.ageFrom - b.ageFrom; }) : [];
    const phaseAt = function (age) { let pct = 100, health = 0; for (const r of phRows) if (age + 1e-9 >= r.ageFrom) { pct = r.pct; health = r.health; } return { pct: pct, health: health }; };
    const tau = Math.min(0.6, Math.max(0, m.retTax && m.retTax.on && taxProvider ? Number(taxProvider(m)) || 0 : 0));
    const base = new Float64Array(N), xf = new Float64Array(N), sf = new Float64Array(N), rM = new Float64Array(N);
    for (let t = 0; t < N; t++) {
      const acc = t < n1;
      const unit = esc ? 1 : 1 / infl[t + 1];
      let f = acc ? m.cashflow.executed : 0;
      for (const row of m.extraMonthly) {
        if (row.ageTo > row.ageFrom && t >= idx(row.ageFrom) && t < idx(row.ageTo)) f += row.value;
      }
      for (const row of m.extraAnnual) {
        const t0 = idx(row.age);
        if (row.ageTo != null && row.ageTo > row.age) {
          if (t >= t0 && t < idx(row.ageTo) && (t - t0) % 12 === 0) f += row.value;
        } else if (t === t0) f += row.value;
      }
      base[t] = f * unit;
      for (const row of m.retIncome) if (t >= idx(row.ageFrom)) base[t] += row.value;
      xf[t] = acc ? unit : 0;
      sf[t] = acc ? 0 : unit;
      if (!acc && phRows.length) { const ph = phaseAt(p.currentAge + t / 12); sf[t] = unit * ph.pct / 100; base[t] -= ph.health * unit; }
      rM[t] = acc ? rAccM : rPostM;
    }
    return { N, n1, infl, base, xf, sf, rM, tau, liquid0: m.assets.liquid, cur: p.currentAge, rrAcc, rrPost, shock: (opts && opts.shock) || 0 };
  }

  function sim(P, o) {
    o = o || {};
    let bal = P.liquid0 + (o.L || 0);
    const X = o.X || 0, S = o.S || 0;
    let ret = bal;
    const yearly = o.path || o.ledger ? [{ age: P.cur, bal }] : null;
    const rows = o.ledger ? [] : null;
    let pos = 0, neg = 0, startBal = bal;
    for (let t = 0; t < P.N; t++) {
      if (t === P.n1) { ret = bal; if (P.shock) bal *= 1 - P.shock; }
      let cf = P.base[t] + X * P.xf[t] - S * P.sf[t];
      if (P.tau && t >= P.n1 && cf < 0) cf /= 1 - P.tau; // saque da carteira tributado: sai o líquido + o IR
      bal = bal * (1 + P.rM[t]) + cf;
      if (o.ledger) {
        const nom = cf * P.infl[t + 1];
        if (nom >= 0) pos += nom; else neg -= nom;
      }
      if (yearly && (t + 1) % 12 === 0) {
        yearly.push({ age: P.cur + (t + 1) / 12, bal });
        if (o.ledger) {
          const infEnd = P.infl[t + 1];
          rows.push({ age: P.cur + (t + 1) / 12, startNom: startBal * P.infl[t + 1 - 12], inflow: pos, outflow: neg, endNom: bal * infEnd, endReal: bal });
          pos = 0; neg = 0; startBal = bal;
        }
      }
    }
    return { ret, term: bal, yearly, rows };
  }

  // Com IR no resgate o saldo final deixa de ser linear em S (só o saque líquido é tributado): bisseção, pois é monótono em S.
  function solveSpend(P, target) {
    const f = function (S) { return sim(P, { S: S }).term - target; };
    if (f(0) <= 0) return 0;
    let lo = 0, hi = 1, guard = 0;
    while (f(hi) > 0 && guard++ < 60) { lo = hi; hi *= 2; }
    if (f(hi) > 0) return 0;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ---------- análise: estratégias, cobertura, legado (linear → solução exata; com IR no resgate, bisseção) ---------- */
  function analyze(m, shift, opts) {
    const P = prep(m, shift, opts);
    const D = m.cashflow.desiredWithdrawal;
    const minLeg = Math.max(0, m.cashflow.minLegacy);
    const s0 = sim(P, { S: D }), sX = sim(P, { X: 1, S: D }), sL = sim(P, { L: 1, S: D });
    const sZ = sim(P, { S: 0 }), sU = sim(P, { S: 1 });
    const aT = s0.term, aR = s0.ret;
    const bT = sX.term - aT, bR = sX.ret - aR, cT = sL.term - aT, cR = sL.ret - aR;
    const k = sZ.term - sU.term;
    const G = bR > 1e-12 ? bT / bR : 1; // fator de crescimento da reserva na aposentadoria até o horizonte

    const needC = minLeg - aT;
    const XC = needC > 0 ? (bT > 1e-12 ? needC / bT : Infinity) : 0;
    const LC = needC > 0 ? (cT > 1e-12 ? needC / cT : Infinity) : 0;
    const gapC = needC > 0 ? (isFinite(XC) ? XC * bR : Infinity) : 0;
    const surplusC = needC < 0 ? -needC / G : 0;

    const g0 = aT - aR, slopeX = bT - bR, slopeL = cT - cR;
    let XP = 0, LP = 0, gapP = 0, surplusP = 0;
    if (g0 >= 0) { surplusP = slopeX > 1e-12 ? g0 / (slopeX / bR) : 0; }
    else if (slopeX > 1e-9 && slopeL > 1e-9) { XP = -g0 / slopeX; LP = -g0 / slopeL; gapP = XP * bR; }
    else { XP = Infinity; LP = Infinity; gapP = Infinity; }

    const Scons = P.tau > 0 ? solveSpend(P, minLeg) : (k > 1e-12 ? Math.max(0, (sZ.term - minLeg) / k) : 0);
    const Spres = P.tau > 0 ? solveSpend(P, aR) : (k > 1e-12 ? Math.max(0, (sZ.term - aR) / k) : 0);
    const rt = ratesOf(m);
    return {
      P, D, minLeg, rrAcc: P.rrAcc, rrPost: P.rrPost, realBase: rt,
      reserveNow: aR, termNow: aT,
      consume: {
        X: XC, L: LC, gap: gapC, surplus: surplusC,
        reserve: isFinite(XC) ? aR + XC * bR : Infinity,
        term: isFinite(XC) ? aT + XC * bT : Infinity,
        maxSpend: Scons, coverage: D > 0 ? Scons / D : null
      },
      preserve: {
        X: XP, L: LP, gap: gapP, surplus: surplusP,
        reserve: isFinite(XP) ? aR + XP * bR : Infinity,
        term: isFinite(XP) ? aT + XP * bT : Infinity,
        maxSpend: Spres, coverage: D > 0 ? Spres / D : null
      }
    };
  }

  function paths(m, an) {
    const P = an.P, D = an.D;
    const cur = sim(P, { S: D, path: true }).yearly;
    const fin = (x) => (isFinite(x) ? x : 0);
    return {
      current: cur,
      consume: sim(P, { X: fin(an.consume.X), S: D, path: true }).yearly,
      preserve: sim(P, { X: fin(an.preserve.X), S: D, path: true }).yearly
    };
  }

  function ledger(m, an, X, year0) {
    const r = sim(an.P, { X: isFinite(X) ? X : 0, S: an.D, ledger: true });
    return r.rows.map(function (row, i) {
      return Object.assign({ year: year0 + i + 1, isRetireYear: Math.abs(row.age - m.profile.retireAge) < 1e-9 }, row);
    });
  }

  // Gasto desejado, renda e saque líquido ano a ano na aposentadoria (R$ de hoje), considerando as fases.
  function spendingProfile(m) {
    const p = m.profile, D = m.cashflow.desiredWithdrawal, rows = [];
    const ph = m.phases && m.phases.on ? m.phaseRows.filter(function (r) { return r.pct >= 0; }).slice().sort(function (a, b) { return a.ageFrom - b.ageFrom; }) : [];
    for (let age = p.retireAge; age < p.horizonAge; age++) {
      let pct = 100, health = 0;
      ph.forEach(function (r) { if (age >= r.ageFrom) { pct = r.pct; health = r.health; } });
      const spend = D * pct / 100 + health;
      const income = m.retIncome.reduce(function (t, r) { return t + (age >= r.ageFrom ? r.value : 0); }, 0);
      rows.push({ age: age, pct: pct, health: health, spend: spend, income: income, draw: Math.max(0, spend - income) });
    }
    return rows;
  }

  /* ---------- Monte Carlo: cenários simulados, nunca probabilidade de sucesso ----------
     Retornos reais mensais independentes: média = retorno das premissas, desvio = vol/√12 (normal ou t de Student com 4 g.l.,
     reescalada para a mesma variância). Gastos, fases e IR vêm do mesmo motor determinístico. Semente fixa → resultado repetível. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeNormal(rng) {
    let spare = null;
    return function () {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0; while (u === 0) u = rng();
      const v = rng(), r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
      spare = r * Math.sin(th); return r * Math.cos(th);
    };
  }
  function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  const MC_Q = { p10: 0.10, p25: 0.25, p50: 0.50, p75: 0.75, p90: 0.90 };

  function monteCarlo(m, opts) {
    opts = opts || {};
    const sims = Math.min(10000, Math.max(100, Math.round(opts.sims || 2000))), vol = Math.max(0, opts.vol == null ? 10 : opts.vol) / 100;
    const dist = opts.dist === "tstudent" ? "tstudent" : "normal", seed = Math.max(1, Math.round(opts.seed || 1)), X = opts.X || 0;
    const P = prep(m, 0, { shock: opts.shock || 0 }), D = m.cashflow.desiredWithdrawal;
    const norm = makeNormal(mulberry32(seed)), s = vol / Math.sqrt(12), tScale = Math.sqrt(0.5); // var(t₄) = 2
    // t de Student (4 g.l.): Z / sqrt(χ²₄ / 4), reescalada para variância 1
    const draw = dist === "tstudent"
      ? function () { const a = norm(), c1 = norm(), c2 = norm(), c3 = norm(), c4 = norm(); return (a / Math.sqrt((c1 * c1 + c2 * c2 + c3 * c3 + c4 * c4) / 4)) * tScale; }
      : norm;
    const nY = Math.floor(P.N / 12), cols = nY + 1, grid = new Float64Array(sims * cols), sum = new Float64Array(cols);
    for (let k = 0; k < sims; k++) {
      let bal = P.liquid0; const base = k * cols; grid[base] = bal; sum[0] += bal;
      for (let t = 0; t < P.N; t++) {
        if (t === P.n1 && P.shock) bal *= 1 - P.shock;
        let r = P.rM[t] + (s > 0 ? s * draw() : 0); if (r < -0.95) r = -0.95;
        let cf = P.base[t] + X * P.xf[t] - D * P.sf[t];
        if (P.tau && t >= P.n1 && cf < 0) cf /= 1 - P.tau;
        bal = bal * (1 + r) + cf;
        if ((t + 1) % 12 === 0) { const y = (t + 1) / 12; grid[base + y] = bal; sum[y] += bal; }
      }
    }
    const ages = [], bands = { p10: [], p25: [], p50: [], p75: [], p90: [] }, mean = [], col = new Float64Array(sims);
    for (let y = 0; y < cols; y++) {
      ages.push(P.cur + y);
      for (let k = 0; k < sims; k++) col[k] = grid[k * cols + y];
      const sorted = Array.prototype.slice.call(col).sort(function (a, b) { return a - b; });
      Object.keys(MC_Q).forEach(function (key) { bands[key].push(quantile(sorted, MC_Q[key])); });
      mean.push(sum[y] / sims);
    }
    const det = sim(P, { X: X, S: D, path: true }).yearly.map(function (pt) { return pt.bal; });
    const ex = function (arr) { for (let i = 0; i < arr.length; i++) if (arr[i] < -0.5) return ages[i]; return null; };
    return {
      sims: sims, vol: vol * 100, dist: dist, seed: seed, ages: ages, bands: bands, mean: mean, det: det, retireAge: m.profile.retireAge, horizonAge: m.profile.horizonAge,
      exhaust: { p10: ex(bands.p10), p25: ex(bands.p25), p50: ex(bands.p50), det: ex(det) },
      terminal: { p10: bands.p10[cols - 1], p25: bands.p25[cols - 1], p50: bands.p50[cols - 1], p75: bands.p75[cols - 1], p90: bands.p90[cols - 1], mean: mean[cols - 1], det: det[cols - 1] }
    };
  }

  // Aproximação racional de Acklam para a inversa da normal padrão.
  function invNorm(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* Ordem dos retornos: o MESMO conjunto de retornos anuais na aposentadoria. Só mudam de lugar os k melhores e os k piores anos
     (k = 5): ou os piores vêm primeiro e os melhores por último, ou o contrário; os demais anos ficam na mesma ordem nas duas versões. */
  function sequenceDemo(m, opts) {
    opts = opts || {};
    const vol = Math.max(0, opts.vol == null ? 10 : opts.vol) / 100, X = opts.X || 0;
    const P = prep(m, 0, {}), D = m.cashflow.desiredWithdrawal, nRet = Math.max(1, Math.round(m.profile.horizonAge - m.profile.retireAge));
    const zs = []; for (let i = 0; i < nRet; i++) zs.push(invNorm((i + 0.5) / nRet));
    const mu = zs.reduce(function (t, x) { return t + x; }, 0) / nRet, sd = Math.sqrt(zs.reduce(function (t, x) { return t + (x - mu) * (x - mu); }, 0) / nRet) || 1;
    const zn = zs.map(function (x) { return (x - mu) / sd; });                     // ascendente, média 0, desvio 1
    const k = Math.max(1, Math.min(5, Math.floor(nRet / 4)));
    const worst = zn.slice(0, k), best = zn.slice(nRet - k).reverse(), mid = zn.slice(k, nRet - k), mix = [];
    for (let i = 0, j = mid.length - 1; i <= j;) { mix.push(mid[i++]); if (i <= j) mix.push(mid[j--]); }
    const badStart = worst.concat(mix, best.slice().reverse()), goodStart = best.concat(mix, worst.slice().reverse());
    const run = function (order) {
      const rM = Float64Array.from(P.rM);
      for (let t = P.n1; t < P.N; t++) {
        const yi = Math.min(nRet - 1, Math.floor((t - P.n1) / 12));
        rM[t] = annualToMonthly(Math.max(-0.9, P.rrPost + vol * order[yi]));
      }
      const r = sim(Object.assign({}, P, { rM: rM }), { X: X, S: D, path: true });
      return { term: r.term, yearly: r.yearly, exhaust: exhaustAge(r.yearly) };
    };
    const flat = sim(P, { X: X, S: D, path: true });
    return {
      bad: run(badStart), good: run(goodStart), flat: { term: flat.term, yearly: flat.yearly, exhaust: exhaustAge(flat.yearly) },
      orders: { bad: badStart, good: goodStart }, years: nRet, window: k, vol: vol * 100, worst: Math.max(-0.9, P.rrPost + vol * zn[0]), best: P.rrPost + vol * zn[nRet - 1]
    };
  }

  function exhaustAge(yearly) {
    for (const pt of yearly) if (pt.bal < -0.5) return pt.age;
    return null;
  }

  function stress(m, p) {
    const m2 = JSON.parse(JSON.stringify(m));
    m2.cashflow.executed *= 1 + p.dAporte / 100;
    m2.cashflow.desiredWithdrawal *= 1 + p.dGasto / 100;
    m2.profile.horizonAge += p.dHor;
    if (p.custo > 0) m2.extraAnnual.push({ id: 9999, age: p.custoIdade, ageTo: null, value: -p.custo, label: "estresse" });
    const an = analyze(m2, p.dRet / 100, { shock: p.shock / 100 });
    const yearly = sim(an.P, { S: an.D, path: true }).yearly;
    const cov = an.consume.coverage;
    return { coverage: cov, X: an.consume.X, exhaustAge: exhaustAge(yearly), cut: cov == null ? null : Math.max(0, 1 - cov), horizon: m2.profile.horizonAge };
  }

  const SENS_SHIFTS = [
    { key: "fav", label: "Favorável", pp: 1 },
    { key: "base", label: "Base", pp: 0 },
    { key: "cons", label: "Conservador", pp: -1 },
    { key: "def", label: "Defensivo", pp: -2 },
    { key: "stress", label: "Estresse", pp: -3 }
  ];
  function sensitivity(m) {
    return SENS_SHIFTS.map(function (s) {
      const an = analyze(m, s.pp / 100);
      return { key: s.key, label: s.label, pp: s.pp, rrAcc: an.rrAcc, rrPost: an.rrPost, an };
    });
  }

  return { setTaxProvider, spendingProfile, monteCarlo, sequenceDemo, invNorm, MAX_VERSIONS, parseLocaleNumber, defaultState, normalizeState, validate, capacityOf, ratesOf, analyze, paths, ledger, sensitivity, stress, exhaustAge, SENS_SHIFTS, annualToMonthly, realRate, ROW_SCHEMAS, ENUMS, QUALITY };
})();
if (typeof module !== "undefined") module.exports = Engine;
/* ENGINE:END */

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

/* SUCCESSION:BEGIN — liquidez para o inventário: base de cálculo, ITCMD, custos e caixa disponível fora do inventário. Puro, sem DOM.
   Estimativa de ordem de grandeza: alíquotas, honorários e prazos variam por estado, comarca e tipo de inventário. */
const Succession = (function () {
  "use strict";

  const num = (x) => (isFinite(x) ? x : 0);
  const pos = (x) => Math.max(0, num(x));
  const COMMUNITY = { comunhao_parcial: true, comunhao_universal: true };
  const PENSION_RE = /pgbl|vgbl|previd/i;
  const REGIME_LABEL = { comunhao_parcial: "Comunhão parcial de bens", comunhao_universal: "Comunhão universal de bens", separacao: "Separação de bens", participacao: "Participação final nos aquestos" };
  // Pontos de partida para o preenchimento rápido; confirme com o advogado do caso.
  const PRESETS = {
    extrajudicial: { fees: 4, costs: 1.5, months: 6, label: "Extrajudicial (cartório, herdeiros capazes e em consenso)" },
    judicial: { fees: 6, costs: 2, months: 24, label: "Judicial (litígio, incapazes ou sem consenso)" }
  };

  /* ctx = { bs (Planning.balanco), protection (opcional: usa protect.existingLife como seguro fora do inventário) }
     Estimativa para o falecimento de quem é titular do patrimônio cadastrado. */
  function analyze(s, ctx, overrides) {
    const c = Object.assign({}, s.succ, overrides || {}), bs = ctx.bs;
    const pensionAuto = s.diag.bsAssets.reduce((t, a) => t + (PENSION_RE.test(a.label || "") ? pos(a.value) : 0), 0);
    const pension = c.pensionOverride != null ? pos(c.pensionOverride) : pensionAuto;
    const life = pos(s.protect.existingLife);
    const debts = pos(bs.totalLiab);
    const assets = pos(bs.totalAssets);
    const monte = Math.max(0, assets - pension - debts);          // monte-mor líquido de dívidas, sem previdência
    const community = c.spouse && COMMUNITY[c.regime];
    const commonShare = c.regime === "comunhao_universal" ? 1 : pos(c.commonPct) / 100;
    const meacao = community ? monte * 0.5 * Math.min(1, commonShare) : 0;
    const base = Math.max(0, monte - meacao);                      // base do ITCMD (herança, sem a meação)
    const itcmd = base * pos(c.itcmd) / 100;
    const fees = monte * pos(c.fees) / 100;                         // honorários e custas sobre o monte-mor
    const costs = monte * pos(c.costs) / 100;
    const carry = pos(c.carry) * pos(c.months);
    const total = itcmd + fees + costs + carry;
    const liquidInside = pos(bs.byLiq.imediata) + pos(bs.byLiq.curta);
    const liquidInsideEstate = Math.max(0, liquidInside - (s.diag.bsAssets.reduce((t, a) => t + (PENSION_RE.test(a.label || "") && (a.liq === "imediata" || a.liq === "curta") ? pos(a.value) : 0), 0)));
    const outside = pension + life;
    const gap = Math.max(0, total - outside);
    const gapAfterRelease = Math.max(0, total - outside - liquidInsideEstate);
    const illiquid = pos(bs.byLiq.iliquida);
    const estateAssets = Math.max(1, assets - pension);
    return {
      assets: assets, pension: pension, pensionAuto: pensionAuto, pensionIsOverride: c.pensionOverride != null, life: life, debts: debts,
      monte: monte, meacao: meacao, base: base, community: !!community, legitima: monte * 0.5, heirs: c.heirs,
      itcmd: itcmd, fees: fees, costs: costs, carry: carry, total: total, totalPct: monte > 0 ? total / monte * 100 : null,
      liquidOutside: outside, liquidInside: liquidInsideEstate, gap: gap, gapAfterRelease: gapAfterRelease,
      coverage: total > 0 ? Math.min(2, outside / total) : null,
      illiquid: illiquid, illiquidShare: illiquid / estateAssets * 100,
      parts: [
        { key: "itcmd", label: "ITCMD (imposto estadual sobre a herança)", value: itcmd },
        { key: "fees", label: "Honorários advocatícios", value: fees },
        { key: "costs", label: "Custas, emolumentos e certidões", value: costs },
        { key: "carry", label: "Custo de manter os bens durante o inventário", value: carry }
      ],
      params: c
    };
  }

  // Quanto o custo e a lacuna mudam com a alíquota do ITCMD (varia por estado, em geral entre 2% e 8%).
  function sensitivity(s, ctx, rates) {
    return (rates || [2, 4, 6, 8]).map(function (r) { const a = analyze(s, ctx, { itcmd: r }); return { itcmd: r, total: a.total, gap: a.gap, totalPct: a.totalPct }; });
  }

  return { analyze, sensitivity, REGIME_LABEL, PRESETS, PENSION_RE };
})();
if (typeof module !== "undefined") module.exports = Succession;
/* SUCCESSION:END */

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
    ["taxRows", "Estrutura tributária", [["value", "valor", "money"], ["kind", "tipo", "text"], ["years", "anos", "int"]]],
    ["commitments", "Compromisso", [["include", "incluído", "bool"], ["value", "valor", "money"], ["due", "prazo", "text"]], "text"]
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
      const kf = L[3] || "label", key = (r, i) => String(r[kf] || ("#" + (i + 1))).trim().toLowerCase().slice(0, 80);
      const ma = {}, mb = {};
      la.forEach((r, i) => { ma[key(r, i)] = r; }); lb.forEach((r, i) => { mb[key(r, i)] = r; });
      Object.keys(mb).forEach(function (k) {
        if (!ma[k]) out.push({ group: L[1] + "s", label: L[1] + " adicionado(a): " + (mb[k][kf] || k), a: null, b: null, fmt: "text" });
        else L[2].forEach(function (f) { if (!same(ma[k][f[0]], mb[k][f[0]])) out.push({ group: L[1] + "s", label: L[1] + " “" + (mb[k][kf] || k) + "”: " + f[1], a: ma[k][f[0]], b: mb[k][f[0]], fmt: f[2] }); });
      });
      Object.keys(ma).forEach(function (k) { if (!mb[k]) out.push({ group: L[1] + "s", label: L[1] + " removido(a): " + (ma[k][kf] || k), a: null, b: null, fmt: "text" }); });
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
    [state.extraMonthly, state.extraAnnual, state.retIncome, state.actions, state.memos, state.diag.bsAssets, state.diag.bsLiabilities, state.diag.flow, state.goals, state.phaseRows, state.taxRows, state.commitments].forEach((l) => l.forEach((r) => { rowSeq = Math.max(rowSeq, (r.id || 0) + 1); }));
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
        document.querySelectorAll('[data-path="' + el.dataset.path + '"]').forEach((o) => { if (o !== el) fillField(o); });
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
  const L_CKIND = [["aporte", "Aporte"], ["reserva", "Reserva"], ["divida", "Dívida"], ["meta", "Meta"], ["protecao", "Proteção"], ["sucessao", "Sucessão"], ["tributario", "Tributário"], ["dados", "Dados e documentos"], ["comportamento", "Comportamento"], ["outro", "Outro"]];
  const L_CFREQ = [["mensal", "Por mês"], ["anual", "Por ano"], ["unico", "Valor único"], ["na", "Sem valor"]];
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
    commitments: {
      path: "commitments", box: "commitRows", add: "addCommit", empty: "Nenhum compromisso ainda. Use “Sugerir a partir do plano” para começar.",
      make: () => ({ text: "", kind: "outro", value: 0, freq: "na", due: "", owner: "cliente", include: true, source: "" }),
      fields: [{ k: "text", l: "Compromisso", t: "textarea", span: 9, max: 300 }, { k: "include", l: "Entra no documento", t: "bool", span: 3, rerender: true }, { k: "kind", l: "Tipo", t: "select", opts: L_CKIND, span: 3 }, { k: "value", l: "Valor (R$)", t: "money", span: 3 }, { k: "freq", l: "Periodicidade", t: "select", opts: L_CFREQ, span: 2 }, { k: "due", l: "Prazo", t: "date", span: 2 }, { k: "owner", l: "Responsável", t: "select", opts: L_OWNER, span: 2 }],
      cls: (r) => (r.include ? "" : "off")
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
    if (f.t === "bool") return '<label class="switch-row" style="padding:6px 0"><input type="checkbox" data-field="' + k + '"' + aria + (v ? " checked" : "") + "><span>" + (v ? "Incluído" : "Fora do documento") + "</span></label>";
    if (f.t === "date") return '<input type="date" data-field="' + k + '"' + aria + ' value="' + esc(v || "") + '">';
    return '<input type="text" maxlength="' + (f.max || 160) + '" data-field="' + k + '"' + aria + ' value="' + esc(v) + '" autocomplete="off">';
  }
  const fieldHTML = (f, row) => '<div class="mini" style="grid-column:span ' + (f.span || 12) + '"><label>' + esc(f.l) + "</label>" + inputHTML(f, row) + "</div>";

  function wireRow(el, cfg, name, row) {
    el.querySelectorAll("[data-field]").forEach((inp) => {
      const f = cfg.fields.find((x) => x.k === inp.dataset.field);
      inp.addEventListener(inp.tagName === "SELECT" || inp.type === "date" || inp.type === "checkbox" ? "change" : "input", () => {
        let v = inp.value;
        if (f.t === "bool") v = inp.checked;
        else if (f.t === "money") v = Engine.parseLocaleNumber(inp.value);
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
    const html = '<div class="disclaimer"><b>Aviso.</b> ' + d.lines.map(esc).join(" ") + (d.filled ? "" : '<div class="banner warn no-pdf" style="margin:8px 0 0">Identificação incompleta: preencha em <b>Abertura → Profissional e escopo</b>.</div>') + "</div>";
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
  function openActionsSorted() {
    return state.actions.filter((a) => a.status !== "concluida").sort((a, b) => (PRIO_RANK[a.priority] - PRIO_RANK[b.priority]) || ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0) || a.id - b.id);
  }
  function top3HTML(emptyMsg) {
    const sorted = openActionsSorted().slice(0, 3);
    return sorted.length ? '<div class="top3">' + sorted.map((a, i) => '<div class="t"><div class="n">' + (i + 1) + '</div><div><div class="tt">' + esc(a.title || "(sem título)") + '</div><div class="tm">' + label(L_OWNER, a.owner) + " · " + (a.due ? "prazo " + a.due.split("-").reverse().join("/") : "sem prazo") + " · " + label(L_STATUS, a.status) + (a.next ? " · próximo passo: " + esc(a.next) : "") + '</div></div><span class="badge ' + PRIO_BADGE[a.priority] + '">' + label(L_PRIORITY, a.priority) + "</span></div>").join("") + "</div>" : '<div class="empty-note">' + (emptyMsg || "Nenhuma ação aberta. Adicione ações abaixo ou use as sugestões do sistema.") + "</div>";
  }
  function computeSuggestions(c) {
    c = c || Synthesis.context(state);
    const tauEst = state.taxRows.length ? taxOf().tau : null;
    return Planning.suggestions(state, { an: c.an, bs: c.bs, fl: c.fl, rs: c.rs, ind: c.ind, quality: c.q, goals: c.goals, protection: c.prot, succession: c.succ, tauEst, stress: c.crise ? { crise: c.crise } : {} }).filter((x) => !state.actions.some((a) => a.source === x.key));
  }
  function renderPlan() {
    const t = todayISO(), open = state.actions.filter((a) => a.status !== "concluida");
    const overdue = open.filter((a) => a.due && a.due < t), blocked = open.filter((a) => a.status === "bloqueada"), done = state.actions.filter((a) => a.status === "concluida");
    $("planKpis").innerHTML = tileHTML("Ações abertas", open.length, open.filter((a) => a.status === "em_curso").length + " em curso") + tileHTML("Prazo vencido", overdue.length, "Abertas com prazo anterior a hoje", overdue.length ? "neg" : "") + tileHTML("Bloqueadas", blocked.length, "Dependem de documento, liquidez ou decisão") + tileHTML("Concluídas", done.length, state.actions.length ? Math.round(done.length / state.actions.length * 100) + "% do plano" : "Sem ações cadastradas");
    $("top3").innerHTML = top3HTML();
    const sug = computeSuggestions();
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

  /* ================= etapas da reunião ================= */
  const STAGES = [
    { id: "open", name: "Abertura", panes: ["open"], ask: "Quem é o cliente, o que ele espera da reunião e o que já trouxe?" },
    { id: "diag", name: "Diagnóstico", panes: ["diag"], ask: "Qual é a situação de hoje: patrimônio, fluxo, reserva, dívidas e qualidade dos dados?" },
    { id: "obj", name: "Objetivos", panes: ["obj"], ask: "O que o cliente quer realizar, até quando e em que ordem de importância?" },
    { id: "ana", name: "Análises", panes: ["cx", "prot", "apos", "succ"], ask: "Os recursos dão conta dos objetivos? Como proteger a família e o patrimônio?" },
    { id: "tax", name: "Tributação", panes: ["irm", "ira", "pgbl"], optional: true, ask: "Há eficiência tributária a avaliar com o contador? (etapa opcional)" },
    { id: "syn", name: "Síntese e plano", panes: ["syn", "plan"], ask: "O que priorizar? Quem faz o quê, e até quando?" },
    { id: "ips", name: "Compromisso", panes: ["ips"], ask: "O cliente assume estes compromissos? Registre o aceite e gere o documento." }
  ];
  const PANE_LABEL = { open: "Abertura", diag: "Diagnóstico", obj: "Objetivos", cx: "Caixa e dívidas", prot: "Proteção", apos: "Aposentadoria", succ: "Sucessão", irm: "IRPF mensal", ira: "IRPF anual e PGBL", pgbl: "PGBL no longo prazo", syn: "Diagnóstico final", plan: "Plano de ação", ips: "Compromisso (IPS)", ver: "Versões" };
  const FLOW = STAGES.flatMap((x) => x.panes), TABS = FLOW.concat(["ver"]);
  const stageOf = (t) => { const x = STAGES.find((y) => y.panes.includes(t)); return x ? x.id : null; };
  const stageLast = {};
  const seenList = () => Object.keys(state.meeting.seen).filter((k) => state.meeting.seen[k]);
  const taxSeen = () => ["irm", "ira", "pgbl"].some((k) => state.meeting.seen[k]);
  const fdate = (iso) => (iso ? String(iso).split("-").reverse().join("/") : "—");

  function renderStages() {
    const st = Synthesis.stages(state, seenList()), m = {};
    st.list.forEach((x) => { m[x.id] = x; });
    document.querySelectorAll(".stage[data-stage]").forEach((b) => { const x = m[b.dataset.stage]; b.classList.toggle("done", !!(x && x.done)); b.classList.toggle("optional", !!(x && x.optional)); });
  }
  const OPT_PANES = (STAGES.find((x) => x.optional) || { panes: [] }).panes;
  // Fora da etapa opcional, o "próximo" e o "anterior" a pulam; um botão extra oferece entrar nela.
  function navTargets(t) {
    const inOpt = OPT_PANES.includes(t), flow = inOpt ? FLOW : FLOW.filter((x) => !OPT_PANES.includes(x)), i = flow.indexOf(t), fi = FLOW.indexOf(t);
    return { prev: i > 0 ? flow[i - 1] : null, next: i >= 0 && i < flow.length - 1 ? flow[i + 1] : null, opt: !inOpt && i >= 0 && i < flow.length - 1 && FLOW[fi + 1] !== flow[i + 1] ? FLOW[fi + 1] : null };
  }
  function renderStepNav() {
    const box = document.querySelector("#pane-" + active + " .stepnav"); if (!box) return;
    const g = STAGES.find((x) => x.id === stageOf(active)); if (!g) { box.innerHTML = ""; return; }
    const nv = navTargets(active);
    box.innerHTML = (nv.prev ? '<button class="btn ghost" type="button" data-go="' + nv.prev + '">← ' + esc(PANE_LABEL[nv.prev]) + "</button>" : "<span></span>") +
      '<span class="hint">Etapa ' + (STAGES.indexOf(g) + 1) + " de " + STAGES.length + " · " + esc(g.name) + (g.panes.length > 1 ? " (" + (g.panes.indexOf(active) + 1) + "/" + g.panes.length + ")" : "") + "</span>" +
      '<span class="nxt">' + (nv.opt ? '<button class="btn ghost" type="button" data-go="' + nv.opt + '">Tributação (opcional)</button>' : "") + (nv.next ? '<button class="btn" type="button" data-go="' + nv.next + '">' + esc(PANE_LABEL[nv.next]) + " →</button>" : "") + "</span>";
  }

  /* ---------- Abertura: roteiro ---------- */
  function renderOpen() {
    const st = Synthesis.stages(state, seenList()), byId = {};
    st.list.forEach((x) => { byId[x.id] = x; });
    $("roadmap").innerHTML = '<div class="road">' + STAGES.map((g, i) => {
      const x = byId[g.id], cls = x.done ? " done" : st.next === g.id ? " next" : "";
      const chip = x.done ? '<span class="badge good">Concluída</span>' : st.next === g.id ? '<span class="badge warning">Próxima</span>' : g.optional ? '<span class="badge neutral">Opcional</span>' : "";
      return '<div class="road-item' + cls + '"><div class="n">' + (x.done ? "✓" : i + 1) + '</div><div><div class="t">' + esc(g.name) + " " + chip + '</div><div class="q">' + esc(g.ask) + '</div></div><button class="btn-small no-pdf" type="button" data-go="' + (stageLast[g.id] || g.panes[0]) + '">' + (x.done ? "Revisar" : "Abrir") + "</button></div>";
    }).join("") + "</div>";
  }

  /* ---------- Diagnóstico final ---------- */
  const AREA_BADGE = { ok: ["good", "Em ordem"], warn: ["warning", "Atenção"], crit: ["critical", "Prioridade"], info: ["neutral", "Informativo"], na: ["neutral", "Sem dado"] };
  function renderSyn() {
    const c = Synthesis.context(state), list = Synthesis.areas(c, { taxVisited: taxSeen() }), sm = Synthesis.summary(list), ex = Synthesis.executive(c, list);
    $("synSummary").innerHTML = '<div class="sum-lines">' + ex.map((l) => "<p>" + esc(l) + "</p>").join("") + "</div>" +
      '<div class="sum-chips">' + (sm.counts.crit ? '<span class="badge critical">' + sm.counts.crit + " prioridade" + (sm.counts.crit > 1 ? "s" : "") + "</span>" : "") + (sm.counts.warn ? '<span class="badge warning">' + sm.counts.warn + " em atenção</span>" : "") + '<span class="badge good">' + sm.counts.ok + " em ordem</span>" + (sm.counts.na ? '<span class="badge neutral">' + sm.counts.na + " sem dado</span>" : "") + "</div>";
    $("synAreas").innerHTML = '<div class="area-wrap"><table class="area-table"><thead><tr><th>Área</th><th>Situação</th><th>Leitura</th><th class="no-pdf"></th></tr></thead><tbody>' + list.map((a) => {
      const b = AREA_BADGE[a.status] || AREA_BADGE.na;
      return '<tr><td class="a">' + esc(a.label) + '</td><td class="s"><span class="badge ' + b[0] + '">' + b[1] + '</span></td><td><div class="hd">' + esc(a.headline) + "</div>" + (a.detail ? '<div class="dt">' + esc(a.detail) + "</div>" : "") + '</td><td class="go no-pdf"><button class="btn-small" type="button" data-go="' + a.tab + '">' + esc(a.tabLabel) + "</button></td></tr>";
    }).join("") + "</tbody></table></div>";
    const open = openActionsSorted();
    if (open.length) $("synTop3").innerHTML = top3HTML();
    else {
      const sug = computeSuggestions(c).slice(0, 3);
      $("synTop3").innerHTML = (sug.length ? '<div class="empty-note" style="padding-top:0">O plano de ação ainda está vazio. Estas são as prioridades apontadas pelos números; transforme-as em ações na etapa seguinte.</div><div class="top3">' + sug.map((x, i) => '<div class="t"><div class="n">' + (i + 1) + '</div><div><div class="tt">' + esc(x.title) + '</div><div class="tm">' + esc(x.evidence) + '</div></div><span class="badge ' + PRIO_BADGE[x.priority] + '">' + label(L_PRIORITY, x.priority) + "</span></div>").join("") + "</div>" : '<div class="empty-note">Sem prioridades apontadas pelos números. Registre as decisões da reunião no plano de ação.</div>') +
        '<div class="actions no-pdf" style="margin-top:12px"><button class="btn" type="button" data-go="plan">Montar o plano de ação</button></div>';
    }
  }

  /* ---------- Compromisso (IPS) ---------- */
  const FREQ_TXT = { mensal: " por mês", anual: " por ano", unico: "", na: "" };
  const commitValue = (x) => (x.freq === "na" || !(x.value > 0) ? "—" : money(x.value) + (FREQ_TXT[x.freq] || ""));
  const TOL_TXT = { conservadora: "conservadora (prefere previsibilidade)", moderada: "moderada (aceita oscilar um pouco)", arrojada: "arrojada (aceita oscilar bastante)" };
  const kv = (k, v, pre) => "<dt>" + esc(k) + "</dt><dd" + (pre ? ' style="white-space:pre-wrap"' : "") + ">" + esc(v) + "</dd>";
  function ipsDocHTML(m, altered) {
    const id = m.identification, inv = m.investment, ac = m.acceptance;
    const stamp = ac.status === "aceito" ? '<span class="stamp ok">Aceito em ' + fdate(ac.acceptedOn) + "</span>" + (altered ? '<span class="stamp draft">com alterações posteriores</span>' : "") : '<span class="stamp draft">Rascunho: ainda não aceito</span>';
    let h = '<div class="ips-doc"><div class="ips-title"><div class="kicker">Declaração de política de planejamento</div><h3>Compromisso de planejamento financeiro ' + stamp + "</h3></div>";
    h += "<h4>1. Identificação</h4><dl class=\"kv\">" + kv("Cliente", id.client || "—") + kv("Planejador", id.planner ? id.planner + (id.cert ? " · " + id.cert : "") : "—") +
      kv("Autorização de consultor (CVM)", id.cvm === "sim" ? "Possui" + (id.cvmNo ? " · " + id.cvmNo : "") : "Não possui; este documento não recomenda valores mobiliários") + kv("Data", fdate(id.date)) + kv("Revisão do plano", "a cada " + id.reviewMonths + " meses; próxima em " + fdate(id.nextReview)) + "</dl>";
    h += '<h4>2. Situação na data</h4><dl class="kv">' + m.situation.map((x) => kv(x.label, x.value)).join("") + "</dl>";
    h += "<h4>3. Objetivos do cliente</h4>" + (m.objectives.length ? "<ul>" + m.objectives.map((o) => "<li><b>" + esc(o.label) + ".</b> " + esc(o.detail) + "</li>").join("") + "</ul>" : "<p>Nenhum objetivo cadastrado.</p>");
    h += "<h4>4. Premissas do plano</h4><ul>" + m.assumptions.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul>";
    h += "<h4>5. Compromissos assumidos</h4>" + (m.commitments.length ? '<table><thead><tr><th>#</th><th>Compromisso</th><th>Valor</th><th>Prazo</th><th>Responsável</th></tr></thead><tbody>' + m.commitments.map((x, i) => "<tr><td>" + (i + 1) + "</td><td>" + esc(x.text) + '</td><td class="r">' + esc(commitValue(x)) + '</td><td class="r">' + esc(fdate(x.due)) + "</td><td>" + esc(label(L_OWNER, x.owner)) + "</td></tr>").join("") + "</tbody></table>" : "<p>Nenhum compromisso incluído.</p>");
    h += "<h4>6. Regras de decisão e revisão</h4><table><thead><tr><th>Regra</th><th>Critério</th><th>Hoje</th></tr></thead><tbody>" + m.rules.map((r) => "<tr><td><b>" + esc(r.label) + "</b></td><td>" + esc(r.rule) + "</td><td>" + (r.current ? esc(r.current) : "") + (r.status === "ok" ? ' <span class="badge good">dentro</span>' : r.status === "crit" ? ' <span class="badge critical">fora</span>' : "") + "</td></tr>").join("") + "</tbody></table>";
    h += '<h4>7. Responsabilidades</h4><div class="two"><div><b>Do cliente</b><ul>' + m.responsibilities.client.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div><div><b>Do planejador</b><ul>" + m.responsibilities.planner.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div></div>";
    h += '<h4>8. Escopo, remuneração e conflitos de interesse</h4><dl class="kv">' + kv("Escopo do serviço", m.scope.scope || "[preencher na Abertura]", true) + kv("Remuneração", m.scope.fee || "[preencher na Abertura]", true) + kv("Conflitos de interesse", m.scope.conflicts || "[preencher na Abertura]", true) + "</dl>";
    h += "<h4>9. Investimentos</h4>";
    if (inv.mode === "autorizado") {
      h += "<p>Diretrizes de responsabilidade do consultor autorizado" + (inv.profileDate ? "; perfil de investidor de " + fdate(inv.profileDate) : "") + ".</p><p style=\"white-space:pre-wrap\">" + esc(inv.policy || "[diretrizes não preenchidas]") + "</p>";
      if (inv.tolerance || inv.drawdown) h += "<p>Percepção de risco declarada: " + esc(TOL_TXT[inv.tolerance] || "não informada") + "; queda suportada sem mudar o plano: " + pct1(inv.drawdown) + ".</p>";
    } else {
      h += "<p>Este documento <b>não define alocação de ativos nem recomenda valores mobiliários</b>: o planejador não possui autorização de consultor da CVM. A escolha dos investimentos cabe ao cliente, com profissional habilitado. As necessidades e restrições abaixo orientam essa escolha:</p><ul>" + inv.needs.map((n) => "<li><b>" + esc(n.label) + ":</b> " + esc(n.detail) + "</li>").join("") + "</ul>";
      h += "<p>Percepção de risco declarada pelo cliente: " + esc(TOL_TXT[inv.tolerance] || "não informada") + "; queda do patrimônio financeiro que suportaria sem mudar o plano: " + pct1(inv.drawdown) + ".</p>";
    }
    if (state.ips.notes) h += "<h4>10. Observações</h4><p style=\"white-space:pre-wrap\">" + esc(state.ips.notes) + "</p>";
    h += '<div class="keep"><h4>' + (state.ips.notes ? "11" : "10") + ". Aviso</h4><p style=\"font-size:11.5px;color:var(--ink-secondary)\">" + m.disclaimer.lines.map(esc).join(" ") + "</p>";
    h += '<div class="sign"><div>' + esc(id.client || "Cliente") + "<br>Cliente · data: ____/____/________</div><div>" + esc(id.planner || "Planejador") + "<br>Planejador · data: ____/____/________</div></div></div>";
    if (ac.status === "aceito") h += '<p style="margin-top:14px;font-size:11.5px;color:var(--ink-muted)">Aceite registrado na ferramenta em ' + fdate(ac.acceptedOn) + ". Os valores acima correspondem ao plano nessa data.</p>";
    return h + "</div>";
  }
  function acceptedVersion() { return state.ips.acceptedVersion ? state.versions.find((v) => v.id === state.ips.acceptedVersion) || null : null; }

  function acceptIps() {
    const toast = $("ipsToast");
    if (state.versions.length >= Engine.MAX_VERSIONS) { const i = state.versions.findIndex((x) => x.auto); if (i >= 0) state.versions.splice(i, 1); }
    if (state.versions.length >= Engine.MAX_VERSIONS) { toast.textContent = "Limite de " + Engine.MAX_VERSIONS + " versões: exclua uma na aba Versões antes de registrar o aceite."; return; }
    const iso = todayISO(), nextId = state.versions.reduce((mx, v) => Math.max(mx, v.id || 0), 0) + 1;
    state.ips.status = "aceito"; state.ips.acceptedOn = iso; state.ips.acceptedVersion = nextId;
    state.versions.push(Versions.make(state, "Compromisso aceito em " + fdate(iso), "Fotografia do plano no momento do aceite do IPS", new Date().toISOString(), false));
    saveNow(); renderAll();
    $("ipsToast").textContent = "Aceite registrado e versão guardada. Salve o PDF e um backup em arquivo.";
  }
  function reopenIps() { state.ips.status = "rascunho"; state.ips.acceptedOn = ""; saveNow(); renderAll(); $("ipsToast").textContent = "Documento reaberto como rascunho. A versão aceita continua guardada em Versões."; }

  function suggestCommitments(refresh) {
    const c = Synthesis.context(state), list = Synthesis.commitments(c, { taxVisited: taxSeen() });
    let added = 0, updated = 0;
    list.forEach((x) => {
      const cur = state.commitments.find((y) => y.source === x.source);
      if (!cur) { state.commitments.push(Object.assign({ id: rowSeq++ }, x)); added++; }
      else if (refresh && (cur.text !== x.text || cur.value !== x.value)) { cur.text = x.text; cur.value = x.value; updated++; }
    });
    renderCards("commitments"); renderAll(); scheduleSave();
    $("commitToast").textContent = refresh ? (updated ? updated + " compromisso(s) atualizado(s) com os números atuais." : "Os valores já estão atualizados.") : (added ? added + " compromisso(s) sugerido(s). Marque os que o cliente decidiu assumir." : "Nenhum compromisso novo: o plano atual já está coberto.");
  }

  function renderIps() {
    const c = Synthesis.context(state), m = Synthesis.ipsModel(c, { taxVisited: taxSeen() }), av = acceptedVersion();
    const ch = av ? Versions.changes(av.state, state).filter((x) => x.group !== "Compromissos") : [], chC = av ? Versions.changes(av.state, state).filter((x) => x.group === "Compromissos") : [];
    const altered = !!av && (ch.length > 0 || chC.length > 0);
    $("ipsWarnings").innerHTML = m.warnings.length ? '<div class="banner warn"><b>Antes de apresentar o documento:</b><ul>' + m.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") + "</ul></div>" : '<div class="banner ok"><b>Sem pendências.</b> O documento está completo com os dados atuais.</div>';
    $("ipsReserveHint").textContent = "Meses de despesas essenciais. Em branco: usa o valor calculado no Diagnóstico (" + fmtD(c.rs.months, 1) + " meses).";
    $("ipsInvestForm").style.display = state.pro.cvm === "sim" ? "" : "none";
    $("ipsDoc").innerHTML = ipsDocHTML(m, altered);
    let a = "";
    if (state.ips.status === "aceito") {
      a += '<div class="banner ok" style="margin-bottom:10px"><b>Aceito em ' + fdate(state.ips.acceptedOn) + ".</b> " + (av ? "Versão guardada: “" + esc(av.name) + "”." : "A versão guardada no aceite não está mais na lista.") + "</div>";
      if (altered) a += '<div class="banner warn"><b>Há alterações desde o aceite (' + (ch.length + chC.length) + "):</b><ul>" + ch.concat(chC).slice(0, 8).map((x) => "<li>" + esc(x.label) + (x.fmt === "text" && x.a == null && x.b == null ? "" : ": " + esc(fmtVal(x.fmt, x.a)) + " → " + esc(fmtVal(x.fmt, x.b))) + "</li>").join("") + (ch.length + chC.length > 8 ? "<li>… e mais " + (ch.length + chC.length - 8) + " (compare em Versões)</li>" : "") + "</ul>Se o cliente concordou com as mudanças, registre um novo aceite.</div>";
      a += '<div class="actions"><button class="btn" id="btnIpsRenew" type="button">Registrar novo aceite</button><button class="btn ghost" id="btnIpsReopen" type="button">Reabrir para edição</button><button class="btn ghost" id="btnIpsBackup" type="button"' + (downloadsNS ? "" : " hidden") + '>Salvar backup (.json)</button><span class="toast" id="ipsToast"></span></div>';
    } else {
      const blocked = !state.client.name || !m.commitments.length;
      a += '<div class="card-hint" style="padding:0 0 10px">O aceite guarda uma fotografia completa do plano em <b>Versões</b>, para comparar nas revisões. Registre-o só depois de o cliente ler o documento acima e concordar.</div>';
      a += '<div class="actions"><button class="btn" id="btnIpsAccept" type="button"' + (blocked ? " disabled" : "") + '>Registrar aceite do cliente</button><span class="toast" id="ipsToast">' + (blocked ? "Informe o nome do cliente e inclua ao menos um compromisso." : "") + "</span></div>";
    }
    $("ipsAccept").innerHTML = a;
    const arm = (id, lbl, fn) => { const b = $(id); if (b) armed(b, lbl, fn); };
    arm("btnIpsAccept", "Clique de novo: registrar o aceite", acceptIps);
    arm("btnIpsRenew", "Clique de novo: registrar novo aceite", acceptIps);
    arm("btnIpsReopen", "Clique de novo: reabrir como rascunho", reopenIps);
    const bk = $("btnIpsBackup"); if (bk) bk.addEventListener("click", exportBackup);
  }

  /* ================= abas, render global e tema ================= */
  let active = "open";
  try { const t = localStorage.getItem(TABKEY); if (TABS.includes(t)) active = t; } catch (e) { /* ignore */ }
  const RENDER = { open: renderOpen, diag: renderDiag, obj: renderObj, cx: renderCx, prot: renderProt, succ: renderSucc, apos: renderApos, irm: renderIrm, ira: renderIra, pgbl: renderPgbl, syn: renderSyn, plan: renderPlan, ips: renderIps, ver: renderVer };
  function renderAll() {
    document.querySelectorAll("[data-client-line]").forEach((el) => { el.textContent = state.client.name ? "Cliente: " + state.client.name : "Cenário sem nome de cliente"; });
    $("whoLine").textContent = state.client.name || "";
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    document.querySelectorAll("[data-today]").forEach((el) => { el.textContent = today; });
    RENDER[active]();
    renderStages(); renderStepNav(); renderDisclaimers(); renderDataSafety();
    const bk = $("backupExport").closest("details"); if (bk && bk.open) $("backupExport").value = JSON.stringify(state, null, 2);
  }
  function markSeen(t) { if (state.meeting.seen[t] === false) { state.meeting.seen[t] = true; scheduleSave(); } }
  function syncBarHeight() { const h = $("appbar").offsetHeight; if (h) document.documentElement.style.setProperty("--topbar", h + "px"); }
  function setTab(t) {
    if (!TABS.includes(t)) return;
    active = t; markSeen(t);
    const sid = stageOf(t), g = STAGES.find((x) => x.id === sid), multi = !!g && g.panes.length > 1;
    if (sid) stageLast[sid] = t;
    document.querySelectorAll(".stage").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.stage ? b.dataset.stage === sid : b.dataset.tab === t)));
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    $("substrip").classList.toggle("on", multi);
    document.querySelectorAll(".sub-group").forEach((gr) => gr.classList.toggle("on", multi && gr.dataset.stage === sid));
    document.querySelectorAll(".pane").forEach((pn) => pn.classList.toggle("active", pn.id === "pane-" + t));
    syncBarHeight();
    const cur = document.querySelector('#stages .stage[aria-selected="true"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
    try { localStorage.setItem(TABKEY, t); } catch (e) { /* ignore */ }
    const pane = $("pane-" + t); if (pane) { const sc = pane.querySelector(".canvas") || pane; sc.scrollTop = 0; }
    renderAll();
  }
  const stageTarget = (b) => (b.dataset.stage ? stageLast[b.dataset.stage] || STAGES.find((x) => x.id === b.dataset.stage).panes[0] : b.dataset.tab);
  document.querySelectorAll(".stage").forEach((b) => {
    b.title = b.dataset.stage ? STAGES.find((x) => x.id === b.dataset.stage).ask : "Fotografias do plano e comparação entre versões";
    b.addEventListener("click", () => setTab(stageTarget(b)));
    b.addEventListener("keydown", (e) => {
      const all = [...document.querySelectorAll(".stage")], i = all.indexOf(b);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length]; n.focus(); setTab(stageTarget(n)); }
    });
  });
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      const tabs = [...b.parentElement.querySelectorAll(".tab")], i = tabs.indexOf(b);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setTab(n.dataset.tab); }
    });
  });
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-go]"); if (b && TABS.includes(b.dataset.go)) setTab(b.dataset.go); });
  window.addEventListener("resize", syncBarHeight);
  $("scenarioPick").addEventListener("change", renderAll);
  let themeTimer = null;
  const rerenderTheme = () => { clearTimeout(themeTimer); themeTimer = setTimeout(renderAll, 80); };
  new MutationObserver(rerenderTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rerenderTheme);

  /* ================= backup, privacidade e arquivos ================= */
  const PDF_SHEETS = { btnPdfDiag: ["sheetDiag", "asset-planning-diagnostico.pdf"], btnPdfPlan: ["sheetPlan", "asset-planning-plano-de-acao.pdf"], btnPdfApos: ["sheetApos", "asset-planning-aposentadoria.pdf"], btnPdfIrm: ["sheetIrm", "asset-planning-irpf-mensal.pdf"], btnPdfIra: ["sheetIra", "asset-planning-irpf-anual-pgbl.pdf"], btnPdfPgbl: ["sheetPgbl", "asset-planning-pgbl-longo-prazo.pdf"], btnPdfObj: ["sheetObj", "asset-planning-objetivos.pdf"], btnPdfCx: ["sheetCx", "asset-planning-caixa-e-dividas.pdf"], btnPdfProt: ["sheetProt", "asset-planning-protecao.pdf"], btnPdfSucc: ["sheetSucc", "asset-planning-sucessao.pdf"], btnPdfVer: ["sheetVer", "asset-planning-versoes.pdf"], btnPdfSyn: ["sheetSyn", "asset-planning-diagnostico-final.pdf"], btnPdfIps: ["sheetIps", "asset-planning-ips-compromisso.pdf"] };
  let downloadsNS = null;
  function updateDownloadUI() {
    const has = !!downloadsNS, pdfOk = has && typeof window.html2pdf === "function";
    $("btnExportFile").hidden = !has; $("btnBackupOpen").hidden = !has;
    const ib = $("btnIpsBackup"); if (ib) ib.hidden = !has;
    Object.keys(PDF_SHEETS).forEach((id) => { $(id).hidden = !pdfOk; });
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

  /* ================= segurança dos dados: backup, armazenamento persistente, instalação ================= */
  const LASTBK = "asset-planning-lastbackup", BACKUP_DAYS = 14;
  const buildId = () => { const m = document.querySelector('meta[name="build-id"]'); return m ? m.content : ""; };
  const isStandaloneApp = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isHosted = () => document.documentElement.dataset.host === "pages";
  let storagePersisted = null, installEvt = null;
  function lastBackup() { try { const v = localStorage.getItem(LASTBK); return v ? new Date(v) : null; } catch (e) { return null; } }
  function markBackup() { try { localStorage.setItem(LASTBK, new Date().toISOString()); } catch (e) { /* ignore */ } renderDataSafety(); }
  function backupAgeDays() { const d = lastBackup(); return d && !isNaN(d) ? Math.floor((Date.now() - d.getTime()) / 864e5) : null; }
  function renderDataSafety() {
    const age = backupAgeDays(), d = lastBackup();
    const overdue = age == null || age > BACKUP_DAYS;
    let html = '<div class="safety-box ' + (overdue ? "warn" : "ok") + '"><b>' + (age == null ? "Nenhum backup em arquivo neste aparelho." : "Último backup: " + d.toLocaleDateString("pt-BR") + " (" + (age === 0 ? "hoje" : "há " + age + (age === 1 ? " dia" : " dias")) + ").") + "</b> " +
      (overdue ? "Os dados ficam só neste navegador: se o histórico for limpo ou o aparelho trocado, eles se perdem. Salve um backup em arquivo e guarde em local seguro." : "Mantenha o hábito: salve um novo backup depois de cada reunião.") + "</div>";
    if (storagePersisted === false) html += '<div class="safety-note">O navegador ainda não marcou este armazenamento como permanente; o backup em arquivo é a garantia.</div>';
    if (isIOS() && !isStandaloneApp() && isHosted()) html += '<div class="safety-note"><b>iPhone e iPad:</b> o Safari pode apagar os dados de um site sem uso por 7 dias. Para evitar, toque em Compartilhar e em “Adicionar à Tela de Início”, e abra o app por esse ícone.</div>';
    if (installEvt) html += '<div class="safety-note"><button class="btn-small primary" type="button" data-install="1">Instalar como aplicativo</button> Abre em janela própria e funciona sem internet.</div>';
    if (buildId()) html += '<div class="safety-note">Versão do app: ' + esc(buildId()) + (isStandaloneApp() ? " (instalado)" : "") + "</div>";
    document.querySelectorAll(".data-safety-slot").forEach((el) => { el.innerHTML = html; el.querySelectorAll("[data-install]").forEach((b) => b.addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* ignore */ } installEvt = null; renderDataSafety(); })); });
  }
  async function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) { storagePersisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); renderDataSafety(); } } catch (e) { /* ignore */ }
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; renderDataSafety(); });
  window.addEventListener("appinstalled", () => { installEvt = null; renderDataSafety(); });
  document.addEventListener("pointerdown", askPersist, { once: true });
  if (isHosted() && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").catch(() => { /* sem service worker o app segue funcionando online */ });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) $("saveIndicator").textContent = "Nova versão do app instalada. Recarregue a página para usá-la."; });
  }
  $("backupExport").addEventListener("click", function () { this.select(); });

  function dlError(e) { say(e && e.code === "declined" ? "Salvamento cancelado." : "Não foi possível salvar o arquivo neste ambiente."); }

  async function exportBackup() {
    if (!downloadsNS) return;
    try { await downloadsNS.save({ filename: "asset-planning-backup.json", data: JSON.stringify(state, null, 2) }); markBackup(); say("Backup salvo."); } catch (e) { dlError(e); }
  }
  $("btnExportFile").addEventListener("click", exportBackup);
  $("btnBackupOpen").addEventListener("click", exportBackup);

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

  Object.keys(PDF_SHEETS).forEach((id) => {
    $(id).addEventListener("click", async () => {
      if (!downloadsNS || typeof window.html2pdf !== "function") return;
      const btn = $(id), el = $(PDF_SHEETS[id][0]), root = document.documentElement, prev = root.getAttribute("data-theme");
      const prevStyle = el.getAttribute("style"), idleTxt = btn.textContent;
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
        btn.disabled = false; btn.textContent = idleTxt;
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
  function applyState(s, toOpen) {
    state = s; recomputeRowSeq(); verSel = { a: null, b: "cur" };
    fillAll(); Object.keys(ROW_UI).forEach(renderRows); Object.keys(CARD_UI).forEach(renderCards);
    if (toOpen) setTab("open"); else { markSeen(active); renderAll(); }
    saveNow();
  }
  $("btnImport").addEventListener("click", () => {
    const txt = $("backupImport").value.trim(); if (!txt) return;
    try { const parsed = JSON.parse(txt); if (!parsed || typeof parsed !== "object") throw new Error("formato"); applyState(Engine.normalizeState(parsed), true); $("backupImport").value = ""; say("Backup restaurado e validado."); }
    catch (e) { say("Não foi possível ler este backup: o texto está incompleto ou não é um JSON válido."); }
  });
  armed($("btnReset"), "Clique de novo: substituir pelo exemplo", () => applyState(Engine.normalizeState(null), true));
  armed($("btnWipe"), "Clique de novo: apagar tudo", () => {
    try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY); localStorage.removeItem(TABKEY); } catch (e) { /* ignore */ }
    applyState(Engine.normalizeState(null), true); try { localStorage.removeItem(KEY); localStorage.removeItem(TABKEY); } catch (e) { /* ignore */ }
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
  $("suggestCommit").addEventListener("click", () => suggestCommitments(false));
  armed($("refreshCommit"), "Clique de novo: atualizar valores", () => suggestCommitments(true));
  FLOW.forEach((t) => { const sh = document.querySelector("#pane-" + t + " .sheet"); if (sh) { const nav = document.createElement("div"); nav.className = "stepnav no-pdf"; sh.appendChild(nav); } });
  fillAll(); wireFields(); Object.keys(ROW_UI).forEach(renderRows); Object.keys(CARD_UI).forEach(renderCards);
  setTab(active); saveNow();
})();
/* APP:END */

