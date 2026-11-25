# Formát testovacích vektorů

Stav: návrh, iterace 1, doplněno v iteraci 2 (UDP, úroveň 2) a 3 (router, statické cesty, ICMP chyby, tracert). Verze formátu: `tcpipsim-vector/1`
(doplňky iterací 2 a 3 jsou zpětně kompatibilní: jen nové nepovinné klíče). Soubory: `tests/vectors/*.json`.

Testovací vektor popisuje **výchozí stav sítě + akci → co se musí stát na linkách a jak mají
vypadat tabulky na konci**. Formát nezávisí na implementaci: popisuje jen pozorovatelné chování
(PDU na linkách, obsah tabulek, výsledek aplikace), ne vnitřní struktury jádra. Klíče JSON jsou
anglicky (jsou to data pro kód), texty (`title`, `description`, `summary`, `detail`) česky.

## 1. Kostra

```json
{
  "format": "tcpipsim-vector/1",
  "id": "ping-switch",
  "title": "…",
  "description": "…co má vektor ukázat…",
  "level": 3,
  "skip": "důvod (nepovinné)",
  "spec_refs": ["docs/spec/arp.md", "…"],
  "topology": { "nodes": [ … ], "links": [ … ] },
  "initial_state": { "arp_cache": { … }, "mac_table": { … }, "routing_table": { … } },
  "actions": [ … ],
  "expected": {
    "transmissions": [ … ],
    "events": [ … ],
    "final_state": { … },
    "app_result": { … }
  }
}
```

Nepovinné klíče kořene: `level` (úroveň simulátoru, pro kterou vektor platí), `skip` (text: vektor
popisuje chování, které jádro zatím neumí; runner `tests/core/vectors.test.js` ho přeskočí s tímto
důvodem). Kdo funkci v jádře dodělá, `skip` z vektoru smaže — vektor pak musí projít. Vektory s akcí
`ping` přeskakuje runner i bez `skip` (`vectorSkipReason` v `js/core/harness.js`), dokud jádro ping neumí.

## 2. `topology`

**Uzel** (`nodes[]`):

| Klíč | Typ | Povinné | Význam |
|---|---|---|---|
| `id` | string | ano | jednoznačný název (`PC1`, `SW1`, `R1`) |
| `type` | `pc` \| `server` \| `hub` \| `switch` \| `router` | ano | viz `model.md` kap. 2 |
| `interfaces` | pole | L3 uzly | `{ "name", "mac", "ip", "prefix" }` |
| `ports` | pole stringů | hub, switch | názvy portů |
| `gateway` | IP | ne | výchozí brána hostitele |
| `ttl_default` | číslo | ne | výchozí TTL (jinak podle `type`, `ipv4.md` kap. 3) |
| `label` | string | ne | jméno pro UI („Alice“); jádro ho nepoužívá |
| `static_routes` | pole | ne | router: ručně zadané cesty `{ "prefix": "síť/délka", "next_hop": IP }` (= `ip route`); `0.0.0.0/0` je výchozí cesta. Odvozují se z nich záznamy `static`/`default` v `routing_table` (`routing.md` kap. 2.1) |
| `apps` | pole | ne | aplikace na uzlu: `{ "name", "proto": "udp", "port": číslo \| null, "auto_reply"?: text }`; `port: null` = klient bez pevného portu (OS přidělí dynamický, `udp.md` kap. 4.2); `auto_reply` = po přijetí zprávy hned odpoví tímto textem na zdrojovou IP a port (`udp.md` kap. 5) |

**Linka** (`links[]`): `{ "id": "L1", "a": { "node": "PC1", "if": "eth0" }, "b": { "node": "SW1", "if": "Fa0/1" } }`.
Každé rozhraní/port je nejvýše v jedné lince.

## 3. `initial_state`

Klíč = id uzlu, hodnota = pole záznamů. Uzel, který v tabulce není uveden, ji nemá (hub) nebo
ji má prázdnou.

| Tabulka | Záznam |
|---|---|
| `arp_cache` | `{ "ip", "mac", "if", "type": "dynamic" \| "static" }` |
| `mac_table` | `{ "mac", "port", "vlan", "type" }` |
| `routing_table` | `{ "prefix": "síť/délka", "next_hop": IP \| null, "if", "type": "connected" \| "local" \| "static" \| "default" }` |
| `udp_sockets` | `{ "app", "port" }` — otevřené UDP sockety (port, na kterém aplikace přijímá). Odvozené z `apps` s pevným portem; klient se objeví až po prvním odeslání. Uvedené ve vektoru, aby šlo začít stavem „po předchozí komunikaci“ |

`routing_table` je **odvozená** z konfigurace v `topology` (adresy rozhraní, brána). Je ve vektoru
proto, aby test ověřil i to odvození: implementace musí z topologie vytvořit stejnou tabulku
(pořadí záznamů nerozhoduje).

## 4. `actions`

`{ "time": 0, "node": "PC1", "command": "ping", "args": { "dst": "192.168.1.20", "count": 1 } }`.
`time` je simulovaný čas v sekundách. Úroveň 2: `{ "command": "udp_send", "args": { "app": "zpravy", "dst": IP, "dport": 5000, "text": "…" } }`
(aplikace `app` na uzlu `node` pošle text v UTF-8; zdrojový port = port socketu aplikace, případně nově
přidělený dynamický).
Výměna zařízení (úroveň 2, hub za switch se stejnými kabely):
`{ "time": 1, "node": "HUB1", "command": "swap", "args": { "with": { "id": "SW1", "type": "switch", "ports": ["Fa0/1", "Fa0/2", "Fa0/3"] }, "ports": { "P1": "Fa0/1", "P2": "Fa0/2", "P3": "Fa0/3" } } }`
— uzel `node` se nahradí uzlem `with` (nový switch má prázdnou MAC tabulku, jako po zapnutí), konce
linek se přejmenují podle mapy `ports`, `id` linek zůstanou; přenosy po výměně mají v `from`/`to` nový uzel.
Akce se stejným `time` se provedou v pořadí, v jakém jsou ve vektoru (nejdřív výměna, pak odeslání).
Úroveň 3: `{ "command": "ping", "args": { "dst": IP, "count": N } }` (časování `icmp.md` kap. 2.1: další
dotaz 1 s po odpovědi) a `{ "command": "tracert", "args": { "dst": IP, "max_hops": 30, "probes": 3, "resolve": false } }`
(= Windows `tracert -d`, `icmp.md` kap. 4.1). Další příkazy (`arp -d`, CLI routeru) přibudou s dalšími
vektory; seznam povolených příkazů je ve specifikaci příslušného protokolu.

## 5. `expected.transmissions` — PDU na linkách

Každý záznam = jeden přenos jednoho rámce po jedné lince jedním směrem:

```json
{ "n": 1, "step": 1, "link": "L1", "from": "PC1", "to": "SW1",
  "summary": "ARP request: kdo má 192.168.1.20? Ptá se 192.168.1.10",
  "pdu": {
    "eth":  { "dst": "ff:ff:ff:ff:ff:ff", "src": "02:00:00:00:00:01", "ethertype": "0x0806" },
    "arp":  { "op": "request", "sha": "…", "spa": "…", "tha": "…", "tpa": "…" },
    "frame_len": 60 } }
```

| Klíč | Význam |
|---|---|
| `n` | pořadové číslo v souboru (jen pro čtení člověkem) |
| `step` | logický krok v modelu jednotkového zpoždění (`model.md` kap. 7): přenos po lince = 1 krok, zpracování v uzlu 0 |
| `link`, `from`, `to` | linka a směr (uzel, který vysílá, a uzel, který přijímá) |
| `summary` | lidský popis, nekontroluje se |
| `pdu.eth` | `dst`, `src`, `ethertype` (`"0x0800"`, `"0x0806"`) |
| `pdu.arp` | `op` (`request`/`reply`), `sha`, `spa`, `tha`, `tpa` |
| `pdu.ip` | `src`, `dst`, `ttl`, `protocol` (číslo), `total_length` |
| `pdu.icmp` | `type`, `code`, `id`, `seq`, `data_len` (Echo); u chybových zpráv (Type 3, 11) `orig`: `{ src, dst, protocol }` z přiložené hlavičky původního paketu (`icmp.md` kap. 3.1) |
| `pdu.udp` | `sport`, `dport`, `length` (UDP Length = 8 + data v bajtech) |
| `pdu.data` | `text` (data aplikace jako text), `len` (délka v bajtech UTF-8) |
| `pdu.frame_len` | délka rámce v bajtech bez preambule a FCS, včetně výplně |

**Pravidla porovnání (normativní):**
1. **Pořadí na každé lince a v každém směru musí sedět přesně.** Pro každou dvojici (`link`, `from`)
   se vyberou přenosy z vektoru a z běhu implementace; musí to být stejně dlouhé posloupnosti se
   shodnými PDU ve stejném pořadí. Žádný přenos navíc ani chybějící.
2. **Pořadí mezi různými linkami se kontroluje jen přes `step`**: implementace, která používá model
   jednotkového zpoždění, musí dát stejné `step`. Implementace s jiným časováním (např. různé
   rychlosti linek) kontroluje jen kauzalitu: přenos s menším `step` na téže cestě nesmí přijít později.
   Přenosy se stejným `step` (např. flooding na více portů) nemají definované vzájemné pořadí.
3. **Částečná shoda polí:** kontrolují se jen pole uvedená ve vektoru; pole neuvedená (např. IP
   Identification, kontrolní součty) se nekontrolují. Pokud implementace kontrolní součty počítá,
   musí být platné (přepočet přes hlavičku dává 0, RFC 1071) — to je samostatný test, ne součást vektoru.
4. MAC adresy se porovnávají bez ohledu na velikost písmen, ve tvaru s dvojtečkami.

## 6. `expected.events` — události v uzlech (informativní)

`{ "step": 2, "node": "PC3", "event": "nic_drop", "detail": "…" }`.
Slovník: `nic_drop`, `arp_learn`, `arp_ignore`, `arp_queue`, `mac_learn`, `flood`, `forward`, `filter`,
`repeat` (hub zopakoval rámec), `ip_forward`, `ip_deliver`, `ip_drop`, `udp_send` (aplikace odeslala
datagram, případně přidělení dynamického portu), `udp_deliver` (cílový port → aplikace),
`udp_no_listener` (na cílovém portu nikdo nepřijímá, `udp.md` kap. 4.3); úroveň 3: `arp_fail` (ARP po 3 pokusech
bez odpovědi, fronta zahozena, `arp.md` kap. 6.2), `arp_expire` (vypršel záznam ARP cache). `ip_drop` zahrnuje
i „žádná cesta“ a „TTL vypršelo“ (detail to upřesní). Slouží k vysvětlení a vizualizaci. **Nejsou normativní**
(nemusí být úplné); pokud implementace hlásí události se stejným slovníkem, test je smí porovnat
jako podmnožinu (každá uvedená událost musí nastat ve stejném kroku a uzlu).

## 7. `expected.final_state` a `app_result`

- `final_state` má stejný tvar jako `initial_state`. Kontroluje se **přesná shoda množin** záznamů
  (pořadí nerozhoduje; `age` se nekontroluje). Tabulka, která ve `final_state` chybí, se oproti
  `initial_state` nezměnila (tak je to u `routing_table`).
- Stav se porovnává ve chvíli, kdy simulace nemá žádné čekající události (všechny PDU doručené),
  a dřív, než by vypršel jakýkoli časovač stárnutí.
- `app_result`: výsledek příkazu, např. ping: `sent`, `received`, `replies[]` (`from`, `bytes`, `ttl`).
  Čas odezvy se nekontroluje. Úroveň 3: `errors[]` = dotazy bez odpovědi Echo Reply s důvodem
  `{ "seq", "kind": "no_route" | "arp_failed" | "unreachable" | "ttl_exceeded" | "timeout", "from"?, "code"? }`
  (`icmp.md` kap. 2.1); `received` počítá jen skutečné Echo Reply (Windows ve statistice počítá jinak,
  `cmd.md` kap. 8.4 — to řeší terminál, ne vektor).
- `app_result` pro `tracert`: `reached` (true = odpověděl cíl), `hops[]` = `{ "hop", "from", "replies", "kind": "time_exceeded" | "echo_reply" | "timeout" }`.
- `app_result` pro UDP (úroveň 2): `received[]` = co dostaly aplikace (`node`, `app`, `port`, `from` ve tvaru
  `IP:port`, `text`), v libovolném pořadí, přesná shoda množiny; `not_received[]` = aplikace (`node`, `app`,
  `port`), které nesmí dostat nic (např. jiná aplikace na stejném PC, PC za hubem).

## 8. Konvence ve scénářích a vektorech

- MAC hostitelů `02:00:00:00:00:0N`, MAC rozhraní routeru `02:00:00:00:RR:II` (RR = číslo routeru,
  II = rozhraní od 01: R1 Gi0/0 = `02:00:00:00:01:01`), vše lokálně spravované.
- Porty switche `Fa0/N`, rozhraní routeru `Gi0/N` (od iterace 3; dříve `G0/N`), hostitelů `eth0`, porty hubu `PN`.
- Topologie úrovně 3: `routing.md` kap. 7.
- Nové vektory přidává projektant; každý vektor má v `spec_refs` odkaz na pravidla, která ověřuje.

## 9. Seznam vektorů (iterace 1)

| Soubor | Co ověřuje | Přenosů |
|---|---|---|
| `ping-switch.json` | ARP broadcast/unicast, učení MAC tabulky, flooding vs. forwarding, RFC 826 (PC3 si nic neuloží, PC2 se učí z requestu) | 9 |
| `ping-hub.json` | hub opakuje vše na všechny porty, PC3 zahazuje cizí rámce na L2 | 12 |
| `ping-router.json` | ARP na bránu, TTL − 1 na routeru, přepis MAC, IP beze změny, TTL odpovědi 63, fronta během ARP na routeru | 8 |

Iterace 2 (úroveň 2, UDP, předvyplněné ARP tabulky podle rozhodnutí 14, `"level": 2` v kořeni vektoru):

| Soubor | Co ověřuje | Přenosů |
|---|---|---|
| `udp-switch.json` | prázdná MAC tabulka: unknown unicast flooding prvního rámce, učení ze zdrojové MAC, odpověď už jen na port Alice; PC3 zahodí cizí rámec; demultiplexing podle cílového portu (5000 zprávy vs. 5001 hra); dynamický port 49152; prohozené porty v odpovědi; výplň rámce na 60 B | 5 |
| `udp-hub.json` | hub opakuje oba rámce na všechny ostatní porty, nic se neučí; PC3 zahodí oba | 6 |
| `udp-switch-naucene.json` | naučená MAC tabulka: žádný flooding, jen obnovení záznamů; existující socket klienta (port 49152 znovu); délky v bajtech UTF-8 u textu s diakritikou | 4 |
| `udp-switch-port6000.json` | celý děj scénáře úrovně 2: hub (opakování, Cyril zahazuje), akce `swap` na switch s prázdnou tabulkou (flooding, učení, přeposlání odpovědi), zpráva na port 6000 doručená aplikaci „poznámky“ (demultiplexing na stejném PC), rámec přesně 60 B bez výplně, hostitelé bez brány (rozhodnutí 27) | 13 |

Iterace 3 (úroveň 3 „Směrování“, `"level": 3`, ARP a ICMP se opravdu posílají):

| Soubor | Co ověřuje | Přenosů |
|---|---|---|
| `ping-router.json` | (přegenerováno podle rozhodnutí 39: Alice — R1 — Bob 192.168.2.20 přímými kabely, `Gi0/N`) ARP na bránu, fronta na routeru, přepis MAC, TTL odpovědi 127 | 8 |
| `ping-arp-prvni.json` | topologie úrovně 3 (rozhodnutí 39: Alice a Cyril na SW1, R1 na Fa0/4, Bob na R1 Gi0/1), prázdné ARP cache i MAC tabulka: ARP na bránu, fronta u Alice i na routeru, Cyril si z cizího requestu nic neuloží, router se naučí Alici z requestu; `ping -n 2`: druhý dotaz bez ARP | 19 |
| `ping-bez-brany.json` | Alice bez brány, Bob v jiné síti: žádný přenos, chyba `no_route` | 0 |
| `ping-spatna-brana.json` | brána 192.168.1.254 neexistuje: 3 ARP requesty po 1 s (flooding na Fa0/3, Fa0/4), router neodpoví (není jeho IP), `arp_failed` od vlastní IP; router si Alici neuloží | 9 |
| `tracert-alice-bob.json` | `tracert -d` přes jeden router (rozhodnutí 44): TTL 1 → Time Exceeded od 192.168.1.1 (adresa odchozího rozhraní), TTL 2 → sonda s TTL 1 doručená Bobovi, Echo Reply TTL 127; `skip`, dokud jádro neumí tracert | 30 |
| `tracert-dva-routery.json` | (pozdější rozšíření, `skip`) `tracert -d` přes R1, R2 se statickou i výchozí cestou, server 192.168.3.10 | 36 |

## 10. Doplňky úrovně 4 (iterace 4, TCP, DNS, HTTP)

Zpětně kompatibilní, jen nové nepovinné klíče. Generátor `tools/vectors/gen5.py`
(`python3 tools/vectors/gen5.py tests/vectors`), topologie `routing.md` kap. 9.

- **Kořen:** `seed` (číslo, výchozí 1) — seed scénáře; určuje ISN (`tcp.md` kap. 4).
- **Uzel:** `dns_servers` (pole IP, = konfigurace „DNS Servers“); `dns_zone`
  `{ "zone", "records": [{ "name", "type": "A", "ttl", "data" }] }` (autoritativní zóna serveru);
  `apps[].proto` smí být `"tcp"` (`port` číslo = naslouchá, `null` = klient).
- **`initial_state` / `final_state`:** `tcp_connections` `{ "local": "IP:port", "remote": "IP:port", "state" }`
  (stavy podle RFC 9293: `LISTEN`, `ESTABLISHED`, `TIME-WAIT`…; naslouchající socket má `remote`
  `0.0.0.0:0`); `dns_cache` `{ "name", "type", "data", "ttl" }` (ttl = původní hodnota, nekontroluje se odpočet).
- **Akce:** `dns_resolve` `{ "name", "type": "A" }` (resolver OS: dotaz na první DNS server uzlu);
  `http_get` `{ "dst", "host", "path", "port", "client": "curl" }` (TCP spojení, GET, příjem podle
  Content-Length, zavření klientem; IP je už známá, překlad jména ukazuje `dns_resolve`);
  `link_loss` `{ "link", "from", "count", "match": { "proto": "tcp", "payload": true } }` (`node: null`)
  — prvních `count` rámců, které uzel `from` pošle po lince `link` a odpovídají `match`, se na lince
  ztratí (`payload: true` = TCP segment s daty).
- **Přenos:** `lost: true` = rámec byl na lince vyslán, ale druhý konec ho nepřijal (dál se nešíří).
- **`pdu.tcp`:** `sport`, `dport`, `seq`, `ack`, `rel_seq`, `rel_ack`, `flags` (řetězec v pořadí
  Wiresharku, `tcp.md` kap. 10), `hdr_len` (B), `window`, `payload_len`, `options` (`[{ "kind": 2, "name": "MSS", "value": 1460 }]`, jen SYN).
- **`pdu.dns`:** `id`, `flags` (hex řetězec), `qr`, `opcode`, `aa`, `tc`, `rd`, `ra`, `rcode`,
  `qdcount`, `ancount`, `nscount`, `arcount`, `question` `{ name, type, class }`, `answers[]`
  `{ name, type, class, ttl, rdlength, data }`.
- **`pdu.http`:** požadavek `{ "kind": "request", "method", "target", "version", "host" }`, odpověď
  `{ "kind": "response", "version", "status", "reason", "content_length" }`; celý text zprávy je v `pdu.data`.
- **`app_result`:** `dns_resolve`: `name`, `server`, `authoritative`, `rcode`, `answers[]`;
  `http_get`: `status`, `reason`, `content_length`, `body_len`, `local`, `remote`, `retransmissions`.
- **Události:** `tcp_state`, `tcp_retransmit`, `link_loss`, `http_request`, `http_response`, `dns_answer`.
- **Čas:** 1 s = 1000 kroků (stejně jako opakování ARP v `ping-spatna-brana`); RTO 1 s → retransmise
  o 1000 kroků po původním odeslání.

| Soubor | Co ověřuje | Přenosů |
|---|---|---|
| `dns-dotaz.json` | resolver: UDP 49152 → 53 přes router, dotaz A (31 B, flags 0x0100), autoritativní odpověď (47 B, 0x8500, komprese 0xC00C, TTL 3600), TTL IP 128/127 a 64/63, záznam v DNS cache; `skip` | 8 |
| `tcp-handshake-http.json` | SYN (MSS 1460) / SYN, ACK / ACK, absolutní i relativní seq a ack z ISN (seed 1), GET 76 B s PSH, ACK serveru, 200 OK 249 B, ACK, ukončení FIN, ACK / ACK / FIN, ACK / ACK; Alice v TIME-WAIT, server zpět jen LISTEN; fronta rozhraní (dva segmenty po sobě); `skip` | 44 |
| `tcp-ztrata-retransmise.json` | totéž, ale GET se ztratí na L4 (R1 → SW2, `lost`); server nic nepotvrdí; Alice po RTO 1 s pošle stejný segment (stejné seq); zbytek o 1000 kroků později; `retransmissions: 1`; `skip` | 47 |
