// Vstupní bod stránky. Zatím jen ověří, že se jádro načte a běží.
import { CORE_VERSION, Scheduler } from './core/index.js';

function selfCheck() {
  const s = new Scheduler();
  const seen = [];
  s.on('hello', (ev) => seen.push(ev.payload));
  s.schedule({ type: 'hello', delay: 2, payload: 'B' });
  s.schedule({ type: 'hello', delay: 1, payload: 'A' });
  s.run();
  return seen.join('') === 'AB';
}

const ok = selfCheck();
document.getElementById('core-status').textContent = ok
  ? `Jádro simulace ${CORE_VERSION} načteno.`
  : 'Jádro simulace se nechová správně.';
if (ok) document.documentElement.dataset.core = 'ok';
else console.error('selfCheck jádra selhal');
