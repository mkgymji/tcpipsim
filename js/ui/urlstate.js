// Stav stránky v adrese: #k=8b&m=tcpip (rozhodnuti.md bod 21), od úrovně 2 #u=2&k=…&m=….
// Bez DOM, testuje se v Node. k = označení kroku jako v UI ('0'…'17', '8a'…'8c'),
// m = osi | tcpip, u = úroveň (chybí = 1). Další parametry (rentgen, terminál) čte úroveň sama.
import { stepIndex, stepLabel } from '../core/timeline.js';

export const MODEL_IDS = ['osi', 'tcpip'];
export const LEVEL_IDS = [1, 2, 3, 4];

// Úroveň z adresy (bez znalosti kroků, rozhoduje se podle ní, co se načte).
export function parseLevel(hash) {
  const u = Number(new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('u'));
  return LEVEL_IDS.includes(u) ? u : 1;
}

// Vrací { level, k, model, anim, questions, params }; k/model jsou null, když v adrese chybí
// nebo nedávají smysl.
export function parseHash(hash, steps) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const k = p.has('k') ? stepIndex(steps, p.get('k')) : -1;
  const m = p.get('m');
  return {
    level: parseLevel(hash),
    k: k >= 0 ? k : null,
    model: MODEL_IDS.includes(m) ? m : null,
    anim: p.has('anim'),
    questions: p.get('q') === '1',
    params: p,
  };
}

// Úroveň 1 zůstává bez `u` (odkazy z úrovně 1 platí dál).
export function formatHash(step, modelId, level = 1) {
  return `#${level === 1 ? '' : `u=${level}&`}k=${stepLabel(step)}&m=${modelId}`;
}
