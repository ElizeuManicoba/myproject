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
      meta: { version: 5 },
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
    goals: { label: "", kind: "outro", amount: 0, year: 0, priority: "importante", saved: 0, rate: null }
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
    "goals.kind": ["educacao", "imovel", "veiculo", "viagem", "familia", "negocio", "saude", "outro"], "goals.priority": ["essencial", "importante", "desejo"]
  };
  const STRATEGIES = ["avalanche", "bola", "fluxo"];
  const MC_DISTS = ["normal", "tstudent"], MC_SCEN = ["atual", "consumir"], REGIMES = ["comunhao_parcial", "comunhao_universal", "separacao", "participacao"];
  const MAX_VERSIONS = 12;
  const MAXLEN = { problem: 2000, evidence: 2000, alternatives: 2000, chosen: 2000, assumptions: 2000, risks: 2000, inaction: 1000, scope: 1000, fee: 500, conflicts: 1000, dep: 300, cost: 200, next: 400, title: 160 };
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
    out.meta.version = 5;
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

  /* Ordem dos retornos: o MESMO conjunto de retornos anuais na aposentadoria, com os piores primeiro ou os melhores primeiro. */
  function sequenceDemo(m, opts) {
    opts = opts || {};
    const vol = Math.max(0, opts.vol == null ? 10 : opts.vol) / 100, X = opts.X || 0;
    const P = prep(m, 0, {}), D = m.cashflow.desiredWithdrawal, nRet = Math.max(1, Math.round(m.profile.horizonAge - m.profile.retireAge));
    const zs = []; for (let i = 0; i < nRet; i++) zs.push(invNorm((i + 0.5) / nRet));
    const mu = zs.reduce(function (t, x) { return t + x; }, 0) / nRet, sd = Math.sqrt(zs.reduce(function (t, x) { return t + (x - mu) * (x - mu); }, 0) / nRet) || 1;
    const zn = zs.map(function (x) { return (x - mu) / sd; });
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
      bad: run(zn), good: run(zn.slice().reverse()), flat: { term: flat.term, yearly: flat.yearly, exhaust: exhaustAge(flat.yearly) },
      years: nRet, vol: vol * 100, worst: Math.max(-0.9, P.rrPost + vol * zn[0]), best: P.rrPost + vol * zn[nRet - 1]
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
