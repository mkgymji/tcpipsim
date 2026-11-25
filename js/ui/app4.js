// Adaptér úrovně 4 „Transport a aplikace“ (docs/ui.md kap. 14): stejný rámec jako úroveň 3 (app3.js,
// „U“ s věžemi, tipy, části, terminál), navíc topologie se SW2 a SRV1, karty Spojení / služby / časová
// osa / UDP × TCP / L4 / demultiplex, rentgen TCP/UDP/DNS/HTTP a příkazy nslookup, netstat -an, curl -v
// (Windows) a ss (Linux na SRV1). Příkazy nslookup a curl: běží-li ve scénáři v tomto kroku, výpis je
// z běhu scénáře, jinak samostatná simulace ze stavu kroku (level4.whatIf4).
import scn from '../../scenarios/uroven4-transport.js';
import { buildLevel4, whatIf4 } from '../scenario/level4.js';
import { createLevel3 } from './app3.js';
import { topologyHtml4, CARDS4 } from './render4.js';

const PARTS_HELP = 'Úroveň má šest částí: A DNS přes UDP, B three-way handshake, C HTTP a ukončení, D sockety a zavřený port, E UDP × TCP, F ztráta segmentu (volitelná). Klik = skok na začátek části.';

// Běh nslookup ze scénáře, který začal v tomto kroku: počet vypršení a výsledek do konce kroku.
function liveNslookup(timeline, v, nodeId) {
  const R = timeline.records;
  const start = R.findIndex((r, i) => i >= v.step.first && i <= v.step.last && r.kind === 'app.start' && r.node === nodeId && r.app === 'nslookup');
  if (start < 0) return null;
  const run = R[start].run;
  const upto = R.slice(start, v.step.last + 1);
  return { timeouts: upto.filter((r) => r.kind === 'dns_timeout' && r.node === nodeId).length,
    result: upto.find((r) => r.kind === 'app.result' && r.run === run)?.result ?? null };
}

function termOpts(node, v, base, timeline) {
  return {
    ...base,
    sim(command, args) {
      if (command === 'nslookup') {
        const live = liveNslookup(timeline, v, node.id);
        if (live) return live;
        const r = whatIf4(scn, v, node.id, 'nslookup', { name: args.name });
        return { timeouts: r.records.filter((x) => x.kind === 'dns_timeout').length, result: r.apps.at(-1)?.result ?? null };
      }
      if (command === 'curl') {
        const r = whatIf4(scn, v, node.id, 'http_get', { host: args.host, port: args.port, path: args.path, client: 'curl' });
        const res = r.apps.find((x) => x.command === 'http_get')?.result ?? null;
        return { result: res, dst: res?.remote?.split(':')[0] ?? r.apps.find((x) => x.command === 'dns_resolve')?.result?.answers?.[0]?.data ?? null };
      }
      return base.sim(command, args);
    },
  };
}

// rozhodnutí 57b: změní-li se uzel ve sloupci příjemce, nadpis to krátce řekne („Teď Alice“)
const switchLabel = (prev, cur, v, label) => (prev?.receiver && cur?.receiver && prev.receiver !== cur.receiver ? `Teď ${label}` : '');

export function createLevel4(host) {
  return createLevel3(host, { scenario: scn, build: buildLevel4, topology: topologyHtml4, cards: CARDS4, partsHelp: PARTS_HELP, termOpts, switchLabel });
}
