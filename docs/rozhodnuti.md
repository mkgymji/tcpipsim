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

## 2026-11-24 — sjednocení specifikace úrovně 2 „Adresy“

23. **Kroky úrovně 2 určuje scénář didaktika** (`scenarios/uroven2-adresy.md`, kroky 0–17);
    prototyp kreativce (12 kroků) je jen vizuální vzor.
24. **MAC tabulka switche ukazuje jen naučené záznamy.** Žádný řádek s „?“ pro neznámou MAC
    (v prototypu je) — switch Boba v okamžiku floodingu nezná, právě proto flooduje.
25. **Jednotné adresy ve všech úrovních:** uzly PC1–PC3 se jmény Alice, Bob, Cyril; MAC
    `02:00:00:00:00:0N`, IP 192.168.1.10/.20/.30. Úroveň 1 se sjednotí (Alice 01, Bob 02), aby
    rentgen a hexdump seděly s vektory projektanta.
26. **Předvyplněná ARP tabulka** (rozhodnutí 14) se zdůvodní textem „switch byl právě zapnut,
    počítače se už dřív znaly“ + označené zjednodušení. Bob má předvyplněnou i Alici (kvůli odpovědi).
    `arp -a` ukazuje typ `dynamic` a i statické broadcastové/multicastové řádky jako skutečné Windows
    (pravdivé, vybízí k otázce „co to je?“; v detailu jedna věta).
27. **`ipconfig` na úrovni 2:** Default Gateway prázdná (jedna síť bez routeru — pravdivá konfigurace).
    Výstupy anglicky (rozhodnutí 10). `getmac` se nedělá.
28. **Zdrojový port** jde deterministicky od 49152; rentgen to označí „Simulátor zjednodušuje:
    skutečný systém volí číslo náhodně z rozsahu 49152–65535.“
29. **Rentgen UDP** ukazuje všechna 4 pole, zvýrazněné jsou porty. Bob má dvě aplikace (5000 zprávy,
    6000 poznámky) — vyvrací „port = díra“.
30. **Formát `show mac address-table` a místa „ověřit“ v `cmd.md`** se ověří snímkem z Packet Traceru
    a školního PC při pilotu (požádat Michala až s pilotem, neblokuje vývoj).

## 2026-11-24 — po kontrole úrovně 2

31. **Tip (předpověď) je samostatný krok se stavem PŘED událostí.** Obrazovka tipu ukazuje rámec,
    který právě dorazil k rozhodujícímu zařízení (např. leží na vstupním portu switche), ale ještě
    nic dalšího: žádné rámce na výstupech, žádné „přijal/zahodil“, žádné vysvětlení výsledku v textu
    ani ve štítcích (štítek „Hub nečte adresy…“ se při tipu schová). Volby se odvozují z topologie,
    ne ze stavu portů starého rámce (příchozí port zamčený). Následující krok ukáže výsledek
    a vyhodnotí tip jednou větou; při nesouladu řekne proč. Přehrávání se na tipu zastaví.
    Nadpis karty: „Tip: …“ (ne „Předpověz“). Tip v kroku 15 má záměrně oporu v MAC tabulce:
    „Podívej se do MAC tabulky a tipni.“ Číslování kroků se tím změní; .md scénáře se upraví.
32. **UDP je „UDP datagram“**, ne segment (slovník). Obecné „segment“ jen na úrovni 1 bez konkrétního protokolu.
    Na úrovni 2 se sloupec vrstvy L4 jmenuje „segment / datagram“ s poznámkou v detailu.
33. **Rentgen ukazuje délku polí v bitech.** Hexdump před vznikem rámce ukazuje jen existující bajty.
34. **Porty switche Fa0/1…**: při prvním výskytu jedna věta „Fa0/1 = Cisco název portu (FastEthernet 0/1)“.
    Hub má porty značené stejně jako switch (Fa0/1…), aby výměna hub → switch nic nezměnila.
35. **Cyrilova MAC je vidět** u uzlů v topologii (poslední bajt tučně) a při zahození: „cílová …:02 ≠ moje …:03“.
36. **Kroky 9–10 (odpověď přes hub)** se zkrátí na jeden krok — opakovaný jev nenese novou myšlenku.
37. **Slovo „výtah“ ani „prostředník“ se studentovi neukazuje** (interní pojmy). Legenda: „dvojitý obrys =
    odesílatel a příjemce vybrané zprávy“.

## 2026-11-25 — připomínka Michala: kde je fyzická vrstva

38. **Přenos se kreslí jako „U“: dolů u odesílatele, po médiu dole, nahoru u příjemce.** Dosud se
    rámec pohyboval po kabelu v topologii nahoře, nad sloupci vrstev, a prostřední blok
    (obálky / „Bity Alice → Bob“) stál nahoře bez ohledu na aktivní vrstvu. Student tak viděl bity
    létat nad aplikační vrstvou, což odporuje obrázku z prezentací (médium = L1 = dole).
    Nově: (a) prostřední blok svisle sleduje aktivní vrstvu (při zapouzdření klesá, na drátě je
    v řádku L1, při rozbalení stoupá); (b) mezi řádky L1 odesílatele a příjemce vede pruh
    „médium (kabel)“, po kterém jedou bity; přes hub/switch se v pruhu ukáže zařízení s výškou
    jen do své vrstvy (hub L1, switch L2) — rámec u switche vystoupá do L2 a zase klesne;
    (c) topologie nahoře zůstává jako mapa „kde v síti jsme“; aktivní kabel v ní se zvýrazní stejně
    jako pruh média dole a popisek odkáže „bity jedou po kabelu — dole ve vrstvě L1“.
    Platí pro úroveň 1 i 2. Proč: prostorová metafora musí sedět s vrstvovým modelem; jinak se
    musí odnaučit. Ponaučení: kontrola didaktika ověřuje i rozvržení obrazovky proti obrázkům
    z prezentací, ne jen texty.

## 2026-11-25 — sjednocení specifikace úrovně 3 „Směrování“

39. **Topologie úrovně 3:** Alice (Fa0/1) a Cyril (Fa0/3) zůstávají na SW1 v 192.168.1.0/24 se stejnými
    adresami. **Bob se přestěhuje** do druhé sítě: 192.168.2.20/24, brána 192.168.2.1, **MAC zůstává
    02:00:00:00:00:02**, připojen přímo na R1 Gi0/1. R1: Gi0/0 → SW1 Fa0/4, 192.168.1.1/24, MAC
    02:00:00:00:01:01; Gi0/1 192.168.2.1/24, MAC 02:00:00:00:01:02; TTL 255. Port Fa0/2 zůstane volný
    (kabel od Boba vede jinam). Server se v úrovni 3 nepoužívá (přijde v úrovni 4 s webem; TTL 64
    tam). Bob je PC, ping dává `TTL=127`. Proč: příběh Alice → Bob pokračuje a stěhování nese pointu
    „IP adresa patří k síti, MAC ke kartě“ (rozh. 25 tím platí pro jména a MAC, IP Boba se mění
    záměrně a scénář to řekne). Projektant přegeneruje vektory.
40. **Rozhraní routeru se jmenují Gi0/0, Gi0/1** (Packet Tracer 2911/ISR), ne Fa0/0. Opravit
    i `docs/ui.md`, `docs/VYVOJ.md`, prototyp.
41. **Chyby konfigurace v části D: chybějící brána a špatná brána (.254)**, ne špatná maska.
    Proč (projektant): Cisco má výchozí proxy ARP, takže by ping se špatnou maskou na skutečné síti
    prošel — simulace bez proxy ARP by učila něco, co se musí odnaučit. Maska se vysvětluje
    v části A (porovnání síťové části).
42. **Oprava chyby v části D tlačítkem** („Oprav bránu“), konfigurační příkazy PC až v úrovni 5.
43. **Jedna úroveň, kroky 0–25, rozdělená na části A–D** se skokem na začátek části v UI
    (učitel může skončit po části B). Tip v kroku 11 se vyhodnotí v kroku 12 — v souladu s rozh. 31.
44. **tracert v úrovni 3 přes jeden router** (2 řádky: 192.168.1.1, pak Bob), Time Exceeded je vidět.
    Animuje se jedna sonda na TTL, výpis ukáže tři časy — označené zjednodušení. Topologie se dvěma
    routery (vektor `tracert-dva-routery`) zůstává `skip` pro pozdější rozšíření.
45. **IOS:** `enable` ano; `show ip route`, `show ip interface brief`, `show ip arp`, `ping` ano;
    `traceroute` na routeru v úrovni 3 odmítnout hláškou simulátoru („v této úrovni použij tracert
    na PC“ — IOS posílá UDP sondy, ICMP imitace by byla nepravdivá); `show running-config` až úroveň 5.
    Windows `route print` ukáže jen sekci IPv4 Route Table; `netstat -nr` stejné.
46. **Nejistá místa** (Windows „General failure“ bez brány, ICMP 3/1 z Cisco po neúspěšném ARP,
    započítání Destination host unreachable do Received) se implementují podle `cmd.md`/`icmp.md`
    s označením „ověřit při pilotu“ (rozšíření rozh. 30).
47. **Vrstva L4 při pingu:** řádek přeskočený, šrafovaný, „ICMP nemá porty“; ve sloupci vrstev zůstává
    „segment / datagram“ (rozh. 32) — pokud se nevejde, zkrátit popisek „kdo se stará“, ne PDU.
48. **Router v pruhu média** je věž do L3 s dvěma nohami (Gi0/0, Gi0/1); paket vystoupá do L3,
    starý rámec (přerušovaný) se zahodí, nový rámec klesne. Karta „Rámec před a za R1“ ukazuje
    změněné MAC, stejné IP a TTL −1. Sítě v topologii jako neutrální podbarvené oblasti se štítkem
    adresy sítě (ne barvami vrstev).

## 2026-11-25 — terminologie vrstev (Michal)

49. **Popisy vrstev, PDU a „kdo se stará“ jsou podle Michalovy prezentace** („3. TCP/IP - L4“, snímky 2–6);
    finální slovo má Michal, tým jen navrhuje. **Michal 2026-11-25 schválil tato znění** (L7 komunikace s aplikací;
    L6 interpretace dat (kódování, šifrování, komprese); L5 řízení a koordinace relace (dialogu mezi aplikacemi);
    L4 a) spolehlivé doručení dat (TCP; UDP ne): příjem se potvrzuje, ztracená data se pošlou znovu, velká data
    rozdělí na části a u příjemce je složí ve správném pořadí; b) doručení dat správné aplikaci na cílovém uzlu
    (podle portu): multiplex / demultiplex; L3 přeprava dat mezi uzly, které mohou ležet i mimo vlastní síť
    (podle IP adresy); doručení lokální (cíl ve stejné síti, přímo) nebo vzdálené (přes router);
    L2 přeprava dat mezi přímo spojenými uzly (ve stejné síti, i přes switch); L1 data, signály (převod bitů na signál)).
    Rozhodnutí 18 se ruší: „kdo se stará“ o L1–L2 je **„firmware síťového rozhraní“**, u L1 v detailu
    věta „L1 je z velké části hardware síťové karty“. PDU: ve sloupci vrstev obecně „segment“, v detailu
    a rentgenu „UDP datagram (RFC 768), TCP segment“ (upřesnění rozh. 32). Do detailu Michalovy názvy
    „linkový rámec“, „síťový paket (IP datagram)“, „transportní paket“.

## 2026-11-25 — po kontrole úrovně 3 (tmp/review3/*.md)

50. **Nadpis prostředního sloupce a „dvojice“ ukazují skutečnou zprávu**, ne dvojici scénáře:
    „ARP dotaz · Alice → všem“, „ARP odpověď · R1 → Alice“, „Time Exceeded · R1 → Alice“, „Echo Reply · Bob → Alice“.
51. **Tipy nesmí prozradit výsledek ani v okolí** (rozšíření 31): v části D nadpisy kroků před tipem neutrální
    („Ping na Boba nefunguje“), žádný štítek „bez brány“, text bez diagnózy; tlačítko „Oprav bránu“ až po
    vyhodnocení tipu. V tipu 16 pruh média neukazuje cestu (zobrazí všechna zařízení topologie nebo žádné).
    Tip 13 nesmí obsahovat výsledek (TTL 127) v textu ani v čipu.
52. **Rozh. 38 platí i v úrovni 3 bez výjimky:** u odesílatele a příjemce blok sedí u aktivní vrstvy; u routeru
    stojí nad věží R1 tak, že věž (Gi0/0, Gi0/1, L1–L3) zůstane vidět; v kroku 12 jsou štítky „starý / nový rámec“.
    Karta „Rámec před a za R1“ se vejde celá včetně věty „MAC se změnila, IP zůstala“ na 900 i 720 px.
53. **Písmo:** min. 15 px mimo husté tabulky, v tabulkách topologie min. 14 px; čipy TTL, štítky věží,
    „jiná/stejná“ 15 px. Topologii zjednodušit (MAC v uzlech celé, nebo jen poslední bajt tučně podle rozh. 35).
54. **Přepínač A–D** má popisek „Části:“ a nápovědu; texty „Simulátor zjednodušuje“ a výzvy k terminálu
    nesmí být pod ohybem — zkrátit texty kroků, ne zmenšit písmo.
55. Opravit nálezy projektanta P1–P5 (ping na vlastní adresu / 127.0.0.1 se doručí uvnitř, RFC 1122; krok 24
    „Alice se ARPem ptá na .254, paket míří na Boba“; krok 15 Cyril; krok 10 `Request timed out.`; ARP pole
    „MAC cíle / IP cíle“), recenzenta R5 (Cyril a R1 viditelně ignorují ARP dotaz na .254), R7 (rentgen ICMP),
    R8 („další skok“), D6, D7, D9 (ARP nemá L3/L4 — řádky neaktivní bez štítku „bez portů“; ICMP: „jede přímo
    v IP paketu“), student 5 a 7 (tabulka tracert, terminál v kroku 1 nesmí ukázat budoucí odpovědi).

## 2026-11-26 — připomínka Michala: kam se má divák dívat

56. **Každý krok má jedno „ohnisko“ a panely se liší rolí.** Michal: „ne vždy je jasné, co a kde mám
    jako divák sledovat“; student si krokuje fáze sám.
    (a) **Role panelů rozliší barva záhlaví + ikona + slovo** (ne jen barva; neutrální odstíny, které se
    nepletou s paletou vrstev L1–L7):
    - Vysvětlivka „Krok“ — tmavé záhlaví (ink), ikona „i“.
    - **Tip / otázka — výrazně žluté pozadí celé karty** (např. #FFE28A, tmavý text, kontrast AA), ikona „?“,
      záhlaví „Ptám se tebe: …“. Na kroku tipu se karta jednou krátce zvětší/zatřese (bez animace
      při „Omezit animace“) a tlačítko Vpřed říká „Potvrdit tip“.
    - Rentgen — modrošedé záhlaví (ne L4 modrá), ikona lupy, „Rentgen: …“.
    - Terminál — černé záhlaví (už je).
    - Detail — světle šedé.
    (b) **Ohnisko kroku:** scénář (nebo automatické pravidlo) určí, kam se dívat: `tip` | `rentgen` |
    `topologie` | `vrstvy` (blok) | `terminal`. Panel ohniska dostane silný rámeček v barvě své role
    a štítek „Sleduj tady“; ostatní panely se mírně ztlumí (opacity ~0.75, ne víc — musí být čitelné).
    Výchozí pravidlo: krok tipu → tip; krok s vybraným polem rentgenu → rentgen; krok, kde se mění tabulka
    (MAC, ARP, směrovací) → topologie; jinak vrstvy/blok.
    (c) **Odkaz z textu:** vysvětlivka může mít čip „→ Rentgen: TTL“ / „→ MAC tabulka“, který po najetí
    nebo kliknutí zvýrazní cíl.
    Platí pro úrovně 1–3. Proč: menší kognitivní zátěž při samostatném krokování; tip je výzva
    k akci a musí „křičet“, rentgen je místo, kam se jen občas odkazuje.

## 2026-11-26 — připomínka Michala: rámec u uzlu, který není cílem

57. **Sloupec příjemce vždy patří uzlu, o kterém krok mluví.** Dosud v kroku „Cyril rámec zahodí“
    (úroveň 2 krok 7, krok 12 flooding; úroveň 3 Cyril/R1 a ARP dotaz) zůstával vpravo Bob se svítící L2
    a v dalším kroku se pokračovalo rozbalováním — student viděl „přijal“, text říkal „zahodil“.
    Nově: (a) v kroku zahození je vpravo **Cyril** (nadpis „Cyril · není cíl“), rámec stojí v jeho L2
    s křížkem a větou „cílová …:02 ≠ moje …:03 → zahozeno“, vyšší vrstvy šedé s popiskem
    „sem nic nedorazí“; blok se dál nepohybuje. (b) Další krok **viditelně přepne** na Boba:
    nadpis sloupce se změní a krátce zvýrazní („Teď Bob“), text začne „Mezitím u Boba: …“.
    (c) V topologii jsou přijímající uzel i zahazující uzel odlišené (Bob „přijal“, Cyril „zahodil“) — to už platí.
    Kontrola týmu nově ověřuje u každého kroku shodu „o kom mluví text = čí sloupec je vidět“.

58. **Nadpis karty tipu je „Otázka: …“** (Michal: „Ptám se tebe“ zní česky divně). Mění 56a.

## 2026-11-26 — rozsah úrovně 4 „Transport a aplikace“

59. **Úroveň 4 = TCP a aplikace na jedné cestě bez NAT.** Topologie úrovně 3 + server SRV1 v síti 2
    (192.168.2.10/24, MAC 02:00:00:00:00:04, Linux, TTL 64; brána 192.168.2.1), na něm DNS (UDP 53)
    a web (TCP 80) se jménem `www.skola.lan` (interní školní server — pravdivé bez NAT, rozh. 5).
    Děj: Alice zadá `http://www.skola.lan` → DNS dotaz/odpověď (UDP) → TCP three-way handshake
    (SYN, SYN-ACK, ACK; čísla sekvencí od ISN, v rentgenu relativní i absolutní) → HTTP GET a odpověď
    (data, ACK) → ukončení (FIN/ACK). Jedna nová myšlenka: „TCP je spojovaný a spolehlivý, UDP ne;
    aplikace se najde podle socketu IP:port“. Navazuje na Michalovu prezentaci „3. TCP/IP - L4“
    (porty, socket, multiplex, UDP vs TCP, three-way handshake) a „4. aplikační vrstva“ (DNS, HTTP).
    Terminál: `nslookup`, `netstat -an` (ESTABLISHED, LISTEN, TIME_WAIT), `curl` nebo prohlížeč jako
    akce scénáře; na Bobovi zůstávají aplikace z úrovně 2. Ztráta segmentu a retransmise jako
    volitelná část (ukazuje „spolehlivost“ z L4 a)). NAT a seznam.cz až v úrovni 5. Specifikace:
    projektant + didaktik; UI pokračuje vzory úrovní 2–3 (bez samostatného kreativce, šetří tokeny).

60. **Úroveň 4 — sjednocení** (scénář didaktika × specifikace projektanta; výchozí volby schválil Michal:
    všechny části A–F, web na TCP 80 s HTTP odpovědí, `www.skola.lan`, termíny podle slovníku):
    - Síť 2 má **switch SW2** (Fa0/1 → R1 Gi0/1, Fa0/2 Bob, Fa0/3 SRV1); Bob se „přepojí“, adresy beze změny.
    - **Čísla podle projektanta** (ISN FNV-1a ze seedu, klientské porty deterministicky od 49152 dle rozh. 28);
      scénář přebírá hodnoty z jádra, ne vlastní návrhy.
    - **Ukončení spojení ve 4 segmentech** (FIN, ACK, FIN, ACK), jak ho kreslí CCNA; ukončuje klient → TIME_WAIT u Alice.
      Spojení FIN+ACK do jednoho segmentu jen poznámka „v praxi často 3 segmenty“.
    - HTTP odpověď v jednom segmentu (O6); skládání dat v pořadí se ukáže v části F (retransmise).
    - RST na zavřený port 8080 (O4) s poznámkou, že firewall by segment zahodil mlčky.
    - ARP cache a MAC tabulky předvyplněné (úroveň 3 je ukázala), označit „Simulátor zjednodušuje“.
    - Klient = `curl` (v terminálu `curl -v`, poznámka o aliasu v PowerShellu); SRV1 autoritativní DNS bez rekurze.
