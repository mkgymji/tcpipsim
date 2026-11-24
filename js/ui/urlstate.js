// Stav stránky v adrese: #k=8b&m=tcpip (rozhodnuti.md bod 21). Bez DOM, testuje se v Node.
// k = označení kroku jako v UI ('0'…'10', '8a'…'8c'), m = osi | tcpip.
import { stepIndex, stepLabel } from '../core/timeline.js';

export const MODEL_IDS = ['osi', 'tcpip'];

// Vrací { k, model, anim, questions }; k/model jsou null, když v adrese chybí nebo nedávají smysl.
export function parseHash(hash, steps) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const k = p.has('k') ? stepIndex(steps, p.get('k')) : -1;
  const m = p.get('m');
  return {
    k: k >= 0 ? k : null,
    model: MODEL_IDS.includes(m) ? m : null,
    anim: p.has('anim'),
    questions: p.get('q') === '1',
  };
}

export function formatHash(step, modelId) {
  return `#k=${stepLabel(step)}&m=${modelId}`;
}
