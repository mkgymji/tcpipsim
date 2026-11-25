# Směrování (routing): směrovací tabulka, longest prefix match, statické cesty

Stav: návrh, iterace 3 (úroveň 3 „Směrování“). Autor: projektant. Zdroje: RFC 1812 (požadavky na
routery: 5.2.4.3 výběr cesty, 5.2.3 lokální doručení, 5.3.1 TTL, 4.3.2.4 zdroj ICMP), RFC 1122 3.3.1
(hostitel: přímé a nepřímé doručení), RFC 4632 (CIDR, zápis prefixem). Cisco IOS 15: kódy a formát
`show ip route` podle dokumentace Cisco a výstupů IOS 15.x (místa „ověřit“ v `cmd.md` kap. 9).
Ověřeno na rfc-editor.org 2026-11-25 (RFC 1812, 1122, 792).

Navazuje na `ipv4.md` kap. 4–6 (rozhodování hostitele, zpracování na routeru, LPM). Tento soubor
je pro implementaci úrovně 3 závazný; při rozporu s `ipv4.md` platí tento (a `ipv4.md` se opraví).

## 1. Pojmy

| Pojem | Význam v simulaci |
|---|---|
| směrovací tabulka (routing table) | seznam cest; každý L3 uzel (PC, server, router) má vlastní |
| cesta (route) | `prefix` (síť/délka) → `next_hop` (IP nebo nic) + výstupní rozhraní `if` + `type` |
| next hop (další skok) | IP adresa souseda **ve stejné síti**, kterému se paket předá; u `connected` cesty žádný (doručí se přímo cíli) |
| výchozí cesta (default route) | `0.0.0.0/0`, odpovídá každé adrese; u hostitele = výchozí brána |
| longest prefix match | z cest, které cíli odpovídají, vyhraje ta s nejdelším prefixem |

Router je L3 zařízení: přeposílá podle **cílové IP**, ne podle MAC. Směrovací tabulka říká jen
**kam paket poslat dál** (další skok), nikdy celou cestu k cíli.

## 2. Jak cesty vznikají

### 2.1 Router (Cisco IOS)

| Typ (`type`) | Kód IOS | Vznikne | Zanikne |
|---|---|---|---|
| `connected` | `C` | rozhraní má `ip address A M` **a** je ve stavu up/up (`no shutdown` + kabel zapojený, druhá strana zapnutá) | `shutdown`, odpojený kabel, `no ip address` |
| `local` | `L` | totéž; cesta `A/32` k adrese rozhraní samotného (IOS 15 a novější) | jako `connected` |
| `static` | `S` | `ip route S M NH` v režimu `(config)#`, kde S/M ≠ 0.0.0.0/0 | `no ip route …`; v tabulce je jen, pokud je NH dosažitelný (viz níže) |
| `default` | `S*` | `ip route 0.0.0.0 0.0.0.0 NH` | jako `static` |

Pravidla:
1. Rozhraní routeru Cisco je po zapnutí **administrativně vypnuté** (`administratively down`);
   bez `no shutdown` cesta `C` nevznikne. Student to uvidí v `show ip interface brief` (cmd.md kap. 10).
2. Cesta `C` se počítá z adresy rozhraní AND maska: `ip address 192.168.1.1 255.255.255.0` dá
   `C 192.168.1.0/24` a `L 192.168.1.1/32`.
3. Statická cesta se do tabulky dostane, jen když je next hop dosažitelný přes existující
   (`connected`) cestu. IOS při rekurzivním vyhledání next hopu použije opět longest match.
   Simulátor zjednodušuje: next hop musí ležet v síti některého `connected` rozhraní (rekurze přes
   jinou statickou cestu se nedělá); jinak cesta „čeká“ a v `show ip route` není. Tak se chová IOS
   pro typické zadání CCNA (next hop na sousední síti) — zjednodušení se nemusí odnaučit.
4. Výstupní rozhraní statické cesty `if` = rozhraní `connected` cesty, ve které leží next hop
   (ve vektorech uvedeno, v IOS výstupu se u `via` neukazuje).
5. Statická cesta s výstupním rozhraním místo next hopu (`ip route S M Gi0/1`) se v úrovni 3
   **nepodporuje** (na Ethernetu závisí na proxy ARP — CCNA ji pro Ethernet nedoporučuje).
   Hláška: „Simulátor zatím podporuje jen ip route síť maska next-hop.“
6. Kontroly při zadání (chování IOS, **ověřit** přesné znění, `cmd.md` kap. 10):
   - `ip route` se sítí, která má jedničky mimo masku (`ip route 192.168.3.1 255.255.255.0 …`) →
     `%Inconsistent address and mask`;
   - `ip address` v síti, která už je na jiném rozhraní → `% 192.168.1.0 overlaps with GigabitEthernet0/0`;
   - nesouvislá maska (`255.0.255.0`) → `Bad mask 0xFF00FF00 for address …`.

### 2.2 Hostitel (PC, server)

Z konfigurace rozhraní (IP, maska) a výchozí brány vzniknou dvě cesty (`ipv4.md` kap. 4.1):
`connected` (síť rozhraní, bez next hopu) a `default` (`0.0.0.0/0` → brána). Bez brány jen
`connected` (rozhodnutí 27). Windows bránu mimo vlastní síť **odmítne** uložit (Microsoft:
„Unable to add a default gateway … not on the same IP network ID“); simulátor ji v editoru také
odmítne s vysvětlením.

## 3. Výběr cesty (longest prefix match)

RFC 1812 5.2.4.3 („Basic Match“ + „Longest Match“):

```
vstup: cílová IP D
kandidáti := { r v tabulce : D AND maska(r) == síť(r) }
pokud kandidáti prázdní: žádná cesta
jinak vyber r s největší délkou prefixu
      při shodě délky: nižší AD, pak nižší metrika (kap. 4)
```

Příklady (R1 z vektoru `tracert-dva-routery`):

| Cíl D | Odpovídající cesty | Vítěz | Proč |
|---|---|---|---|
| 192.168.3.10 | 192.168.3.0/24 S | 192.168.3.0/24 via 192.168.2.2 | jediná |
| 192.168.1.10 | 192.168.1.0/24 C | connected Gi0/0 | přímé doručení |
| 192.168.1.1 | 192.168.1.0/24 C, 192.168.1.1/32 L | /32 L | delší prefix → lokální doručení |
| 8.8.8.8 | (R1 nemá default) | žádná | ICMP 3/0 zdroji |
| 8.8.8.8 na R2 | 0.0.0.0/0 S* | default via 192.168.2.1 | /0 odpovídá všemu, vyhrává jen bez jiné shody |

**Pořadí záznamů v tabulce o výsledku nerozhoduje** (typická miskoncepce „bere se první řádek
shora“ — vyvrací ji to, že `show ip route` řadí podle sítě, ne podle priority).

## 4. Administrativní vzdálenost (AD) a metrika — jen zobrazit

V `show ip route` je u statické cesty `[1/0]` = `[AD/metrika]`. Cesty C a L AD ani metriku
nezobrazují (AD connected = 0).

| Zdroj cesty | AD (Cisco výchozí) |
|---|---|
| connected | 0 |
| static (i default) | 1 |
| (pro úroveň 5) OSPF 110, RIP 120, EIGRP 90 | |

Simulátor zjednodušuje: AD a metrika se v úrovni 3 jen **ukazují**; dvě cesty na stejný prefix
(např. statická i connected na tutéž síť) simulátor odmítne vložit s hláškou „Na tuto síť už cesta
existuje“. Skutečný IOS by druhou cestu přijal a do tabulky dal tu s nižší AD (druhá čeká jako
záloha, tzv. floating static). Didaktický dopad: nic se neodnaučuje, jen chybí rozšíření (úroveň 5).
Výpis `[1/0]` je pravdivý a v detailu má jednu větu: „1 = administrativní vzdálenost (jak moc
router zdroji cesty věří), 0 = metrika.“

## 5. Co router s paketem udělá (souhrn pro úroveň 3)

Platí `ipv4.md` kap. 5 s upřesněním pořadí (RFC 1812 5.2.3, 5.3.1, 5.2.7.1):

1. Rámec prošel L2 filtrem rozhraní (cílová MAC = moje nebo broadcast).
2. Cíl = moje adresa (kterékoli rozhraní) → lokální doručení, TTL se nekontroluje ani nesnižuje.
3. TTL ≤ 1 → zahodit, ICMP Time Exceeded 11/0 zdroji (icmp.md kap. 3.2).
4. TTL := TTL − 1, přepočet kontrolního součtu.
5. LPM; žádná cesta → zahodit, ICMP 3/0 (network unreachable).
6. next hop := (connected ? D : next_hop cesty); ARP na výstupním rozhraní; čeká-li, fronta
   (arp.md kap. 6); ARP selže → ICMP 3/1 (host unreachable) pro **jeden** z paketů ve frontě
   (RFC 1812 3.3.2: „reply that the destination is unreachable to one of the queued datagrams“).
7. Nový rámec: zdrojová MAC = MAC výstupního rozhraní, cílová MAC = MAC next hopu;
   **IP adresy beze změny**.

Pořadí 3 vs. 5 (TTL před vyhledáním cesty): RFC 1812 ho nepředepisuje; simulátor kontroluje TTL
dřív. Pozorovatelné je jen u paketu, který má TTL 1 a zároveň nemá cestu (dostane Time Exceeded
místo Unreachable). **Ověřit** na Cisco IOS (otevřená otázka 9 v `README.md`), pro výuku nepodstatné.

## 6. Hostitel: přímé a nepřímé doručení

Viz `ipv4.md` kap. 4.2. Shrnutí chyb, které úroveň 3 ukazuje (vektory):

| Konfigurace | Co se stane na síti | Co uvidí student | Vektor |
|---|---|---|---|
| správná (brána 192.168.1.1) | ARP na bránu, Echo přes router | `Reply from 192.168.2.20: bytes=32 time<1ms TTL=127` | `ping-router`, `ping-arp-prvni` |
| bez brány, cíl v jiné síti | **nic**, paket neopustí PC | `PING: transmit failed. General failure.` (ověřit) | `ping-bez-brany` |
| brána na neexistující adrese (.254) | 3× ARP request „kdo má 192.168.1.254?“, bez odpovědi | `Reply from 192.168.1.10: Destination host unreachable.` | `ping-spatna-brana` |
| router nemá cestu zpět / dál | Echo Request dojde k routeru, ten pošle ICMP 3/0 | `Reply from 192.168.1.1: Destination net unreachable.` | (další vektor, viz kap. 8) |

## 7. Topologie úrovně 3 (rozhodnutí 39)

Alice a Cyril zůstávají na SW1 se stejnými adresami a porty jako v úrovni 2. **Bob se přestěhuje**
do druhé sítě: nová IP 192.168.2.20, ale **stejná MAC** (karta se nemění) — pointa „IP adresa patří
k síti, MAC ke kartě“. Router R1 je na volném portu Fa0/4; Fa0/2 zůstane volný (kabel od Boba vede
teď k routeru). Server se v úrovni 3 nepoužívá (úroveň 4).

```
                192.168.1.0/24                          192.168.2.0/24
 Alice  .10 ─ Fa0/1 ┐
        (volný) Fa0/2 ├ SW1 ─ Fa0/4 ── Gi0/0 [R1] Gi0/1 ──── eth0  Bob .20
 Cyril  .30 ─ Fa0/3 ┘                .1        .1
```

| Uzel | Typ | Rozhraní | MAC | IP / prefix | Brána | TTL |
|---|---|---|---|---|---|---|
| PC1 Alice | pc | eth0 → SW1 Fa0/1 | 02:00:00:00:00:01 | 192.168.1.10/24 | 192.168.1.1 | 128 |
| PC3 Cyril | pc | eth0 → SW1 Fa0/3 | 02:00:00:00:00:03 | 192.168.1.30/24 | 192.168.1.1 | 128 |
| SW1 | switch | Fa0/1–Fa0/4 (Fa0/2 volný) | (bez vlastní MAC v simulaci) | — | — | — |
| R1 | router | Gi0/0 → SW1 Fa0/4 | 02:00:00:00:01:01 | 192.168.1.1/24 | — | 255 |
| | | Gi0/1 → Bob | 02:00:00:00:01:02 | 192.168.2.1/24 | | |
| PC2 Bob | pc | eth0 → R1 Gi0/1 | 02:00:00:00:00:02 | 192.168.2.20/24 | 192.168.2.1 | 128 |

Poznámky:
- Ping Alice → Cyril: stejná síť, bez routeru, `TTL=128`. Ping Alice → Bob: přes router, `TTL=127`
  (Bob je Windows, 128 − 1). Kontrast „stejná síť / jiná síť“ na jednom příkazu.
- V síti 2 je jediné zařízení, proto přímý kabel router–Bob (auto-MDIX, `model.md` kap. 8).
- MAC routeru má jinou řadu (`02:00:00:00:RR:II`, RR = číslo routeru, II = rozhraní od 01), takže
  v rentgenu je hned vidět, že rámec odeslal router. Všechny adresy jsou lokálně spravované.
- Názvy rozhraní routeru `Gi0/0`, `Gi0/1` (rozhodnutí 40; `show ip interface brief` vypisuje plný
  název `GigabitEthernet0/0`).
- Alice nejdřív **bránu nemá** (převzatá konfigurace z úrovně 2, rozhodnutí 27) → `ping-bez-brany`;
  druhá chyba je brána .254 → `ping-spatna-brana` (rozhodnutí 41). Maska jako chyba ne (kap. 8).
- `tracert` v úrovni 3 přes jeden router (rozhodnutí 44, vektor `tracert-alice-bob`): řádky
  192.168.1.1 a 192.168.2.20.

Pozdější rozšíření se dvěma routery (vektor `tracert-dva-routery`, zatím `skip`): Alice — R1 — R2 — Server, síť
192.168.2.0/24 je tranzitní (R1 Gi0/1 .1, R2 Gi0/0 .2), server je v 192.168.3.0/24 (.10, brána
192.168.3.1 = R2 Gi0/1). R1: `ip route 192.168.3.0 255.255.255.0 192.168.2.2`;
R2: `ip route 0.0.0.0 0.0.0.0 192.168.2.1`. Jedna síť se tak ukáže statickou cestou a druhá
výchozí — obě formy z CCNA. Adresy R1 zůstávají stejné jako v základní topologii.

## 8. Mimo rozsah úrovně 3 a další vektory

- Dynamické směrování (RIP, OSPF), floating static, ECMP: úroveň 5.
- ICMP Redirect: router neposílá (simulátor zjednodušuje, `ipv4.md` kap. 5).
- Proxy ARP (Cisco výchozí zapnuto): simulátor nemá. Dopad: scénář se **špatnou maskou** hostitele
  (např. Alice /16) by se v simulátoru choval jinak než na Cisco (tam ping díky proxy ARP projde).
  Proto úroveň 3 jako chybu konfigurace používá **špatnou bránu**, ne masku (viz otevřená otázka
  v `README.md`).
- Doporučené další vektory, až jádro umí ICMP chyby: `ping-bez-cesty` (R1 bez cesty do
  192.168.3.0/24 → ICMP 3/0, Windows `Destination net unreachable.`), `ping-router-arp-fail`
  (cíl v síti 2 neexistuje → R1 3× ARP, pak ICMP 3/1), `traceroute-ios` (UDP sondy, cmd.md kap. 11).
