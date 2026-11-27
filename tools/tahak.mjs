// Generátor taháku příkazů prirucka/tahak.md z registru js/cli/commands.js (rozh. 63).
// Spuštění: node tools/tahak.mjs   (test tests/core/tahak.test.js hlídá, že soubor je aktuální)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../js/cli/commands.js';
import { LEVELS } from '../js/levels.js';
import { TASKS, TASK_ORDER } from '../scenarios/ulohy.js';

const WHERE = { PC: 'PC (Windows)', switch: 'switch (IOS)', router: 'router (IOS)', server: 'server (Linux)' };
const cell = (s) => String(s).replace(/\|/g, '\\|');

export function tahakMarkdown() {
  const out = [
    '# Tahák příkazů terminálu',
    '',
    'Příkazy, které umí terminál v simulátoru tcpipsim (https://mkgymji.github.io/tcpipsim/), po úrovních.',
    'Tisk: A4 na výšku. Soubor se generuje z kódu (`node tools/tahak.mjs`), ručně ho neupravuj.',
    '',
    '## Jak otevřít terminál',
    '',
    '- Klikni na uzel (PC, switch, router, server) a stiskni **F2** nebo tlačítko **Terminál**.',
    '- Nápověda: `help` nebo `?` (Windows), `?` (IOS), `help` (Linux) vypíše příkazy, které terminál v dané úrovni umí.',
    '- Odkaz rovnou na krok s otevřeným terminálem a zadaným příkazem:',
    '  `#u=<úroveň>&k=<krok>&t=<uzel>&c=<příkaz>`, například',
    '  https://mkgymji.github.io/tcpipsim/#u=3&k=9&t=R1&c=enable&c=show%20ip%20route',
    '  (mezera v příkazu = `%20`, víc příkazů = víc parametrů `c`).',
    '- Výstupy napodobují skutečný Windows (anglická verze) a Cisco IOS, zjednodušeně.',
    '  Co simulátor zjednodušuje, vypíše pod výstupem.',
    '- Příkazy z nižších úrovní fungují i ve vyšších.',
  ];
  for (const lvl of Object.values(LEVELS)) {
    const list = COMMANDS.filter((c) => c.from === lvl.id);
    out.push('', `## Úroveň ${lvl.id}: ${lvl.title}`, '');
    if (!lvl.terminal) { out.push('Terminál v této úrovni není.'); continue; }
    if (!list.length) { out.push('Žádné nové příkazy.'); continue; }
    out.push('| Příkaz | Kde | Co ukáže | Na co se zeptat |', '| --- | --- | --- | --- |');
    for (const c of list) {
      out.push(`| \`${cell(c.usage)}\` | ${WHERE[c.where]}${c.priv ? ', R1#' : ''}${c.tasks ? ', úlohy' : ''} | ${cell(c.short)} | ${cell(c.ask)} |`);
    }
  }
  out.push('', '## Modelové situace (úlohy)', '',
    'Student sám nastaví počítač nebo najde a opraví chybu v hotové síti úrovně 4; simulátor vyhodnotí',
    '„funguje / nefunguje a proč“. Příkazy označené „úlohy“ mění stav jen v úlohách.',
    'Pořadí pro hodinu: 4, 1, 5, 7, 10; doma 11, 3, 13. U úlohy 13 dá `&seed=N` každému stejnou (nebo jinou) chybu.',
    'Na běžné stránce simulátoru jsou úlohy skryté. Zpřístupní je odkaz https://mkgymji.github.io/tcpipsim/#ulohy (menu všech úloh) nebo odkaz na konkrétní úlohu níže; menu pak zůstane v té záložce prohlížeče.', '',
    '| Úloha | Odkaz | Co trénuje |', '| --- | --- | --- |');
  for (const id of TASK_ORDER) {
    const t = TASKS[id];
    out.push(`| ${id} ${cell(t.title)} | https://mkgymji.github.io/tcpipsim/#uloha=${id}${t.seeded ? '&seed=1' : ''} | ${cell(t.short)} |`);
  }
  out.push('', '### Postup, když síť nejde (od L1 nahoru)', '', '| Vrstva | Otázka | Příkaz | Dobrý výsledek |', '| --- | --- | --- | --- |');
  for (const [l, q, cmd, okv] of TASKS[13].checklist) out.push(`| ${l} | ${cell(q)} | ${cell(cmd)} | ${cell(okv)} |`);
  out.push('', '## Dál', '',
    'Navazující nástroj: Cisco Packet Tracer (zdarma, netacad.com) — volné stavění sítí a konfigurace pro CCNA.', '');
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = fileURLToPath(new URL('../prirucka/tahak.md', import.meta.url));
  writeFileSync(path, tahakMarkdown());
  console.log(`Zapsáno: ${path}`);
}
