# Příkazy terminálu (úroveň 2 a 3)

Stav: návrh, iterace 2; úroveň 3 doplněna v iteraci 3 (kap. 7–12). Autor: projektant. Rozhodnutí 10: výstupy Windows **anglicky**
(Windows 10/11 v angličtině = shoda s návody a CCNA), s českou poznámkou simulátoru; jazyk Windows
ve škole ověřit. Hodnoty ve výstupech jsou vždy ze stavu simulace (topologie, ARP tabulka,
MAC tabulka), nic se nevymýšlí.

Značení: **ověřit** = formát podle znalosti projektanta, není ověřený na zdroji ani na reálném
PC/switchi; před zveřejněním porovnat se školním PC (Windows) a se switchem nebo Packet Tracerem.
Microsoft přesný výstup `ipconfig`/`arp` nedokumentuje (dokumentace na learn.microsoft.com uvádí
jen parametry), proto je zdrojem pravdy reálné PC.

## 1. Výběr příkazů pro úroveň 2

| Příkaz | Kde | Úroveň 2? | Proč |
|---|---|---|---|
| `ipconfig` | PC (Windows) | ano | IP adresa (L3) svého rozhraní. Maska a brána se ukážou, ale na úrovni 2 se nevysvětlují (didaktika: „nepočítá se s maskou“); poznámka „k masce a bráně se dostaneme v úrovni 3“. |
| `ipconfig /all` | PC | **ano, hlavní** | Jediné místo, kde student na PC vidí **MAC i IP současně** („Physical Address“ vs. „IPv4 Address“) — přímo cíl úrovně 2 (každá vrstva má svou adresu). Příkaz z Michalových prezentací. |
| `arp -a` | PC | ano | Ukáže předvyplněnou ARP tabulku (rozhodnutí 14): student vidí, že Alice „zná“ MAC Boba, a tím je zjednodušení vidět, ne schované. Úroveň 3 ukáže, jak tam záznam vznikne. |
| `getmac` | PC | volitelně (nízká priorita) | Jen MAC adresy; ve výuce i v CCNA se používá málo, `ipconfig /all` stačí. Doporučení: zatím nedělat. |
| `show mac address-table` | switch (Cisco IOS) | **ano** | MAC tabulka switche je hlavní děj úrovně 2 (učení, flooding). Formát Cisco = shoda s Packet Tracerem a CCNA. |
| `netstat -an -p UDP` | PC | ne (úroveň 4) | Ukázal by otevřené porty (`0.0.0.0:5000`); porty jako „naslouchání“ jsou cíl úrovně 4. Na úrovni 2 port stačí v rentgenu a v obálce L4. |
| `ping`, `tracert` | PC | ne (úroveň 3) | ICMP nemá porty (rozhodnutí 13). |

Na switchi: terminál switche se otevře klikem na switch. Prompt `Switch#` (privilegovaný režim
bez hesla; `enable` se na úrovni 2 přeskakuje — Simulátor zjednodušuje: „konzole switche je rovnou
v privilegovaném režimu“). Na hubu terminál není (hub nemá žádný software ani tabulku — dobrá
hláška: „Hub nemá konzoli: nic si nepamatuje a nic nenastavuje.“).

## 2. `ipconfig` (Windows 10/11, anglicky)

Vzor pro Alici (PC1, statická IP, bez DHCP). Prázdné řádky jsou součást výstupu.

```
C:\Users\student>ipconfig

Windows IP Configuration


Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 192.168.1.10
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1

C:\Users\student>
```

- Popisky a tečkové „vodítko“ (`IPv4 Address. . . . . . . . . . . :`) se píší přesně jako ve
  Windows; hodnota začíná ve stejném sloupci. Přesný počet teček a mezer **ověřit** (vzor odpovídá
  běžně publikovaným výstupům Windows 10).
- Počet prázdných řádků mezi „Windows IP Configuration“ a adaptérem (dva) **ověřit**.
- Název adaptéru `Ethernet` (Windows 10/11 pojmenuje první drátovou kartu „Ethernet“, další
  „Ethernet 2“…).
- **Simulátor zjednodušuje:** skutečný Windows ukáže navíc řádek `Link-local IPv6 Address . . . . . :
  fe80::…%12` (IPv6 je zapnuté vždy) a případně další adaptéry (Wi-Fi, virtuální). Simulátor IPv6
  nemá; poznámka v UI: „Na školním PC uvidíš navíc řádek s adresou IPv6, tu simulátor nemá.“
- Uzel bez brány: řádek `Default Gateway . . . . . . . . . :` s prázdnou hodnotou.
- Česká Windows (pro poznámku simulátoru): „Konfigurace IP systému Windows“, „Adresa IPv4“,
  „Maska podsítě“, „Výchozí brána“ — **ověřit** na školním PC.

## 3. `ipconfig /all`

```
C:\Users\student>ipconfig /all

Windows IP Configuration

   Host Name . . . . . . . . . . . . : ALICE
   Primary Dns Suffix  . . . . . . . :
   Node Type . . . . . . . . . . . . : Hybrid
   IP Routing Enabled. . . . . . . . : No
   WINS Proxy Enabled. . . . . . . . : No

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : Simulated Ethernet Adapter
   Physical Address. . . . . . . . . : 02-00-00-00-00-01
   DHCP Enabled. . . . . . . . . . . : No
   Autoconfiguration Enabled . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 192.168.1.10(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1
   NetBIOS over Tcpip. . . . . . . . : Enabled

C:\Users\student>
```

- **Physical Address** = MAC, zápis Windows: velká písmena, pomlčky (`02-00-00-00-00-01`);
  data simulátoru mají dvojtečky a malá písmena (`model.md` kap. 3), převod jen při výpisu.
  Velká písmena hex číslic u MAC ve Windows (např. `A4-BB-6D-…`) — **ověřit**, projektant je
  přesvědčen, že Windows píše velká.
- `(Preferred)` za IPv4 adresou se v `/all` píše, v `ipconfig` bez parametru ne.
- `Host Name`: z `label` uzlu velkými písmeny bez diakritiky (Windows NetBIOS jméno), nebo z `id`.
  Jméno počítače nemá s adresami nic společného — na úrovni 2 se nevysvětluje.
- `Node Type`: Windows bez WINS serveru ukazuje `Hybrid` (**ověřit**; na některých PC bývá
  `Broadcast`, a v češtině „Hybridní“). Řádek je pro úroveň 2 nepodstatný.
- **Simulátor zjednodušuje:** chybí řádky `Link-local IPv6 Address`, `DHCPv6 IAID`,
  `DHCPv6 Client DUID`, `DNS Servers` (do zavedení DNS v úrovni 4 uzly DNS server nemají); u DHCP
  (úroveň 5) přibudou `DHCP Server`, `Lease Obtained`, `Lease Expires`.
- `Description`: text výrobce ovladače; simulátor píše „Simulated Ethernet Adapter“, aby nepředstíral
  reálný hardware (stejný důvod jako lokálně spravované MAC `02:…`).
- Na úrovni 2 UI zvýrazní (stejnou barvou jako v rentgenu) řádky Physical Address (L2) a IPv4
  Address (L3). Česky: „Fyzická adresa“, „Adresa IPv4“ — **ověřit**.

## 4. `arp -a`

Vzor pro Alici s předvyplněnou ARP tabulkou (vektory úrovně 2):

```
C:\Users\student>arp -a

Interface: 192.168.1.10 --- 0x4
  Internet Address      Physical Address      Type
  192.168.1.20          02-00-00-00-00-02     dynamic
  192.168.1.255         ff-ff-ff-ff-ff-ff     static
  255.255.255.255       ff-ff-ff-ff-ff-ff     static

C:\Users\student>
```

- Struktura (řádek `Interface: <IP> --- 0x<index>`, hlavička tří sloupců, `dynamic`/`static`
  malými písmeny, MAC s pomlčkami a **malými** písmeny) odpovídá Windows 10/11; přesné zarovnání
  sloupců **ověřit**. Číslo za `0x` je index rozhraní v OS (libovolné, simulátor píše `0x4`).
- Řádky `192.168.1.255` (broadcast vlastní sítě) a `255.255.255.255` (omezený broadcast) Windows
  opravdu ukazuje jako `static`; simulátor je doplní při výpisu (nejsou v datech `arp_cache`,
  podobně jako Cisco vlastní adresy, `arp.md` kap. 5). Poznámka UI na úrovni 2: „Adresy končící
  .255 jsou pro broadcast — vysvětlíme v úrovni 3.“ (Alternativa, pokud didaktik chce méně šumu:
  vynechat je a označit „Simulátor zjednodušuje: …“.)
- **Simulátor zjednodušuje:** skutečný Windows vypíše navíc multicastové záznamy (`224.0.0.22`,
  `224.0.0.251`, `239.255.255.250` s MAC `01-00-5e-…`), které vznikají provozem na pozadí
  (`model.md` kap. 8). Poznámka: „Na školním PC uvidíš víc řádků (adresy 224.… a 239.…); patří
  provozu, který simulátor nemá.“
- Prázdná ARP tabulka (Cyril, PC3): Windows vypíše jen `Interface…`, hlavičku a static záznamy.
  Bez jakéhokoli záznamu (ani static) Windows píše `No ARP Entries Found.` — **ověřit**.
- Česky: `Rozhraní: 192.168.1.10 --- 0x4`, `Internetová adresa`, `Fyzická adresa`, `Typ`,
  `dynamický`/`statický` — **ověřit** (souvisí s otevřenou otázkou 5 v `README.md`).
- Úroveň 2 ARP neukazuje v provozu (rozhodnutí 14): `arp -a` jen čte. `arp -d` (smazání) na
  úrovni 2 **nepovolit** — po smazání by musel proběhnout ARP. Hláška: „Tento příkaz zpřístupní
  úroveň 3.“

## 5. `getmac` (volitelně)

```
C:\Users\student>getmac

Physical Address    Transport Name
=================== ==========================================================
02-00-00-00-00-01   \Device\Tcpip_{3F2504E0-4F89-11D3-9A0C-0305E82C3301}
```
Formát a GUID **ověřit**; GUID je identifikátor rozhraní ve Windows bez významu pro výuku.
Doporučení: na úrovni 2 neimplementovat (viz kap. 1).

## 6. Switch: `show mac address-table` (Cisco IOS 15, Catalyst 2960)

Vzor po vektoru `udp-switch` (Alice na Fa0/1, Bob na Fa0/2, Cyril nic neposlal):

```
Switch#show mac address-table
          Mac Address Table
-------------------------------------------

Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    0200.0000.0001    DYNAMIC     Fa0/1
   1    0200.0000.0002    DYNAMIC     Fa0/2
Total Mac Addresses for this criterion: 2
Switch#
```

- MAC ve formátu Cisco: tři skupiny po 4 hex číslicích s tečkami, malá písmena (`ethernet.md` kap. 1).
- `Type` velkými písmeny `DYNAMIC` / `STATIC`; `Ports` krátký název rozhraní (`Fa0/1`, `Gi0/1`).
- Řazení: podle VLAN, pak podle MAC (IOS řadí; **ověřit**). Simulátor: podle VLAN a MAC vzestupně.
- Ověření formátu: hlavička „Mac Address Table“, sloupce „Vlan / Mac Address / Type / Ports“ a
  řádek „Total Mac Addresses for this criterion“ odpovídají výstupům Catalyst IOS 12.2/15 v Cisco
  dokumentaci k sesterským platformám (Catalyst 3560-X, ME 3400) a v Cisco Community; přesné
  zarovnání sloupců **ověřit** na switchi ve škole nebo v Packet Traceru. Starší IOS (příkaz
  s pomlčkou `show mac-address-table`, do 12.1(11)EA1) měly jiný formát — simulátor ho nepodporuje.
- **Simulátor zjednodušuje:** skutečný Catalyst vypíše na začátku i statické záznamy
  `All    0100.0ccc.cccc    STATIC      CPU` (a další adresy pro protokoly CDP, STP, VTP…), které
  patří vlastnímu procesoru switche; simulátor je vynechává (switch bez vlastní správy, `model.md`
  kap. 2). Packet Tracer je také neukazuje (**ověřit**). Poznámka v UI: „Skutečný switch vypíše
  navíc řádky s portem CPU, to jsou adresy, které patří switchi samotnému.“ Počet v `Total`
  pak odpovídá jen vypsaným řádkům.
- Prázdná tabulka (switch po zapnutí, začátek vektoru `udp-switch`): hlavička bez řádků a
  `Total Mac Addresses for this criterion: 0` — **ověřit**.
- Volitelné varianty, levné na implementaci a užitečné na úrovni 2:
  - `show mac address-table dynamic` (jen dynamické; v simulaci totéž),
  - `show mac address-table interface Fa0/1` (jen záznamy portu),
  - `show mac address-table aging-time` → výstup **ověřit** (300 s je výchozí, `ethernet.md` 4.1),
  - `clear mac address-table dynamic` (vyprázdní tabulku → student znovu uvidí flooding; IOS
    nic nevypíše, vrátí prompt).
- Neplatný příkaz: IOS odpoví `% Invalid input detected at '^' marker.` se stříškou pod místem
  chyby, neúplný `% Incomplete command.`, neznámý `% Unknown command or computer name, or unable to
  find computer address` (**ověřit** znění) — pro úroveň 2 stačí první dvě.
- Zkracování příkazů (`sh mac add`) IOS umožňuje, pokud je zkratka jednoznačná; simulátor by měl
  zkratky přijímat (studenti je uvidí v CCNA a Packet Traceru).

## 7. Úroveň 3: výběr příkazů

Stav: iterace 3. Topologie a adresy ve vzorech: `routing.md` kap. 7 (Alice 192.168.1.10, R1
Gi0/0 192.168.1.1 / Gi0/1 192.168.2.1, Bob 192.168.2.20, Cyril 192.168.1.30; rozhodnutí 39).
Vše ostatní z kap. 1–6 platí dál. Značka **ověřit** jako výše; **ověřeno** = podle zdroje
uvedeného u vzoru.

| Příkaz | Kde | Proč na úrovni 3 |
|---|---|---|
| `ping <IP>` (`-n N`) | PC | ARP + ICMP Echo, TTL v odpovědi (128 v síti, 63 přes router), chybové hlášky (kap. 8) |
| `tracert <IP>` (`-d`) | PC | TTL a Time Exceeded, adresy routerů (kap. 9) |
| `ipconfig`, `ipconfig /all` | PC | teď s výchozí bránou (kap. 2–3 beze změny formátu) |
| `arp -a`, `arp -d` | PC | ARP cache se plní provozem; `arp -d` ji smaže, aby šel ARP zopakovat (kap. 10) |
| `route print` = `netstat -nr` | PC | jen sekce IPv4 Route Table (rozhodnutí 45, kap. 11) |
| `show ip interface brief` | R1 | rozhraní, IP, stav up/down, administratively down (kap. 12.2) |
| `show ip route` | R1 | C, L, S, S*, `[AD/metrika]`, Gateway of last resort (kap. 12.3) |
| `show ip arp` (= `show arp`) | R1 | ARP cache routeru na obou stranách (kap. 12.4) |
| `ping` | R1 | `!!!!!` (kap. 12.5); `traceroute` se v úrovni 3 odmítne (kap. 12.6, rozhodnutí 45) |
| `enable`, `configure terminal`, `interface`, `ip address`, `no shutdown`, `ip route`, `end` | R1 | zjednodušená konfigurace (kap. 12.7) |

## 8. Windows `ping`

### 8.1 Úspěch (Alice → Bob přes router)

```
C:\Users\student>ping 192.168.2.20

Pinging 192.168.2.20 with 32 bytes of data:
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127

Ping statistics for 192.168.2.20:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 0ms, Maximum = 0ms, Average = 0ms

C:\Users\student>
```

- Struktura (řádek `Pinging … with 32 bytes of data:`, `Reply from …: bytes=32 time<1ms TTL=…`,
  blok statistiky) je standardní výstup Windows 10/11; zarovnání a prázdné řádky **ověřit**.
- `TTL=` je TTL z IP hlavičky **odpovědi** (`ipv4.md` kap. 3), ne počet skoků.
- `time<1ms`: simulátor zjednodušuje — simulovaný čas je orientační (`model.md` kap. 8), v LAN
  terminál vždy píše `time<1ms` a statistiku `0ms`. Alternativa `time=1ms` při průchodu routerem
  by byla vymyšlená přesnost; nedělat.
- Česky (**ověřit**): `Příkaz PING na 192.168.2.20 s 32 bajty dat:`, `Odpověď od 192.168.2.20: bajty=32 čas<1ms TTL=127`,
  `Statistika ping pro 192.168.2.20:`, `Pakety: Odeslané = 4, Přijaté = 4, Ztracené = 0 (ztráta 0%)`.

### 8.2 Hostitel nemá cestu (bez brány, cíl v jiné síti) — vektor `ping-bez-brany`

```
C:\Users\student>ping 192.168.2.20

Pinging 192.168.2.20 with 32 bytes of data:
PING: transmit failed. General failure.
PING: transmit failed. General failure.
PING: transmit failed. General failure.
PING: transmit failed. General failure.

Ping statistics for 192.168.2.20:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),

C:\Users\student>
```

- **Nejistota (ověřit při pilotu, priorita vysoká):** že Windows 10/11 bez brány pro cíl mimo síť
  hlásí `PING: transmit failed. General failure.`, uvádějí návody a fóra (např. sid-500.com,
  thewindowsclub.com); Microsoft „General failure“ popisuje obecně jako „no valid interfaces to
  process the request“ (learn.microsoft.com, Troubleshoot TCP/IP communication). Projektant
  nemá vlastní záznam. Možná alternativa na některých verzích: `Destination host unreachable.`
  od vlastní adresy. Ověření: na školním PC nastavit statickou IP bez brány a pingnout 8.8.8.8.
- Na síti se nic neděje (žádný ARP) — to platí bez ohledu na text hlášky (RFC 1122 3.3.1, `ipv4.md` 4.2).
- Zda se za hláškami vypisuje statistika a blok RTT chybí: **ověřit**.

### 8.3 Chyby hlášené odpovědí

| Situace | Řádek ve Windows | Odkud | Vektor |
|---|---|---|---|
| ARP na next hop bez odpovědi (špatná brána, cíl v LAN neexistuje) | `Reply from 192.168.1.10: Destination host unreachable.` | **vlastní IP**, na lince žádné ICMP | `ping-spatna-brana` |
| router nemá cestu (ICMP 3/0) | `Reply from 192.168.1.1: Destination net unreachable.` | IP rozhraní routeru | (navrženo) |
| router nedostal ARP odpověď (ICMP 3/1) | `Reply from 192.168.1.1: Destination host unreachable.` | IP rozhraní routeru | (navrženo) |
| TTL vypršelo (ICMP 11/0; `ping -i 1`) | `Reply from 192.168.1.1: TTL expired in transit.` | IP rozhraní routeru | — |
| žádná odpověď do 4 s | `Request timed out.` | — | — |

- Význam „Destination host unreachable“ od vlastní IP = ARP bez odpovědi: **ověřeno** (Microsoft
  Learn: „means that the ARP requests that are sent by the node aren't getting a response“).
- Texty `Destination net unreachable.` a `TTL expired in transit.`: běžně publikované výstupy
  Windows, **ověřit** tečku na konci a velikost písmen.
- Česky (**ověřit**): `Odpověď od 192.168.1.10: Cílový hostitel není dostupný.`,
  `Vypršel časový limit žádosti.`, `Při přenosu vypršela hodnota TTL.`

### 8.4 Statistika při chybách (past pro studenty)

Windows počítá odpověď „Destination host unreachable“ (i od vlastní IP) do **Received**:
`Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)` — přestože žádné Echo Reply nepřišlo.
Projektant je si tím téměř jistý (častý dotaz na fórech), **ověřit**. Simulátor to má ukázat
pravdivě a dodat poznámku: „Pozor: Windows tu počítá jako přijaté i chybové hlášení, ne odpověď
cíle. Ping se nepovedl.“ Ve vektoru se `received` počítá jen z Echo Reply (vektory.md kap. 7);
převod na řádek Windows dělá terminál.

## 9. Windows `tracert`

Vektor `tracert-alice-bob` (rozhodnutí 44: jeden router):

```
C:\Users\student>tracert -d 192.168.2.20

Tracing route to 192.168.2.20 over a maximum of 30 hops

  1    <1 ms    <1 ms    <1 ms  192.168.1.1
  2    <1 ms    <1 ms    <1 ms  192.168.2.20

Trace complete.

C:\Users\student>
```

- Řádek 1 = R1 (Time Exceeded ze zdrojové adresy Gi0/0, `icmp.md` kap. 3.2), řádek 2 = Bob (Echo Reply).
  Simulátor animuje jednu sondu na TTL, výpis ukáže tři časy (rozhodnutí 44, označené zjednodušení);
  vektor obsahuje všechny 3 sondy na skok, jak je Windows opravdu posílá.
- Varianta přes dva routery (vektor `tracert-dva-routery`, `skip`): řádky 192.168.1.1, 192.168.2.2, 192.168.3.10.
- Hlavička `Tracing route to … over a maximum of 30 hops`, tři sloupce časů, adresa, `Trace complete.`:
  standardní výstup Windows podle běžně publikovaných ukázek (příkaz popisuje Microsoft Learn a KB 162326
  „How to use TRACERT“); šířky sloupců **ověřit**.
- Bez `-d` se Windows ptá DNS na jména; v simulaci zatím není DNS, proto `tracert` bez `-d` vypíše
  totéž jako s `-d` (Windows při neúspěšném reverzním dotazu vypíše jen IP — pravdivé) a poznámku
  „Bez DNS se jména nezjišťují (DNS v úrovni 4).“ Pro cíl zadaný jménem: `Tracing route to
  www.example.cz [IP]` až s DNS.
- Skok bez odpovědi: `  2     *        *        *     Request timed out.` (**ověřit** mezery).
- Router hlásí nedostupnost: `  2  192.168.1.1  reports: Destination net unreachable.` (**ověřit**),
  pak `Trace complete.`
- Bez brány: přesný text **nevíme** (ověřit při pilotu; možná `Unable to contact IP driver. General
  failure.` nebo `Transmit error: code 1231.`). Do ověření terminál vypíše `General failure.`
  s poznámkou simulátoru „přesné znění ověřujeme“.
- Česky (**ověřit**): `Výpis trasy k 192.168.3.10 s nejvýše 30 směrováními`, `Trasování bylo dokončeno.`

## 10. `arp -a` a `arp -d` po provozu

Alice po vektoru `ping-arp-prvni` (formát kap. 4):

```
C:\Users\student>arp -a

Interface: 192.168.1.10 --- 0x4
  Internet Address      Physical Address      Type
  192.168.1.1           02-00-00-00-01-01     dynamic
  192.168.1.255         ff-ff-ff-ff-ff-ff     static
  255.255.255.255       ff-ff-ff-ff-ff-ff     static

C:\Users\student>
```

- Klíčové pro úroveň 3: v tabulce je **MAC brány**, ne MAC Boba (Bob je za routerem).
  Řádek s Bobem 192.168.2.20 tam nikdy nebude — miskoncepci vyvrací tenhle výpis.
- `arp -d` (bez parametru nebo `arp -d *`) smaže všechny dynamické záznamy, `arp -d 192.168.1.1`
  jeden; výpis nic nevypíše. Ve Windows vyžaduje spuštění jako správce, jinak `The ARP entry
  deletion failed: The requested operation requires elevation.` (**ověřit** znění). Simulátor
  zjednodušuje: oprávnění nekontroluje; poznámka „Na školním PC potřebuješ příkazový řádek
  spuštěný jako správce.“
- Na úrovni 3 se `arp -d` povolí (na úrovni 2 zůstává zakázané, kap. 4).

## 11. `route print` a `netstat -nr`

Oba příkazy vypíšou totéž (`netstat -r` = `route print`). Vzor pro Alici (statická IP, brána):

```
C:\Users\student>route print

IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      192.168.1.1     192.168.1.10     25
        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331
        127.0.0.1  255.255.255.255         On-link         127.0.0.1    331
  127.255.255.255  255.255.255.255         On-link         127.0.0.1    331
      192.168.1.0    255.255.255.0         On-link      192.168.1.10    281
     192.168.1.10  255.255.255.255         On-link      192.168.1.10    281
    192.168.1.255  255.255.255.255         On-link      192.168.1.10    281
        224.0.0.0        240.0.0.0         On-link         127.0.0.1    331
        224.0.0.0        240.0.0.0         On-link      192.168.1.10    281
  255.255.255.255  255.255.255.255         On-link         127.0.0.1    331
  255.255.255.255  255.255.255.255         On-link      192.168.1.10    281
===========================================================================
Persistent Routes:
  Network Address          Netmask  Gateway Address  Metric
          0.0.0.0          0.0.0.0      192.168.1.1  Default
===========================================================================

C:\Users\student>
```

- Rozhodnutí 45: simulátor vypíše jen sekci IPv4 Route Table. **Simulátor zjednodušuje:** skutečný
  Windows začíná blokem `Interface List` (seznam karet a jejich MAC) a končí blokem `IPv6 Route Table`;
  poznámka „Na školním PC uvidíš navíc seznam rozhraní a tabulku pro IPv6.“ Zda patří Persistent Routes
  do „sekce IPv4“: ve Windows je součástí IPv4 bloku, ponechat.
- Struktura (IPv4 Route Table, Active Routes, `On-link`, Persistent Routes u ručně
  zadané brány) odpovídá Windows 10/11; **ověřit** šířky sloupců a metriky (25 / 281 / 331 jsou
  typické pro 1 Gb/s kartu a loopback: metrika rozhraní + 256 u on-link cest; ověřit).
- Simulace má jen dvě cesty (`ipv4.md` 4.1): řádky `0.0.0.0` a `192.168.1.0` jsou „pravé“, ostatní
  (loopback 127.x, vlastní /32, broadcast, multicast 224.0.0.0/4) terminál doplní při výpisu stejně
  jako broadcastové řádky v `arp -a` (rozhodnutí 26). UI zvýrazní dva pravé řádky a k ostatním dá
  jednu větu: „Další řádky patří adresám, které počítač zná vždy (sám sebe, broadcast, multicast).“
  Alternativa pro didaktika: vypsat jen dva řádky s označením „Simulátor zjednodušuje“.
- `On-link` = přímé doručení (cesta `connected`); `Gateway` u 0.0.0.0 = výchozí brána.
- Bez brány: řádek `0.0.0.0` chybí a Persistent Routes je `None`.

## 12. Router: Cisco IOS

### 12.1 Prompt a režimy

`R1>` (uživatelský režim) → `enable` → `R1#` (privilegovaný) → `configure terminal` → `R1(config)#`
→ `interface GigabitEthernet0/0` → `R1(config-if)#`; `exit` o úroveň výš, `end` (nebo Ctrl+Z) zpět do `R1#`.
Doporučení: na routeru `enable` **nepřeskakovat** (na rozdíl od switche v úrovni 2) — režimy
jsou základ CCNA a stojí jen jeden příkaz; bez hesla. Zkratky (`conf t`, `int g0/0`, `sh ip ro`)
přijímat (kap. 6). `show` v režimu `(config)` IOS odmítne; přijímá `do show …` (IOS 12.2+, ověřit
v Packet Traceru) — simulátor ho může přijímat.

### 12.2 `show ip interface brief`

Router po zapnutí (nic nenastaveno):

```
R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES unset  administratively down down
GigabitEthernet0/1     unassigned      YES unset  administratively down down
R1#
```

Po konfiguraci (kap. 12.7):

```
R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES manual up                    up
GigabitEthernet0/1     192.168.2.1     YES manual up                    up
R1#
```

- Stavy: `administratively down / down` (shutdown), `down / down` (no shutdown, ale kabel nezapojený
  nebo druhá strana vypnutá), `up / up`. Sloupec `Protocol` = stav linkové vrstvy.
- Plné názvy rozhraní (`GigabitEthernet0/0`) jsou ve výpisu správně; zkratka `Gi0/0` v jiných
  výpisech a ve vstupu.
- Šířky sloupců **ověřit** (IOS 15 na ISR 1941/2901 a Packet Tracer 2911). Simulátor vypisuje jen
  rozhraní z topologie; skutečný router jich má víc (např. Gi0/2, Serial…) — zjednodušení.

### 12.3 `show ip route`

R1 v základní topologii:

```
R1#show ip route
Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP
       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area
       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2
       E1 - OSPF external type 1, E2 - OSPF external type 2
       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2
       ia - IS-IS inter area, * - candidate default, U - per-user static route
       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP
       + - replicated route, % - next hop override

Gateway of last resort is not set

      192.168.1.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.1.0/24 is directly connected, GigabitEthernet0/0
L        192.168.1.1/32 is directly connected, GigabitEthernet0/0
      192.168.2.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.2.0/24 is directly connected, GigabitEthernet0/1
L        192.168.2.1/32 is directly connected, GigabitEthernet0/1
R1#
```

R1 a R2 z vektoru `tracert-dva-routery` (pozdější rozšíření, `skip`; blok Codes vynechán):

```
R1#show ip route
...
Gateway of last resort is not set

      192.168.1.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.1.0/24 is directly connected, GigabitEthernet0/0
L        192.168.1.1/32 is directly connected, GigabitEthernet0/0
      192.168.2.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.2.0/24 is directly connected, GigabitEthernet0/1
L        192.168.2.1/32 is directly connected, GigabitEthernet0/1
S     192.168.3.0/24 [1/0] via 192.168.2.2

R2#show ip route
...
Gateway of last resort is 192.168.2.1 to network 0.0.0.0

S*    0.0.0.0/0 [1/0] via 192.168.2.1
      192.168.2.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.2.0/24 is directly connected, GigabitEthernet0/0
L        192.168.2.2/32 is directly connected, GigabitEthernet0/0
      192.168.3.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.3.0/24 is directly connected, GigabitEthernet0/1
L        192.168.3.1/32 is directly connected, GigabitEthernet0/1
```

- Pravidla formátu: řazení podle adresy sítě; síť, která má víc záznamů s různými maskami (C /24
  + L /32), dostane nadřazený řádek `X is variably subnetted, N subnets, M masks` a záznamy se odsadí;
  samostatná cesta (S 192.168.3.0/24) je bez nadřazeného řádku. `[1/0]` = `[AD/metrika]`
  (`routing.md` kap. 4). C a L nemají `[AD/metrika]` ani `via`.
- Ověřeno podle publikovaných výstupů IOS 15 (Cisco dokumentace a CCNA materiály); přesné odsazení,
  znění bloku Codes (liší se mezi verzemi IOS a Packet Tracerem) **ověřit** v Packet Traceru.
  Simulátor vypíše blok Codes celý (studenti ho znají z Packet Traceru); UI zvýrazní kódy L, C, S, *.
- Varianty: `show ip route static`, `show ip route connected` (jen dané typy; levné), `show ip route
  192.168.3.10` (podrobnosti k jedné cestě — formát **ověřit**, nízká priorita).

### 12.4 `show ip arp` (= `show arp`)

R1 po vektoru `ping-arp-prvni`:

```
R1#show ip arp
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  192.168.1.1             -   0200.0000.0101  ARPA   GigabitEthernet0/0
Internet  192.168.1.10            0   0200.0000.0001  ARPA   GigabitEthernet0/0
Internet  192.168.2.1             -   0200.0000.0102  ARPA   GigabitEthernet0/1
Internet  192.168.2.20            0   0200.0000.0002  ARPA   GigabitEthernet0/1
R1#
```

- Vlastní adresy rozhraní se stářím `-` doplní výpis (nejsou v datech, `arp.md` kap. 5).
  `Age (min)` v celých minutách; `ARPA` = Ethernet II zapouzdření. MAC v Cisco tvaru (kap. 6).
- Řazení podle IP; zarovnání **ověřit**. `clear arp-cache` smaže dynamické záznamy (bez výpisu).

### 12.5 `ping` z routeru

```
R1#ping 192.168.2.20
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 192.168.2.20, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms
R1#
```

- IOS posílá 5 dotazů, „100-byte“ = velikost **celého IP paketu** (datagram size; ICMP data 72 B),
  limit 2 s. Znaky: `!` odpověď, `.` vypršel limit, `U` přišla Destination Unreachable,
  `&` TTL vypršelo (**ověřit** `&`), `M`, `?` ostatní (neimplementovat).
- Zdrojová IP = adresa výstupního rozhraní.
- **První ping do sítě, kde router ještě nezná MAC:** skutečný IOS a Packet Tracer ukážou `.!!!!`
  (`Success rate is 80 percent (4/5)`), protože první paket při ARP zahodí (`arp.md` kap. 6.3).
  Simulátor (rozhodnutí 9) ukáže `!!!!!` a poznámku. Tohle je nejčastější rozdíl, který studenti
  z Packet Traceru uvidí — poznámka je nutná.
- Data Echo z IOS (vzor `0xABCD`), Identifier, Sequence od 0: **ověřit** v Packet Traceru; vektory
  pro ping z routeru zatím nejsou.

### 12.6 `traceroute` z routeru — v úrovni 3 se odmítne (rozhodnutí 45)

Hláška simulátoru: „traceroute z routeru v této úrovni nejde, použij tracert na PC.“ Důvod: IOS
traceroute posílá **UDP** sondy (cílové porty od 33434) a cíl odpovídá ICMP Port Unreachable
(`icmp.md` kap. 4.2); napodobit ho ICMP Echo sondami by bylo nepravdivé. Vzor pro pozdější úroveň
(**ověřit** v Packet Traceru, hlavně řádek `VRF info:` z IOS 15):

```
R1#traceroute 192.168.3.10
Type escape sequence to abort.
Tracing the route to 192.168.3.10
VRF info: (vrf in name/id, vrf out name/id)
  1 192.168.2.2 0 msec 0 msec 0 msec
  2 192.168.3.10 0 msec *  0 msec
```

### 12.7 Konfigurace (zjednodušená)

```
R1>enable
R1#configure terminal
Enter configuration commands, one per line.  End with CNTL/Z.
R1(config)#interface GigabitEthernet0/0
R1(config-if)#ip address 192.168.1.1 255.255.255.0
R1(config-if)#no shutdown
R1(config-if)#
%LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to up
R1(config-if)#exit
R1(config)#ip route 192.168.3.0 255.255.255.0 192.168.2.2
R1(config)#end
R1#
%SYS-5-CONFIG_I: Configured from console by console
R1#
```

- Podporované příkazy úrovně 3: `enable`, `disable`, `configure terminal`, `interface <název>`,
  `ip address <IP> <maska>`, `no ip address`, `shutdown`, `no shutdown`, `ip route <síť> <maska> <next-hop>`,
  `no ip route …`, `exit`, `end`, `clear arp-cache`, `show …` z kap. 12.2–12.4, `ping`.
  Maska se zadává **v desítkovém tvaru** (`255.255.255.0`), IOS `/24` v `ip address` nepřijímá.
- Syslog hlášky po `no shutdown` jsou ve tvaru Packet Traceru; skutečný IOS je uvozuje časem
  (`*Mar  1 00:01:02.123: %LINK-3-UPDOWN: …`) a používá `%LINK-3-UPDOWN` — **ověřit**, simulátor
  použije tvar Packet Traceru bez času.
- Chybové hlášky (**ověřit** znění v Packet Traceru):
  - `ip route 192.168.3.1 255.255.255.0 192.168.2.2` → `%Inconsistent address and mask`
  - `ip address 192.168.1.5 255.255.255.0` na Gi0/1, když Gi0/0 je v 192.168.1.0/24 →
    `% 192.168.1.0 overlaps with GigabitEthernet0/0`
  - `ip address 192.168.1.1 255.0.255.0` → `Bad mask 0xFF00FF00 for address 192.168.1.1`
  - neplatný / neúplný příkaz: kap. 6.
- `ip address` bez `no shutdown` = rozhraní zůstane `administratively down`, cesta C nevznikne
  (`routing.md` kap. 2.1) — nejčastější chyba začátečníka, simulátor ji má ukázat, ne opravit za studenta.
- Simulátor zjednodušuje: konfigurace se neukládá (`copy running-config startup-config`,
  `write memory` mimo rozsah), bez `hostname` a hesel; `show running-config` až v úrovni 5 (rozhodnutí 45).

## 13. Otevřené otázky

1. Jazyk Windows ve škole (rozhodnutí 10): pokud jsou školní PC česky, dát ve výstupu přepínač
   EN/CZ, nebo jen českou poznámku pod anglickým výstupem?
2. Ukazovat v `arp -a` statické broadcastové řádky (pravdivé, ale je to šum) — rozhodne didaktik.
3. Všechna místa označená **ověřit**: jeden snímek `ipconfig`, `ipconfig /all`, `arp -a` ze
   školního PC (anglicky i česky) a `show mac address-table` z Packet Traceru vyřeší všechna.
4. Úroveň 3, priorita při pilotu (jeden screenshot vyřeší): (a) ping bez brány na 8.8.8.8 —
   `General failure` vs. `Destination host unreachable` (kap. 8.2); (b) statistika `Received`
   u Destination host unreachable (kap. 8.4); (c) `tracert` bez brány (kap. 9); (d) Packet Tracer:
   `show ip route`, `show ip interface brief`, syslog po `no shutdown`, `traceroute` (kap. 12).
5. `enable` na routeru: rozhodnuto ano (rozhodnutí 45).
