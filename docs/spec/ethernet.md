# Ethernet II, hub a switch

Stav: návrh, iterace 1. Zdroje: IEEE 802.3 (rámec, Length/Type), IEEE 802 (struktura MAC adresy),
IEEE 802.1D (transparentní bridge = switch). Čísla klauzulí IEEE uvádím jen tam, kde si je jistý;
ostatní jsou označena „ověřit“ (normy IEEE nejsou volně na rfc-editor.org).

## 1. MAC adresa

- 48 bitů, zápis po bajtech hexadecimálně: `02:00:00:00:00:01` (Linux), `02-00-00-00-00-01`
  (Windows `ipconfig /all`, `arp -a`), `0200.0000.0001` (Cisco IOS).
- Bit I/G (nejnižší bit prvního bajtu): 0 = individuální (unicast), 1 = skupinová (multicast).
- Bit U/L (druhý nejnižší bit prvního bajtu): 0 = globálně přidělená výrobcem (OUI), 1 = lokálně
  spravovaná. Scénáře používají lokálně spravované adresy `02:…`.
- Broadcast: `ff:ff:ff:ff:ff:ff` (všechny bity 1, je to zvláštní případ skupinové adresy).

## 2. Rámec Ethernet II — pole pro rentgen

| Pole | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|
| Preambule | 56 | střídání 1010… pro synchronizaci přijímače | neukazuje se / šedě „nepřenáší se v simulaci“ |
| SFD (Start Frame Delimiter) | 8 | `10101011`, začátek rámce | neukazuje se / šedě |
| Cílová MAC (Destination) | 48 | komu je rámec určen | podle situace; broadcast `ff:ff:ff:ff:ff:ff` |
| Zdrojová MAC (Source) | 48 | kdo rámec odeslal (MAC výstupního rozhraní) | MAC rozhraní odesílatele |
| EtherType | 16 | co je v obsahu | `0x0800` IPv4, `0x0806` ARP (později `0x86DD` IPv6) |
| Data (payload) | 46–1500 bajtů | obsah: ARP zpráva nebo IP paket | skutečná délka obsahu |
| Výplň (padding) | 0–46 bajtů | doplnění na minimum 46 B dat | nuly, počítá se do délky |
| FCS | 32 | CRC-32 pro detekci chyb | „nepočítá se“ (zjednodušení) |

Poznámky:
- Cílová MAC je v rámci **první** — switch se může rozhodnout, kam rámec poslat, hned po
  přečtení prvních 6 bajtů (cut-through přepínání). Dobrá otázka pro studenty.
- Pole Length/Type (IEEE 802.3, klauzule 3.2.6): hodnota ≥ 1536 (`0x0600`) znamená EtherType
  (Ethernet II), hodnota ≤ 1500 znamená délku (rámec 802.3 s LLC). Simulátor používá jen Ethernet II.
- Minimální velikost rámce je 64 bajtů včetně FCS (512 bitů, IEEE 802.3 minFrameSize), tedy
  60 bajtů bez FCS; maximální 1518 bajtů včetně FCS (bez VLAN tagu). Odtud minimum 46 B dat.
- **Délka rámce ve vektorech a v rentgenu = cílová MAC až konec výplně, bez FCS** (stejně jako
  Wireshark při zachytávání na odesílateli). Příklad: ARP rámec = 14 B hlavička + 28 B ARP +
  18 B výplň = 60 B.

## 3. Hub (L1)

- Bit (v simulaci celý rámec), který přijde na port P, se zopakuje na všechny ostatní porty.
- Žádné adresy, žádné učení, žádné filtrování. Hub nemění obsah.
- Simulátor zjednodušuje: kolize se nemodelují. Ve skutečnosti by dva současně vysílající
  uzly na hubu způsobily kolizi (half-duplex, CSMA/CD, IEEE 802.3 klauzule 4). Vektory jsou
  sestavené tak, aby současné vysílání na hubu nenastalo.
- Otevřená otázka: zda v úrovni 5 kolize vizualizovat (viz `README.md`).

## 4. Switch (L2) — transparentní bridge

Chování podle IEEE 802.1D (Filtering Database, učení a přeposílání; přesné číslo klauzule ověřit).

### 4.1 MAC tabulka

Záznam: `mac`, `port`, `vlan` (v simulaci vždy 1), `type` (`dynamic`; `static` jen ruční),
`age` (stáří v sekundách). Na Cisco `show mac address-table`.

- Výchozí doba stárnutí (aging time): **300 s** (doporučená hodnota IEEE 802.1D a výchozí
  hodnota Cisco IOS). Záznam, který se 300 s neobnovil, se smaže.
- Jedna MAC je v tabulce nejvýše jednou. Objeví-li se na jiném portu, záznam se přepíše
  (přesun stanice).

### 4.2 Algoritmus pro rámec přijatý na portu P

```
učení:   tabulka[zdrojová MAC] := (P, stáří 0)       // jen pokud zdrojová MAC je unicast
cíl:     D := cílová MAC
         pokud D je broadcast nebo multicast:   flooding (všechny porty kromě P)
         jinak pokud D není v tabulce:          flooding (unknown unicast)
         jinak pokud tabulka[D].port == P:      zahodit (filtrování)
         jinak:                                 poslat jen na tabulka[D].port
```

- Rámec se nemění. Switch nečte IP hlavičku (L2 switch).
- Simulátor zjednodušuje: multicast se vždy floodí (bez IGMP snoopingu); bez VLAN; bez STP,
  topologie musí být bez smyček.
- Učí se **jen ze zdrojové MAC**. Důsledek ve vektorech: stanice, která nic neodeslala, v MAC
  tabulce není, i když jí switch rámce doručoval (flooding).

### 4.3 Události pro vizualizaci a vektory

`mac_learn` (nový/aktualizovaný záznam), `flood`, `forward`, `filter`.

## 5. Příjem rámce koncovým uzlem (síťová karta)

- Karta přijme rámec, jehož cílová MAC je MAC rozhraní nebo broadcast (a multicast, k jehož
  skupině je přihlášena — v této iteraci nevyužito). Ostatní rámce tiše zahodí: událost `nic_drop`.
- Promiskuitní režim (Wireshark) v simulaci odpovídá „pohledu na linku“, ne chování uzlu.
- Rámec předá podle EtherType: `0x0806` → ARP, `0x0800` → IPv4, jiný → zahodit.

## Zdroje
- IEEE 802.3-2018, klauzule 3 (formát rámce, 3.2.6 Length/Type), klauzule 4 (MAC, CSMA/CD, parametry).
- IEEE 802-2014, struktura MAC adresy (I/G, U/L bit) — číslo klauzule ověřit.
- IEEE 802.1D-2004, Filtering Database, aging time 300 s — číslo klauzule ověřit.
