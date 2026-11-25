# DNS (Domain Name System)

Stav: návrh, iterace 4 (rozhodnutí 59). Autor: projektant. Zdroj: **RFC 1035** (formát zpráv),
RFC 1034 (koncepce), RFC 2181 (TTL), RFC 6895 (registry příznaků), Wireshark 4.x pro názvy polí.
Vektor: `dns-dotaz`.

## 1. Co úroveň 4 ukazuje

Před spojením na `http://www.skola.lan` musí Alice zjistit IP adresu. Resolver operačního systému
pošle **DNS dotaz** (typ A = IPv4 adresa) přes **UDP na port 53** DNS serveru z vlastní konfigurace
(`ipconfig /all` → DNS Servers 192.168.2.10). SRV1 je pro zónu `skola.lan` **autoritativní** (má ji
ve vlastní konfiguraci) a odpoví. Výsledek si Windows uloží do DNS cache na dobu TTL záznamu
(`ipconfig /displaydns`). Jedna myšlenka: „jméno → IP adresa, a teprve pak TCP na IP:port“.

Simulátor zjednodušuje: SRV1 odpovídá jen ze své zóny; rekurzivní dotazy do internetu (kořenové
servery, `.cz`) nejsou — přijdou s NAT v úrovni 5. Jméno mimo zónu → odpověď RCODE 3 (NXDOMAIN),
viz kap. 5.

## 2. Zpráva — pole pro rentgen (RFC 1035 kap. 4.1)

Zpráva má hlavičku (12 B) a 4 sekce: Question, Answer, Authority, Additional.

### 2.1 Hlavička (kap. 4.1.1)

| # | Česky | Wireshark / filtr | Bity | Dotaz | Odpověď | Vysvětlení | Z |
|---|---|---|---|---|---|---|---|
| 1 | Identifikátor | Transaction ID / `dns.id` | 16 | 1 | 1 (zkopírováno) | Podle něj klient pozná, ke kterému dotazu odpověď patří. | ● |
| 2 | QR | Response / `dns.flags.response` | 1 | 0 = dotaz | 1 = odpověď | | ● |
| 3 | Opcode | Opcode / `dns.flags.opcode` | 4 | 0 = standardní dotaz | 0 | | |
| 4 | AA | Authoritative / `dns.flags.authoritative` | 1 | 0 | **1** | Odpovídá server, který zónu spravuje. Bez AA vypíše `nslookup` „Non-authoritative answer:“. | ● |
| 5 | TC | Truncated / `dns.flags.truncated` | 1 | 0 | 0 | Odpověď se nevešla do UDP (512 B bez EDNS) → zopakovat přes TCP. | |
| 6 | RD | Recursion desired / `dns.flags.recdesired` | 1 | 1 | 1 (zkopírováno) | Klient chce, aby server odpověď sehnal i jinde. | |
| 7 | RA | Recursion available / `dns.flags.recavail` | 1 | 0 | 0 | Server rekurzi nenabízí (jen vlastní zóna, kap. 5). | |
| 8 | Z | Z, AD, CD / `dns.flags.z`, `.authenticated`, `.checkdisable` | 3 | 0 | 0 | RFC 1035: rezervováno; RFC 4035 z něj použil 2 bity pro DNSSEC. Rentgen: jeden šedý řádek „rezervováno / DNSSEC“. | |
| 9 | RCODE | Reply code / `dns.flags.rcode` | 4 | 0 | 0 = No error | 3 = NXDOMAIN (jméno neexistuje). | |
| 10 | QDCOUNT | Questions / `dns.count.queries` | 16 | 1 | 1 | Počet otázek. | |
| 11 | ANCOUNT | Answer RRs / `dns.count.answers` | 16 | 0 | 1 | Počet odpovědí. | ● |
| 12 | NSCOUNT | Authority RRs / `dns.count.auth_rr` | 16 | 0 | 0 | | |
| 13 | ARCOUNT | Additional RRs / `dns.count.add_rr` | 16 | 0 | 0 | | |

Pole 2–9 tvoří 16bitové slovo **Flags**: dotaz `0x0100` (Wireshark „Standard query“), odpověď
`0x8500` (QR, AA, RD; „Standard query response, No error“). Rentgen ukáže Flags jako jeden řádek
s rozbalením na jednotlivé bity (jako Wireshark).

### 2.2 Otázka (kap. 4.1.2)

| Pole | Bity | Hodnota | Poznámka |
|---|---|---|---|
| QNAME | 8 × 15 | `www.skola.lan` | kódování kap. 3 |
| QTYPE | 16 | 1 = A | (28 = AAAA, 12 = PTR, 5 = CNAME, 15 = MX; RFC 1035 kap. 3.2.2, AAAA RFC 3596) |
| QCLASS | 16 | 1 = IN | Internet |

### 2.3 Záznam v odpovědi — Resource Record (kap. 4.1.3)

| Pole | Bity | Hodnota | Poznámka |
|---|---|---|---|
| NAME | 16 | `0xC00C` → `www.skola.lan` | ukazatel na jméno v otázce (kap. 3) |
| TYPE | 16 | 1 = A | |
| CLASS | 16 | 1 = IN | |
| TTL | 32 | **3600** | jak dlouho (s) smí klient odpověď držet v cache (RFC 1035 kap. 3.2.1, RFC 2181 kap. 8) |
| RDLENGTH | 16 | 4 | délka RDATA v bajtech |
| RDATA | 32 | 192.168.2.10 | IPv4 adresa |

Pozor na záměnu: **TTL v DNS záznamu** (sekundy v cache) není **TTL v IP hlavičce** (počet skoků).
Rentgen u obou dá tooltip, že jde o různé věci.

## 3. Kódování jména (RFC 1035 kap. 3.1, 4.1.2, 4.1.4)

- Jméno se zapisuje jako posloupnost **návěští (labels)**: bajt s délkou (0–63) + znaky, na konci
  nulový bajt (kořen). Tečky se neposílají.
  `www.skola.lan` → `03 77 77 77 05 73 6b 6f 6c 61 03 6c 61 6e 00` (15 B).
- Návěští max. 63 B, celé jméno max. 255 B (kap. 2.3.4). Velikost písmen se při porovnání nerozlišuje.
- **Komprese:** jméno, které už ve zprávě je, se nahradí 2bajtovým ukazatelem: horní 2 bity `11`,
  zbylých 14 bitů = posun od začátku DNS zprávy. Otázka začíná hned za 12bajtovou hlavičkou, proto
  `0xC00C`. Rentgen ukáže „ukazatel na bajt 12 → www.skola.lan“.

## 4. Velikosti (pro vektory a rentgen)

| | DNS | UDP | IP | Rámec |
|---|---|---|---|---|
| Dotaz | 12 + 15 + 4 = **31 B** | 39 B | 59 B | 73 B |
| Odpověď | 31 + 16 = **47 B** | 55 B | 75 B | 89 B |

Simulátor zjednodušuje: dotaz bez EDNS(0) (RFC 6891; Windows i `nslookup` ho dnes obvykle přidávají
jako OPT záznam v Additional, ARCOUNT 1 — ověřit Wiresharkem), odpověď bez sekce Authority (BIND ji
ve výchozím stavu u autoritativní odpovědi přidává s NS záznamy zóny, ověřit).

## 5. Chování klienta a serveru

- **Klient (resolver OS):** dynamický UDP port od 49152 (`udp.md` kap. 4.2), cílový port 53, ID =
  čítač dotazů uzlu od 1 (Simulátor zjednodušuje: skutečné resolvery volí ID i port náhodně jako
  ochranu proti podvržení odpovědi, RFC 5452). Odpověď přijme, jen když sedí ID, otázka a IP:port
  serveru. Po odpovědi socket zavře a záznam uloží do DNS cache (`dns_cache`) na TTL. Další dotaz
  na stejné jméno během TTL už na síť nejde.
- **Bez odpovědi:** Windows resolver opakuje dotaz (po 1 s, pak další servery a delší čekání, ověřit);
  simulátor: 2 opakování po 1 s, pak chyba „jméno nelze přeložit“. Ve vektorech úrovně 4 se nevyskytuje.
- **Server (SRV1, aplikace dns na UDP 53):** pro jméno ve své zóně odpoví AA=1 s A záznamy; jméno
  v zóně neexistuje → RCODE 3 (NXDOMAIN), AA=1, ANCOUNT 0; jméno mimo zónu → RCODE 5 (REFUSED),
  protože rekurzi simulátor nemá (Simulátor zjednodušuje: skutečný rekurzivní server by se zeptal dál).
  RA=0: SRV1 je jen autoritativní server své zóny (Simulátor zjednodušuje: školní server by obvykle
  dělal i rekurzi pro klienty; to přijde s NAT v úrovni 5, pak RA=1, flags `0x8580`).
- **Zóna SRV1:** `www.skola.lan A 192.168.2.10`, `srv1.skola.lan A 192.168.2.10`, TTL 3600.
  PTR záznamy (reverzní zóna) simulace nemá.

## 6. Vazba na terminál

`nslookup` (`cmd.md` kap. 15) a `ipconfig /displaydns` (volitelně). Rozdíl, který se vyplatí říct:
`nslookup` se ptá DNS serveru **přímo** a cache OS nepoužívá; prohlížeč a curl používají resolver
s cache.
