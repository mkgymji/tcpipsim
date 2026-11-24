// Veřejné API jádra simulace. Jádro nesmí sahat na DOM ani window,
// aby šlo testovat v Node (node --test) i spouštět v prohlížeči.

export const CORE_VERSION = '0.1.0';
// Verze formátu topologie/scénáře (viz docs/VYVOJ.md, kap. Formát topologie).
export const FORMAT_VERSION = 1;

export { Scheduler } from './scheduler.js';
export { Rng } from './rng.js';
