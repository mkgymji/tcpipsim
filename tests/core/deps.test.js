// Pravidlo závislostí (VYVOJ.md kap. 2): jádro, protokoly, kódování a scénáře bez DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const DIRS = ['js/core', 'js/proto', 'js/wire', 'js/scenario', 'js/devices', 'js/cli'];

test('moduly bez DOM nesahají na document/window/localStorage ani do ui/', () => {
  for (const dir of DIRS) {
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.js'))) {
      const src = readFileSync(join(ROOT, dir, f), 'utf8').replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(src, /\b(document|window|localStorage)\b/, `${dir}/${f}`);
      assert.doesNotMatch(src, /from '\.\.\/ui\//, `${dir}/${f}`);
      assert.doesNotMatch(src, /\bimport\(/, `${dir}/${f}: dynamický import`);
    }
  }
});
