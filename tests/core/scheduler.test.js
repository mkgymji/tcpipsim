// Testy plánovače diskrétních událostí: pořadí, determinismus, rušení, snímky.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler } from '../../js/core/scheduler.js';

// Pomocník: plánovač, který si zapisuje provedené události.
function recording() {
  const s = new Scheduler();
  const log = [];
  s.subscribe((ev) => log.push(`${ev.time}:${ev.type}:${ev.payload?.n ?? ''}`));
  return { s, log };
}

test('události se provádějí podle času, při shodě v pořadí naplánování', () => {
  const { s, log } = recording();
  s.on('a', () => {}).on('b', () => {});
  s.schedule({ type: 'a', delay: 30, payload: { n: 1 } });
  s.schedule({ type: 'b', delay: 10, payload: { n: 2 } });
  s.schedule({ type: 'a', delay: 10, payload: { n: 3 } });
  s.schedule({ type: 'b', delay: 0, payload: { n: 4 } });
  s.run();
  assert.deepEqual(log, ['0:b:4', '10:b:2', '10:a:3', '30:a:1']);
  assert.equal(s.now, 30);
  assert.equal(s.pending, 0);
});

test('obsluha může plánovat další události (ping-pong)', () => {
  const { s, log } = recording();
  s.on('ping', (ev, sch) => {
    if (ev.payload.n < 3) sch.schedule({ type: 'ping', delay: 5, payload: { n: ev.payload.n + 1 } });
  });
  s.schedule({ type: 'ping', payload: { n: 0 } });
  s.run();
  assert.deepEqual(log, ['0:ping:0', '5:ping:1', '10:ping:2', '15:ping:3']);
});

test('cancel odstraní událost (časovač retransmise)', () => {
  const { s, log } = recording();
  s.on('t', () => {});
  const ids = [10, 20, 30, 40, 50].map((d) => s.schedule({ type: 't', delay: d, payload: { n: d } }));
  assert.equal(s.cancel(ids[1]), true);
  assert.equal(s.cancel(ids[1]), false);
  s.run();
  assert.deepEqual(log, ['10:t:10', '30:t:30', '40:t:40', '50:t:50']);
});

test('run({until}) zastaví v daném čase a posune hodiny', () => {
  const { s, log } = recording();
  s.on('t', () => {});
  s.schedule({ type: 't', delay: 10 });
  s.schedule({ type: 't', delay: 100 });
  assert.equal(s.run({ until: 50 }), 1);
  assert.equal(s.now, 50);
  assert.equal(log.length, 1);
});

test('chybné vstupy vyhodí výjimku', () => {
  const s = new Scheduler();
  assert.throws(() => s.schedule({ type: 'x', delay: 1.5 }), TypeError);
  assert.throws(() => s.schedule({ delay: 1 }), TypeError);
  s.on('x', () => {});
  s.schedule({ type: 'x', delay: 10 });
  s.run();
  assert.throws(() => s.schedule({ type: 'x', at: 5 }), RangeError);
  s.schedule({ type: 'neznamy' });
  assert.throws(() => s.step(), /Chybí obsluha/);
});

test('snapshot + restore: pokračování dá stejný průběh (podklad pro krok zpět)', () => {
  const build = () => {
    const r = recording();
    r.s.on('tick', (ev, sch) => {
      if (ev.payload.n < 20) {
        sch.schedule({ type: 'tick', delay: 3, payload: { n: ev.payload.n + 1 } });
        if (ev.payload.n % 4 === 0) sch.schedule({ type: 'tick', delay: 7, payload: { n: ev.payload.n + 10 } });
      }
    });
    r.s.schedule({ type: 'tick', payload: { n: 0 } });
    return r;
  };
  const full = build();
  full.s.run();

  const part = build();
  part.s.run({ maxEvents: 6 });
  const snap = part.s.snapshot();
  const prefix = part.log.slice();
  part.s.run(); // poběží dál, snímek se tím nesmí změnit
  part.log.length = prefix.length;
  part.s.restore(snap);
  part.s.run();
  assert.deepEqual(part.log, full.log);
  assert.equal(part.s.executed, full.s.executed);
});

test('determinismus: dva běhy stejného vstupu dají identický záznam', () => {
  const runOnce = () => {
    const { s, log } = recording();
    s.on('e', (ev, sch) => {
      const n = ev.payload.n;
      if (n < 200) {
        sch.schedule({ type: 'e', delay: (n * 7) % 13, payload: { n: n + 1 } });
        sch.schedule({ type: 'e', delay: (n * 5) % 11, payload: { n: n + 2 } });
      }
    });
    s.schedule({ type: 'e', payload: { n: 0 } });
    s.run({ maxEvents: 5000 });
    return log.join('|');
  };
  assert.equal(runOnce(), runOnce());
});
