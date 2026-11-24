# Příkazy terminálu na úrovni 2

Stav: návrh, iterace 2. Autor: projektant. Rozhodnutí 10: výstupy Windows **anglicky**
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

## 7. Otevřené otázky

1. Jazyk Windows ve škole (rozhodnutí 10): pokud jsou školní PC česky, dát ve výstupu přepínač
   EN/CZ, nebo jen českou poznámku pod anglickým výstupem?
2. Ukazovat v `arp -a` statické broadcastové řádky (pravdivé, ale je to šum) — rozhodne didaktik.
3. Všechna místa označená **ověřit**: jeden snímek `ipconfig`, `ipconfig /all`, `arp -a` ze
   školního PC (anglicky i česky) a `show mac address-table` z Packet Traceru vyřeší všechna.
