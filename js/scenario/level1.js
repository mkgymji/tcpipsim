// Sestavení úrovně 1 ze scénáře: jádro vyrobí trace, z něj se poskládají kroky.
// Bez DOM (testuje se v Node).
import { runTransfer } from '../core/transfer.js';
import { Timeline } from '../core/timeline.js';
import { LEVELS } from '../levels.js';

export function buildLevel1(scenario) {
  const level = LEVELS[scenario.level];
  if (!level) throw new Error(`Neznámá úroveň ${scenario.level}`);
  const action = scenario.actions[0];
  if (scenario.actions.length !== 1 || action.command !== 'send') {
    throw new Error('Úroveň 1 umí právě jednu akci "send"');
  }
  const run = runTransfer({
    topology: scenario.topology,
    protocols: scenario.protocols ?? level.protocols,
    action,
    seed: scenario.seed,
  });
  return { run, timeline: new Timeline(run.records, scenario.steps), level };
}
