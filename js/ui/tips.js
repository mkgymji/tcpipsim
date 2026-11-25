// Tipy studenta (rozhodnutí 31): krok tipu ukazuje stav PŘED událostí, vyhodnotí ho pozdější
// krok se `evaluates: [id]` (bez něj následující krok). Bez DOM, testuje se v Node.
import { esc } from './render.js';
import { tipOptions } from './render2.js';

/** Vazba krok tipu <-> krok vyhodnocení. */
export function tipEvaluator(steps) {
  const evalOf = new Map();
  steps.forEach((s, k) => {
    if (!s.predict) return;
    const e = steps.findIndex((x, j) => j > k && x.evaluates?.includes(s.predict.id));
    evalOf.set(k, e >= 0 ? e : k + 1);
  });
  return {
    evaluatorOf: (k) => evalOf.get(k) ?? null,
    tipsEvaluatedAt: (k) => [...evalOf].filter(([, e]) => e === k).map(([t]) => t),
  };
}

// Porty, na které zařízení rámec v kroku k skutečně poslalo.
export function actualPorts(view, node) {
  const ports = Object.entries(view.portState[node] ?? {}).filter(([, s]) => s === 'out').map(([p]) => p);
  return ports.length ? ports : (view.decision?.node === node ? view.decision.outPorts : []);
}

const joinI = (arr) => (arr.length ? arr.join(' i ') : 'nikam');

/**
 * Vyhodnocení tipu z kroku tipK v kroku evalK. ans = vybrané volby (porty nebo text volby).
 * Vrací { same, html, actual }; html je jedna věta, při nesouladu s důvodem (predict.why).
 */
export function evalTip(timeline, tipK, evalK, ans) {
  const pred = timeline.steps[tipK].predict;
  if (pred.choices) {
    const a = ans[0];
    return { same: null, actual: null, html: `<b>Tvůj tip:</b> ${esc(a)}. ${esc(pred.verdicts?.[a] ?? '')}`.trim() };
  }
  const opts = tipOptions(timeline.view(tipK), pred);
  const label = (p) => opts.find((o) => o.port === p)?.label ?? p;
  const actual = actualPorts(timeline.view(evalK), pred.node);
  const same = actual.length === ans.length && actual.every((p) => ans.includes(p));
  const verdict = same ? 'Sedí.' : `Nesedí: ${pred.why ?? ''}`;
  return { same, actual, html: `<b>Tvůj tip:</b> ${esc(joinI(ans.map(label)))}. <b>Skutečnost:</b> ${esc(joinI(actual.map(label)))}. ${esc(verdict)}` };
}
