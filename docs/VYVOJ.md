# Vývoj tcpipsim

Stav: iterace 3. Úrovně 1 „Barvičky“ a 2 „Adresy“ beze změny chování, úroveň 3 „Směrování“ funguje
(kroky 0–25 v částech A–D podle `scenarios/uroven3-smerovani.md`: ARP s frontou a 3 pokusy, ICMP Echo,
Time Exceeded, Destination Unreachable, router s LPM a TTL, tracert, chyby brány s „Oprav bránu“,
terminál Windows i Cisco IOS routeru). Přenos se ve všech úrovních kreslí jako „U“ (rozhodnutí 38,
48). Autor: vývojář.
Hotové: plánovač, Rng, PDU, trace, timeline (kroky + pohled), síťová simulace s více uzly
(`core/netsim.js`: PC a router se zásobníkem Ethernet/ARP/IPv4/ICMP/UDP, hub, switch), runner
testovacích vektorů (všechny kromě `tracert-dva-routery`, který je `skip` podle rozhodnutí 44, ale
jádro ho už přehraje), kódování rámce do bajtů a pole pro rentgen, terminál nad pohledem (`cli/`),
UI úrovní 1–3.
Iterace 4: úroveň 4 „Transport a aplikace“ (rozhodnutí 59, 60; kroky 0–31 v částech A–F podle
`scenarios/uroven4-transport.md`): `core/transport.js` (TCP se stavy RFC 9293, handshake, data, potvrzení,
ukončení ve 4 segmentech, TIME-WAIT, RST, retransmise po RTO; resolver a autoritativní server DNS na UDP 53;
curl a webový server HTTP/1.1), `proto/tcp.js`, `proto/dns.js`, `proto/http.js`, rentgen TCP/UDP/DNS/HTTP
(`wire/fields.js`), terminál `nslookup`, `netstat -an`, `curl -v` (`cli/wincmd4.js`) a `ss` na SRV1
(`cli/linux.js`), UI `ui/app4.js` + `ui/render4.js` (adaptér úrovně 3 s konfigurací). Všechny vektory
projektanta kromě `tracert-dva-routery` procházejí bez `skip`.
Rozhodnutí jsou psaná s důvodem, aby šla zpětně zvrátit.

## 0. Rychlý start

```bash
tests/run_all.sh              # node testy jádra + smoke test stránky v headless Chromiu
tests/run_all.sh --no-browser # jen node testy
node --test tests/core/       # jednotlivá složka
python3 -m http.server 8000   # lokální vývoj, pak http://localhost:8000/
```

Požadavky: Node 20+ (testy), libovolný moderní prohlížeč (Chrome/Edge 100+, Firefox 115+,
Safari 16.4+). Nic se neinstaluje, `package.json` není potřeba.

## 1. Základní rozhodnutí

| # | Rozhodnutí | Proč |
|---|---|---|
| R1 | Čisté HTML/CSS/JS, **ES moduly**, bez build kroku a bez závislostí | Zadání projektu; stejný přístup jako git-simulator. Moduly dávají `import`, které funguje stejně v prohlížeči i v Node (`node --test`). |
| R2 | Primární provoz = **GitHub Pages (https)**. Učitel nic nestahuje, sdílí odkaz. | Školní PC jsou Windows bez Pythonu a bez práv instalovat; odkaz do Google Classroom je nejjednodušší cesta. |
| R3 | Z `file://` se **zdrojová** verze nespustí; pro offline je **jednosouborová** `tcpipsim-offline.html`, generovaná skriptem `tools/bundle.mjs` (Node, bez závislostí) při vydání | Ověřeno na gaze (Chromium 156): `<script type="module">` z `file://` blokuje CORS („origin null“). Ověřeno i řešení: moduly vložené jako text a načtené přes `Blob` URL fungují z `file://` bez přepínačů. Bundler jen přepíše cesty v `import`, kód nemění. Není to build krok pro vývoj ani Pages, jen balení pro stažení. |
| R4 | `index.html` při načtení z `file://` ukáže srozumitelnou hlášku (kam jít místo toho) | Učitel, který si stáhne ZIP z GitHubu a dvakrát klikne, nesmí vidět prázdnou stránku. Ověřeno headless (hláška se zobrazí). |
| R5 | Jádro simulace **bez DOM a bez `window`**, jen čistá data a funkce | Testovatelnost v Node; UI je jen pozorovatel. |
| R6 | Simulace **nejdřív proběhne, pak se prohlíží**: jádro vyrobí úplný záznam (trace), UI se po něm pohybuje kurzorem | Krok vzad je pak triviální a přesný (UI nikdy nemění stav, viz `docs/ui.md` kap. 4). Simulované scénáře jsou malé (stovky událostí), takže dopočítat dopředu je levné. |
| R7 | Krok vzad: **vratné delty v záznamu + kontrolní body (snapshoty) světa**; nový vstup (příkaz v terminálu, změna v editoru) = obnovit snapshot + deterministický replay, budoucnost se zahodí | Delty stačí na zobrazení (tabulky, PDU na lince) dopředu i dozadu. Plný snapshot světa je potřeba jen pro pokračování simulace z minulosti; replay zaručuje determinismus (R8). |
| R8 | **Determinismus**: virtuální čas v celých µs, pořadí událostí (čas, pořadí naplánování), náhoda jen ze seedovaného `Rng`, žádné `Date.now()`, `Math.random()`, iterace přes `Set`/`Map` jen v pořadí vložení | Stejný scénář = stejný průběh (testy, sdílení, krok vzad). |
| R9 | Události plánovače jsou **data** (`{type, payload}`), ne closures; stav uzlů je čistá data | Snapshot = `structuredClone(world)`. Obsluhy se hledají podle `type` v registru. |
| R10 | Formát topologie = **stejné schéma uzlů a linek jako testovací vektory** (`docs/spec/vektory.md` kap. 2), doplněné o rozvržení a konfiguraci | Jedna sada loaderů a validací; vektor je vlastně scénář s očekávaným výsledkem. |

## 2. Struktura adresářů

```
index.html              hlavní stránka (kostra UI úrovně 1, chyby zachytává do data-errors)
css/app.css             styly (paleta kreativce, docs/ui.md), proměnné v :root
js/
  main.js               vstupní bod: výběr úrovně (#u=2), společné ovládání (krok, přehrávání, rychlost,
                        model, klávesy, adresa); kreslení řeší adaptér úrovně ui/app1.js, ui/app2.js
  core/                 JÁDRO, bez DOM. Importuje jen z core/, proto/ a wire/
    index.js            veřejné API jádra (re-exporty), CORE_VERSION, FORMAT_VERSION
    scheduler.js        plánovač diskrétních událostí            [hotovo]
    rng.js              seedovaný generátor (mulberry32)         [hotovo]
    layers.js           modely ISO/OSI (7) a TCP/IP (4), názvy, PDU, „kdo se stará“  [hotovo]
    pdu.js              PDU s vnořením vrstev, id a rodokmen PDU  [hotovo]
    trace.js            záznam událostí                           [hotovo, delty od iterace 2]
    transfer.js         přenos jedné zprávy vrstvami mezi 2 uzly (úroveň 1)  [hotovo]
    netsim.js           síť s více uzly: PC, router (L3), hub, switch; protokoly podle úrovně
                        (`protocols`: bez 'arp' = úroveň 2, ARP tabulka jen čtená); ARP (fronta podle
                        next hopu, 3 pokusy po 1 s, arp_fail, stárnutí při čtení), IPv4 (LPM, TTL,
                        ICMP chyby), aplikace ping a tracert; akce udp_send / ping / tracert / set_gateway
                        / swap / mark, záznam + koncové tabulky  [hotovo, úroveň 3]
    netview.js          pohled úrovně 2 po kroku: uzly, tabulky, štítky PC, porty, rámce na kabelech  [hotovo]
    netview3.js         pohled úrovně 3: navíc router (hop: rámec před a za), ARP a směrovací tabulky,
                        běhy aplikací (apps: události pingu/tracertu pro živý výpis terminálu)  [hotovo]
    harness.js          runVector / compareVector (vektory.md kap. 5–7)  [hotovo]
    addr.js             MAC (zápisy Windows/Cisco, skupinové), IPv4 (maska, síť, broadcast, multicast MAC)  [hotovo]
    timeline.js         kroky ze scénáře (match), pohled po kroku k (viewFn podle úrovně), vpřed/vzad  [hotovo]
    world.js, link.js, topology.js   (plán: snapshot světa, ztrátovost, validace a migrace formátu)
  proto/                moduly protokolů (bez DOM), jeden soubor = jeden protokol
    registry.js         statický registr protokolů, pořadí v zásobníku, demux()  [hotovo]
    ethernet.js ipv4.js udp.js   [hlavička, přijetí, binds/demuxField]; ipv4.js navíc deriveRoutes (PC i router:
                        connected, local, static_routes) a lookupRoute (LPM); arp.js icmp.js [úroveň 3: data,
                        parametry a stavba zpráv; chování s plánovačem je v core/netsim.js]; tcp.js dns.js http.js (plán)
  devices/              chování typů uzlů: types.js (host/hub/switch), hub.js, switch.js (IEEE 802.1D; porty bez
                        kabelu se nefloodují); router je v core/netsim.js (routerIp), protože potřebuje ARP a plánovač
  wire/                 převod PDU na bajty (bez DOM): encode.js [Ethernet II, IPv4, UDP, RFC 1071],
                        fields.js [pole pro rentgen: posun, délka, hodnota z bajtů, názvy CZ/Wireshark], pcap.js (plán)
  cli/                  terminály nad pohledem (bez DOM): shell.js (dialekt podle typu uzlu), wincmd.js
                        (ipconfig, ipconfig /all, arp -a; úroveň 3: ping, tracert, arp -d, route print = netstat -nr),
                        ios.js (switch: show mac address-table), iosrouter.js (router: R1> / enable / R1#,
                        show ip route, show ip interface brief, show ip arp, ping; traceroute a konfigurace odmítnuté)
  scenario/             sestavení úrovně ze scénáře (level1.js, level2.js, level3.js + whatIf: ping/tracert
                        z terminálu jako samostatná simulace ze stavu kroku), později sdílení odkazem
  levels.js             profily úrovní 1–5 (protokoly, co UI ukazuje: xray, terminal)
  ui/                   UI: render.js (úroveň 1 a společné: výtah, odznaky), lift.js (přenos jako „U“,
                        rozhodnutí 38: kotva bloku podle aktivní vrstvy, pruh média s bity, hub/switch v pruhu;
                        čisté funkce + dvě malé DOM funkce pro polohu a posun), render2.js (úroveň 2: hvězda
                        s hubem/switchem, MAC tabulka, obálky s adresami, rentgen, vysvětlivka s předpovědí,
                        řádky terminálu; funkce vracejí HTML jako text, testují se v Node), tips.js (tip:
                        krok tipu <-> krok vyhodnocení, věta „Sedí / Nesedí: důvod“), app1.js a app2.js
                        (adaptéry úrovní: stav UI a události), urlstate.js (#u=2&k=8b&m=tcpip)
scenarios/              scénáře: *.md (didaktik, text) a *.js (data pro simulátor, viz kap. 5.3)
tests/
  run_all.sh            všechny testy (node + smoke v prohlížeči)
  core/*.test.js        jednotkové testy jádra
  ui/*.test.js          logika UI bez prohlížeče (texty podle režimu, panel Detail, adresa)
  browser/interact.html test ovládání v headless Chromiu (spouští run_all.sh, výsledek v data-result)
  proto/*.test.js       testy protokolů (kódování, checksumy)
  vectors/*.json        testovací vektory projektanta (docs/spec/vektory.md)
  core/vectors.test.js  runner vektorů (kap. 8)
tools/
  bundle.mjs            jednosouborová offline verze (iterace 3–4)
docs/                   dokumentace týmu
```

**Pravidla závislostí** (hlídá `tests/core/deps.test.js`, kontroluje všech šest složek): `core/`, `proto/`, `devices/`, `wire/`,
`cli/`, `scenario/` nesmí importovat z `ui/` ani sahat na `document`/`window`/`localStorage`. `ui/` smí
importovat z čehokoli. Žádné cyklické importy (kvůli bundleru R3).

**Konvence kódu kvůli bundleru:** jen statické `import … from './relativni/cesta.js'` s příponou
`.js`; žádný `import()` (dynamický), žádný top-level `await`, žádné `fetch` v jádře. Data
(scénáře) načítá jen `scenario/` a pro offline verzi je bundler vloží do stránky.

## 3. Jádro simulace

### 3.1 Entity

Celý stav simulace je jeden objekt `world` z čistých dat (snapshot = `structuredClone`):

```js
world = {
  time: 0,                       // µs, kopie scheduler.now
  nodes: { PC1: Node, … },       // pořadí klíčů = pořadí v topologii (determinismus)
  links: { L1: Link, … },
  pduSeq: 0,                     // čítač id PDU
  rng: { state },                // Rng.snapshot()
  scheduler: { now, seq, queue } // Scheduler.snapshot()
}
Node = { id, type: 'pc'|'server'|'hub'|'switch'|'router', label, config,
         interfaces: { eth0: Interface, … },
         state: { arp: {...}, ip: {...}, bridge: {...}, icmp: {...}, … } }   // klíč = id protokolu
Interface = { name, mac, ip, prefix, up, link: 'L1' | null }
Link = { id, a: { node, if }, b: { node, if }, delay: 1000, up: true }
```

**PDU** je neměnná vnořená struktura, každá úroveň = jedna vrstva. Hlavičky obsahují jen pole,
která simulace potřebuje; zbytek reálné hlavičky (verze, IHL, checksum…) dopočítá `wire/encode.js`
pro rentgen a pcap.

```js
{ id: 17, parent: 12,            // parent: z čeho vznikl (router: nový rámec ze starého)
  proto: 'ethernet', h: { dst: 'ff:ff:ff:ff:ff:ff', src: '02:00:00:00:00:01', ethertype: 0x0806 },
  payload: { proto: 'arp', h: { op: 1, sha, spa, tha, tpa }, payload: null } }
```

Rodokmen (`parent`) umožní v UI ukázat „tohle je pořád tentýž paket, jen v novém rámci“.

### 3.2 Plánovač (hotovo: `js/core/scheduler.js`)

- Virtuální čas v **celých mikrosekundách**. Model jednotkového zpoždění ze specifikace
  (`model.md` kap. 7) = linka má `delay` 1000 µs; **krok vektoru = čas příchodu / 1000**.
  Časovače v sekundách (ARP 300 s) se vejdou bez ztráty přesnosti (2^53 µs ≈ 285 let).
- Fronta je binární halda podle (čas, pořadové číslo naplánování) → shodné časy proběhnou FIFO.
- `on(type, handler)`, `schedule({type, payload, delay|at}) → id`, `cancel(id)`, `step()`,
  `run({until, maxEvents})`, `subscribe(observer)`, `snapshot()`/`restore()`.
- `maxEvents` je pojistka proti zahlcení (smyčka switchů bez STP, `spec/README.md` otázka 7).

Typy událostí plánovače jsou jmenné prostory `<modul>.<co>`: `link.arrive`, `arp.timeout`,
`tcp.rto`, `cli.command`. Obsluhu registruje modul, který typ vlastní.

### 3.3 Záznam (trace) jako jediný zdroj pro zobrazení

Jádro kromě plánovače vede **trace**: seznam záznamů, které popisují, co se stalo, tak podrobně,
aby z nich šla bez jádra vykreslit animace, sekvenční diagram, rentgen i pcap:

```js
{ i: 42, t: 2000, node: 'SW1', kind: 'link.tx', link: 'L2', from: 'SW1', to: 'PC2', pdu: {...} }
{ i: 43, t: 2000, node: 'SW1', kind: 'table', table: 'mac_table',
  delta: { op: 'add', entry: { mac: '02:…:01', port: 'Fa0/1', vlan: 1, type: 'dynamic' } } }
{ i: 44, t: 3000, node: 'PC3', kind: 'nic_drop', pdu: 17, detail: 'cizí cílová MAC' }
{ i: 45, t: 3000, node: 'PC1', kind: 'encap', layer: 'L3', pdu: 21 }     // pro výtah (úroveň 1)
```

- `kind` používá slovník událostí z `vektory.md` kap. 6 (`arp_learn`, `flood`, `ip_forward`…)
  plus technické `link.tx`, `link.rx`, `encap`, `decap`, `table`, `app` (výstup aplikace).
- Delty tabulek mají tvar `{op: 'add'|'update'|'remove', entry, before}` → jsou vratné.
- Tabulky se mění **jen** přes pomocníka `ctx.table(node, 'arp_cache').upsert(...)`, který
  zároveň zapíše deltu. Ruční zápis do stavu mimo něj je chyba (hlídá test porovnáním snapshotu
  s přehranými deltami).

### 3.4 Kroky a krok vpřed/vzad (R6, R7)

- **Krok** je didaktická jednotka, ne událost plánovače. `timeline.js` seskupí záznamy trace
  do kroků podle profilu úrovně: úroveň 1 = každé `encap`/`decap` a přenos je krok
  (výtah, `docs/ui.md`); úroveň 2–3 = jeden krok na jeden logický krok vektoru (všechny přenosy
  se stejným časem příchodu, flooding na víc portů je jeden krok); úroveň 4 = podobně, s
  možností „přeskoč handshake“.
- **Úroveň 1 (hotovo):** `transfer.js` vyrobí záznamy `sim.start, app.send, encap ×3, phy.tx,
  link.tx, phy.rx, decap ×3, app.recv, sim.end`; `timeline.js` je přiřadí krokům scénáře podle
  `match` a pohled po kroku k počítá **znovu z předpony záznamu** (`viewAt`), bez delt. Pro desítky
  záznamů je to zanedbatelné a krok vzad je přesný z definice (test). Delty a snapshoty níže
  přijdou s tabulkami v iteraci 2. Model vrstev (ISO/OSI / TCP/IP) jádro nezná, je jen parametr
  vykreslení, takže přepnutí nemění krok ani stav. Jediný zdroj pravdy o aktuálním kroku v UI je
  `timeline.cursor` (main.js si krok zvlášť nepamatuje). Texty kroku (`title`, `text`, `note`,
  `hint`, `simplifies`) jsou řetězec, nebo `{ osi, tcpip }` podle režimu (`textFor()`); id řádku
  vrstvy se při přepnutí modelu převádí `convertRowId()` (jinak by panel Detail spadl).
- Příjem je skutečný **demultiplex zdola**: rámec zpracuje nejnižší modul, další modul vybere
  pole hlavičky (`demuxField`: EtherType -> Protocol -> port) proti `binds` zapnutých modulů
  (`registry.demux`). Vypnutý protokol = `drop` s důvodem „protokol není v této úrovni“.
  Hlavičky odesílatele berou hodnoty z `binds` modulu nad sebou (EtherType 0x0800, Protocol 17).
  IPv4 Identification je čítač na uzel od `node.ip_id_start ?? 1` (ipv4.md kap. 2).
- **Úroveň 2 (hotovo):** `netsim.js` vyrobí záznamy `sim.start` (topologie a výchozí tabulky),
  `app.send`, `udp_send`, `encap` ×3, `phy.tx`, `link.tx`, na hubu `phy.rx` + `repeat`, na switchi
  `phy.rx` + `mac_learn` + `flood`/`forward`/`filter`, na PC `phy.rx` a buď `nic_drop` (karta), nebo
  (v další události se stejným časem) `decap`, `ip_deliver`, `udp_deliver`, `app.recv`; akce scénáře
  `mark` (krok bez provozu) a `swap` (výměna hubu za switch se stejnými kabely, `topo.swap`).
  Karta filtruje hned, OS zpracuje přijatý rámec až v události `host.rx` se zpožděním 0: proto je
  v záznamu nejdřív zahození u Cyrila a teprve potom rozbalování u Boba (pořadí kroků 7 a 8 ve
  scénáři). `netViewAt(records, upto, from)` počítá pohled znovu z předpony (krok vzad je přesný
  i s MAC tabulkou, test), záznamy od `from` jsou „tento krok“ (rámce na kabelech, porty vstup/ven,
  nový řádek tabulky). Dvojice ve výtahu = poslední `app.send` (UI může příjemce přepnout klikem).
  Zdrojový port klienta je první volný od 49152 (rozhodnutí 28; .md scénáře uvádí 50001).
- Kurzor `timeline.goto(k)` vrátí **pohled** na stav po kroku k: tabulky uzlů, PDU na linkách,
  texty vysvětlivek. Dopředu se delty aplikují, dozadu se aplikují inverzně. Pro skok posuvníkem
  se ukládá pohled každých 32 kroků.
- Nový vstup v kroku k (student napíše `ping` v terminálu): jádro obnoví nejbližší **plný
  snapshot světa** ≤ k (ukládá se při každém vstupu a každých 256 událostí), přehraje do k,
  naplánuje vstup a dopočítá dál. Budoucnost za k se zahodí (jako „undo“ v editoru).
- Proč ne jen snapshoty po každém kroku: snapshot celého světa je dražší a pro zobrazení
  zbytečný. Proč ne jen replay od začátku: u delších scénářů s TCP by krok vzad trval
  znatelně dlouho na školním PC. Hybrid je obojí levné.

### 3.5 Kontext pro moduly

Obsluhy dostávají `ctx` (jediná brána do světa, usnadňuje testy):
`ctx.now`, `ctx.node(id)`, `ctx.send(node, ifName, pdu)` (předá lince), `ctx.deliverUp(node,
proto, pdu, meta)` (demux výš), `ctx.schedule(...)`, `ctx.cancel(id)`, `ctx.table(node, name)`,
`ctx.emit(kind, data)` (trace), `ctx.rng`, `ctx.newPdu(proto, h, payload, parent)`.

## 4. Protokoly jako moduly

### 4.1 Rozhraní modulu

```js
// js/proto/arp.js
export default {
  id: 'arp',
  layer: 'L2.5',                  // pro výtah a barvy (mezi L2 a L3, model.md kap. 1)
  requires: ['ethernet'],
  nodeTypes: ['pc', 'server', 'router'],
  binds: { ethertype: 0x0806 },   // demux: ethernet.ethertype | ipv4.protocol | port
  tables: ['arp_cache'],          // tabulky, které modul vlastní
  init(node, ctx) { return { arp_cache: [], pending: [] }; },   // -> node.state.arp
  receive(node, ifName, pdu, ctx) { … },                          // PDU z nižší vrstvy
  api: { resolve(node, ifName, nextHopIp, ctx, onResolved) { … } }, // volají jiné moduly
  events: { 'arp.timeout': (ev, ctx) => { … } },                  // obsluhy plánovače
  commands: { pc: ['arp'] },                                       // příkazy terminálu (cli/)
};
```

Kódování do bajtů je **oddělené** (`js/wire/encode.js` má pro každý `proto` funkci
`encode(h, payloadBytes) → Uint8Array` a `fields(h) → [{name, offset, bits, value, display, ref}]`
pro rentgen). Simulace bajty nepotřebuje; rentgen a pcap ano. Díky tomu jde kódování testovat
samostatně proti reálným rámcům (hexdump z Wiresharku jako vektor).

### 4.2 Registrace a zapnutí podle úrovně

- `registry.js` má statický seznam všech modulů (statické importy, kvůli bundleru R3).
- Scénář určuje sadu protokolů: `"protocols": [...]`; když chybí, vezme se výchozí sada
  z `levels.js` pro `"level"`. Registr sadu doplní o `requires` a odmítne neznámé id.
- Vypnutý protokol v simulaci **neexistuje** (demux ho nenajde → `ip_drop` s důvodem
  „protokol není v této úrovni“), jeho příkazy v terminálu nejsou dostupné.
- Úroveň zároveň řídí **zobrazení** (`levels.js` → UI): úroveň 1 skryje adresy, úroveň 2 ukáže
  MAC/IP/port na obálkách, rentgen je dostupný od úrovně 2 atd. Jádro počítá vždy přesně;
  úroveň mění jen to, co UI ukáže.

| Úroveň | Výchozí protokoly |
|---|---|
| 1 Barvičky | ethernet, ipv4, udp (zpráva Alice → Bob; adresy skryté) |
| 2 Adresy | ethernet, ipv4, udp (+ hub, switch; ARP tabulka jen předvyplněná, rozhodnutí 14; ARP a ICMP v úrovni 3) |
| 3 Směrování | ethernet, arp, ipv4, icmp, udp (+ router; ping, tracert; ARP se opravdu posílá) |
| 4 Transport a aplikace | + tcp, dns, http |
| 5 Směrem k CCNA | + dhcp, nat, filtrace (acl) |

### 4.3 Kdo vlastní kterou tabulku

| Tabulka (název ve vektorech) | Vlastník (modul) | Kde je | Kdo ji čte |
|---|---|---|---|
| `arp_cache` | `arp` | `node.state.arp.arp_cache` | `ipv4` přes `arp.api.resolve`, `cli` (`arp -a`, `show arp`) |
| `mac_table` | `switch` (devices/switch.js, IEEE 802.1D) | `node.state.bridge.mac_table` | jen switch, `cli` (`show mac address-table`) |
| `routing_table` | `ipv4` | `node.state.ip.routing_table` | `ipv4` (forwarding, longest prefix match), `cli` (`route print`, `show ip route`) |
| sockety / spojení | `udp`, `tcp` | `node.state.tcp.sockets` | aplikace, `cli` (`netstat`) |
| DNS cache | `dns` | `node.state.dns.cache` | `cli` (`ipconfig /displaydns`) |

`routing_table` se **odvozuje** z konfigurace (adresy rozhraní → connected/local, brána →
default, statické trasy z `config`), jak vyžaduje `vektory.md` kap. 3. Odvození je samostatná
čistá funkce `ipv4.deriveRoutes(node)`, testovaná proti `initial_state` vektorů.

## 5. Formát topologie a scénáře

### 5.1 Verze

Každý soubor má `"format": "tcpipsim-<druh>/<major>"` (`tcpipsim-topology/1`,
`tcpipsim-scenario/1`, `tcpipsim-vector/1`). Minor změny jen přidávají nepovinné klíče
(loader neznámé klíče ignoruje). Změna major = migrační funkce v `core/topology.js`
(`migrate['tcpipsim-scenario/1'] → /2`), staré odkazy tak dál fungují.

### 5.2 Topologie

Uzly a linky přesně podle `vektory.md` kap. 2 (`id`, `type`, `interfaces`, `ports`, `gateway`,
`ttl_default`, linky `a`/`b`), navíc nepovinné: `label` (popisek v UI), `pos: {x, y}` (mřížka
editoru), `config` (statické trasy, později DHCP, ACL), na lince `delay`.

**Příklad A: 2 PC + switch**

```json
{
  "format": "tcpipsim-topology/1",
  "id": "dva-pc-switch",
  "title": "Dva počítače a switch",
  "nodes": [
    { "id": "PC1", "type": "pc", "label": "Alice", "pos": { "x": 2, "y": 4 },
      "interfaces": [{ "name": "eth0", "mac": "02:00:00:00:00:01", "ip": "192.168.1.10", "prefix": 24 }] },
    { "id": "PC2", "type": "pc", "label": "Bob", "pos": { "x": 10, "y": 4 },
      "interfaces": [{ "name": "eth0", "mac": "02:00:00:00:00:02", "ip": "192.168.1.20", "prefix": 24 }] },
    { "id": "SW1", "type": "switch", "pos": { "x": 6, "y": 2 }, "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"] }
  ],
  "links": [
    { "id": "L1", "a": { "node": "PC1", "if": "eth0" }, "b": { "node": "SW1", "if": "Fa0/1" } },
    { "id": "L2", "a": { "node": "PC2", "if": "eth0" }, "b": { "node": "SW1", "if": "Fa0/2" } }
  ]
}
```

**Příklad B: domácí LAN + router + server (obrázek z prezentací)**

```json
{
  "format": "tcpipsim-topology/1",
  "id": "domaci-lan-seznam",
  "title": "Domácí síť a www.seznam.cz",
  "nodes": [
    { "id": "PC1", "type": "pc", "label": "Notebook", "pos": { "x": 2, "y": 2 }, "gateway": "192.168.1.1",
      "interfaces": [{ "name": "eth0", "mac": "02:00:00:00:00:01", "ip": "192.168.1.10", "prefix": 24 }] },
    { "id": "PC2", "type": "pc", "label": "Stolní PC", "pos": { "x": 2, "y": 6 }, "gateway": "192.168.1.1",
      "interfaces": [{ "name": "eth0", "mac": "02:00:00:00:00:02", "ip": "192.168.1.20", "prefix": 24 }] },
    { "id": "SW1", "type": "switch", "pos": { "x": 6, "y": 4 }, "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"] },
    { "id": "R1", "type": "router", "label": "Domácí router", "pos": { "x": 10, "y": 4 },
      "interfaces": [
        { "name": "Gi0/0", "mac": "02:00:00:00:01:01", "ip": "192.168.1.1", "prefix": 24 },
        { "name": "Gi0/1", "mac": "02:00:00:00:01:02", "ip": "77.75.75.1", "prefix": 24 } ] },
    { "id": "SRV1", "type": "server", "label": "www.seznam.cz", "pos": { "x": 14, "y": 4 }, "gateway": "77.75.75.1",
      "interfaces": [{ "name": "eth0", "mac": "02:00:00:00:00:04", "ip": "77.75.75.172", "prefix": 24 }] }
  ],
  "links": [
    { "id": "L1", "a": { "node": "PC1", "if": "eth0" }, "b": { "node": "SW1", "if": "Fa0/1" } },
    { "id": "L2", "a": { "node": "PC2", "if": "eth0" }, "b": { "node": "SW1", "if": "Fa0/2" } },
    { "id": "L3", "a": { "node": "SW1", "if": "Fa0/4" }, "b": { "node": "R1", "if": "Gi0/0" } },
    { "id": "L4", "a": { "node": "R1", "if": "Gi0/1" }, "b": { "node": "SRV1", "if": "eth0" } }
  ]
}
```

Simulátor zjednodušuje: internet mezi domácím routerem a serverem je zkrácený na jednu linku
a router nedělá NAT (NAT a ISP přijdou v úrovni 5). Adresa `77.75.75.1` je smyšlená brána.
Toto zjednodušení musí odsouhlasit projektant a didaktik (privátní adresa by ve skutečném
internetu bez NAT neprošla, student se to nesmí naučit špatně → v UI výslovně označit).

### 5.3 Scénář

Scénář = topologie (vložená, nebo odkaz `"topology": "domaci-lan-seznam"`) + úroveň + akce +
texty kroků + otázky. Texty píše didaktik do `scenarios/*.md`, data jsou v `scenarios/*.json`.

```json
{
  "format": "tcpipsim-scenario/1",
  "id": "uroven2-ping-switch",
  "title": "Ping přes switch",
  "level": 2,
  "seed": 1,
  "protocols": null,
  "topology": "dva-pc-switch",
  "initial_state": { "arp_cache": { "PC1": [] } },
  "actions": [ { "time": 0, "node": "PC1", "command": "ping", "args": { "dst": "192.168.1.20", "count": 1 } } ],
  "steps": [
    { "match": { "kind": "link.tx", "node": "PC1", "pdu.arp.op": 1 },
      "title": "ARP request", "text": "PC1 nezná MAC adresu Boba, ptá se všech (broadcast)." }
  ],
  "terminal": { "enabled": true, "nodes": ["PC1", "PC2"] },
  "questions": [ { "text": "Proč PC2 odpověděl jen PC1, a ne všem?", "answer": "…" } ]
}
```

- **Soubor scénáře je ES modul s čistými daty** (`scenarios/<id>.js`: `export default { …JSON… }`),
  ne `.json`. Důvod: `fetch` z `file://` nefunguje a JSON moduly (`import … with {type:'json'}`)
  neumí Firefox 115; statický import modulu funguje v prohlížeči, v Node i v bundleru (R3).
  Test hlídá, že data jdou beze ztráty převést na JSON (pro sdílení odkazem a soubor).
- Krok scénáře: `{ num, part?, match, title, text, note?: {osi, tcpip}, hint?, simplifies?, showMapping? }`.
  `num` je číslo kroku ve scénáři (čítač „Krok n z N“), `part: [i, n]` dílčí krok (úroveň 1: 8a–8c),
  `note` doplňující věta jen v daném režimu přepínače, `simplifies` text za „Simulátor zjednodušuje:“.
- `actions` a `initial_state` mají stejný tvar jako ve vektorech (`time` v sekundách, převádí
  se na µs). `steps[].match` váže text vysvětlivky na záznam trace (ne na číslo kroku), takže
  text sedí i po změně časování.
- Když scénář `steps` nemá, vysvětlivky se generují ze `summary` událostí (jako ve vektorech).

### 5.4 Sdílení odkazem

- **Úroveň (hotovo):** `#u=2&k=12&m=osi`; bez `u` je úroveň 1 (staré odkazy platí). Výběr úrovně
  v záhlaví a změna `u` v adrese stránku načtou znovu (jiné jádro i DOM). `<title>` podle úrovně.
  Úroveň 2 navíc čte (pro odkazy a snímky): `x=ethernet|ipv4|udp` záložka rentgenu, `f=eth.dst` pole,
  `t=PC1` otevřený terminál a `c=<příkaz>` (může být víckrát), `pick=Fa0/2,Fa0/3` tip v kroku tipu,
  `ans=sw1:Fa0/2;swap:Ne` potvrzené tipy (id tipu ze scénáře) pro snímek kroku vyhodnocení,
  `pair=PC3` příjemce ve výtahu, `sel=SW1` vybraný uzel.
- **Krok a model (hotovo, rozhodnutí 21):** `index.html#k=8b&m=tcpip`. `k` je označení kroku
  jako v UI (`8` = `8a`), `m` = `osi | tcpip`. Adresa se při krokování a přepnutí přepisuje
  (`history.replaceState`, historie se nezaplní) a změna adresy (`hashchange`) stránku přepne.
  Pro snímky navíc `&anim` (vykreslit s animací) a `&q=1` (otevřít kontrolní otázky).
  Parsování je v `js/ui/urlstate.js` (test v `tests/ui/render.test.js`).
- Vestavěný scénář: `index.html#s=uroven2-ping-switch`.
- Vlastní topologie/scénář od učitele: `#d=<base64url(deflate-raw(JSON))>` přes nativní
  `CompressionStream` (bez knihovny). Topologie s 10 uzly ≈ 3 kB JSON ≈ 1 kB v odkazu; to
  Classroom i e-mail snesou. Data v hash se neposílají na server (soukromí, GitHub Pages je statický).
- Pro větší soubory: tlačítko „Uložit / Otevřít soubor“ (`.json`, `<input type=file>` a
  drag&drop; funguje i v offline verzi, protože nepotřebuje `fetch`).
- Odkaz nese i `seed`, takže všichni studenti vidí stejný průběh.

## 6. UI oddělené od jádra

- Jádro nic nekreslí. UI dostane hotovou `timeline` a poslouchá `timeline.subscribe(view =>…)`
  (pozorovatel). Každý pohled (výtah, topologie, sekvenční diagram, rentgen, tabulky) je
  funkce `render(view)` nad stejným pohledem; žádný pohled si stav nedrží sám.
- Animace jen interpoluje mezi pohledem k a k+1 (`docs/ui.md` kap. 4); přerušení animace
  nemění stav.
- **Přenos jako „U“** (rozhodnutí 38, `ui/lift.js`): prostřední sloupec `#lane` je mřížka 7 stop
  jako sloupec vrstev (stopa vrstvy n = 8 − n). `liftAnchor(view, pair)` řekne, kde zpráva je
  (`sender`/`receiver`/`device`/`other`/`wire`/`none`) a u které vrstvy ISO/OSI; `laneEnd()` z toho
  spočte `--lane-end` (blok `#nest` má `grid-row: 1 / end`, `.float` sedí dole přes `margin-top: auto`).
  Bity se nekreslí v bloku, ale v `#medium` (`mediumHtml()`: pruh mezi řádky L1, u úrovně 2 věžička
  hub L1 / switch L1–L2). Poloha se mění jen třídou/proměnnou; posun je `transform` (`slideFloat`),
  jen při kroku vpřed, ne při kroku vzad, skoku a „Omezit animace“. Test: `tests/ui/lift.test.js`
  (kotva a řádek pro kroky úrovně 1 a 2, tip nic neprozradí) a `tests/browser/interact.html`
  (skutečná poloha bloku proti aktivnímu řádku při 1280×720). Snímky: `tmp/u38/all.sh`
  (1400×900 a 1280×720, jen lokálně, `tmp/` se necommituje).
- **Sekvenční diagram** = `link.tx` záznamy (osy = uzly, šipky = přenosy, čas = krok).
- **Rentgen** = `wire/encode.js` nad PDU z vybraného záznamu (pole + hexdump; IP/ICMP/TCP
  checksumy se počítají skutečně podle RFC 1071, FCS se nepočítá, `model.md` kap. 8).
- **Export pcap** = `wire/pcap.js`: klasický pcap (LINKTYPE_ETHERNET = 1), jeden soubor
  na vybranou linku (jako odposlech na jednom kabelu; víc linek najednou by duplikovalo
  rámce), časové razítko = virtuální čas. Stažení přes `Blob` + `<a download>` (jde i z `file://`).
- **Terminál** (`cli/`) je modul nad jádrem bez DOM: `shell.execute(nodeId, 'ping 192.168.1.20')`
  → naplánuje akci (`cli.command`) a vrátí objekt, který postupně dostává řádky výstupu z
  událostí `app` v trace. Dialekty: `wincmd` (ipconfig, ping, tracert, arp, nslookup, netstat,
  route print) a `ios` (zjednodušené Cisco IOS: režimy `>`/`#`/`(config)#`, `show ip route`,
  `show arp`, `ip route`, `ping`). Okno terminálu (`ui/terminal.js`) jen zobrazuje. Testuje se
  v Node (vstup → očekávaný text), texty hlášek podle `docs/ui.md`.
- **Editor topologie** mění jen JSON topologie; po každé změně se svět sestaví znovu
  (topologie je malá, je to okamžité). Undo/redo = zásobník verzí JSON.

## 7. Výkon

Školní PC a Raspberry Pi 4 jsou cílová spodní hranice. Typický scénář má stovky až nízké
tisíce událostí; simulace dopředu trvá milisekundy. Rizikem je jen DOM: animovat
`transform`/`opacity`, sekvenční diagram v SVG s omezeným počtem viditelných řádků.
Měřit od iterace 2 na gaze (`performance.now()` v smoke testu).

## 8. Testování

| Vrstva | Nástroj | Co |
|---|---|---|
| jádro, protokoly, cli | `node --test` (vestavěný, bez závislostí) | `tests/**/*.test.js` |
| vektory projektanta | `tests/core/vectors.test.js` | každý `tests/vectors/*.json` = jeden test; `skip` jen `tracert-dva-routery` (rozhodnutí 44) |
| úroveň 3 | `tests/core/level3.test.js`, `tests/ui/render3.test.js` | testovací kritéria scénáře, LPM, terminál Windows a IOS, runner pozná špatný ping/tracert, ICMP součty, vykreslení všech kroků, tipy nic neprozradí |
| úroveň 2 | `tests/core/level2.test.js`, `devices.test.js`, `cli.test.js`, `tests/ui/render2.test.js` | testovací kritéria scénáře, switch/hub, terminál (vstup -> text), vykreslení všech kroků |
| kódování | `tests/proto/*.test.js` | bajty proti hexdumpům reálných rámců, checksum = 0 po přepočtu |
| logika UI | `node --test` (`tests/ui/`) | panel Detail pro všechna id × model, texty podle režimu, zakázané zkratky, adresa |
| stránka | headless Chromium v `tests/run_all.sh` | načtení `index.html` bez chyb |
| ovládání | headless Chromium, `tests/browser/interact.html` | klávesy, přepnutí modelu s otevřeným panelem, adresa, posuvník, pauza, dialog |
| vzhled | `chromium --headless --screenshot=…` | ruční kontrola snímků (kreativec, recenzent) |

**Runner vektorů** (hotovo: `js/core/harness.js`, test `tests/core/vectors.test.js`). Navíc test, že
runner pozná změněné očekávání (jiné pole, chybějící přenos, jiná tabulka, událost navíc), platné
kontrolní součty IP a UDP a hexdump rámců 1 a 4 přesně podle `rentgen.md` kap. 6:

```js
const run = runVector(vector);   // js/core/harness.js: topologie → svět, initial_state,
                                 // actions, run až do prázdné fronty (před vypršením časovačů)
// run = { transmissions: [{step, link, from, to, pdu}], events: [...],
//         finalState: { arp_cache, mac_table, routing_table }, appResult }
compareVector(vector.expected, run);  // pravidla vektory.md kap. 5–7: pořadí na (link, from)
                                      // přesně, step, částečná shoda polí, MAC bez ohledu na
                                      // velikost písmen, tabulky jako množiny, bez `age`
```

`harness.js` převádí PDU jádra na tvar `pdu.eth/ip/udp/data` z vektorů a `frame_len`, `total_length`
a UDP `length` čte z bajtů z `wire/encode.js`, takže vektor zároveň testuje kódování délek. Odvozená
směrovací tabulka se porovná s `initial_state.routing_table`. Vektory úrovně 3 a vektory s akcí
`ping`/`tracert` se přehrají se zapnutým ARP a ICMP (`vectorProtocols`); `app_result` pingu a tracertu
se porovná (částečná shoda + stejný počet odpovědí/chyb/skoků, `appResults` ze záznamů `app.start` /
`app.event`). Události `arp_fail`, `arp_expire` jsou ve slovníku. `tests/core/vectors-format.test.js`
dál kontroluje tvar všech vektorů.

**Smoke test v prohlížeči** (ověřeno na gaze, Chromium 156):
- `chromium --headless --dump-dom` nad **`http://127.0.0.1` na gaze zamrzne** (prohlížeč se
  k lokálnímu serveru vůbec nepřipojí, ani mimo sandbox, ani s `--no-proxy-server`; příčinu
  jsem nedohledal). Proto smoke test načítá `file://…/index.html` s přepínačem
  `--allow-file-access-from-files`, který moduly ze souboru povolí. Na jiných strojích je
  možné přidat variantu přes http.
- Chyby se zjišťují dvojím způsobem: (1) inline skript v `index.html` zachytí `error`,
  `unhandledrejection`, `console.error` a selhání načtení modulu do atributu `data-errors`
  v DOM; (2) `--enable-logging=stderr` vypíše konzoli jako řádky `CONSOLE`, skript hledá
  `Uncaught|Error|CORS|Failed to load`. Jádro po úspěšném startu nastaví `data-core="ok"`.
- Ověřeno, že test opravdu selže při výjimce v modulu i při chybějícím importu.
- `--user-data-dir` do dočasné složky, aby test nekolidoval s otevřeným prohlížečem.
- Smoke test načte `index.html` (úroveň 1), `index.html#u=2&k=13&t=SW1&c=…` (úroveň 2 s terminálem)
  a dvě adresy úrovně 3 (konzole R1 s `show ip route`, živý `tracert` na Alici).
- `run_all.sh` hledá výsledek testu ovládání jako atribut prvku (`id="result" data-result="OK"`);
  samotný text `data-result="OK"` je i v komentáři souboru, dřívější grep proto nemohl selhat.
- **Test ovládání:** `tests/browser/interact.html` načte `index.html#k=8b&m=tcpip` v iframe
  (file:// + `--allow-file-access-from-files` = stejný původ), posílá události a kliká, výsledek
  zapíše do `<pre id="result" data-result="OK|FAIL">`; `run_all.sh` ho čte z `--dump-dom`
  a vypíše řádky, které selhaly. Nový ovládací prvek = nová kontrola tam. Druhá část přepne
  výběrem v záhlaví na úroveň 2 a projde tip na port (nic neprozrazuje) + vyhodnocení s důvodem
  a štítkem „tip“, zastavení přehrávání na tipu, krok vzad s MAC tabulkou, dvojici Alice -> Cyril,
  výběr pole (buňka štítku, klávesy 1, 1+2 = pole 12, R a čísla i na zaměřeném posuvníku, Enter na
  řádku rentgenu), terminál switche, Esc, „Spustit za mě“, Obnovit (výpisy pryč, historie zůstane).
- **Snímky úrovně 2 (iterace 2, opravy):** `tmp/fix2/` (900 i 720 px; tipy `tipNN`, vyhodnocení
  `evalNN`, rentgen, terminál; `mac4.html` = kontrola místa pro 4 řádky MAC tabulky).
- **Snímky:** `tmp/fix/shot.sh <název> 'k=5&m=tcpip' 1280 720` (stav se zadává adresou), úroveň 2
  např. `'u=2&k=15&t=SW1&c=show%20mac%20address-table'`; snímky iterace 2 jsou v `tmp/u2/`.

**Pravidla:** každý nový modul jádra má test; nová chyba = nejdřív test, který ji ukáže.
Hotovo = `tests/run_all.sh` končí „VŠE PROŠLO“.

## 9. Jak přidat protokol / scénář (návod, platí od iterace 2)

**Protokol:** (1) spec v `docs/spec/<proto>.md` od projektanta, (2) `js/proto/<proto>.js` podle
kap. 4.1, (3) kódování a pole pro rentgen ve `js/wire/encode.js`, (4) zápis do `registry.js`
a výchozí úrovně v `levels.js`, (5) testy `tests/proto/<proto>.test.js` + vektor od projektanta.

**Úroveň 4 (TCP, DNS, HTTP):** jádro `core/transport.js` se instaluje do `runNetwork`, jen když je
v `protocols` zapnuté `tcp` (`LEVEL4_PROTOCOLS`). Tabulka spojení uzlu je `state.tcp_connections` ve tvaru
vektorů `{ local, remote, state }`; řídicí blok (TCB) visí na záznamu jako neenumerovatelná vlastnost `tcb`,
takže se do kopií tabulek ani do porovnání s vektory nedostane. Akce: `dns_resolve`, `nslookup` (bez cache,
timeout 2 s), `http_get` (`dst` nebo jen `host` = nejdřív DNS; `think` = čas aplikace v s, `keep` = nezavírat,
`via` = poslat po existujícím spojení), `tcp_open`, `tcp_close`, `tcp_expire` (konec TIME-WAIT), `link_loss`.
Aplikace serveru mají `delay` (s). Ve vektorech jsou zpoždění 0; ve scénáři 20 ms, aby segmenty šly po krocích.
Fronta rozhraní (tcp.md kap. 10): koncový uzel pošle po jedné lince nejvýš jeden rámec za krok; časovač RTO
startuje, až rámec opravdu odejde (`onTx`). Kroky událostí ve vektorech = čas v uzlu (`r.t / 1000`), ne příchod
rámce; `tools/vectors/gen5.py` je tak opravený (FIN-WAIT-1 v kroku zavření, `tcp_retransmit` v čase RTO,
`ip_forward` v kroku příchodu do R1). Pískoviště terminálu: `scenario/level4.js` `whatIf4` (stav kroku:
ARP, MAC, LISTEN/ESTABLISHED/TIME-WAIT, DNS cache). Odkaz: `index.html#u=4&k=16a&t=PC1&c=netstat%20-an`.

**Krok končí svou událostí (`until`) a hlídá ho `expect`:** krok bez `until` trvá až do začátku dalšího
kroku, a tak by zahrnul i zprávu, kterou jádro vyšle těsně před událostí dalšího kroku (recenze úrovně 4,
R1–R4). `until` (vzor záznamu) ukončí krok jeho událostí; záznamy po ní patří dalšímu kroku (`buildSteps`).
`expect: { from, to, proto, flags, seq, ack, type, op }` říká, jakou zprávu má pohled kroku ukazovat
(`core/message.js` `shownMessage`); `tests/core/expect.test.js` to ověřuje pro úrovně 2–4 a v úrovni 4 i to,
že sloupec příjemce = `right` kroku (`ui/lift.js` `stepPair`). Nový krok, který mluví o konkrétní zprávě,
má mít `expect`.

**Scénář:** (1) text v `scenarios/<id>.md` (didaktik), (2) data `scenarios/<id>.js` podle
kap. 5.3 (texty kroků doslova z .md; úroveň 2 navíc `initial_state`, akce `udp_send`/`mark`/`swap`
a u kroku `predict`, `evaluates`, `terminal`, `xray`, `socket`, `summary`, `arpHint`, viz hlavička
`uroven2-adresy.js`; volitelně `focus` = ohnisko kroku, jinak výchozí pravidlo v `js/ui/focus.js`,
`docs/ui.md` kap. 13), (3) zápis do katalogu (až bude víc scénářů), (4) test, že
každý krok najde svůj záznam (`buildSteps` jinak vyhodí chybu), (5) smoke test.

**UI úrovně 1 (jak ladit):** `index.html#k=4&m=tcpip` otevře krok 4 (označení jako v UI, např. `8b`) v režimu TCP/IP,
`&anim` přehraje animaci příchodu do kroku, `&q=1` otevře kontrolní otázky. Snímek:
`chromium --headless --allow-file-access-from-files --screenshot=tmp/k4.png --window-size=1400,900
"file://$PWD/index.html#k=4"` (kontrolovat i 1280x720; složka `tmp/` je v .gitignore).
Klávesy: šipky, mezerník, Home/End, +/−, T (ui.md kap. 6). Animace jen `transform`/`opacity`,
délky násobí CSS proměnná `--k` = 1/rychlost; `prefers-reduced-motion` i tlačítko „Omezit animace“
(třída `body.reduce-motion`, uloží se do localStorage) je nahradí 200ms zvýrazněním. Pauza dá
`body.frozen` (`animation-play-state: paused`), krok nebo Přehrát animaci rozmrazí. Průchod
vrstvou bez obálky (L7 -> L6 -> L5) = `.pass.anim-pass` v řádku, jen v ISO/OSI. Vysvětlivka
(`aria-live`) a panel Detail se překreslí jen při změně kroku nebo modelu (`state.shown`), ne při
změně rychlosti. Obálka má jediné tlačítko, svůj štítek (`button.lab`); mezerník na zaměřeném
tlačítku tlačítko aktivuje, jinde přehrává. Úroveň bez rentgenu (`levels.js` `xray: false`) má
panel „Detail“ a bez terminálu (`terminal: false`) skrytý terminál.
Odloženo (rozhodnuti.md bod 19): zpětná animace kroku vzad, animované slučování řádků.

**UI úrovně 2 (jak ladit):** `index.html#u=2&k=12`. Adaptér `ui/app2.js` drží jen stav UI (dvojice
ve výtahu, vybraný uzel, záložka a pole rentgenu, tipy předpovědi, historie terminálu), simulaci
nemění. Klik na PC = příjemce ve výtahu + tlačítko Terminál (klik na odesílatele vrátí výchozí
dvojici); klik na hlavičku switche = tlačítko Terminál. Klávesy navíc: `R` záložka rentgenu,
číslo pole (dvě číslice do 0,9 s = pole 12, 13), `Enter`/mezerník na řádku rentgenu vybere pole,
`Esc` zruší výběr / zavře terminál, `F2` nebo `` ` `` terminál, `Enter` potvrdí tip.
Pole se propojují atributem `data-field` (řádek rentgenu, bajty hexdumpu, buňka štítku: najetí =
třída `hl` na všech místech, klik = výběr).

**Tip (rozhodnutí 31):** krok s `predict` je samostatný krok se stavem PŘED rozhodnutím zařízení:
krok končí záznamem `phy.rx` (a případně `mac_learn`) na zařízení, rámec leží na vstupním portu
(pohled ho kreslí i na kabelu, kterým přišel), žádné výstupy ani přijal/zahodil. Volby
(`tipOptions` v render2.js) se berou z topologie: porty zařízení kromě vstupního (`pick: 'hosts'` =
popisek podle připojeného PC); `choices` = volby textem (Ano/Ne) s větami `verdicts`. Krok se
`evaluates: [id]` (jinak následující krok) ukáže výsledek a jednu větu „Tvůj tip: … Skutečnost: …
Sedí. / Nesedí: <why>“ (`ui/tips.js`), porty s tipem dostanou štítek „tip“. Nadpis karty
„Tip: …“, volby hned pod textem; Vpřed se jmenuje „Potvrdit tip“; přehrávání se na kroku tipu
zastaví (`app.isTip`, bez zmrazení animace); nic se neukládá, počet trefených tipů je v dialogu
Kontrolní otázky. Testy „nic neprozrazuje“: `tests/core/level2.test.js` a `tests/ui/render2.test.js`.

Terminál vypisuje stav v aktuálním kroku (tabulky z pohledu); historie příkazů (šipka nahoru) se
drží po dobu stránky, Obnovit smaže jen výpisy. Při výšce do 820 px: bez popisků buněk štítků (MAC
a IP celé), užší sloupce vrstev, rámec na kabelu jen jako šipka, data L7 na jednom řádku, souhrn
rentgenu skrytý (aspoň 3 pole viditelná), vysvětlivka do 40 % výšky se svým posuvníkem.

**UI úrovně 3 (jak ladit):** `index.html#u=3&k=12`. Adaptér `ui/app3.js`, kreslení `ui/render3.js`
(topologie dvou sítí s podbarvenými oblastmi, R1 jako karta přes hranici sítí se směrovací a ARP tabulkou;
pruh média s věžemi zařízení na cestě dvojice: switch do L2, router do L3 s nohami Gi0/0 a Gi0/1, rozhodnutí 48;
blok sedí u aktivní vrstvy (rozhodnutí 52), v routeru nad věží kompaktní paket s TTL `128 → 127` nebo rámec;
vlevo od věže „starý rámec zahozen“, vpravo „nový rámec“). Nadpis sloupce a popisek pod posuvníkem = skutečná
zpráva (`currentMessage`, rozhodnutí 50). Tipy nic neprozradí ani v okolí (rozhodnutí 51: `hideGw`, `allDevices`,
TTL na kabelu se v kroku tipu nekreslí; testy v `tests/ui/render3.test.js`). Pravý panel: karta podle `step.panel` (`mask`, `compare` = Rámec před
a za R1, `tables`, `probes`) a pod ní rentgen (`wire/fields.js` `pduFields`: Ethernet, ARP, IPv4, ICMP
včetně vložené hlavičky). Tipy úrovně 3 mají volby a správnou odpověď ve scénáři (`predict.answer`,
`multi`); test ověřuje odpověď proti záznamu. Skok na začátek části A–D (`part3` ve scénáři) tlačítky
v hlavičce vysvětlivky (popisek „Části:“); krok s `fix` (vyhodnocení tipu 22b, 24b) má tlačítko „Oprav bránu“ (a Vpřed se tak jmenuje).
Ping na vlastní adresu a 127/8 se doručí uvnitř zásobníku (`ip_local`, RFC 1122). Příkaz, který scénář spustí
až v pozdějším kroku, terminál nespustí (napíše, ve kterém kroku poběží).
Texty vrstev (`core/layers.js`) jsou podle rozhodnutí 49: role podle Michalovy prezentace, „firmware síťového
rozhraní“ (v řádku „firmware síť. rozhraní“), `detail` s Michalovými názvy PDU; ve sloupci vrstev L4 obecně „segment“. Terminál:
`ping`/`tracert`, které ve scénáři v tomto kroku běží nebo začaly, se vypisují „živě“ (řádky přibývají
krokováním); jiné se spustí jako samostatná simulace ze stavu kroku (`level3.whatIf`), `arp -d`
a `clear arp-cache` mění jen pískoviště terminálu v daném kroku. Konzole routeru začíná v `R1>`.
Adresa navíc: `x`, `f`, `t`, `c`, `pick`, `ans`, `sel` jako u úrovně 2. Snímky: `tmp/u3impl/`.

**Dluh pro úroveň 3 (projektant, nález 13; vyřešeno v iteraci 3 jen částečně):** s ARP karta přijme jen
svou MAC a broadcast (ne cizí multicast); `reason: 'multicast'` u switche zatím ne. `devices/switch.js` označuje flooding skupinové MAC
důvodem `'broadcast'` i pro multicast (`isGroupMac`), UI pak píše „broadcast → flooding“. A síťová
karta PC přijme jakoukoli skupinovou MAC (multicast bez filtru skupin). Na úrovni 2 se multicast
nevyskytuje; před ARP/IGMP na úrovni 3 rozlišit `reason: 'broadcast' | 'multicast'` a filtr karty
(přijmout jen broadcast a přihlášené skupiny), doplnit vektor.

## 10. Rizika

| Riziko | Dopad | Opatření |
|---|---|---|
| Offline verze z `file://` (R3) nefunguje v některém prohlížeči (Blob moduly ověřeny jen v Chromiu) | učitel bez internetu | ověřit Edge/Firefox na Windows ve škole; záloha: ZIP + návod `python -m http.server` |
| Headless Chromium na gaze nenačte http (kap. 8) | smoke test neověří reálný provoz přes server | test přes `file://` s přepínačem; ruční kontrola na GitHub Pages při vydání |
| TCP (stavy, retransmise, okna) je výrazně složitější než ARP/IP | zpoždění úrovně 4 | zúžit: bez okna a Nagle, pevné RTO, jen scénáře z didaktiky; vektory dřív než kód |
| Rozjetí formátu scénáře mezi didaktikem, projektantem a jádrem | rozbité scénáře | jedno schéma (R10), validátor s českými hláškami, test, který načte všechny `scenarios/*.json` |
| Krok vzad po interaktivním vstupu (terminál) mate studenta („kam zmizela budoucnost“) | UX | UI to řekne textem; rozhodne kreativec |
| Smyčky v topologii bez STP | zamrznutí stránky | `maxEvents` + hláška; editor smyčky hlásí (otázka 7 ve spec) |
| Sdílení odkazem přes `CompressionStream` (Safari < 16.4, starý Firefox) | odkaz nejde otevřít | pojistka: nekomprimovaný base64url `#j=`, delší odkaz |
| Výkon animací na projektorových PC | trhání | jen `transform`/`opacity`, měřit na gaze |
| Přesnost texty hlášek Windows/IOS | student se naučí špatný výstup | ověřit na školním PC a v Packet Traceru (projektant), texty v jednom souboru |

## 11. Odhad pracnosti iterací

Odhad v pracovních dnech vývojáře (agent + kontrola), bez času ostatních rolí.

| Iterace | Obsah | Jádro | UI | Celkem | Riziko |
|---|---|---|---|---|---|
| 1 | úroveň 1 Barvičky: world, pdu, link, trace, timeline (krok vpřed/vzad), ethernet+ipv4+udp bez adres v UI, výtah, ovládání, scénář z JSON | 3 | 4 | 7 | nízké |
| 2 | úroveň 2 Adresy: arp, icmp (ping), hub, switch, runner vektorů (ping-hub, ping-switch), topologie a tabulky v UI, rentgen L2/L3, sekvenční diagram, terminál cmd (`ping`, `arp -a`, `ipconfig`) | 5 | 5 | 10 | střední (rentgen, sekvenční diagram) |
| 3 | úroveň 3 Směrování: router, routing table, LPM, ICMP time exceeded/unreachable, `tracert`, IOS CLI základ, vektor ping-router, export pcap, sdílení odkazem, offline bundle | 6 | 4 | 10 | střední (IOS CLI rozsah) |
| 4 | úroveň 4 Transport a aplikace: udp, tcp (handshake, ACK, ztráta, retransmise, ukončení), dns, http, `netstat`/`nslookup`, editor topologie | 9 | 6 | 15 | vysoké (TCP, editor) |

Editor topologie lze přesunout do iterace 3, pokud ho didaktik potřebuje dřív (nezávisí na TCP).

## Ikona

`img/favicon.svg` (vnořené obálky L2, L3, L4 v barvách palety) a `img/apple-touch-icon.png` 180x180
(vyrenderováno z SVG headless Chromiem). Offline verze (`tools/bundle.mjs`) musí favicon vložit jako data URL.

## Nasazení a cache
GitHub Pages posílá soubory s `Cache-Control: max-age=600`. Při změně CSS nebo JS zvyš číslo `?v=` u `css/app.css` a `js/main.js` v `index.html`, jinak prohlížeč může 10 minut kombinovat nové HTML se starým CSS (stalo se 2026-11-26 u patičky).
