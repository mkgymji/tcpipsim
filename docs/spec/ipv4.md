# IPv4

Stav: návrh, iterace 1. Zdroje: RFC 791 (formát, 3.1), RFC 1122 (hostitel: 3.2.1, 3.3.1),
RFC 1812 (router: 5.2.3, 5.2.4.3, 5.2.7.1, 5.3.1), RFC 2474/3168 (DSCP/ECN), RFC 1071 (kontrolní součet).

## 1. Adresa, maska, síť

- IPv4 adresa: 32 bitů, zápis čtyři desítková čísla: `192.168.1.10`.
- Maska: souvislá řada jedniček zleva; zápis `255.255.255.0` nebo prefix `/24` (počet jedniček).
  Simulátor ukládá prefix (číslo 0–32), UI ukazuje obojí (Windows `ipconfig` ukazuje masku,
  Cisco `show ip route` prefix).
- **Adresa sítě** = adresa AND maska. Dvě adresy jsou ve stejné síti, když mají stejnou adresu
  sítě při masce **odesílatele**.
- Adresa sítě (`192.168.1.0`) a broadcast (`192.168.1.255`) se nepřidělují hostitelům (/24 má 254
  použitelných adres). Výjimky /31, /32 mimo rozsah iterace.

## 2. Hlavička — pole pro rentgen (RFC 791 3.1)

| Pole | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|
| Version | 4 | verze IP | `4` |
| IHL | 4 | délka hlavičky ve 32bitových slovech | `5` (20 B, bez voleb) |
| DSCP | 6 | třída služby (QoS); původně Type of Service, RFC 2474 | `0` |
| ECN | 2 | oznámení zahlcení, RFC 3168 | `0` |
| Total Length | 16 | délka celého paketu (hlavička + data) v bajtech | spočítaná; ping z Windows: 60 |
| Identification | 16 | číslo paketu pro skládání fragmentů | čítač odesílatele (viz níže) |
| Flags | 3 | bit 0 rezervovaný, DF (nefragmentovat), MF (další fragmenty) | `0 0 0` |
| Fragment Offset | 13 | pozice fragmentu (v 8B jednotkách) | `0` |
| TTL (Time To Live) | 8 | max. počet routerů, které paket ještě projde | výchozí podle OS (kap. 3) |
| Protocol | 8 | co je v datech | `1` ICMP, `6` TCP, `17` UDP |
| Header Checksum | 16 | kontrolní součet **jen hlavičky** (RFC 1071) | počítá se skutečně; router přepočítá po změně TTL |
| Source Address | 32 | IP odesílatele (původního zdroje) | |
| Destination Address | 32 | IP cíle (konečného) | |
| Options | 0–320 | volby | žádné |

- Identification: v simulaci deterministický čítač na uzel, začíná na hodnotě ze scénáře
  (výchozí 1) a zvyšuje se o 1 s každým odeslaným paketem. Vektory ho nekontrolují.
- Flags: Windows ping posílá DF = 0 (`ping -f` nastaví DF = 1); Linux ping DF nastavuje.
  Simulátor zjednodušuje: DF = 0 všude, fragmentace se neděje (MTU 1500, malé pakety).
- Kontrolní součet: jednotkový doplněk součtu 16bitových slov hlavičky (RFC 1071). Simulátor ho
  počítá, aby rentgen ukazoval realistické hodnoty; router ho po snížení TTL přepočítá
  (RFC 1812 4.2.2.5 povoluje i inkrementální úpravu). Kontrola při příjmu: chybný součet →
  zahodit (v simulaci nenastává).

## 3. TTL

- **Odesílatel** nastaví TTL na výchozí hodnotu svého OS. Doporučení IANA (dříve RFC 1700) je 64;
  RFC 1122 3.2.1.7 odkazuje na „Assigned Numbers“. Simulátor používá profily:

| Profil uzlu | Výchozí TTL | Pozn. |
|---|---|---|
| `pc` (Windows) | 128 | odpovídá školním PC; `ping` z Windows ukazuje TTL=128 v téže síti |
| `server` (Linux) | 64 | |
| `router` (Cisco IOS) | 255 | jen pro pakety, které router sám vytvoří (odpověď na ping, ICMP chyby) |

  Hodnota je nastavitelná na uzlu (`ttl_default`).
- **Router** při přeposílání sníží TTL o 1 (RFC 1812 5.3.1: „MUST decrement the TTL by at least one“).
  Pokud by TTL kleslo na 0, paket zahodí a pošle zdroji ICMP Time Exceeded, kód 0.
  Prakticky: přijde-li paket s TTL = 1 (a není pro router), router ho zahodí.
  Paket určený routeru samotnému se nepřeposílá, TTL se u něj nesnižuje (RFC 1812 5.2.3).
- **Hostitel** TTL nemění (nepřeposílá).
- Echo Reply je **nový paket** odpovídajícího uzlu s jeho výchozím TTL. TTL v odpovědi pingu tedy
  = výchozí TTL odpovídajícího − počet routerů na zpáteční cestě. Ve vektoru `ping-router`:
  server (64) přes 1 router → PC vidí TTL=63. (Typická miskoncepce: „TTL se vrací/odečítá tam i zpět“.)
- Na TTL stojí `tracert` (další iterace).

## 4. Rozhodování hostitele při odeslání

### 4.1 Směrovací tabulka hostitele

Hostitel s jedním rozhraním (`192.168.1.10/24`, brána `192.168.1.1`) má v simulaci dvě cesty:

| Cíl (síť/prefix) | Další skok (next hop) | Rozhraní | Typ |
|---|---|---|---|
| `192.168.1.0/24` | — (přímo, on-link) | `eth0` | `connected` |
| `0.0.0.0/0` | `192.168.1.1` | `eth0` | `default` (výchozí brána) |

Windows `route print` / `netstat -nr` ukazuje navíc loopback, multicast a broadcast cesty;
simulátor zjednodušuje na tyto dvě (rozhodování je stejné).

### 4.2 Algoritmus (RFC 1122 3.3.1.1 a 3.3.1.2)

```
vstup: cílová IP D
1. vyber cestu z tabulky metodou longest prefix match (kap. 6)
2. pokud cesta je connected (D je ve stejné síti podle masky):  next hop := D        (přímé doručení)
   jinak:                                                       next hop := brána    (nepřímé doručení)
   pokud žádná cesta (není brána a D je mimo síť): chyba, nic se neodešle
3. MAC := ARP cache[next hop]; pokud chybí → ARP request na next hop, paket do fronty (arp.md kap. 6)
4. rámec: zdrojová MAC = moje, cílová MAC = MAC next hopu; IP: zdroj = moje IP, cíl = D
```

Ekvivalentní formulace pro úroveň 2 (bez pojmu směrovací tabulka):
„Je cíl ve stejné síti? (moje IP AND maska == cíl AND maska) Ano → ARP na cíl. Ne → ARP na bránu.“

**V obou případech zůstává cílová IP v paketu = konečný cíl; mění se jen to, komu patří cílová MAC.**

## 5. Zpracování na routeru (RFC 1812)

Příchozí paket na rozhraní I (rámec už prošel L2 filtrem, `model.md` 6.4):
1. Kontrola hlavičky (verze, délka, kontrolní součet). Chyba → zahodit.
2. **Lokální doručení** (RFC 1812 5.2.3): cílová IP = některá adresa routeru (na kterémkoli
   rozhraní) nebo broadcast → zpracuje sám (ICMP Echo → odpoví). Konec.
3. **TTL:** je-li TTL ≤ 1 → zahodit, ICMP Time Exceeded (11/0) zdroji. Jinak TTL := TTL − 1.
4. **Vyhledání cesty:** longest prefix match (kap. 6). Žádná → zahodit, ICMP Destination
   Unreachable (3/0, network unreachable) zdroji (RFC 1812 5.2.7.1).
5. **Next hop:** cesta `connected` → next hop = cílová IP; jinak next hop = adresa z cesty.
6. **ARP** na výstupním rozhraní (případně fronta).
7. **Nový rámec:** zdrojová MAC = MAC výstupního rozhraní, cílová MAC = MAC next hopu.
   IP adresy beze změny, přepočítat kontrolní součet. Odeslat.

Pořadí kroků 3 a 4: RFC 1812 nepředepisuje, zda kontrolovat TTL před vyhledáním cesty; pro
studenta je pozorovatelný rozdíl jen v tom, kterou ICMP chybu dostane paket, který má TTL 1
a zároveň nemá cestu. Simulátor: nejdřív TTL (jako Cisco IOS — **ověřit**).

Simulátor zjednodušuje: router neposílá ICMP Redirect (RFC 1812 5.2.7.2), i když by paket odcházel
stejným rozhraním, kterým přišel; nemá ACL, NAT ani dynamické směrování (pozdější úrovně).

## 6. Směrovací tabulka a longest prefix match

Záznam: `prefix` (síť/délka), `next_hop` (IP nebo prázdné), `if` (výstupní rozhraní), `type`:

| type | Cisco kód | Význam |
|---|---|---|
| `connected` | C | síť přímo připojeného rozhraní (vznikne nastavením IP na rozhraní ve stavu up) |
| `local` | L | adresa rozhraní samotného, /32 (Cisco IOS 15+) — jen router |
| `static` | S | ručně zadaná cesta (`ip route síť maska next-hop`) |
| `default` | S* | statická výchozí cesta `0.0.0.0/0` (u hostitele = výchozí brána) |

Algoritmus (RFC 1812 5.2.4.3, Basic Match + Longest Match):
1. Ponech jen cesty, pro které platí `D AND maska(cesty) == síť(cesty)`.
2. Z nich vyber tu s **nejdelším prefixem**. `0.0.0.0/0` odpovídá všemu, ale vyhraje jen tehdy,
   když nic jiného neodpovídá.
3. Při shodě délky (dvě cesty na stejnou síť) rozhoduje administrativní vzdálenost a metrika —
   v této iteraci se nevyskytuje; simulátor odmítne vložit druhou cestu na stejný prefix
   (zjednodušení, otevřená otázka).

Cesty `local` (/32) zajistí, že paket na adresu routeru vyhraje longest match a doručí se lokálně;
logicky je to totéž jako krok 2 v kap. 5. Hostitelům simulátor `local` cesty nepřidává.

## 7. Mimo rozsah této iterace

Fragmentace a MTU, volby IP hlavičky, broadcast na adresu sítě (directed broadcast), multicast,
DHCP (hostitel má IP nastavenou ručně ve scénáři), NAT, IPv6.
