# Formát testovacích vektorů

Stav: návrh, iterace 1, doplněno v iteraci 2 (UDP, úroveň 2). Verze formátu: `tcpipsim-vector/1`
(doplňky iterace 2 jsou zpětně kompatibilní: jen nové nepovinné klíče). Soubory: `tests/vectors/*.json`.

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
Další příkazy (`arp -d`, `tracert`, CLI routeru) přibudou
s dalšími iteracemi; seznam povolených příkazů bude ve specifikaci příslušného protokolu.

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
| `pdu.icmp` | `type`, `code`, `id`, `seq`, `data_len` |
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
`udp_no_listener` (na cílovém portu nikdo nepřijímá, `udp.md` kap. 4.3). Slouží k vysvětlení a vizualizaci. **Nejsou normativní**
(nemusí být úplné); pokud implementace hlásí události se stejným slovníkem, test je smí porovnat
jako podmnožinu (každá uvedená událost musí nastat ve stejném kroku a uzlu).

## 7. `expected.final_state` a `app_result`

- `final_state` má stejný tvar jako `initial_state`. Kontroluje se **přesná shoda množin** záznamů
  (pořadí nerozhoduje; `age` se nekontroluje). Tabulka, která ve `final_state` chybí, se oproti
  `initial_state` nezměnila (tak je to u `routing_table`).
- Stav se porovnává ve chvíli, kdy simulace nemá žádné čekající události (všechny PDU doručené),
  a dřív, než by vypršel jakýkoli časovač stárnutí.
- `app_result`: výsledek příkazu, např. ping: `sent`, `received`, `replies[]` (`from`, `bytes`, `ttl`).
  Čas odezvy se nekontroluje.
- `app_result` pro UDP (úroveň 2): `received[]` = co dostaly aplikace (`node`, `app`, `port`, `from` ve tvaru
  `IP:port`, `text`), v libovolném pořadí, přesná shoda množiny; `not_received[]` = aplikace (`node`, `app`,
  `port`), které nesmí dostat nic (např. jiná aplikace na stejném PC, PC za hubem).

## 8. Konvence ve scénářích a vektorech

- MAC hostitelů `02:00:00:00:00:0N`, MAC rozhraní routeru `02:00:00:00:RR:II` (lokálně spravované).
- Porty switche `Fa0/N`, rozhraní routeru `G0/N`, hostitelů `eth0`, porty hubu `PN`.
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