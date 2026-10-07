/* Navegação pelas etapas da reunião: clica na etapa e, se houver, na subetapa. */
const STAGE = { open: 'open', diag: 'diag', obj: 'obj', cx: 'ana', prot: 'ana', apos: 'ana', succ: 'ana', irm: 'tax', ira: 'tax', pgbl: 'tax', syn: 'syn', plan: 'syn', ips: 'ips', ver: null };
async function go(page, t, wait) {
  if (t === 'ver') await page.click('.stage.util');
  else if (['open', 'diag', 'obj', 'ips'].includes(t)) await page.click('.stage[data-stage="' + t + '"]');
  else { await page.click('.stage[data-stage="' + STAGE[t] + '"]'); await page.click('.tab[data-tab="' + t + '"]'); }
  await page.waitForTimeout(wait || 300);
}
module.exports = { go, STAGE };
