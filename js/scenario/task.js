// Modelové situace (úlohy, rozh. 66–69): stav úlohy nad topologií úrovně 4, zásahy studenta (dialog
// IPv4, kabel, tiskárna, služba, arp -d), příkazy terminálu jako samostatné simulace ze stavu úlohy
// (ARP, MAC a DNS tabulky se mezi příkazy pamatují) a vyhodnocení „funguje / nefunguje a proč“.
// Bez DOM (testuje se v Node). Determinismus: varianta úlohy 13 jen ze seedu (fnv1a, tcp.md kap. 4).
import { runNetwork } from '../core/netsim.js';
import { appResults } from '../core/harness.js';
import { effectiveTopology, addressConflicts, l2Peers, maskToPrefix } from '../core/hostcfg.js';
import { diagnose, REASON_LAYER } from '../core/diagnose.js';
import { downInterfaces } from '../core/netsim.js';
import { deriveRoutes } from '../proto/ipv4.js';
import { sameSubnet, maskString } from '../core/addr.js';
import { fnv1a } from '../proto/tcp.js';
import { LEVELS } from '../levels.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const PROTOCOLS = LEVELS[4].protocols;
export const UNIT = { web: 'nginx', dns: 'named' };   // systemd jednotky aplikací SRV1 (Debian)

// Varianta úlohy 13 ze seedu (ulohy.md kap. 4.1).
export function variantOf(def, seed) {
  return def.variants ? fnv1a(`u13|${seed}`) % def.variants.length : null;
}

/** Nový stav úlohy. base = scénář úrovně 4 (topologie). */
export function createTask(def, base, { seed = 1 } = {}) {
  const topo = clone(base.topology);
  for (const n of topo.nodes) for (const a of n.apps ?? []) delete a.delay;   // úloha: bez „přemýšlení“ aplikací
  const pc1 = topo.nodes.find((n) => n.id === 'PC1');
  const i = pc1.interfaces[0];
  pc1.ipv4_config = { mode: 'static', ip: i.ip, prefix: i.prefix, gateway: pc1.gateway ?? null, dns: [...(pc1.dns_servers ?? [])] };
  const variant = variantOf(def, seed);
  const v = variant != null ? def.variants[variant] : null;
  const faults = v ? v.faults : def.faults ?? [];
  for (const f of faults) applyFault(topo, f);
  const task = { def, seed, variant, topology: topo, tables: { arp_cache: {}, mac_table: {}, dns_cache: {} },
    cfgSeq: 0, changes: [], hintsOpened: 0, checks: v?.checks ?? def.checks ?? [] };
  task.initial = snapshotFacts(task);
  return task;
}

function applyFault(topo, f) {
  if (f.kind === 'link') topo.links.find((l) => l.id === f.link).connected = false;
  else if (f.kind === 'config') {
    const c = topo.nodes.find((n) => n.id === f.node).ipv4_config;
    for (const [k, val] of Object.entries(f.set)) c[k] = clone(val);
  } else if (f.kind === 'service') {
    topo.nodes.find((n) => n.id === f.node).apps.find((a) => a.name === f.app).running = f.running;
  } else if (f.kind === 'add_node') {
    topo.nodes.push(clone(f.node));
    topo.links.push(clone(f.link));
  }
}

export const effTopo = (task) => effectiveTopology(task.topology);
export const hasNode = (task, id) => task.topology.nodes.some((n) => n.id === id);

// Stav uzlu pro terminál (tvar jako v pohledu úrovní 3–4: cli/ čte ip, prefix, mac, gateway, tabulky …).
export function nodeView(task, id) {
  const topo = effTopo(task);
  const n = topo.nodes.find((x) => x.id === id);
  const down = downInterfaces(topo, id);
  const v = { id: n.id, type: n.type, label: n.label ?? n.id, device: n.device };
  if (n.type === 'switch') return { ...v, ports: [...n.ports], mac_table: clone(task.tables.mac_table[id] ?? []) };
  Object.assign(v, { interfaces: n.interfaces.map((i) => ({ ...i, down: down.includes(i.name) })), arp_cache: clone(task.tables.arp_cache[id] ?? []),
    routing_table: deriveRoutes(n).filter((r) => !down.includes(r.if)), dns_cache: clone(task.tables.dns_cache[id] ?? []),
    apps: clone(n.apps ?? []), dns_servers: [...(n.dns_servers ?? [])] });
  const i = n.interfaces[0];
  Object.assign(v, { mac: i.mac, ip: i.ip, prefix: i.prefix, ifName: i.name, gateway: n.gateway ?? null,
    media: down.includes(i.name) ? 'disconnected' : 'connected', addr_state: n.addr_state ?? null, ipv4_config: clone(n.ipv4_config ?? null) });
  v.tcp_connections = (n.apps ?? []).filter((a) => a.proto === 'tcp' && a.port != null && a.running !== false)
    .map((a) => ({ local: `0.0.0.0:${a.port}`, remote: '0.0.0.0:0', state: 'LISTEN' }));
  return v;
}

/**
 * Příkaz terminálu jako simulace ze stavu úlohy. command: ping | tracert | nslookup | http_get.
 * persist = true: ARP, MAC a DNS tabulky po běhu se uloží do úlohy (jako skutečná síť).
 */
export function runCommand(task, nodeId, command, args, { persist = true } = {}) {
  const topo = effTopo(task);
  const { records, world } = runNetwork({ topology: topo,
    initialState: { arp_cache: clone(task.tables.arp_cache), mac_table: clone(task.tables.mac_table), dns_cache: clone(task.tables.dns_cache) },
    actions: [{ time: 0, node: nodeId, command, args }], protocols: PROTOCOLS, seed: task.seed });
  if (persist) {
    for (const n of Object.values(world.nodes)) {
      if (n.state.arp_cache) task.tables.arp_cache[n.id] = clone(n.state.arp_cache);
      if (n.state.mac_table) task.tables.mac_table[n.id] = clone(n.state.mac_table);
      if (n.state.dns_cache) task.tables.dns_cache[n.id] = clone(n.state.dns_cache);
    }
  }
  const apps = records.filter((r) => r.kind === 'app.result');
  return { records, topo, result: appResults(records).find((a) => a.node === nodeId) ?? null, apps };
}

// Jméno -> IP resolverem uzlu (ping a tracert jménem; DNS cache se pamatuje). Vrací IP nebo null.
export function resolveName(task, nodeId, name) {
  const r = runCommand(task, nodeId, 'dns_resolve', { name });
  const res = r.apps.find((x) => x.command === 'dns_resolve')?.result;
  return res?.kind === 'answer' ? res.answers?.find((a) => a.type === 'A')?.data ?? null : null;
}

// ---- zásahy studenta ----

function snapshotFacts(task) {
  const f = {};
  const c = task.topology.nodes.find((n) => n.id === 'PC1').ipv4_config;
  Object.assign(f, { 'PC1.mode': c.mode, 'PC1.ip': c.ip, 'PC1.prefix': c.prefix, 'PC1.gateway': c.gateway, 'PC1.dns': (c.dns ?? []).join(',') });
  for (const l of task.topology.links) f[`link.${l.id}`] = l.connected !== false;
  const prt = task.topology.nodes.find((n) => n.id === 'PRT1');
  if (prt) f['PRT1.ip'] = `${prt.interfaces[0].ip}/${prt.interfaces[0].prefix}`;
  for (const a of task.topology.nodes.find((n) => n.id === 'SRV1').apps) f[`SRV1.${a.name}`] = (f[`SRV1.${a.name}`] ?? true) && a.running !== false;
  return f;
}

// Které údaje se oproti zadání změnily (pro texty „měnil jsi, co nebylo rozbité“ a počet zásahů).
export function changedKeys(task) {
  const now = snapshotFacts(task);
  return Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(task.initial[k]));
}

/**
 * Zásah studenta. fix = { kind: 'ipv4', node, cfg } | { kind: 'link', link, connected } |
 * { kind: 'printer', node, ip, prefix, gateway } | { kind: 'service', node, app, running } |
 * { kind: 'arp_delete', node, ip | null } | { kind: 'arp_clear', node }.
 */
export function applyFix(task, fix) {
  const node = (id) => task.topology.nodes.find((n) => n.id === id);
  task.changes.push(clone(fix));
  if (fix.kind === 'ipv4') {
    const n = node(fix.node);
    n.ipv4_config = clone(fix.cfg);
    n.cfg_seq = ++task.cfgSeq;
    // nová adresa = nové rozhraní: Windows vyprázdní ARP a DNS cache (simulátor zjednodušuje)
    task.tables.arp_cache[fix.node] = [];
    task.tables.dns_cache[fix.node] = [];
  } else if (fix.kind === 'link') {
    const l = task.topology.links.find((x) => x.id === fix.link);
    if (fix.connected) delete l.connected; else l.connected = false;
    // po zapojení se ARP Announcement nekreslí (rozh. 69); po odpojení rozhraní zapomene sousedy
    for (const end of [l.a, l.b]) if (task.tables.arp_cache[end.node] && !fix.connected) task.tables.arp_cache[end.node] = [];
  } else if (fix.kind === 'printer') {
    const n = node(fix.node);
    Object.assign(n.interfaces[0], { ip: fix.ip, prefix: fix.prefix });
    if (fix.gateway) n.gateway = fix.gateway; else delete n.gateway;
    n.cfg_seq = ++task.cfgSeq;
    task.tables.arp_cache[fix.node] = [];
  } else if (fix.kind === 'service') {
    node(fix.node).apps.filter((a) => a.name === fix.app).forEach((a) => { a.running = fix.running; });
  } else if (fix.kind === 'arp_delete' || fix.kind === 'arp_clear') {
    const t = task.tables.arp_cache[fix.node] ?? [];
    task.tables.arp_cache[fix.node] = fix.ip ? t.filter((e) => e.ip !== fix.ip) : t.filter((e) => e.type === 'static');
  }
}

// ---- vyhodnocení ----

function facts(task, topo, diag) {
  const c = task.topology.nodes.find((n) => n.id === 'PC1').ipv4_config;
  const pc1 = topo.nodes.find((n) => n.id === 'PC1');
  const i = pc1.interfaces[0];
  const r1 = topo.nodes.find((n) => n.id === 'R1').interfaces[0];
  return {
    'PC1.mode': c.mode, 'PC1.ip': c.ip, 'PC1.gateway': c.gateway, 'PC1.dns1': c.dns?.[0] ?? null,
    'PC1.dup_with': pc1.addr_state?.conflictWith ?? null,
    'PC1.ip_outside': c.mode === 'static' && c.ip ? !sameSubnet(c.ip, r1.ip, r1.prefix) : false,
    'PC1.gw_outside': Boolean(c.gateway && c.ip && !sameSubnet(c.gateway, c.ip, c.prefix)),
    'PC1.gw_is_self': Boolean(c.gateway && c.gateway === c.ip),
    'links.down': topo.links.filter((l) => l.connected === false).map((l) => l.id),
    'diag.node': diag.node ?? null, 'diag.owner': diag.detail?.owner ?? null, ip: i.ip,
  };
}

/** Pravidlo `when` (deklarativní, scenarios/ulohy.js). */
export function matchRule(when, ctx) {
  if (when.reason && ![].concat(when.reason).includes(ctx.reason)) return false;
  if (when.success != null && when.success !== ctx.success) return false;
  if (when.changed && !when.changed.some((k) => ctx.changed.includes(k))) return false;
  if (when.unchanged && when.unchanged.some((k) => ctx.changed.includes(k))) return false;
  for (const [k, val] of Object.entries(when.facts ?? {})) {
    if (k.endsWith('_not')) { if (ctx.facts[k.slice(0, -4)] === val) return false; continue; }
    const f = ctx.facts[k];
    if (Array.isArray(f) ? !f.includes(val) : f !== val) return false;
  }
  return true;
}

const label = (topo, id) => topo.nodes.find((n) => n.id === id)?.label ?? id;
const macW = (m) => String(m).replace(/:/g, '-');

// Obecný text k důvodu (ulohy.md kap. 1.2), když úloha nemá vlastní pravidlo.
export function reasonText(diag, topo) {
  const d = diag.detail ?? {};
  const L = (id) => label(topo, id);
  switch (diag.reason) {
    case 'link_down': return `Kabel u ${L(diag.node)} **není zapojený**${d.end === 'path' ? ' (cestou k cíli)' : ''}. Bez fyzického spojení neprojde ani bit (L1).`;
    case 'no_address': return d.duplicate ? `Adresu ${d.duplicate} už v síti má **${L(d.conflictWith)}**. Windows konflikt zjistí a adresu nepoužije (Duplicate), dostane jen 169.254.x.x.`
      : `${L(diag.node)} **nemá platnou IP adresu** této sítě (jen náhradní 169.254.x.x, protože DHCP server tu není).`;
    case 'mask_wrong': return `Maska ${maskString(d.prefix)} **neodpovídá síti** (ostatní mají ${maskString(d.expected)}). Simulátor zjednodušuje: proxy ARP routeru nemodeluje, takovou kombinaci rovnou odmítne.`;
    case 'no_route': return `Cíl ${d.dst ?? ''} je v **jiné síti** a ${L(diag.node)} **nemá výchozí bránu**: paket nemá komu předat.`;
    case 'arp_failed': {
      let t = `Na ARP dotaz na **${d.ip}** nikdo neodpověděl.`;
      if (d.gatewayOutside || d.ipOutside) t += ' IP adresa a brána **nejsou ve stejné síti** (porovnej síťovou část podle masky).';
      else if (d.ownerDown) t += ` Zkontroluj **fyzické spojení** k zařízení ${L(d.ownerDown)}.`;
      else if (d.nobody) t += ' Tuhle adresu v síti nikdo nemá.';
      return t;
    }
    case 'ip_conflict': return `Adresu **${d.ip}** používají **dvě zařízení** (${(d.nodes ?? []).filter(Boolean).map(L).join(' a ')}). Na jeden ARP dotaz přijdou dvě odpovědi s různou MAC.`;
    case 'ip_conflict_config': return `Adresu **${d.ip}** mají **dvě zařízení**: ${d.nodes.map(L).join(' a ')}. Každá IP smí být v síti jen jednou.`;
    case 'arp_stale': return `${L(diag.node)} má v ARP tabulce pro ${d.ip} MAC ${macW(d.mac)}, ta ale patří zařízení ${L(d.owner)}${d.unreachable ? ', které je odpojené' : ''}. **Záznam je zastaralý**: pakety jdou na špatné místo. Smaž ho (\`arp -d\`).`;
    case 'wrong_next_hop': return `Paket dostal **${L(diag.node)}**, který ho dál nepošle (není router a cílová adresa ${d.dst} není jeho).`;
    case 'no_dns_server': return 'Jméno se nepřeložilo na IP adresu: **chybí DNS server**.';
    case 'dns_failed': return d.rcode ? 'DNS server odpověděl, ale jméno nezná.' : `DNS server ${d.server}${d.owner ? ` (${L(d.owner)})` : ''} na dotaz **neodpověděl**: neběží na něm služba DNS (UDP 53).`;
    case 'connection_refused': return 'Server je dostupný, ale **na portu 80 nikdo nenaslouchá** (odpověď RST).';
    case 'http_error': return `Server odpověděl stavem ${d.status}, ne 200 OK.`;
    case 'timeout': return 'Odpověď **nepřišla** (vypršel čas). Projdi vrstvy zdola a najdi, kde se zpráva ztratila.';
    default: return '';
  }
}

/**
 * Vyhodnocení úlohy na kopii stavu (stav studentovy sítě se nemění): cíl a kontroly, první selhání
 * zdola nahoru, text podle pravidel úlohy. Vrací { status: 'ok' | 'partial' | 'fail', reason, layer,
 * lines[], diag, checks[] }. layerGuess (úloha 13): vrstva, kterou student určil.
 */
export function evaluate(task, { layerGuess = null } = {}) {
  const copy = { ...task, tables: clone(task.tables) };
  const g = task.def.goalRun;
  const topo = effTopo(task);
  const run = runCommand(copy, g.node, g.command, g.args);
  let diag = diagnose({ topo, source: g.node, records: run.records, result: run.result, goal: { command: g.command, status: g.status } });
  const checks = [];
  if (diag.reason === 'ok') {
    for (const c of task.checks) {
      const r = runCommand(copy, c.node, c.command, c.args);
      const d = diagnose({ topo, source: c.node, records: r.records, result: r.result, goal: { command: c.command, replies_min: c.replies_min } });
      checks.push({ label: c.label, ok: d.reason === 'ok' });
      if (d.reason !== 'ok') { diag = d; break; }
    }
  }
  // dvě zařízení se stejnou IP (i když cíl zrovna prošel): oprava nesmí konflikt nechat ani přidat
  const conf = addressConflicts(topo);
  if (diag.reason === 'ok' && conf.length) diag = { reason: 'ip_conflict_config', layer: 'L2/L3', node: conf[0].nodes[0], detail: conf[0] };
  const success = diag.reason === 'ok';
  const ctx = { reason: diag.reason, success, changed: changedKeys(task), facts: facts(task, topo, diag) };
  const rules = task.def.rules ?? [];
  const hit = rules.find((r) => matchRule(r.when, ctx));
  let status = success ? 'ok' : 'fail';
  if (hit?.status) status = hit.status;
  const lines = [];
  if (success && status === 'ok') lines.push(...task.def.ok);
  if (hit) lines.push(hit.text);
  else if (!success) lines.push(reasonText(diag, topo));
  // úloha 13: vrstva a zbytečné zásahy
  let extra = null;
  if (task.variant != null) {
    const v = task.def.variants[task.variant];
    const needed = new Set([...v.fix, 'arp']);
    const changed = ctx.changed;
    const useless = changed.filter((k) => !needed.has(k));
    extra = { variant: v, useless, layerOk: layerGuess ? layerGuess === v.layer : null };
    if (status === 'ok') {
      lines.length = 0;
      lines.push(`Opraveno: **${v.label}**, vrstva **${v.layer}**. Pro zopakování: úloha ${v.task}.`);
      if (layerGuess && layerGuess !== v.layer) lines.push(`Oprava sedí, ale vrstvu pojmenuj znovu: tahle chyba je na **${v.layer}**, ne na ${layerGuess}.`);
      else if (layerGuess) lines.push('Vrstvu jsi určil **správně**.');
      else lines.push('Urči ještě vrstvu, na které chyba byla (výběr nad tlačítkem).');
      if (useless.length) lines.push(`Změnil jsi i ${useless.length === 1 ? 'jednu věc' : `${useless.length} věci`}, které rozbité nebyly.${useless.length > 3 ? ' Příště nic neměň, dokud neověříš každý bod seznamu.' : ''}`);
    }
  }
  return { status, success, reason: diag.reason, layer: diag.layer ?? REASON_LAYER[diag.reason], diag, lines, checks, extra,
    hints: task.hintsOpened };
}

// Třetí nápověda úlohy 13: vrstva podle varianty (neprozradí přesnou chybu).
export function hint3Of(task) {
  if (task.variant == null) return task.def.hints[2];
  const v = task.def.variants[task.variant];
  return { L1: 'Chyba je na **L1**: zkontroluj kabely (v obrázku i `ipconfig`, na R1 `show ip interface brief`).',
    'L2/L3': 'Chyba je mezi **L2 a L3**: odpovídá na adresu brány opravdu R1? Porovnej `arp -a` s `show ip arp` na R1.',
    L3: 'Chyba je na **L3**: zkontroluj IP adresu a bránu Alice (`ipconfig /all`).',
    'L4/L7': 'Chyba je ve **službě** (L4/L7): běží na SRV1 web? (`ss -tuln`)',
    L7: 'Chyba je na **L7**: přeloží se jméno? (`nslookup`, `ipconfig /all`)' }[v.layer];
}

export { maskToPrefix, l2Peers };
