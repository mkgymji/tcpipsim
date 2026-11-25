# ARP (Address Resolution Protocol)

Stav: návrh, iterace 1. Zdroj: RFC 826; RFC 1122 2.3.2 (požadavky na hostitele); RFC 1812 3.3.2
(routery). Ověřeno na rfc-editor.org 2026-11-24.

## 1. Účel

ARP zjistí MAC adresu k IPv4 adrese **v téže síti** (v téže broadcastové doméně). Hostitel ho
používá, když chce poslat paket dalšímu skoku: buď přímo cíli (cíl je ve stejné síti), nebo
výchozí bráně. **ARP se nikdy neptá na adresu za routerem** — typická miskoncepce, kterou
simulátor vyvrací (vektor `ping-router`: Alice se ptá na 192.168.1.1, ne na Boba 192.168.2.20).

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
Příkazy: Windows `arp -a`, `arp -d`; Cisco `show ip arp` (= `show arp`), `clear arp-cache`.

### 5.1 Doba platnosti (zjednodušeně)

RFC 1122 2.3.2.1: implementace MUSÍ mít mechanismus, jak zastaralé záznamy odstranit; je-li to
časový limit, SHOULD být nastavitelný a má se **obnovit, když uzel uvidí ARP zprávu od dotyčného**
(„refreshed by observing the source fields … of an ARP broadcast“).

| Uzel | Doba platnosti v simulaci (`arp_timeout`) | Realita |
|---|---|---|
| PC, server | 300 s | Windows/Linux: stavový automat NUD — „reachable“ náhodně 15–45 s, pak „stale“ a ověření při dalším použití; v `arp -a` záznam zůstává déle |
| router | 14 400 s (4 h) | Cisco IOS výchozí `arp timeout 14400` (4 h); `show ip arp` ukazuje stáří v minutách |

Pravidla simulace:
1. Záznam vznikne nebo se obnoví (age := 0) **jen z přijaté ARP zprávy** podle algoritmu kap. 4.
   Odeslání paketu ani přijetí IP paketu stáří neobnovuje.
2. Když age dosáhne `arp_timeout`, záznam zmizí (událost `arp_expire`). Další paket na tuto IP
   spustí nový ARP request (fronta, kap. 6).
3. Statické záznamy (`type: static`) nestárnou a příchozí ARP je nepřepíše.
4. `arp -d` (Windows) a `clear arp-cache` (IOS) smažou dynamické záznamy hned; to je hlavní
   způsob, jak si ve scénáři ARP zopakovat (čekat 300 s je nepraktické). Simulátor může nabídnout
   i „posunout čas“.

Simulátor zjednodušuje: jedna pevná doba platnosti místo stavového automatu NUD (RFC 4861 kap. 7.3
pro IPv6; Windows i Linux ho používají i pro IPv4). Na VŠ/CCNA se nic neodnaučuje: platí „záznam
po čase vyprší a ARP se zopakuje“; hodnoty jsou nastavitelné a v detailu je věta „Skutečný Windows
záznam ověřuje už po desítkách sekund, Cisco router si ho pamatuje 4 hodiny.“

Cisco `show ip arp` vypisuje i vlastní adresy rozhraní (stáří „-“). Simulátor je v datech
(ARP cache ve vektorech) **neuvádí**; výpis je doplní (`cmd.md` kap. 10.3). Windows `arp -a`
podobně doplní statické broadcastové řádky (`cmd.md` kap. 4).

## 6. Čekání na odpověď (fronta) a neúspěch

Rozhodnutí 9: výchozí chování podle RFC (fronta), i na routeru.

### 6.1 Fronta

- Paket, který čeká na ARP, se **uloží do fronty**, ne zahodí (RFC 1122 2.3.2.2: „SHOULD save
  (rather than discard) at least one (the latest) packet“; RFC 1812 3.3.2: routery „SHOULD queue
  up to a small number of datagrams briefly“).
- Fronta je **na uzel a IP next hopu** (ne na cílovou IP paketu): pakety různým cílům přes
  stejnou bránu čekají na jeden ARP. Max. 3 pakety; při přeplnění se zahodí nejstarší
  (událost `ip_drop`, detail „fronta ARP plná“).
- Pokud na next hop už ARP běží, nový paket se jen přidá do fronty — **druhý request se neposílá**
  dřív než za 1 s (RFC 1122 2.3.2.1: max. 1 ARP request za sekundu na cíl).
- Po přijetí ARP reply (nebo requestu, ze kterého vznikne záznam) se pakety z fronty odešlou
  v pořadí příchodu, v tomtéž kroku (zpracování v uzlu trvá 0 kroků, `model.md` kap. 7).
- Události: `arp_queue` (paket uložen, request odeslán), `arp_learn` (záznam vznikl, fronta odeslána).

### 6.2 Opakování a neúspěch

- Neodpoví-li nikdo: request se zopakuje, **celkem 3 pokusy, interval 1 s** (časy 0, 1, 2 s od
  prvního). Po 1 s od posledního pokusu (čas 3 s) je ARP neúspěšný: událost `arp_fail`, pakety
  z fronty se zahodí. Vektor `ping-spatna-brana`.
- **Hostitel:** aplikace dostane chybu „cíl nedostupný“. Windows `ping` vypíše odpověď od **vlastní**
  IP: `Reply from 192.168.1.10: Destination host unreachable.` — na lince žádný ICMP paket není
  (Microsoft: „Destination host unreachable error means that the ARP requests that are sent by the
  node aren't getting a response“, learn.microsoft.com, Troubleshoot TCP/IP communication).
- **Router:** pro **jeden** z paketů ve frontě pošle zdroji ICMP Destination Unreachable, kód 1
  (host unreachable); ostatní zahodí bez hlášení (RFC 1812 3.3.2 a 5.2.7.1). Zdrojová IP ICMP =
  adresa rozhraní, kterým zpráva odchází (RFC 1812 4.3.2.4). Windows pak vypíše
  `Reply from 192.168.1.1: Destination host unreachable.` — **od routeru**. Rozdíl „od sebe / od
  routeru“ je pro diagnostiku podstatný a scénář ho může využít.
  **Ověřit:** zda Cisco IOS při neúspěšném ARP ICMP 3/1 opravdu posílá (projektant si není jistý;
  Packet Tracer v této situaci podle zkušenosti ukazuje spíš `Request timed out.`). Pokud ne,
  simulátor zůstane u RFC a označí: „Simulátor se drží RFC; skutečný Cisco router paket často
  zahodí bez hlášení a ping vypíše Request timed out.“
- Počet a interval opakování jsou zjednodušení (Windows, Linux i Cisco se liší: Cisco opakuje
  ARP request po 2 s, ověřit); hodnoty `arp_retries` = 3, `arp_retry_interval` = 1 s jsou
  nastavitelné v jádře a vektory s nimi počítají.

### 6.3 Cisco a první ztracený ping

Cisco IOS **první paket čekající na ARP zahodí** (proto první ping z routeru do nové sítě vypíše
`.!!!!`, Packet Tracer stejně). Simulátor ve výchozím stavu frontuje i na routeru (rozhodnutí 9,
podle RFC, bez ztráty) a v detailu řekne: „Skutečný Cisco router první paket při čekání na ARP
zahodí, proto v Packet Traceru uvidíš u prvního pingu tečku.“ Volba „věrnost Cisco“ až v úrovni 5.

## 7. Mimo rozsah této iterace

Gratuitous ARP / ARP announcement a probe (RFC 5227); proxy ARP (RFC 1027) — pozor, na Cisco
IOS je proxy ARP na rozhraních ve výchozím stavu zapnuté, simulátor ho nemá (router odpovídá jen
na dotazy na vlastní IP), což ovlivní jen scénáře se špatně nastavenou maskou; statické záznamy
z CLI (`arp -s`, `arp` v IOS) — jen datová podpora `type: static`, chování stejné jako dynamic
bez stárnutí a bez přepisu z příchozích zpráv.
