# Obecný model simulace

Stav: návrh, iterace 1. Autor: projektant. Platí pro jádro simulace (bez DOM) a pro testovací vektory.

Tento dokument popisuje, z čeho se simulovaná síť skládá a jak se v ní pohybují data. Detaily
jednotlivých protokolů jsou v samostatných souborech (`ethernet.md`, `arp.md`, `ipv4.md`, `icmp.md`).

## 1. Vrstvové modely a terminologie

Simulátor používá terminologii z Michalových prezentací (viz `CLAUDE.md`).

| ISO/OSI | Číslo | TCP/IP | PDU (jak se říká) | Adresace | Kdo se stará |
|---|---|---|---|---|---|
| Aplikační | L7 | Aplikační | data | (jméno, URL) | aplikace |
| Prezentační | L6 | Aplikační | data | | aplikace |
| Relační | L5 | Aplikační | data | | aplikace |
| Transportní | L4 | Transportní | segment (TCP), datagram (UDP) | port | operační systém |
| Síťová | L3 | Síťová | paket (IP datagram) | IP adresa | operační systém |
| Linková | L2 | Vrstva síťového rozhraní | rámec | MAC adresa | síťová karta (hardware a firmware); hlavičku sestaví ovladač v OS |
| Fyzická | L1 | Vrstva síťového rozhraní | bity | | síťová karta (hardware a firmware) |

Poznámky k přesnosti (nic, co by se student musel odnaučit, jen zpřesnění):

- **„Paket“ a „IP datagram“** jsou na L3 synonyma. RFC 791 používá „datagram“, v praxi i v CCNA
  se říká „paket“. Slovo „datagram“ samotné je dvojznačné (také UDP datagram na L4), proto
  v simulátoru na L3 primárně „paket“, v rentgenu podtitul „IP datagram“.
- **Kdo sestavuje ethernetovou hlavičku:** v reálném PC ji sestaví ovladač síťové karty v OS,
  karta (firmware/hardware) přidá preambuli a FCS, odvysílá bity a u příchozích rámců
  filtruje podle cílové MAC. Simulátor u L1 i L2 píše „síťová karta (hardware a firmware)“
  (rozhodnuti.md bod 18; prezentace říká „firmware síťového rozhraní“). Je to
  zjednodušení, které platí v tom podstatném: o rámce se aplikace ani IP vrstva nestarají.
- **ARP** stojí mezi L2 a L3 (ptá se na MAC podle IP). Implementuje ho operační systém (ARP
  cache je v jádře OS, `arp -a`), nikoli firmware karty. Rámec s ARP nenese IP paket:
  EtherType 0x0806, ne 0x0800. V rentgenu se ARP zobrazuje jako obsah rámce, ne jako paket.
- **ICMP** je součástí síťové vrstvy (RFC 792), ale jeho zpráva je přenášena uvnitř IP paketu
  (Protocol = 1). V rentgenu tedy: rámec → IP paket → ICMP zpráva.

## 2. Uzly

Každý uzel má jednoznačné `id` (např. `PC1`, `SW1`, `R1`) a seznam rozhraní.

| Typ | Nejvyšší zpracovávaná vrstva | Má MAC | Má IP | Tabulky |
|---|---|---|---|---|
| `pc` | L7 | ano (každé rozhraní) | ano | ARP cache, směrovací tabulka |
| `server` | L7 | ano | ano | ARP cache, směrovací tabulka |
| `hub` | L1 | ne | ne | žádné |
| `switch` | L2 | (viz pozn.) | ne | MAC tabulka |
| `router` | L3 (pro sebe L7: ping, později CLI služby) | ano (každé rozhraní) | ano (každé rozhraní) | ARP cache, směrovací tabulka |

- **PC a server** se na vrstvách L1–L4 chovají stejně. Liší se rolí (server poslouchá na
  portech, má typicky pevnou IP) a výchozím profilem OS (viz `ipv4.md`, výchozí TTL).
  Hostitel **nepřeposílá** pakety, které nejsou pro něj (IP forwarding vypnutý; hostitel podle RFC 1122 není gateway).
- **Switch** v simulaci nemá MAC ani IP adresu. Reálný spravovaný switch má MAC na každém portu
  a IP na rozhraní pro správu (VLAN 1), ale pro přepínání rámců to nehraje roli.
  Simulátor zjednodušuje: switch je čistě L2 zařízení bez správy (management IP možná v úrovni 5).
- **Router** má na každém rozhraní vlastní MAC a vlastní IP adresu s maskou. Každé rozhraní
  routeru je v jiné síti (jiné broadcastové doméně).

## 3. Rozhraní

Rozhraní (`interface`) má:

| Atribut | Význam | Příklad |
|---|---|---|
| `name` | název podle zvyklosti zařízení | PC: `eth0`; switch: `Fa0/1`; router: `G0/0` |
| `mac` | 48bitová MAC (jen L2/L3 uzly mimo switch a hub) | `02:00:00:00:00:01` |
| `ip`, `prefix` | IPv4 adresa a délka masky (jen L3 uzly) | `192.168.1.10`, `24` (= 255.255.255.0) |
| `up` | stav rozhraní | `true` |

- MAC adresy ve scénářích jsou **lokálně spravované** (druhý nejnižší bit prvního bajtu = 1,
  tj. `02:...`), aby nepředstíraly skutečného výrobce. V UI se mohou zobrazovat ve formátu
  Windows (`02-00-00-00-00-01`) nebo Cisco (`0200.0000.0001`) podle kontextu; v datech je vždy
  tvar s dvojtečkami, malá písmena.
- Hub a switch mají jen porty (rozhraní bez adres).

## 4. Linky

- Linka spojuje **právě dvě** rozhraní (bod–bod kabel). Sdílené médium (koaxiál) se
  nemodeluje; sdílenou doménu kolizí tvoří hub.
- Linka je **full-duplex**: oba konce mohou vysílat současně. Výjimka: linka k hubu je
  ve skutečnosti half-duplex. Simulátor zjednodušuje: kolize ani CSMA/CD nemodeluje (viz kap. 8).
- Simulátor zjednodušuje: na typu kabelu (přímý/křížený) nezáleží, jako u současných zařízení
  s auto-MDIX. (Packet Tracer typ kabelu vyžaduje; na CCNA se to probírá jako historie.)
- Linka nemá chybovost ani ztrátovost, pokud ji scénář výslovně nenastaví (pozdější úrovně).

## 5. PDU a zapouzdření

PDU se v jádře reprezentuje jako vnořená struktura, každá vrstva má hlavičku a obsah (payload):

```
rámec (L2, Ethernet II)
  hlavička: cílová MAC, zdrojová MAC, EtherType
  obsah: ARP zpráva            (EtherType 0x0806)
     nebo IP paket (L3)        (EtherType 0x0800)
            hlavička: ... TTL, Protocol, zdrojová IP, cílová IP
            obsah: ICMP zpráva (Protocol 1)
               nebo TCP segment (6) / UDP datagram (17)   [další iterace]
                      obsah: data (L7: DNS, HTTP …)       [další iterace]
```

Zapouzdření při odesílání jde shora dolů (každá vrstva přidá svou hlavičku), rozbalení při
příjmu zdola nahoru (každá vrstva přečte a odstraní svou hlavičku a podle pole „typ obsahu“
předá obsah výš: EtherType → Protocol → port).

**L1 (bity):** simulátor přenáší po lince celý rámec jako jeden celek. Animace na lince
představuje „bity na médiu“; jednotlivé bity, kódování signálu ani rychlost linky se nemodelují.

**Délky:** jádro počítá délky v bajtech přesně podle hlaviček (pro rentgen a pro kontrolu
ve vektorech). Délka rámce se uvádí **bez preambule a bez FCS** (tak jako ve Wiresharku),
ale **včetně výplně** na minimálních 60 bajtů (viz `ethernet.md`).

## 6. Kdo zpracovává kterou vrstvu (chování uzlů)

### 6.1 Hostitel (PC, server)

Příjem rámce:
1. L2: je cílová MAC moje, nebo broadcast `ff:ff:ff:ff:ff:ff`? Pokud ne, karta rámec **tiše zahodí**
   (událost `nic_drop`). Student to vidí u hubu: rámec dojde, ale PC ho nezpracuje.
2. Podle EtherType: 0x0806 → ARP (`arp.md`), 0x0800 → IP (`ipv4.md`).
3. IP: je cílová IP moje (nebo broadcast)? Pokud ne, zahodit (hostitel nepřeposílá).
4. Podle Protocol: 1 → ICMP (`icmp.md`); 17 → UDP (`udp.md`, podle cílového portu aplikaci); 6 → TCP (další iterace).

Odeslání IP paketu: rozhodnutí podle směrovací tabulky (přímé doručení v téže síti, jinak
přes výchozí bránu), získání MAC dalšího skoku přes ARP, sestavení rámce. Podrobně `ipv4.md` kap. 4.

### 6.2 Hub (L1)

- Co přijde na jeden port, odešle **na všechny ostatní porty** beze změny. Nečte adresy, nic
  se neučí, nemá tabulku.
- Všechny porty hubu tvoří jednu doménu kolizí i jednu broadcastovou doménu.
- Důsledek, který má student vidět: unicastový rámec pro PC2 dorazí i na PC3; PC3 ho zahodí
  na L2 (cizí cílová MAC). Zároveň je vidět, proč je hub bezpečnostní i výkonnostní problém.

### 6.3 Switch (L2)

Pro každý přijatý rámec na portu P (IEEE 802.1D, transparentní bridge; podrobně `ethernet.md` kap. 4):
1. **Učení:** zdrojovou MAC zapíše do MAC tabulky s portem P (nebo aktualizuje port a stáří).
2. **Rozhodnutí podle cílové MAC:**
   - broadcast (nebo multicast) → **flooding**: odešle na všechny porty kromě P;
   - unicast, MAC v tabulce není (unknown unicast) → **flooding**;
   - unicast, MAC v tabulce na portu Q ≠ P → **přepošle** jen na Q (forwarding);
   - unicast, MAC v tabulce na portu P → **zahodí** (filtrování; cíl je na stejném segmentu).
3. Rámec nemění (MAC adresy, obsah zůstávají).

Switch odděluje domény kolizí (každý port vlastní), ale broadcastovou doménu nechává jednu.

### 6.4 Router (L3)

Pro přijatý rámec na rozhraní I (RFC 1812):
1. L2: přijme jen rámec s cílovou MAC rozhraní I nebo broadcast (ARP request).
2. ARP: odpovídá na dotazy na IP adresu rozhraní I (`arp.md`). **Broadcasty nepřeposílá** — ARP
   zůstává v jedné síti. Router tedy ohraničuje broadcastovou doménu.
3. IP: je cílová IP některá z adres routeru? → doručit lokálně (např. odpovědět na ping), TTL se
   nesnižuje (RFC 1812 5.2.3).
4. Jinak přeposílání (forwarding):
   - TTL − 1; pokud by výsledek byl 0, paket zahodí a pošle zdroji ICMP Time Exceeded
     (RFC 1812 5.3.1);
   - vyhledá cestu ve směrovací tabulce (**longest prefix match**, RFC 1812 5.2.4.3); bez cesty
     zahodí a pošle ICMP Destination Unreachable, kód 0 (RFC 1812 5.2.7.1);
   - zjistí MAC dalšího skoku (ARP) a **vytvoří nový rámec**: zdrojová MAC = MAC výstupního
     rozhraní, cílová MAC = MAC dalšího skoku;
   - **zdrojová a cílová IP zůstávají** (bez NAT); přepočítá se kontrolní součet IP hlavičky.

Klíčová myšlenka pro studenta: **MAC adresy se mění na každém skoku (každé lince mezi L3 uzly),
IP adresy zůstávají od zdroje do cíle.** (NAT, který IP mění, přijde v pozdější úrovni.)

## 7. Čas a determinismus

- Jádro je simulátor diskrétních událostí. Ve vektorech se používá **logický krok**: přenos
  PDU po jedné lince trvá 1 krok, zpracování v uzlu 0 kroků (model jednotkového zpoždění).
- Stejný scénář dává vždy stejný průběh: žádné náhodné hodnoty (Identification v IP, ICMP
  identifikátor, čísla portů…) bez určeného seedu nebo počáteční hodnoty.
- Časovače (stárnutí ARP cache a MAC tabulky, opakování ARP dotazu) běží v simulovaném čase
  v sekundách; výchozí hodnoty jsou v příslušných specifikacích.

## 8. Co simulátor záměrně zjednodušuje a proč to nevadí

| Zjednodušení | Realita | Proč to studentovi nevadí |
|---|---|---|
| Bez preambule a SFD | 7 + 1 bajt před každým rámcem, synchronizace hodin | Je to L1 záležitost karty; Wireshark ji také neukazuje. V rentgenu může být šedě s poznámkou. |
| FCS se nepočítá | CRC-32 na konci rámce, chybné rámce karta zahodí | Linky v simulaci nedělají chyby. Pole se v rentgenu ukáže jako „FCS (nepočítá se)“. Princip (detekce chyb) zůstává pravdivý. |
| Bez kolizí a CSMA/CD | hub = half-duplex, kolize, backoff | Kolize jsou dnes historie (full-duplex switche). Na CCNA se CSMA/CD probírá teoreticky; doplnitelné v úrovni 5. |
| MTU 1500, bez fragmentace | velké pakety se fragmentují nebo zahazují (DF) | Ping a malé zprávy se do MTU vejdou. Pole fragmentace v rentgenu jsou vidět s hodnotou 0. |
| Linka = 1 logický krok | rychlost a délka linky, zpoždění, fronty | Pořadí událostí je správné; časové údaje (ping „čas=…“) jsou orientační. |
| Žádný provoz na pozadí | reálná LAN je plná ARP, IPv6 ND, mDNS, SSDP, NetBIOS… | Student vidí jen to, co způsobil. Úroveň 5 může přidat „realistický šum“. |
| Bez IPv6, VLAN, STP | všude jinde přítomné | Samostatná témata pro pozdější úrovně. Topologie bez smyček (smyčka by bez STP zahltila síť, viz otevřené otázky). |
| Bez gratuitous ARP při zapnutí rozhraní | OS při připojení posílá ARP announcement/probe (RFC 5227) | Nemění logiku ARP; jen by zahlcovalo začátek scénáře. |
| Typ kabelu nerozhoduje | dříve křížený vs. přímý kabel | Současná zařízení mají auto-MDIX. |
| Hostitel má jen 2 typy cest (síť rozhraní + výchozí brána) | Windows `route print` ukazuje i loopback, multicast, broadcast cesty | Rozhodovací logika je stejná; zbytek je šum. |

Pravidlo: každé zjednodušení je v UI i ve specifikaci označeno „Simulátor zjednodušuje: …“.

## 9. Vyšší vrstvy (další iterace)

V této iteraci se nespecifikují, model s nimi ale počítá:
- **UDP** (RFC 768): datagram, porty, bez spojení. Protocol = 17. Specifikováno v `udp.md` (úroveň 2).
- **TCP** (RFC 9293): segmenty, three-way handshake, sekvenční čísla, ACK, retransmise, ukončení.
  Protocol = 6.
- **DNS** (RFC 1034/1035): typicky nad UDP port 53; překlad jména `www.seznam.cz` → `77.75.75.172`.
- **HTTP** (RFC 9110/9112): nad TCP port 80; navazuje na Michalovu ukázku webserveru v Pythonu.
- Socket = IP adresa + port (+ protokol); spojení TCP určuje dvojice socketů.

## Zdroje

- RFC 791 (IPv4), RFC 792 (ICMP), RFC 826 (ARP), RFC 1122 (požadavky na hostitele),
  RFC 1812 (požadavky na routery), IEEE 802.3 (Ethernet), IEEE 802.1D (bridge / switch).
- Ověřeno na rfc-editor.org (2026-11-24): RFC 1812 5.2.3, 5.2.4.3, 5.2.7.1, 5.3.1; RFC 1122 2.3.2.2,
  3.2.2.6, 3.3.1.1; RFC 826 algoritmus příjmu.
