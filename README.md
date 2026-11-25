# tcpipsim

Výukový simulátor sítě TCP/IP v prohlížeči. Ukazuje vrstvový model ISO/OSI a TCP/IP,
zapouzdření dat, adresaci a směrování po úrovních od principu k realitě. Skutečné hlavičky
protokolů jsou vidět „na kliknutí“ (rentgen), příkazy si student zkusí v terminálu
(Windows cmd, zjednodušené Cisco IOS).

Určeno pro seminář informatiky 4. ročníku gymnázia (příprava na technickou VŠ a Cisco CCNA,
maturita z IVT – okruh Počítačové sítě).

**Spustit:** https://mkgymji.github.io/tcpipsim/

## Úrovně

| Úroveň | Obsah | Stav |
|---|---|---|
| 1 Barvičky | vrstvy ISO/OSI a TCP/IP, zapouzdření a rozbalení zprávy | hotovo |
| 2 Adresy | MAC, IP, port; hub vs. switch, MAC tabulka; UDP | hotovo |
| 3 Směrování | ARP, ping (ICMP), brána, router, směrovací tabulka, TTL, tracert, hledání chyb | hotovo |
| 4 Transport a aplikace | DNS (UDP), TCP handshake, HTTP, ukončení spojení, socket a multiplex, retransmise | hotovo |
| 5 Směrem k CCNA | NAT a internet (seznam.cz), konfigurace IOS, VLAN, STP… | plánováno |

Odkaz na konkrétní krok: `#u=<úroveň>&k=<krok>&m=osi|tcpip`, např.
https://mkgymji.github.io/tcpipsim/#u=3&k=12

## Technika

Čisté HTML, CSS a JavaScript (ES moduly), bez build kroku a bez cizích knihoven.
Jádro simulace je bez DOM a testuje se v Node (`node --test`), celé testy `bash tests/run_all.sh`
(potřebuje Node a Chromium). Chování protokolů se ověřuje proti RFC testovacími vektory
v `tests/vectors/`.

- Vývoj a architektura: `docs/VYVOJ.md`
- Rozhodnutí (mají přednost před ostatními dokumenty): `docs/rozhodnuti.md`
- Didaktika a úrovně: `docs/didaktika.md`, scénáře `scenarios/`
- Slovník pojmů: `docs/slovnik.md`
- Specifikace protokolů: `docs/spec/`
- Role agentů vývojového týmu: `.claude/agents/`

## Licence

© 2026 Michal Kočer.
Kód je pod licencí [MIT](LICENSE). Výukové texty (scénáře, dokumentace, prototypy) jsou pod
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.cs) – můžete je upravovat a sdílet
s uvedením autora. Projekt nepoužívá žádný cizí kód ani knihovny.

Cisco a Cisco IOS jsou ochranné známky společnosti Cisco Systems, Inc.; Windows je ochranná známka
společnosti Microsoft. Simulátor s nimi není spojen, jen napodobuje výstupy příkazů pro výuku.
