# ICMP

Stav: iterace 3 (úroveň 3 „Směrování“). Zdroje: RFC 792 (formáty zpráv), RFC 1122 3.2.2 (hostitel),
RFC 1812 4.3 a 5.2.7, 5.3.1 (router). Ověřeno na rfc-editor.org 2026-11-25.

## 1. Zařazení

ICMP je součást síťové vrstvy, zprávy se ale přenášejí v IP paketu s Protocol = `1`.
Slouží k diagnostice (ping, tracert) a k hlášení chyb (nedoručitelnost, vypršení TTL).
**ICMP nemá porty** (rozhodnutí 13); rozlišení odpovědí dělá Identifier a Sequence Number.

## 2. Echo Request / Echo Reply (ping) — pole pro rentgen

| Pole | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|
| Type | 8 | druh zprávy | `8` Echo Request, `0` Echo Reply |
| Code | 8 | upřesnění | `0` |
| Checksum | 16 | kontrolní součet celé ICMP zprávy (RFC 1071) | počítá se skutečně |
| Identifier | 16 | rozlišení „relací“ pingu | `1` (Windows ping používá 1; Linux PID — zjednodušení) |
| Sequence Number | 16 | pořadové číslo dotazu | od `1`, +1 s každým dotazem |
| Data | proměnná | libovolná data, odpověď je vrací | ping: 32 B `abcdefghijklmnopqrstuvwabcdefghi` (jako Windows `ping`) |

- Hlavička ICMP echo = 8 B. Ping z Windows: ICMP 8 + 32 = 40 B, IP paket 60 B, rámec 74 B.
- **Odpověď** (RFC 792; RFC 1122 3.2.2.6): Type 0, Identifier a Sequence Number zkopírované
  z dotazu, data vrácená celá a beze změny („MUST be entirely included“). IP adresy prohozené.
  Je to **nový IP paket** s výchozím TTL odpovídajícího uzlu (viz `ipv4.md` kap. 3).
- Odpovídá každý L3 uzel včetně routeru (na kteroukoli svou adresu). Simulátor zjednodušuje:
  žádný firewall, který by ICMP blokoval (Windows ve výchozím nastavení Echo Request blokuje!
  — reálná past při zkoušení ve škole, vhodné zmínit v didaktice).
- Simulátor zjednodušuje: Windows čísluje Sequence Number průběžně pro celý systém (druhé
  spuštění `ping` nezačíná od 1); simulátor začíná každý příkaz od 1.

### 2.1 Aplikace `ping` (Windows) — časování a výsledek

| Parametr | Windows | Simulace |
|---|---|---|
| počet dotazů | 4 (`-n N`) | `count` v akci; terminál výchozí 4 |
| velikost dat | 32 B (`-l N`) | 32 |
| časový limit odpovědi | 4000 ms (`-w`) | 4 s |
| další dotaz | cca 1 s po předchozím | **1 s po přijetí odpovědi**, po vypršení limitu nebo po chybě hned |
| TTL | 128 (`-i N`) | `ttl_default` uzlu; `-i` volitelně (úroveň 3 nepotřebuje) |

Výsledek pro UI (`app_result`, vektory.md kap. 7): `sent`, `received` (počet Echo Reply),
`replies[]` (`from`, `bytes`, `ttl`), `errors[]` (`seq`, `kind`, `from`, případně `code`):

| `kind` | Kdy | Řádek Windows (cmd.md kap. 8) |
|---|---|---|
| `no_route` | hostitel nemá cestu (bez brány, cíl mimo síť) | `PING: transmit failed. General failure.` (ověřit) |
| `arp_failed` | ARP na next hop bez odpovědi (arp.md kap. 6.2); `from` = vlastní IP | `Reply from <vlastní IP>: Destination host unreachable.` |
| `unreachable` | přišla ICMP 3/x; `from` = odesílatel ICMP, `code` | `Reply from <router>: Destination net unreachable.` (3/0), `… Destination host unreachable.` (3/1) |
| `ttl_exceeded` | přišla ICMP 11/0 | `Reply from <router>: TTL expired in transit.` |
| `timeout` | do 4 s nic | `Request timed out.` |

## 3. Chybové zprávy

### 3.1 Společný formát (RFC 792)

| Pole | Délka (bity) | Hodnota |
|---|---|---|
| Type | 8 | 3 nebo 11 |
| Code | 8 | viz tabulka 3.3 |
| Checksum | 16 | počítá se skutečně |
| Unused | 32 | nuly (u 3/4 by byla Next-Hop MTU, RFC 1191 — mimo rozsah) |
| Původní paket | proměnná | IP hlavička původního paketu + začátek jeho dat |

RFC 792 vyžaduje alespoň hlavičku + 64 bitů dat původního paketu; RFC 1812 4.3.2.3 doporučuje
routerům přiložit co nejvíc, aby zpráva nepřesáhla 576 B. **Simulátor zjednodušuje:** přiloží IP
hlavičku + prvních 8 B dat (minimum RFC 792). U ICMP Echo je v těch 8 B celá ICMP hlavička
(Type, Code, Checksum, Identifier, Sequence) — podle nich odesílatel pozná, na který dotaz chyba
odpovídá. Délky: ICMP 8 + 20 + 8 = 36 B, IP paket **56 B**, rámec 70 B (bez výplně). Shodné
s pozorovaným provozem (Time Exceeded s Total Length 56, záznam provozu na networklessons.com).

Rentgen ukazuje přiloženou hlavičku jako vnořený blok „Původní paket (kopie začátku)“ se zdrojovou
a cílovou IP a TTL — to, co student potřebuje k pochopení tracertu.

TTL v přiložené hlavičce: simulátor vkládá hlavičku **tak, jak paket přišel** (tedy TTL 1),
s původním kontrolním součtem. Implementace se liší (některé routery vkládají TTL 0); pro výuku
nepodstatné, vektory ho nekontrolují.

### 3.2 Kdo a s jakou adresou zprávu posílá

- **Zdrojová IP chybové zprávy z routeru = adresa rozhraní, kterým ICMP zpráva odchází**
  (RFC 1812 4.3.2.4: „the IP source address in an ICMP message originated by the router MUST be
  one of the IP addresses associated with the physical interface over which the ICMP message is
  transmitted“). Ověřeno v textu RFC 2026-11-25.
  V běžné topologii je to rozhraní **směrem ke zdroji** (tam, odkud paket přišel). Proto `tracert`
  ukazuje adresy rozhraní routerů „bližší“ odesílateli (vektor `tracert-alice-bob`: řádek 1 je
  192.168.1.1, ne 192.168.2.1, i když paket míří do 192.168.2.0/24; u dvou routerů ve vektoru
  `tracert-dva-routery` 192.168.1.1 a 192.168.2.2, ne 192.168.2.1 a 192.168.3.1). Typická miskoncepce: „router má jednu adresu“.
- Cílová IP = zdrojová IP původního paketu.
- TTL = výchozí TTL routeru (Cisco 255). Na zpáteční cestě ho další routery snižují jako u každého paketu.
- ICMP chyba se cestou směruje normálně (LPM, ARP, nový rámec) — router ji vytvoří, jako by
  ji posílal sám od sebe.

### 3.3 Typy a kódy v simulaci

| Type | Code | Název | Kdo a kdy posílá | Úroveň 3 |
|---|---|---|---|---|
| 3 | 0 | Destination Unreachable — network unreachable | router: nemá cestu (RFC 1812 5.2.7.1) | ano |
| 3 | 1 | Destination Unreachable — host unreachable | router: next hop neodpovídá na ARP (RFC 1812 5.2.7.1, 3.3.2) | ano, viz arp.md 6.2 „ověřit“ |
| 3 | 3 | Destination Unreachable — port unreachable | hostitel: na UDP portu nikdo neposlouchá | volitelně (IOS traceroute, kap. 4.2); jinak úroveň 4 |
| 11 | 0 | Time Exceeded — TTL exceeded in transit | router: TTL by kleslo na 0 (RFC 1812 5.3.1) | ano |

Pravidla (RFC 1122 3.2.2, RFC 1812 4.3.2.7): ICMP chyba se **neposílá** jako odpověď na jinou
ICMP chybu, na paket s broadcast/multicast cílem ani na fragment jiný než první. (Na Echo
Request/Reply se posílá — Echo není chybová zpráva; proto Windows tracert s ICMP Echo funguje.)

Simulátor zjednodušuje: bez omezení četnosti ICMP zpráv (Cisco ve výchozím stavu omezuje
unreachable na 1 za 500 ms — **ověřit**; proto IOS traceroute u posledního skoku často ukáže `*`),
bez Redirect (5), Source Quench (4, zastaralé) a Timestamp.

## 4. Traceroute

Princip (stejný pro všechny implementace): sondy s TTL 1, 2, 3, …; router, kterému TTL vyprší,
pošle Time Exceeded ze své adresy → odesílatel se dozví adresu každého routeru na cestě.
Konec: odpověď od cíle, nebo `max_hops` (Windows 30).
Úroveň 3: Windows `tracert` přes jeden router (rozhodnutí 44, vektor `tracert-alice-bob`); IOS
`traceroute` se v úrovni 3 odmítne (rozhodnutí 45, kap. 4.2).

### 4.1 Windows `tracert` (akce `tracert` ve vektorech)

| Vlastnost | Windows | Simulace |
|---|---|---|
| sonda | **ICMP Echo Request** s rostoucím TTL (Microsoft Learn, příkaz tracert) | ICMP Echo Request |
| data sondy | 64 B nul (podle záznamu provozu: Total Length 92; **ověřit** Wiresharkem při pilotu) | 64 B nul, IP 92 B, rámec 106 B |
| sond na skok | 3 | `probes` = 3 |
| max. skoků | 30 (`-h`) | `max_hops` = 30 |
| časový limit | 4000 ms (`-w`) | 4 s, pak `*` |
| konec | Echo Reply od cíle | Echo Reply od cíle |
| jména | reverzní DNS dotaz na každou adresu, `-d` vypne | bez DNS do úrovně 4; akce odpovídá `tracert -d` (`resolve: false`) |
| další sonda | po odpovědi / po limitu | **hned po odpovědi** (zjednodušení časování) |

Identifier a Sequence Number sond Windows: **ověřit** (vektor je nekontroluje).

### 4.2 Cisco IOS `traceroute`

Cisco (stejně jako Linux `traceroute`) posílá **UDP datagramy** na vysoké porty (výchozí od 33434),
ve výchozím stavu 3 sondy na skok. Routery cestou odpovídají Time Exceeded, **cíl** odpoví
ICMP **Port Unreachable** (3/3), protože na tom portu nikdo neposlouchá — tím traceroute pozná cíl.
To je fakt, který CCNA zkouší („Windows tracert = ICMP, Cisco/Linux traceroute = UDP“).

Rozhodnutí 45: v úrovni 3 se IOS `traceroute` odmítne hláškou „v této úrovni použij tracert na PC“;
**nesimulovat** ho pomocí ICMP Echo (to by se student musel odnaučit). Implementace s UDP sondami
a 3/3 od cíle později.

Detaily (**ověřit**): zdrojový port sondy, inkrement cílového portu o 1 pro každou sondu,
data sondy (IOS posílá krátká data, délku ověřit v Packet Traceru).

## 5. Mimo rozsah této iterace

Path MTU Discovery (3/4), ICMP Redirect, ICMP rate limiting, ICMPv6.
