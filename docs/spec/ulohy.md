# Modelové situace (úlohy)

Stav: návrh projektanta, 2026-11-27; situace 3 upravena podle rozh. 69 (vývojář, implementace). Podklad: `docs/rozhodnuti.md` body 66 a 68 (kontext 39, 41, 59, 60).
Navazuje na `routing.md` kap. 9 (topologie úrovně 4), `cmd.md`, `arp.md`, `tcp.md` kap. 7.3, `vektory.md` kap. 10.
Zdroje: RFC 826 (ARP), RFC 5227 (IPv4 Address Conflict Detection), RFC 3927 (IPv4 link-local, APIPA),
RFC 1122 kap. 3.3.1 (výběr next hopu), RFC 9293 kap. 3.10.7.1 (RST na zavřený port), Microsoft Learn
(„Troubleshoot TCP/IP communication“, Event ID 4199). Vše, co je označeno **ověřit**, projektant nemá
z vlastního záznamu reálného provozu; seznam k pilotu je v kap. 7.

Dva druhy úloh (rozh. 66): **(a) nastavení** — student nastaví uzel, aby splnil cíl; **(b) „síť nejde“** —
student najde a opraví předpřipravenou chybu. Úloha se zadává odkazem (`#uloha=<id>[&seed=<n>]` (stejný styl jako `#u=4&k=21`)).

## 1. Společný model úlohy

### 1.1 Struktura (data, ne kód)

```json
{
  "id": "u05-bez-brany",
  "kind": "b",
  "base": "level4",
  "faults": [ { "kind": "config", "node": "PC1", "set": { "gateway": null } } ],
  "goal": { "node": "PC1", "command": "curl", "args": { "url": "http://www.skola.lan" },
            "success": { "http_status": 200 } },
  "checks": [ { "node": "PC1", "command": "ping", "args": { "dst": "192.168.2.20" }, "success": { "replies_min": 1 } } ],
  "allowed_fixes": [ "pc_ipv4_dialog" ],
  "hint_order": [ "ipconfig", "ping 192.168.1.1", "ping 192.168.2.10", "nslookup www.skola.lan" ]
}
```

- **`base`**: `level3` (`routing.md` kap. 7) nebo `level4` (`routing.md` kap. 9: Alice .10, Cyril .30 na SW1,
  R1 Gi0/0 .1 / Gi0/1 .1, SW2, Bob 192.168.2.20, SRV1 192.168.2.10 s DNS a webem `www.skola.lan`). Všechny
  situace v tomto dokumentu stojí na `level4` (cíl je web nebo ping přes router).
- **Výchozí stav tabulek**: ARP cache a MAC tabulky **prázdné** (na rozdíl od vektorů úrovně 4). Diagnostika
  pomocí `arp -a` dává smysl jen tehdy, když záznamy vznikají před očima studenta.
- **`faults[]`** — porucha = změna oproti `base` (nic jiného se nemění):

| `kind` | Parametry | Příklad | Situace |
|---|---|---|---|
| `link` | `link`, `connected: false`, `end` (`a`/`b`, který konec je vytažený) | kabel Alice vytažený z karty | 1 |
| `config` | `node`, `set` (`ip`, `prefix`, `gateway`, `dns_servers`) | brána `null`, IP s překlepem | 4, 5, 7, 11 |
| `service` | `node`, `app`, `running: false` | web na SRV1 neběží | 10 |
| `add_node` | uzel + linka (formát `vektory.md` kap. 2) | tiskárna s IP brány na SW1 Fa0/2 (rozh. 69) | 3 |

- **`goal`** — podmínka úspěchu, vždy **funkční** (výsledek příkazu v simulaci), ne porovnání konfigurace
  s „řešením“. Student, který zvolí jinou funkční cestu (např. jinou volnou IP), uspěje. Druhy:
  `http_status` (curl), `replies_min` (ping), `resolved` (nslookup vrátí A záznam).
- **`checks[]`** — doplňkové podmínky (co se opravou nesmí rozbít, např. „Cyril dál funguje“).
- **`allowed_fixes`** — které zásahy UI nabídne (kap. 2, kap. 3 u jednotlivých situací). Ostatní
  konfigurace je v úloze zamčená (student nemůže „opravit“ router, když chyba je na PC).

### 1.2 Vyhodnocení „funguje / nefunguje a proč“

Tlačítko „Vyhodnoť“ spustí `goal` (a `checks`) v simulaci na **kopii** sítě (stav studentovy sítě se
nemění) a z trace (přenosy + události `vektory.md` kap. 6) určí **první vrstvu, na které cíl selhal**.
Postup zdola nahoru, vrací se první nalezený důvod:

| Pořadí | Vrstva (TCP/IP / OSI) | Důvod (`reason`) | Jak se pozná v trace / stavu | Text pro studenta |
|---|---|---|---|---|
| 1 | síťové rozhraní (L1) | `link_down` | rozhraní zdroje nebo next hopu bez linky | „Kabel u … není zapojený. Bez fyzického spojení neprojde ani bit.“ |
| 2 | síťová (L3, konfigurace) | `no_address` | rozhraní nemá IP v žádné síti s cestou k cíli (APIPA 169.254.x.x) | „Alice nemá platnou IP adresu této sítě.“ |
| 3 | síťová (L3) | `no_route` | `ip_drop` u zdroje: „žádná cesta“ (chybí brána) | „Cíl je v jiné síti a Alice nemá výchozí bránu.“ |
| 4 | linková / síťová (L2/L3) | `arp_failed` | `arp_fail` u zdroje (next hop neodpověděl) | „Na ARP dotaz na … nikdo neodpověděl.“ + upřesnění (kap. 3.5) |
| 5 | linková / síťová (L2/L3) | `ip_conflict` | na jeden ARP request přišly odpovědi z různých MAC, nebo odpověď přišla z jiné MAC, než má cílový uzel | „Adresu … používají dvě zařízení.“ |
| 6 | aplikační (DNS) | `no_dns_server` / `dns_failed` | resolver nemá server / dotaz bez odpovědi | „Jméno se nepřeložilo na IP adresu.“ |
| 7 | transportní (L4) | `connection_refused` | na SYN přišel `RST, ACK` | „Server je dostupný, ale na portu 80 nikdo nenaslouchá.“ |
| 8 | aplikační (L7) | `http_error` | odpověď s jiným stavem než 200 | (zatím nepoužito) |
| — | — | `ok` | cíl splněn | „Funguje: curl dostal 200 OK.“ |

- Výsledek obsahuje i **„kde“** (uzel, rozhraní, krok trace), aby UI mohlo kliknutím skočit na místo
  v animaci/rentgenu. Vyhodnocení neprozrazuje opravu, jen místo a vrstvu; nápovědy (`hint_order`) jsou
  zvlášť a na vyžádání.
- Pořadí v tabulce = doporučený postup diagnostiky (kap. 6). Vyhodnocovač bere první selhání **na cestě
  k cíli** v čase, ne „nejnižší vrstvu kdekoli v síti“.
- **Simulátor zjednodušuje:** skutečný počítač nic jako „první vrstvu, která selhala“ neřekne; to je
  pomůcka učitele. Student má na závěr umět totéž zjistit sám příkazy (kap. 3).

## 2. Konfigurace PC

### 2.1 Doporučení: dialog „Vlastnosti protokolu IPv4“

Dialog podle klasického Windows (`ncpa.cpl` → Ethernet → Vlastnosti → Internet Protocol Version 4
(TCP/IPv4) → Vlastnosti). Je ve Windows 10 i 11 stejný, studenti ho najdou na školním PC, a Packet Tracer
(PC → Desktop → IP Configuration) má stejná pole. Nové „Nastavení“ Windows 11 (Upravit nastavení IP)
se mezi verzemi měnilo, proto ne.

Pole (anglicky podle Windows, v závorce česká Windows — **ověřit** přesné znění na školním PC):

| Pole | Hodnota v úloze 4 | Poznámka |
|---|---|---|
| ( ) Obtain an IP address automatically (Získat adresu IP ze serveru DHCP automaticky) | výchozí stav v úloze 4 | DHCP až v úrovni 5; bez serveru vznikne APIPA (kap. 3.3) |
| (•) Use the following IP address (Použít následující adresu IP) | — | |
| IP address (Adresa IP) | 192.168.1.10 | |
| Subnet mask (Maska podsítě) | 255.255.255.0 | Windows po opuštění pole IP **předvyplní masku podle třídy** (192.x → 255.255.255.0); simulátor to dělá také a v poznámce řekne, že je to zbytek třídního adresování |
| Default gateway (Výchozí brána) | 192.168.1.1 | |
| Preferred DNS server (Upřednostňovaný server DNS) | 192.168.2.10 | |
| Alternate DNS server (Náhradní server DNS) | prázdné | |
| [ ] Validate settings upon exit | neaktivní | **Simulátor zjednodušuje:** vynechat nebo zašednout |

Po „OK“ se konfigurace použije okamžitě (jako ve Windows; bez restartu). Ověření studentem: `ipconfig /all`
(kap. 2.3) a `ping`.

Zmínka pro pokročilé (v taháku, v simulátoru volitelně):
`netsh interface ip set address name="Ethernet" static 192.168.1.10 255.255.255.0 192.168.1.1` a
`netsh interface ip set dns name="Ethernet" static 192.168.2.10` (cmd jako správce). PowerShell
ekvivalent `New-NetIPAddress` jen zmínka. Linux (`ip addr`, netplan) mimo rozsah.

### 2.2 Validace (co Windows dovolí a co hlásí)

Simulátor napodobí Windows: tvrdé chyby odmítne, varování nechá potvrdit, zbytek přijme bez řečí — také
nesmysl, který Windows přijme (o tom jsou úlohy (b)). Texty **ověřit** (projektant je zná z běžně
publikovaných snímků, ne z vlastního záznamu):

| Vstup | Windows | Text (anglicky) | Simulátor |
|---|---|---|---|
| oktet > 255 | pole nedovolí | „255 is not a valid entry. Please specify a value between 0 and 255.“ (u 1. oktetu „between 1 and 223“) | stejně |
| 1. oktet 0, 127, ≥ 224 | odmítne | „… is not a valid entry. Please specify a value between 1 and 223.“; u 127 zvláštní hláška o loopbacku | stejně |
| maska nespojitá (255.0.255.0) | odmítne | „The subnet mask you have entered is not valid. Enter a valid subnet mask.“ | stejně |
| IP = adresa sítě (192.168.1.0/24) | odmítne | „The combination of IP address and subnet mask is invalid. All of the bits in the host address portion of the IP address are set to 0. Please enter a valid combination of IP address and subnet mask.“ | stejně |
| IP = broadcast (192.168.1.255/24) | odmítne | totéž, „… are set to 1 …“ | stejně |
| brána mimo síť IP a masky | **varuje, dovolí uložit** | „The default gateway is not on the same network segment (subnet) that is defined by the IP address and subnet mask. Do you want to save this configuration?“ (Yes/No) | stejně; situace 7 |
| brána = vlastní IP, brána = adresa sítě | ? | **ověřit** | přijmout (rozbije se až provoz) |
| IP shodná s jiným zařízením | dialog nic neřekne | konflikt zjistí OS po uložení (kap. 3.2) | stejně |
| prázdná IP u „Use the following“ | odmítne | **ověřit** text | odmítnout |
| DNS mimo síť | nic | — | přijmout (DNS server běžně bývá v jiné síti) |

### 2.3 `ipconfig /all` s DNS (doplněk `cmd.md` kap. 3)

V úloze se k výstupu `cmd.md` kap. 3 přidají řádky (pořadí podle Windows, za `Default Gateway`):

```
   Default Gateway . . . . . . . . . : 192.168.1.1
   DNS Servers . . . . . . . . . . . : 192.168.2.10
   NetBIOS over Tcpip. . . . . . . . : Enabled
```

- Bez nastaveného DNS Windows ukazuje `DNS Servers . . . : fec0:0:0:ffff::1%1` a další dvě IPv6 adresy
  (zastaralé site-local „výchozí“ servery). **Simulátor zjednodušuje:** IPv6 nemá, řádek vynechá; poznámka
  „Na školním PC tu uvidíš podivné adresy fec0:…, to je IPv6 náhradní hodnota, nefunguje.“ (**ověřit**.)
- Rozhraní bez kabelu: kap. 3.1.

## 3. Situace

U každé: výchozí stav (porucha), cíl, co student uvidí, co je v trace, oprava, co ověřit při pilotu.
Výstupy: Windows 10/11 anglicky, cmd.exe; `curl` = `curl.exe` 8.x (`cmd.md` kap. 17).

### 3.1 Situace 1 — odpojený kabel (L1, typ b)

- **Porucha:** `link` L1 (Alice–SW1), vytažený konec u Alice. V obrázku kabel visí, LED portu SW1 Fa0/1 nesvítí.
- **Cíl:** `curl http://www.skola.lan` z Alice → 200; check: ping Alice → 192.168.1.1.
- **Co uvidí:**

```
C:\Users\student>ipconfig

Windows IP Configuration


Ethernet adapter Ethernet:

   Media State . . . . . . . . . . . : Media disconnected
   Connection-specific DNS Suffix  . :

C:\Users\student>
```

  `ipconfig /all`: `Media State . . . : Media disconnected`, `Connection-specific DNS Suffix`, `Description`,
  `Physical Address`, `DHCP Enabled`, `Autoconfiguration Enabled` — **bez řádků IPv4, masky a brány**
  (statická konfigurace zůstává uložená v dialogu, ale rozhraní ji nepoužívá).

```
C:\Users\student>ping 192.168.1.1

Pinging 192.168.1.1 with 32 bytes of data:
PING: transmit failed. General failure.
PING: transmit failed. General failure.
PING: transmit failed. General failure.
PING: transmit failed. General failure.

Ping statistics for 192.168.1.1:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),
```

  `curl -v http://www.skola.lan` → `curl: (6) Could not resolve host: www.skola.lan`. `arp -a` → `No ARP Entries Found.`
- **Trace:** žádný přenos. Směrovací tabulka Alice nemá pro `eth0` žádnou cestu (Windows při odpojení
  odebere adresy a cesty rozhraní) → `ip_drop` „žádná cesta“ → `reason: link_down` (vyhodnocovač kontroluje
  linku dřív než cestu, tabulka v kap. 1.2).
- **Oprava:** kliknutím na volný konec kabelu (nebo na port karty) se kabel zapojí; „Media State“ zmizí,
  vrátí se IPv4 řádky. **Simulátor zjednodušuje:** Windows po zapojení zopakuje kontrolu konfliktu adresy
  (ARP Probe, kap. 3.2) a DHCP; simulátor jen pošle jedno ARP Announcement (gratuitous ARP), aby šlo vidět,
  že „karta ožila“ — **rozhodnout s vývojářem**, jinak nic.
- **Varianta pro situaci 13 (1b):** kabel vytažený na straně R1 Gi0/0 (L3). Alice má `ipconfig` v pořádku,
  `ping 192.168.1.1` → `Reply from 192.168.1.10: Destination host unreachable.` (ARP bez odpovědi, `cmd.md` 8.3),
  `ping 192.168.1.30` funguje. Na R1 `show ip interface brief` → `GigabitEthernet0/0 192.168.1.1 YES manual down down`.
- **Ověřit při pilotu:** přesný výstup `ipconfig` u odpojené karty se statickou IP (zda opravdu chybí IPv4
  řádky); text pingu bez linky (`General failure` vs. `Destination host unreachable`); `arp -a` bez záznamů
  (`No ARP Entries Found.`).

### 3.2 Situace 3 — konflikt IP adres (L2/L3, typ b)

**Jak to je ve skutečnosti (proč viník není PC):**

- RFC 5227 (Address Conflict Detection) kap. 2.1: před použitím adresy pošle stanice 3 **ARP Probe**
  (PROBE_NUM = 3, rozestup 1–2 s, po posledním čeká ANNOUNCE_WAIT = 2 s). ARP Probe = broadcast ARP request,
  **sender IP 0.0.0.0** (aby nezměnil cizí ARP cache), sender MAC = vlastní, target IP = zkoušená adresa,
  target MAC 00:00:00:00:00:00. Přijde-li v té době ARP (request nebo reply) se sender IP = zkoušená adresa,
  adresa je obsazená (kap. 2.1.1). Pak 2 **ARP Announcement** (sender IP = target IP = vlastní adresa;
  „gratuitous ARP“) s rozestupem 2 s (kap. 2.3).
- Za provozu (kap. 2.4): vidí-li stanice ARP se svou IP od cizí MAC, je to konflikt; smí (a) adresu
  přestat používat, (b) jednou se bránit Announcementem (DEFEND_INTERVAL 10 s), (c) bránit se trvale.
- **Windows** (od Vista) adresu před použitím zkouší. Při konfliktu statické adresy ji nepoužije:
  `ipconfig /all` ukáže `IPv4 Address. . . : 192.168.1.30(Duplicate)` a vedle toho
  `Autoconfiguration IPv4 Address. . : 169.254.x.y(Preferred)` s maskou 255.255.0.0; do protokolu událostí
  zapíše Event ID 4199 („The system detected an address conflict for IP address 192.168.1.30 with the system
  having network hardware address 02-00-00-00-00-03 …“). Windows 8+ už nezobrazuje okno „Windows has
  detected an IP address conflict“ (dřívější verze ano). Zdroje: Microsoft Learn Event ID 4199; SANS ISC
  diary 28380; **přesné řádky ipconfig ověřit**.
- Proto by konflikt dvou Windows PC skončil hned a zřetelně u toho, kdo přišel druhý. Skutečně záludný
  konflikt (provoz „chodí jen někdy“) vzniká, když jedno ze zařízení **detekci nemá**: levná síťová
  tiskárna, kamera, starší embedded zařízení se statickou IP. To je viník situace 3.

**Úloha (upraveno podle rozh. 69: tiskárna má IP brány, ne Cyrila):**

- **Porucha (`add_node`):** `PRT1` „Tiskárna“ — `type: "pc"` s `device: "printer"`, MAC 02:00:00:00:00:05,
  **192.168.1.1/24** (IP brány R1; někdo ji opsal z papírku jako „adresu tiskárny“), brána 192.168.1.1,
  TTL 64, `acd: false` (bez RFC 5227: nezkouší, neohlašuje, nebrání se), připojena na **SW1 Fa0/2**
  (volný port, linka L7). Tiskárna odpovídá na ARP a ping, žádné aplikace, pakety dál nepředává.
  Tiskárna **odpovídá pomaleji** (zpracování o 1 krok déle než PC; `proc_delay_steps: 1`) — **Simulátor
  zjednodušuje:** ve skutečnosti rozhoduje náhoda, kdo odpoví později; tady je pořadí pevné.
- Proč nikdo nic nehlásí: tiskárna sama nic nevysílá; její ARP odpovědi jsou unicast pro tazatele. R1
  (Cisco IOS) duplicitu zaznamená jen z paketů, které sám přijme (syslog `%IP-4-DUPADDR`), Alice nic.
- **Cíl:** `curl http://www.skola.lan` z Alice → 200 a check `ping 192.168.2.10` 4× ze 4 (stabilita).
- **Jak se projeví (pevné pořadí, vektor `uloha-konflikt-ip`):**
  1. Alice pošle ARP request „kdo má 192.168.1.1?“ (broadcast). Odpoví **oba**: R1 (u Alice v kroku 4)
     a tiskárna (krok 5). V rentgenu jsou na jeden dotaz **dvě odpovědi s různou MAC**.
  2. Alice pošle první paket routeru (první odpověď); druhá odpověď (tiskárna) podle RFC 826 (merge,
     `arp.md` kap. 4) záznam **přepíše** na MAC tiskárny. Další pakety do jiné sítě jdou tiskárně, ta je
     zahodí (cílová IP není její): `ping 192.168.2.10` vrátí první odpověď (TTL=63) a pak `Request timed out.`;
     web nejde (DNS dotaz ještě projde přes R1, SYN už jde tiskárně). Tím sedí příběh „jednou jde, jednou ne“.
  3. Vektor: `ping -n 2 192.168.1.1` → první odpověď od R1 `TTL=255`, druhá od tiskárny `TTL=64`.
     Stejná IP, jiné TTL = jiné zařízení.
  4. Záznam se „vrátí“ k R1 až po `arp -d` (nebo vypršení) a novém ARP; pak se zase přepíše na tiskárnu.
- **Jak to student odhalí:** (1) `arp -a` u Alice: `192.168.1.1   02-00-00-00-00-05`; (2) na R1 `show ip arp`
  → vlastní adresa rozhraní `192.168.1.1  -  0200.0000.0101` ≠ MAC v ARP cache Alice; (3) TTL 255 vs. 64
  v `ping 192.168.1.1`; (4) `show mac address-table` na SW1 → MAC 0200.0000.0005 na Fa0/2 → tiskárna.
- **Oprava:** klik na tiskárnu → „Nastavení sítě“ (napodobuje panel tiskárny) → IP 192.168.1.50 (volná).
  Pak u Alice `arp -d` (zastaralý záznam; vyhodnocovač jinak hlásí `arp_stale`) a znovu ping.
  Didaktická pointa: „opravit zdroj a pak vyčistit zastaralou cache“.
- **Vyhodnocení:** `ip_conflict` (next hop, jehož IP má v doméně L2 víc zařízení, nebo dvě odpovědi s různou
  MAC); po opravě bez `arp -d` `arp_stale`; tiskárna s jinou obsazenou adresou `ip_conflict_config`;
  odpojená tiskárna = „obejití, ne oprava“.
- **Navazující ukázka (volitelně, ne v situaci 13):** student nastaví Alici IP 192.168.1.30 v dialogu →
  Alice pošle 3 ARP Probe (SPA 0.0.0.0), Cyril odpoví → `ipconfig /all` ukáže `(Duplicate)` + APIPA. Ukazuje,
  proč Windows takový konflikt odhalí sám.
- **Ověřit při pilotu (priorita vysoká):** (1) zda Windows 10/11 při druhé ARP odpovědi na tentýž dotaz
  opravdu přepíše záznam (RFC 826 ano; Linux má `locktime` 1 s a ponechá první — u Windows projektant
  neví; když Windows ponechá první, úloha funguje stejně, jen tiskárna „vyhraje“ až při dalším ARP);
  (2) přesné řádky `(Duplicate)` a `Autoconfiguration IPv4 Address`; (3) text Event 4199.

### 3.3 Situace 4 — nastav Alici IP, masku, bránu a DNS (typ a)

- **Výchozí stav:** Alice je nový počítač: „Obtain an IP address automatically“, DHCP server v síti není
  → Windows si přidělí **APIPA** (RFC 3927): `Autoconfiguration IPv4 Address . . : 169.254.83.107(Preferred)`,
  maska 255.255.0.0, brána prázdná. Adresa v simulátoru deterministicky z MAC (169.254.x.y, x ∈ 1–254).
  **Simulátor zjednodušuje:** Windows zatím opakovaně posílá DHCP Discover; simulátor DHCP nemá (úroveň 5)
  a provoz nevykreslí. (Alternativa bez APIPA: prázdný dialog — Windows to neumí, proto ne.)
- **Zadání:** „Správce sítě ti přidělil: IP 192.168.1.10, maska 255.255.255.0, brána 192.168.1.1, DNS
  192.168.2.10.“ Cíl: `curl http://www.skola.lan` → 200; check: Cyril funguje.
- **Co uvidí před nastavením:** `ping 192.168.1.1` → `PING: transmit failed. General failure.` (cíl není
  v 169.254.0.0/16 a brána není; **ověřit** — Windows může u APIPA zkusit ARP rovnou, RFC 3927 kap. 2.6.2
  dovoluje link-local adresou mluvit s cílem na stejné lince). `curl` → `Could not resolve host`.
- **Vyhodnocení typických chyb** (vyhodnocovač kap. 1.2, text navíc):

| Chyba studenta | Výsledek | Text |
|---|---|---|
| zapomene bránu | `no_route` u DNS dotazu | situace 5 |
| zapomene DNS | `no_dns_server` | situace 11 |
| překlep v IP (jiná síť) | `arp_failed` na bránu | situace 7 |
| IP .30 (Cyril) | Windows zjistí konflikt (ARP Probe), `(Duplicate)` | „Tuhle adresu už má Cyril.“ |
| IP .1 (brána) | totéž, konflikt s R1 | „To je adresa brány.“ |
| jiná volná IP (např. .11) | funguje → `ok` | uznat; poznámka „správce ti dal .10“ |
| maska 255.255.0.0 | DNS/web funguje (Alice si myslí, že SRV1 je v její síti, posílá ARP na 192.168.2.10, R1 má proxy ARP a odpoví — rozh. 41) | **rozhodnout:** proxy ARP v simulátoru zatím není → vyhodnocovač tuto kombinaci odmítne textem „Maska neodpovídá síti 192.168.1.0/24“, bez simulace (označit „Simulátor zjednodušuje“) |

- **Ověřit při pilotu:** APIPA výstup `ipconfig` (řádek `Autoconfiguration IPv4 Address`); hláška pingu z APIPA.

### 3.4 Situace 5 — chybějící brána (L3, typ b)

- **Porucha:** `config` PC1 `gateway: null` (stejně jako vektor `ping-bez-brany`, rozh. 41).
- **Cíl:** `curl http://www.skola.lan` → 200.
- **Co uvidí:** `ipconfig` → `Default Gateway . . . :` prázdné. `ping 192.168.1.30` funguje (přímé doručení),
  `ping 192.168.2.10` → `PING: transmit failed. General failure.` ×4 (`cmd.md` 8.2; **ověřit**, priorita
  vysoká). `curl -v http://www.skola.lan` → `curl: (6) Could not resolve host: www.skola.lan` (DNS server je
  v jiné síti, dotaz se ani neodešle). `nslookup www.skola.lan` → **ověřit**; projektant očekává
  `DNS request timed out.` / `timeout was 2 seconds.` a na konci `*** Request to UnKnown timed-out`.
- **Trace:** žádný přenos mimo síť 1; `ip_drop` u Alice „žádná cesta k 192.168.2.10“ → `no_route`.
  Pozor: vyhodnocovač hlásí `no_route` (L3), ne `dns_failed`, protože DNS dotaz neopustil Alici kvůli L3.
- **Oprava:** dialog IPv4 → Default gateway 192.168.1.1.
- **Ověřit:** výstup `nslookup` bez brány; `route print` bez řádku 0.0.0.0 (`cmd.md` kap. 11).

### 3.5 Situace 7 — IP mimo síť, překlep (L3, typ b)

- **Porucha:** `config` PC1 `ip: 192.168.11.10` (zdvojená jednička), maska /24, brána 192.168.1.1, DNS
  192.168.2.10. Při uložení by Windows varovalo (kap. 2.2) — ve hře to „někdo odklikl“.
- **Cíl:** `curl http://www.skola.lan` → 200; check ping 192.168.1.30.
- **Chování (rozhodnutí projektanta, ověřit):**
  - Windows bránu mimo podsíť po potvrzení přijme a **považuje ji za přímo dosažitelnou** (posílá na ni ARP
    z rozhraní). Opora: návody poskytovatelů serverů (failover IP s bránou mimo podsíť na Windows Server
    fungují právě takto). **Ověřit**.
  - Alice tedy pošle ARP request SPA 192.168.11.10, TPA 192.168.1.1. **Cisco IOS na ARP request od odesílatele
    mimo podsíť rozhraní neodpoví** (debug ukazuje „wrong cable“). **Ověřit v Packet Traceru** — nejistota
    projektanta střední. Cyril request dostane (broadcast), ale TPA není jeho.
  - Po 3 pokusech `arp_fail` → `Reply from 192.168.11.10: Destination host unreachable.` (od vlastní IP,
    `cmd.md` 8.3) — i pro `ping 192.168.1.30`, protože 192.168.1.30 není v 192.168.11.0/24, jde tedy přes bránu.
  - Záložní model, pokud se ověření nepotvrdí: Windows bránu mimo podsíť nepoužije → `PING: transmit failed.
    General failure.` Pro úlohu je výsledek rovnocenný (vyhodnocení `no_route` místo `arp_failed`).
- **Co uvidí:** `ipconfig` → `IPv4 Address . . : 192.168.11.10` (student porovná síťovou část s bránou:
  192.168.11 vs. 192.168.1); `arp -a` → `Interface: 192.168.11.10 --- 0x4` a žádný záznam brány;
  `curl` → `Could not resolve host` (DNS přes bránu neprojde, ARP brány selhal).
- **Vyhodnocení:** `arp_failed`, upřesnění „IP adresa Alice 192.168.11.10 a brána 192.168.1.1 nejsou ve stejné
  síti (maska /24 → porovnej první 3 oktety)“.
- **Oprava:** dialog IPv4 → IP 192.168.1.10.

### 3.6 Situace 10 — web neodpovídá, služba neběží (L4/L7, typ b)

- **Porucha:** `service` SRV1 `web` (nginx) `running: false`. DNS běží.
- **Cíl:** `curl http://www.skola.lan` → 200.
- **Co uvidí u Alice:** `ping 192.168.2.10` → odpovědi `TTL=63` (L3 v pořádku); `nslookup www.skola.lan` →
  správná odpověď (`cmd.md` kap. 15); `curl -v`:

```
C:\Users\student>curl -v http://www.skola.lan
* Host www.skola.lan:80 was resolved.
* IPv6: (none)
* IPv4: 192.168.2.10
*   Trying 192.168.2.10:80...
* connect to 192.168.2.10 port 80 from 192.168.1.10 port 49152 failed: Connection refused
* Failed to connect to www.skola.lan port 80 after 0 ms: Couldn't connect to server
* closing connection #0
curl: (7) Failed to connect to www.skola.lan port 80 after 0 ms: Couldn't connect to server
```

  Formát curl 8.x (starší 7.x: `Failed to connect to … port 80: Connection refused`) — **ověřit** verzí na
  školním PC. Windows po RST zkouší SYN ještě 2× (`tcp.md` kap. 7.3), proto reálně „after ~2000 ms“;
  **Simulátor zjednodušuje:** jeden pokus, `after 0 ms` (stejná konvence jako `time<1ms`).
  `netstat -an` u Alice: žádné spojení na :80.
- **Na SRV1:**

```
student@srv1:~$ ss -tuln
Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
udp   UNCONN 0      0            0.0.0.0:53        0.0.0.0:*
tcp   LISTEN 0      10           0.0.0.0:53        0.0.0.0:*
student@srv1:~$ systemctl status nginx
○ nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: inactive (dead) since Fri 2026-11-27 07:55:00 CET; 5min ago
```

  (chybí řádek `0.0.0.0:80`; `systemctl status` formát Debian 13 / systemd 257 — **ověřit**, zda `Loaded:`
  cesta je `/usr/lib/systemd/system/`.)
- **Trace:** SYN Alice → SRV1:80, odpověď `RST, ACK` (seq 0, ack = ISN Alice + 1, RFC 9293 kap. 3.10.7.1)
  → `connection_refused`. Vektor `uloha-web-rst`.
- **Oprava — rozhodnutí: v terminálu SRV1 `sudo systemctl start nginx`.** Zdůvodnění: diagnóza je
  v terminálu (`ss -tuln`), oprava má být tamtéž a stejným nástrojem, jaký student potká v praxi i na VŠ
  (systemd je na Debianu/Ubuntu standard). Tlačítko „Spustit službu“ by schovalo, že služba = proces, který
  otevře naslouchající socket. Uznat i `sudo systemctl restart nginx` a `sudo service nginx start`.
  **Simulátor zjednodušuje:** `sudo` se neptá na heslo. Po startu `ss -tuln` ukáže `tcp LISTEN 0 511 0.0.0.0:80`.
- **Poznámka pro učitele:** „služba neběží“ (RST, okamžitá chyba) vs. „firewall zahazuje“ (SYN bez odpovědi,
  `curl: (28) … Timeout was reached` po desítkách sekund) — druhá varianta je odložená.
- **Ověřit:** přesná verbose hláška curl 8.x na Windows při RST; formát `systemctl status`.

### 3.7 Situace 11 — nastav DNS server (typ a)

- **Výchozí stav:** Alice má IP 192.168.1.10/24 a bránu 192.168.1.1, **DNS prázdné** (`dns_servers: []`).
- **Zadání:** „Web na 192.168.2.10 přes IP funguje, přes jméno ne. Nastav Alici DNS server školy (192.168.2.10).“
  Cíl: `curl http://www.skola.lan` → 200.
- **Co uvidí:**

```
C:\Users\student>ping www.skola.lan
Ping request could not find host www.skola.lan. Please check the name and try again.

C:\Users\student>curl http://www.skola.lan
curl: (6) Could not resolve host: www.skola.lan

C:\Users\student>curl http://192.168.2.10
<!DOCTYPE html> …   (stránka se načte)

C:\Users\student>nslookup www.skola.lan
*** Default servers are not available
Server:  UnKnown
Address:  127.0.0.1

*** UnKnown can't find www.skola.lan: No response from server
```

  (text `nslookup` bez serveru **ověřit**.) `ipconfig /all`: bez řádku `DNS Servers` (kap. 2.3).
- **Trace:** u `curl` jménem žádný přenos; událost resolveru „žádný DNS server“ → `no_dns_server`.
  U `curl` přes IP celé spojení jako vektor `tcp-handshake-http`.
- **Oprava:** dialog IPv4 → Preferred DNS server 192.168.2.10; ověřit `nslookup www.skola.lan` (`cmd.md` kap. 15).
- **Pointa:** jméno → IP dělá DNS (aplikační vrstva), bez něj funguje vše „pod ním“.
- **Ověřit:** výstup `nslookup` bez DNS serveru; text `ping` u nepřeložitelného jména.

## 4. Situace 13 — „síť nejde“ s náhodnou chybou

### 4.1 Výběr chyby ze seedu

- Odkaz: `#uloha=13&seed=<celé číslo>`. Bez `seed` ho UI vygeneruje a **zobrazí v adrese** (učitel ho opíše
  a dá všem stejný odkaz, nebo každý dostane svůj).
- Výběr: `index = fnv1a32("u13|" + seed) mod N` (stejná funkce jako ISN, `tcp.md` kap. 4; žádný
  `Math.random`). Případné parametry varianty (např. která číslice v IP je zdvojená) z
  `fnv1a32("u13|" + seed + "|p")`.
- Vždy právě **jedna** chyba (kombinace dvou chyb až po pilotu; zmást se dá i jednou).

| # | Chyba | Z situace | `faults` | Vyhodnocení |
|---|---|---|---|---|
| 0 | kabel Alice vytažený u PC | 1 | `link` L1, konec `a` | `link_down` |
| 1 | kabel vytažený u R1 Gi0/0 | 1b | `link` L3, konec `a` | `arp_failed` (brána neodpovídá) → upřesnění „zkontroluj fyzické spojení k bráně“ |
| 2 | tiskárna s IP brány (rozh. 69) | 3 | `add_node` PRT1 | check: ping 192.168.2.10 4×; `ip_conflict` |
| 3 | chybí brána | 5 | `gateway: null` | `no_route` |
| 4 | IP 192.168.11.10 | 7 | `ip` | `arp_failed` / `no_route` (kap. 3.5) |
| 5 | IP 192.168.10.10 (překlep jinak) | 7 | `ip` | totéž, jiná hodnota (aby si studenti neopisovali) |
| 6 | web neběží | 10 | `service` web | `connection_refused` |
| 7 | chybí DNS | 11 | `dns_servers: []` | `no_dns_server` |

Cíl situace 13 je společný (`curl http://www.skola.lan` z Alice → 200), u chyby 2 navíc ping 192.168.2.10 4× ze 4
(stabilita). Zadání pro studenta: „Alice hlásí, že jí nejde školní web. Zjisti,
kde je chyba, a oprav ji.“ Všechny opravy z kap. 3 jsou povolené (dialog IPv4 u Alice, kabely, tiskárna,
terminál SRV1).

### 4.2 Doporučený postup diagnostiky (od L1 nahoru)

| Krok | Otázka | Příkaz / pohled | Dobrý výsledek |
|---|---|---|---|
| 1 | Je kabel zapojený? (L1) | `ipconfig` (Media disconnected?), obrázek: LED portu | IPv4 řádky jsou vidět |
| 2 | Má Alice správnou IP, masku, bránu, DNS? (L3 konfigurace) | `ipconfig /all` | IP v síti brány, brána vyplněná, DNS Servers |
| 3 | Dosáhnu na bránu? (L2/L3 v místní síti) | `ping 192.168.1.1`, pak `arp -a` | odpovědi; v `arp -a` záznam brány |
| 4 | Dosáhnu na server přes router? (L3) | `ping 192.168.2.10` (`tracert -d` volitelně) | TTL=63 |
| 5 | Přeloží se jméno? (DNS) | `nslookup www.skola.lan` | Address 192.168.2.10 |
| 6 | Odpovídá služba? (L4/L7) | `curl -v http://www.skola.lan`; na SRV1 `ss -tuln` | 200 OK / LISTEN na :80 |
| — | Odpovídá ten, koho čekám? (konflikt) | `arp -a` + `ipconfig /all` na cílovém PC; TTL v pingu | MAC sedí |

- Tahle tabulka patří i do taháku (`prirucka/tahak.md`) jako „postup, když síť nejde“. Odpovídá metodě
  „bottom-up“ z CCNA (Cisco: troubleshooting methods bottom-up / top-down / divide-and-conquer); pro
  začátečníka je bottom-up nejjistější.
- Kroky 3–4 se dají zkrátit „divide and conquer“ (rovnou ping na server); v poznámce zmínit, ne vyžadovat.

## 5. Nové klíče ve vektorech (doplněk `vektory.md`, zpětně kompatibilní)

- **Linka:** `connected` (bool, výchozí `true`). `false` = kabel vytažený; rozhraní na obou koncích je bez
  linky (Media disconnected, Cisco `down down`); hostitel nemá pro rozhraní adresy ani cesty
  (`routing_table` odvozená = prázdná).
- **Uzel:** `device` (text pro UI, např. `printer`); `acd` (bool; `true` = RFC 5227 při změně konfigurace /
  zapojení, výchozí `true` pro `pc` a `server`, `false` jinak); `proc_delay_steps` (číslo, výchozí 0;
  o kolik kroků později uzel odešle odpověď na přijatý rámec).
- **Aplikace:** `apps[].running` (bool, výchozí `true`); `false` = služba zastavená, socket neexistuje
  (TCP → RST, UDP → `udp_no_listener`).
- **`app_result` pro `http_get`:** při chybě `status: null`, `error`: `connection_refused` | `no_route` |
  `timeout`; pro `dns_resolve` `error: "no_dns_server"`.
- **`app_result.errors[].kind`** pro ping: navíc `link_down` (rozhraní bez linky).

## 6. Vektory

Generátor `tools/vectors/gen6.py` (`python3 tools/vectors/gen6.py tests/vectors`). Jádro je umí (iterace 5), `skip` už nemají.
V `uloha-web-rst` je událost u SRV1 `tcp_rst` (jádro RST na zavřený port nezapisuje jako změnu stavu `tcp_state`).

| Soubor | Co ověřuje | Přenosů |
|---|---|---|
| `uloha-kabel.json` | situace 1: L1 `connected: false`, prázdná odvozená směrovací tabulka Alice, ping bez přenosu, chyba `link_down` | 0 |
| `uloha-konflikt-ip.json` | situace 3 (rozh. 69): jeden ARP request na bránu, dvě odpovědi (R1 krok 4, tiskárna krok 5), přepis ARP cache podle RFC 826, `ping -n 2 192.168.1.1`: TTL 255 od R1, pak TTL 64 od tiskárny; MAC tabulka SW1 s Fa0/2 | 16 |
| `uloha-web-rst.json` | situace 10: web `running: false`, SYN → `RST, ACK` (seq 0, ack ISN+1, okno 0) přes router, `connection_refused`, žádné TCP spojení na konci | 8 |

## 7. Ověřit při pilotu (souhrn, priorita)

1. **Vysoká:** Windows u druhé ARP odpovědi na tentýž dotaz — přepíše, nebo ponechá první? (situace 3)
2. **Vysoká:** Cisco IOS / Packet Tracer — odpoví R1 na ARP request od 192.168.11.10 na Gi0/0 (192.168.1.1/24)?
   A Windows: pošle ARP na bránu mimo podsíť? (situace 7)
3. **Vysoká:** `ping` bez brány a bez kabelu — `General failure` vs. `Destination host unreachable`.
4. Střední: `ipconfig` u odpojené karty se statickou IP; `(Duplicate)` + `Autoconfiguration IPv4 Address`; APIPA výstup.
5. Střední: hlášky dialogu IPv4 (kap. 2.2), zejména brána mimo síť a adresa sítě/broadcastu; české znění.
6. Střední: `nslookup` bez DNS serveru a bez brány; `curl` 8.x při RST na Windows (verbose řádky, čas).
7. Nízká: `systemctl status nginx` na Debianu 13; `DNS Servers fec0:…` bez nastaveného DNS.

Postup ověření na školním PC: statická IP bez brány → `ping 192.168.2.10`, `nslookup`; vytáhnout kabel →
`ipconfig`, `ping`; nastavit IP souseda → `ipconfig /all`; v Packet Traceru topologie úrovně 4 s IP Alice
192.168.11.10 a `debug arp` na routeru.
