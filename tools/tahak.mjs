// Generátor taháku příkazů prirucka/tahak.md z registru js/cli/commands.js (rozh. 63).
// Spuštění: node tools/tahak.mjs   (test tests/core/tahak.test.js hlídá, že soubor je aktuální)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../js/cli/commands.js';
import { LEVELS } from '../js/levels.js';

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
      out.push(`| \`${cell(c.usage)}\` | ${WHERE[c.where]}${c.priv ? ', R1#' : ''} | ${cell(c.short)} | ${cell(c.ask)} |`);
    }
  }
  out.push('', '## Dál', '',
    'Navazující nástroj: Cisco Packet Tracer (zdarma, netacad.com) — volné stavění sítí a konfigurace pro CCNA.', '');
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = fileURLToPath(new URL('../prirucka/tahak.md', import.meta.url));
  writeFileSync(path, tahakMarkdown());
  console.log(`Zapsáno: ${path}`);
}
