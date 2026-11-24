# ARP (Address Resolution Protocol)

Stav: návrh, iterace 1. Zdroj: RFC 826; RFC 1122 2.3.2 (požadavky na hostitele); RFC 1812 3.3.2
(routery). Ověřeno na rfc-editor.org 2026-11-24.

## 1. Účel

ARP zjistí MAC adresu k IPv4 adrese **v téže síti** (v téže broadcastové doméně). Hostitel ho
používá, když chce poslat paket dalšímu skoku: buď přímo cíli (cíl je ve stejné síti), nebo
výchozí bráně. **ARP se nikdy neptá na adresu za routerem** — typická miskoncepce, kterou
simulátor vyvrací (vektor `ping-router`: PC1 se ptá na 192.168.1.1, ne na server).

ARP zpráva je přímo v rámci (EtherType `0x0806`), není v IP paketu.

## 2. Formát zprávy — pole pro rentgen

Pro Ethernet a IPv4 má zpráva 28 bajtů (RFC 826, „Packet format“).

| Pole (RFC 826) | Běžný název | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|---|
| ar$hrd | Hardware type (HTYPE) | 16 | typ linkové vrstvy | `1` (Ethernet) |
| ar$pro | Protocol type (PTYPE) | 16 | typ síťové adresy | `0x0800` (IPv4) |
| ar$hln | Hardware size (HLEN) | 8 | délka MAC v bajtech | `6` |
| ar$pln | Protocol size (PLEN) | 8 | délka IP v bajtech | `4` |
| ar$op | Opcode (OPER) | 16 | druh zprávy | `1` = request, `2` = reply |
| ar$sha | Sender MAC | 48 | MAC odesílatele | MAC odesílajícího rozhraní |
| ar$spa | Sender IP | 32 | IP odesílatele | IP odesílajícího rozhraní |
| ar$tha | Target MAC | 48 | MAC cíle | request: `00:00:00:00:00:00`; reply: MAC tazatele |
| ar$tpa | Target IP | 32 | hledaná / cílová IP | request: hledaná IP; reply: IP tazatele |

- RFC 826 říká, že tazatel ar$tha v requestu „nenastavuje na nic konkrétního“. Windows i Linux
  posílají nuly; simulátor také nuly.
- Rámec s ARP: 14 B hlavička + 28 B ARP + 18 B výplň = 60 B (bez FCS).
- Wireshark popisuje request jako „Who has 192.168.1.20? Tell 192.168.1.10“ a reply jako
  „192.168.1.20 is at 02:00:00:00:00:02“. UI může použít český ekvivalent.

## 3. Odeslání

**ARP request:** rámec s cílovou MAC `ff:ff:ff:ff:ff:ff` (broadcast), zdrojová MAC = MAC rozhraní,
opcode 1, SHA/SPA = já, THA = nuly, TPA = hledaná IP.

**ARP reply:** **unicast** přímo tazateli (RFC 826: „send the packet to the (new) target hardware
address“), cílová MAC rámce = SHA z requestu; opcode 2; SHA/SPA = já; THA/TPA = tazatel.

## 4. Příjem (algoritmus RFC 826, „Packet Reception“)

```
pokud HTYPE ≠ 1 nebo PTYPE ≠ 0x0800: zahodit
merge := false
pokud SPA už je v mé ARP cache:
    aktualizuj MAC u SPA na SHA, obnov stáří;  merge := true
pokud TPA je moje IP adresa (na přijímacím rozhraní):
    pokud ne merge: přidej záznam SPA → SHA
    pokud opcode = request: pošli reply (kap. 3)
jinak: nic dalšího (zpráva není pro mě)        // událost arp_ignore
```

Důsledky, které ukazují vektory:
1. **Dotazovaný si zapamatuje tazatele** už z requestu. Proto cíl pingu při odpovědi (Echo Reply)
   ARP dotaz neposílá — MAC tazatele už zná.
2. **Ostatní stanice** v síti request dostanou (broadcast), ale záznam si **nevytvoří**, pokud
   tazatele už v cache nemají (jen aktualizují existující). Proto PC3 má po pingu PC1→PC2
   prázdnou ARP cache.
3. Tazatel si záznam vytvoří z ARP reply (je v něm TPA = jeho IP).

Simulátor zjednodušuje: reálné OS se v detailech liší (Linux si např. z cizího requestu
může vytvořit záznam ve stavu STALE). Simulátor se drží RFC 826, což odpovídá Cisco IOS i Windows
v pozorovatelném chování `arp -a` — **ověřit na reálném provozu** (otevřená otázka v README).

## 5. ARP cache

Záznam: `ip`, `mac`, `if` (rozhraní), `type` (`dynamic` / `static`), `age`.
Příkazy: Windows `arp -a`, `arp -d`; Cisco `show ip arp`, `clear arp-cache`.

| Uzel | Výchozí doba platnosti dynamického záznamu v simulaci | Realita |
|---|---|---|
| PC, server | 300 s | Windows: „reachable time“ náhodně 15–45 s, pak ověřování (NUD); Linux podobně |
| router | 14 400 s (4 h) | Cisco IOS výchozí ARP timeout 4 h |

Simulátor zjednodušuje: u hostitelů jedna pevná doba místo stavového automatu NUD (RFC 4861
má NUD pro IPv6, Windows/Linux ho používají i pro IPv4). Pro výuku stačí „záznam po čase vyprší“.

Cisco `show ip arp` vypisuje i vlastní adresy rozhraní (stáří „-“). Simulátor je v datech
(ARP cache ve vektorech) **neuvádí**; UI je může doplnit při výpisu.

## 6. Čekání na odpověď (fronta) a neúspěch

- Paket, který čeká na ARP, se **uloží do fronty**, ne zahodí (RFC 1122 2.3.2.2: „SHOULD save
  (rather than discard) at least one (the latest) packet“; RFC 1812 3.3.2: routery „SHOULD queue
  up to a small number of datagrams“). Simulace: fronta max. 3 pakety na cílovou IP, při přeplnění
  se zahodí nejstarší. Událost `arp_queue`.
- Neodpoví-li nikdo: request se zopakuje, celkem 3 pokusy po 1 s. Pak se pakety z fronty zahodí.
  - Hostitel: aplikace dostane chybu. Windows `ping` v téže síti vypíše odpověď od **vlastní**
    IP „Destination host unreachable“ (žádný ICMP paket na lince!) — ověřit přesné české znění.
  - Router: pošle zdroji ICMP Destination Unreachable, kód 1 (host unreachable) — RFC 1812
    3.3.2 to umožňuje až po neúspěšném ARP; Cisco to dělá s omezením četnosti (ověřit).
- Počet a interval opakování jsou zjednodušení (Windows/Linux/Cisco se liší); hodnota je
  nastavitelná v jádře.

Otevřená otázka: **Cisco IOS první paket čekající na ARP zahodí** (proto první ping z routeru
vypíše `.!!!!`). Simulátor ve výchozím stavu frontuje i na routeru (podle RFC, bez ztráty).
Zda nabídnout „věrnost Cisco“ přepínačem, viz `README.md`.

## 7. Mimo rozsah této iterace

Gratuitous ARP / ARP announcement a probe (RFC 5227); proxy ARP (RFC 1027) — pozor, na Cisco
IOS je proxy ARP na rozhraních ve výchozím stavu zapnuté, simulátor ho nemá (router odpovídá jen
na dotazy na vlastní IP), což ovlivní jen scénáře se špatně nastavenou maskou; statické záznamy
z CLI (`arp -s`, `arp` v IOS) — jen datová podpora `type: static`, chování stejné jako dynamic
bez stárnutí a bez přepisu z příchozích zpráv.
