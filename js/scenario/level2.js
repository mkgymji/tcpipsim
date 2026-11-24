// Sestavení úrovně 2 ze scénáře: síťová simulace vyrobí záznam, timeline z něj poskládá
// kroky scénáře (match) a pohled netViewAt. Bez DOM (testuje se v Node).
import { runNetwork } from '../core/netsim.js';
import { Timeline } from '../core/timeline.js';
import { netViewAt } from '../core/netview.js';
import { LEVELS } from '../levels.js';

export function buildLevel2(scenario) {
  const level = LEVELS[scenario.level];
  if (!level) throw new Error(`Neznámá úroveň ${scenario.level}`);
  const run = runNetwork({ topology: scenario.topology, initialState: scenario.initial_state ?? {},
    actions: scenario.actions });
  return { run, timeline: new Timeline(run.records, scenario.steps, netViewAt), level };
}
