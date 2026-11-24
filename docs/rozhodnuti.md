# Rozhodnutí orchestrátora

Sjednocení výstupů rolí. Platí, dokud je nové rozhodnutí nezmění. Agenti: tohle čti
po `CLAUDE.md` a před svými dokumenty; při rozporu s jiným dokumentem platí tento soubor.

## 2026-11-24 — iterace 1, sjednocení specifikace

1. **Vrstvy L5–L7 nemají v simulaci vlastní obálky.** Obálky jsou jen L4 (segment), L3 (paket),
   L2 (rámec), na drátě bity (L1). V režimu ISO/OSI jsou L5, L6, L7 ve sloupci vrstev vidět,
   ale zpráva jimi projde jako „data“ bez hlavičky; vysvětlivka řekne, že v TCP/IP tyhle
   úkoly řeší aplikace (např. šifrování TLS, kódování znaků). Proč: prototyp s obálkami L5 a L6
   by studenta naučil něco, co se v CCNA musí odnaučit (TCP/IP žádné hlavičky L5/L6 nepřidává).
   Platí pravidlo „zjednodušit jen tak, aby se to nemuselo odnaučit“. Úprava pro `docs/ui.md`
   a prototyp: ze středového panelu zmizí obálky L5 a L6; L7 je blok „data“ (obsah zprávy).
2. **Konec rámce (FCS) je vidět už na úrovni 1** jako proužek „konec rámce“ (je v prototypu).
   Obsah FCS až v rentgenu. Proč: rámec má opravdu hlavičku i patičku, je to levné a pravdivé.
3. **Kroky úrovně 1 určuje scénář didaktika** (`scenarios/uroven1-zapouzdreni.md`, kroky 0–10),
   ne 16 kroků z prototypu. UI se mu přizpůsobí.
4. **Barvy:** platí paleta kreativce (`docs/ui.md`), barvy podle vrstvy (ne pracovní barvy
   didaktika). Každá vrstva má i zkratku L1–L7 a tvar značky.
5. **Domácí LAN se seznam.cz bez NAT se nepoužívá.** Privátní adresa by se bez NAT
   do internetu nedostala — to by bylo zjednodušení, které se musí odnaučit. Do zavedení NAT
   (úroveň 5) se směrování ukazuje na dvou sítích přes router (192.168.1.0/24 a 192.168.2.0/24,
   jako vektor `ping-router`). Scénář „otevři seznam.cz“ přijde s NAT; do té doby může
   router-hranice internetu NAT dělat jako označenou „černou skříňku“ (rozhodne se v iteraci 4).
6. **Profily TTL** (PC 128, server Linux 64, router Cisco 255) a ARP podle RFC 826 podle
   projektanta platí.
7. **Smyčky v topologii:** editor je do zavedení STP nedovolí (varování), simulace má pojistku
   `maxEvents`. Broadcast storm možná jako ukázka v úrovni 5.
8. **Kolize na hubu se nemodelují** (do úrovně 5 nerozhodnuto, označit jako zjednodušení).
9. **Cisco zahození prvního paketu při ARP (`.!!!!`):** výchozí chování podle RFC (fronta);
   „věrnost Cisco“ jako volba až v úrovni 5.
10. **Hlášky terminálu Windows:** rozhodne se v iteraci 2. Předběžně anglicky (Windows v angličtině
    = shoda s návody a CCNA), s českou poznámkou simulátoru; ověřit jazyk Windows ve škole.
11. **Vazba na maturitu IVT** (okruhy 2026/2027): okruh 12 Počítačové sítě (ISO-OSI a TCP/IP,
    IP adresy, příkazy pro zjišťování konfigurace, hub/switch/router) a okruh 15 Internetové
    technologie (DNS, www, e-mail). Didaktik podle toho doplní vazby místo „potvrdit“.
12. **Provoz:** GitHub Pages + jednosouborová offline verze z `tools/bundle.mjs` (podle `docs/VYVOJ.md`).

## 2026-11-24 — po schválení slovníku projektantem

13. **Úroveň 2 ukazuje porty na jednoduchém UDP provozu** (aplikace „zprávy“ Alice → Bob,
    zdrojový a cílový port), ne na pingu. ICMP a ping přicházejí až s úrovní 3 (ICMP nemá
    porty, jede přímo v IP paketu). Proč: navazuje na úroveň 1 (stejná zpráva, teď s adresami)
    a odpovídá Michalovu snímku „Identifikace / Adresování“ (MAC / IP / port). Projektant dodá
    `docs/spec/udp.md`.
14. **Úroveň 2 bez ARP:** MAC cíle je předvyplněná v ARP tabulce scénáře (`initial_state.arp_cache`)
    a simulátor to řekne („Simulátor zjednodušuje: MAC adresu Boba už PC A zná; jak ji zjistí,
    uvidíš v úrovni 3“).
15. **Štítek L2 je „zdrojová MAC → cílová MAC“**, nikdy „odesílatel → příjemce“ (za routerem je cíl
    další skok). V rentgenu skutečné pořadí polí (cílová MAC první).
16. **Hub se neoznačuje jako „opakovač“** (repeater je jiné zařízení). Rozbalení L2 odstraní hlavičku
    i patičku. Bity na drátě bez preambule = označené zjednodušení.

## 2026-11-24 — po kontrole úrovně 1 (recenzent, projektant, didaktik, student-tester)

17. **Krok 5 se přepisuje:** po drátě jede celý rámec, obálky i zpráva, jako bity; kabel je nerozlišuje.
    Původní text vytvářel miskoncepci „obálky se neposílají“ (student-tester ji v odpovědích převzal).
18. **„Kdo se stará“ u L1 a L2:** „síťová karta (hardware a firmware)“. Michalova prezentace říká
    „firmware síťového rozhraní“, L1 je ale hardware; „síťová karta“ je termín z praxe. model.md sjednotit.
19. **Odloženo:** zpětná animace kroku vzad a animované slučování řádků při přepnutí modelu
    (krok vzad zatím okamžitý se zvýrazněním). Přepínač „Barvy | Barvy + písmena“ se nedělá,
    písmena L1–L7 jsou vidět vždy.
20. **Panel vpravo se na úrovni 1 jmenuje „Detail“**, rentgen až od úrovně 2; terminál se na úrovni 1 neukazuje.
21. **Adresa stránky nese stav:** `#k=<číslo kroku jako v UI, např. 8b>&m=osi|tcpip`, aby šlo poslat
    odkaz na konkrétní krok (učitel → studenti).
22. **IPv4 Identification** = čítač na uzel od 1 (podle ipv4.md), ne náhoda.
