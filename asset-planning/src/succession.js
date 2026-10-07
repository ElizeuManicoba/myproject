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
