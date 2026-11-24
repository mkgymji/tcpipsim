# Didaktika tcpipsim

Stav: návrh učitele (iterace 1, fáze specifikace). Schvaluje projektant a orchestrátor.
Terminologie: `docs/slovnik.md`. Úroveň 1 podrobně: `scenarios/uroven1-zapouzdreni.md`.

## Zásady

- Každá úroveň přidává jednu novou myšlenku. Co student už zná, se nevysvětluje znovu.
- Zjednodušení se vždy výslovně označí v simulátoru („Simulátor zjednodušuje: ...“). Zjednodušit
  se smí jen to, co se student nebude muset na VŠ nebo v CCNA odnaučit.
- Reálné hlavičky se ukazují „na kliknutí“ (rentgen), ne v hlavním výkladu.
- Každá úroveň končí kontrolními otázkami, které jdou zodpovědět z toho, co student viděl.
- Výchozí obrázek z Michalových prezentací: domácí LAN 192.168.1.0/24, brána 192.168.1.1,
  přepínač, router (NAT), ISP, www.seznam.cz (77.75.75.172). Od úrovně 2 se k němu postupně
  přibližujeme.
- Vazba na maturitu: konkrétní požadavky maturity IVT na tuto chvíli nemám ověřené (označeno
  „potvrdit“). Uvádím jen tematický okruh.

## Přehled úrovní

| Úroveň | Nová myšlenka | Co se objeví | Co zůstane skryté |
|---|---|---|---|
| 1 Barvičky | Data se po cestě obalují: každá vrstva přidá svou obálku, příjemce je sundává | vrstvy, obálky, bity na drátě, ISO/OSI vs. TCP/IP | adresy, protokoly, sítě mezi uzly |
| 2 Adresy | Obálka nese adresu a každá vrstva čte jen tu svou | MAC, IP, port; hub vs. switch | maska, směrování, ARP |
| 3 Směrování | Doručení po úsecích: MAC se mění na každém úseku, IP zůstává | maska, brána, ARP, směrovací tabulka, TTL | transportní spolehlivost |
| 4 Transport a aplikace | Spolehlivost a rozlišení aplikací jsou práce transportní vrstvy | porty, sockety, UDP vs. TCP, handshake, DNS, HTTP | konfigurace zařízení |
| 5 Směrem k CCNA | Síť se nastavuje a hledá se v ní chyba | konfigurace IP a tras, diagnostika, DHCP, NAT, filtrace | IPv6, VLAN, dynamické směrování |

---

## Úroveň 1: Barvičky

**Nová myšlenka.** Zpráva jede dolů zásobníkem vrstev, každá vrstva ji obalí svou obálkou
(zapouzdření); po drátě jdou jen bity; příjemce obálky sundává ve stejném pořadí v opačném směru.

**Výukové cíle.** Student po úrovni:
- vyjmenuje vrstvy TCP/IP (4) a ISO/OSI (7) a přiřadí je k sobě (aplikační = OSI 5–7, transportní = 4,
  síťová = 3, síťového rozhraní = 1–2);
- na obrázku ukáže, v jakém pořadí se obálky přidávají a v jakém sundávají;
- pojmenuje PDU každé vrstvy (data, segment, paket, rámec, bity);
- vysvětlí, že obálku vrstvy N na přijímací straně čte jen vrstva N;
- vysvětlí, že po drátě se neposílají obálky ani „zpráva“, ale bity (signál).

**Skryté / zjednodušené.** Žádné adresy, žádné konkrétní protokoly, jen dva uzly přímo propojené.
Obsah obálek je „popisek“ vrstvy, ne reálná hlavička. Simulátor zjednodušuje: v režimu ISO/OSI se
vrstvy 7–5 zobrazí jako jedna skupina „data“ (v praxi TCP/IP stack na nich hlavičky nepřidává).

**Miskoncepce a jak je simulátor vyvrací.**
- „Po drátě jede zpráva i s obálkami jako balíček.“ Na drátě student vidí jen proud bitů; obálky
  se rozpadnou na bity a u příjemce se znovu poskládají.
- „Každá vrstva zprávu změní.“ Obsah (data) zůstává uvnitř nezměněný, vrstva jen přidává obálku
  (a sundává ji). Simulátor ukáže, že vnitřek je stejný na začátku i na konci.
- „Vrstvy jsou různá zařízení.“ Obě vrstvové sady jsou uvnitř jednoho počítače; simulátor je kreslí
  jako sloupec v jednom uzlu.
- „ISO/OSI a TCP/IP jsou dvě různé sítě.“ Přepínač popisků ukáže, že jde o stejnou animaci
  s jiným dělením.

**Maturita IVT.** Zapouzdření a vrstvový model patří k základům okruhu o sítích (potvrdit
konkrétní znění požadavků). **CCNA (ITN).** Odpovídá úvodu o modelech OSI a TCP/IP a o zapouzdření.

---

## Úroveň 2: Adresy

**Nová myšlenka.** Obálka nese adresu a každá vrstva má vlastní druh adresy: linková MAC, síťová IP,
transportní port. Zařízení rozhoduje podle adresy své vrstvy.

**Výukové cíle.** Student po úrovni:
- k obálce na dané vrstvě přiřadí správný druh adresy (MAC, IP, port) a řekne, co identifikuje
  (síťovou kartu, rozhraní v síti, aplikaci);
- ve zjednodušené síti s přepínačem vysvětlí, jak přepínač plní tabulku MAC (učí se ze zdrojové
  adresy) a co dělá s neznámou cílovou adresou;
- vysvětlí rozdíl mezi hubem (opakuje na všechny porty) a přepínačem (posílá jen cílovému portu,
  jakmile ho zná);
- řekne, že počítač rámec s cizí cílovou MAC zahodí (kromě broadcastu);
- vysvětlí, proč je potřeba víc adres současně (MAC a IP a port se doplňují, nenahrazují).

**Skryté / zjednodušené.** Všichni v jedné síti, IP adresy se jen ukazují, nepočítá se s maskou.
ARP se ještě neukazuje: simulátor zjednodušuje a MAC cíle „zná“ (označit). Broadcast jen pro
neznámou adresu v přepínači a pro ukázku.

**Miskoncepce.**
- „Switch posílá všem.“ Simulátor: u přepínače se po naučení MAC přenáší rámec jen na jeden port;
  u hubu na všechny. Student přepne hub ↔ switch a porovná. (Při neznámém cíli přepínač rozešle na všechny
  porty kromě příchozího, což se výslovně ukáže jako výjimka.)
- „MAC adresa je adresa v internetu.“ Obálka MAC se ukáže jen v rámci jedné sítě; od úrovně 3 se
  její obsah mění. Na úrovni 2 student dostane otázku, proč tam stejně musí být i IP.
- „Port je díra v počítači.“ Port je číslo v obálce transportní vrstvy, kterým operační systém
  předá data správné aplikaci. Simulátor ukáže dvě aplikace na jednom počítači a podle portu je
  rozliší.
- „IP adresa je adresa počítače.“ Je to adresa rozhraní (síťové karty) v síti; počítač s více
  kartami má více IP.

**Maturita IVT.** Adresace MAC/IP/port a rozdíl hub–switch (potvrdit). **CCNA.** Ethernet a MAC
adresy, funkce přepínače (ITN: úvod do sítí, přepínání).

---

## Úroveň 3: Směrování

**Nová myšlenka.** Paket putuje po úsecích. Na každém úseku se mění linková adresa (MAC), IP adresa
zůstává. Router rozhoduje podle IP adresy a směrovací tabulky; počítač rozhoduje podle masky,
zda je cíl „u mě“ (přímé doručení), nebo jde přes výchozí bránu.

**Výukové cíle.** Student po úrovni:
- z IP adresy a masky určí, zda je cíl ve stejné síti (síť a hostitelská část);
- vysvětlí, k čemu slouží výchozí brána a kdy ji počítač použije;
- popíše, jak počítač zjistí MAC cíle nebo brány (ARP) a že ARP je jen v rámci jedné sítě;
- přečte jednoduchou směrovací tabulku a určí, kudy paket půjde (nejdelší shoda prefixu);
- sleduje, co se mění a co ne při průchodu routerem: MAC mění, IP zůstává, TTL se snižuje o 1;
- vysvětlí, proč existuje TTL a co se stane při TTL = 0 (zahodí se, ICMP Time Exceeded) a jak
  na tom stojí `tracert`.

**Skryté / zjednodušené.** Bez NAT (připraveno na úroveň 5), jen IPv4, statické směrování
(směrovací tabulky už vyplněné), bez fragmentace. Router se v prvních scénářích nechová
jako „černá skříňka“, ale tabulku lze rozkliknout.

**Miskoncepce.**
- „Router zná celou cestu.“ Router zná jen další krok (next hop) pro daný prefix. Simulátor
  zobrazuje rozhodnutí na každém routeru zvlášť a nikdy nevykreslí celou trasu předem.
- „IP adresa se po cestě mění.“ Zdrojová a cílová IP se v obálce nemění (bez NAT); mění se MAC.
  Simulátor zvýrazní, které pole se na routeru přepsalo.
- „Stačí znát IP cíle, MAC není potřeba.“ Bez ARP nelze rámec na linkové vrstvě odeslat; student
  uvidí ARP dotaz předtím, než odejde první paket.
- „Brána je cíl, kam paket míří.“ Brána je jen další krok; cílová IP v paketu je pořád vzdálený server.
  Pokus s chybnou bránou ukáže, že paket zůstane na místě.
- „Maska je jen další číslo, které se píše.“ Chybná maska změní rozhodnutí „přímo vs. přes bránu“;
  student zkusí a sleduje rozdíl.
- „Router posílá všem (jako hub).“ Router vybírá jedno rozhraní podle tabulky; broadcast se přes něj
  nepřenáší.

**Maturita IVT.** IP adresace, maska, brána, směrování (potvrdit). **CCNA.** ITN: IPv4 adresace,
podsítě, směrovací tabulka, ARP, ICMP; základ pro Switching, Routing (SRWE).

---

## Úroveň 4: Transport a aplikace

**Nová myšlenka.** Transportní vrstva rozlišuje aplikace (porty) a volitelně zajišťuje
spolehlivost (TCP). Aplikační protokol (DNS, HTTP) je dohoda klient–server o formátu
dotazu a odpovědi.

**Výukové cíle.** Student po úrovni:
- vysvětlí, že spojení je určeno čtveřicí (zdrojová IP:port, cílová IP:port) a že socket je dvojice IP:port;
- popíše klient–server: server naslouchá (LISTENING) na známém portu, klient má náhodný zdrojový port;
- rozliší UDP (bez spojení, bez potvrzování) a TCP (spojení, potvrzování, opakované odeslání) a ke
  každému uvede vhodný příklad;
- rozepíše three-way handshake (SYN, SYN-ACK, ACK) a řekne, proč jsou potřeba tři kroky;
- vysvětlí, co TCP udělá při ztrátě segmentu (timeout, opakované odeslání);
- popíše, co se děje po zadání adresy do prohlížeče: DNS → TCP handshake → HTTP požadavek → odpověď.

**Skryté / zjednodušené.** Okno, řízení toku a zahlcení se zjednodušují na jednoduché potvrzování
(označit: „Simulátor zjednodušuje“); TLS není. HTTP je jen GET s textovým obsahem.

**Miskoncepce.**
- „Port je díra v počítači (kterou je potřeba otevřít).“ Port je číslo v hlavičce; „otevřený“
  znamená, že tam nějaká aplikace naslouchá. Simulátor ukáže odpověď na zavřený port (RST / ICMP
  port unreachable, upřesní projektant) vs. na otevřený.
- „UDP je horší než TCP.“ Je jiné: nižší režie, nevadí ztráta (DNS, video, hry). Simulátor ukáže
  ztrátu u obou.
- „Handshake je jen formalita.“ Student vidí, že bez něj nejsou domluvena čísla (sekvenční čísla)
  a spojení neexistuje.
- „HTTP a TCP jsou totéž / webová stránka jede po internetu jako celek.“ HTTP je zpráva uvnitř TCP
  segmentu; stránka se může rozdělit do více segmentů.
- „DNS je součástí internetu jako drát.“ DNS je aplikace (UDP/53) s vlastním serverem.

**Maturita IVT.** Služby internetu, DNS, HTTP, klient–server (potvrdit). **CCNA.** ITN: transportní
a aplikační vrstva (TCP, UDP, DNS, HTTP, DHCP). Sedí na Michalovu prezentaci „4. aplikační vrstva“
a Python sockety v semináři.

---

## Úroveň 5: Směrem k CCNA

**Nová myšlenka.** Student už není divák: síť nastavuje (IP, statické trasy v zjednodušeném
Cisco IOS) a hledá v ní chyby systematicky po vrstvách.

**Výukové cíle.** Student po úrovni:
- nastaví IP adresu, masku a bránu na PC a na rozhraní směrovače;
- přidá statickou trasu (`ip route`) a ověří ji (`show ip route`, `ping`, `tracert`);
- při chybě postupuje od spodu nahoru (kabel/rozhraní → adresa/maska/brána → trasa → port/aplikace)
  a každý krok zdůvodní;
- vysvětlí, co dělá DHCP a NAT (překlad privátní ↔ veřejná adresa a portů) a proč se domácí LAN
  schová za jednu veřejnou adresu;
- vysvětlí, na jakých vrstvách filtruje přepínač (L2), směrovač (L3) a firewall (L3/L4).

**Skryté / zjednodušené.** Jen podmnožina IOS příkazů, bez IPv6, VLAN a dynamického směrování.
Chyby jsou předpřipravené (nevhodná maska, chybná brána, chybějící trasa, zavřený port).

**Miskoncepce.**
- „NAT je firewall.“ NAT překládá adresy; filtrování je jiná funkce. Simulátor je zapíná
  zvlášť.
- „Ping nefunguje, tedy je rozbitý kabel.“ Chybu může způsobit kterákoli vrstva; student prochází
  kontrolní seznam.
- „Za NATem má počítač veřejnou adresu.“ Je to privátní adresa; tabulka NAT ukáže překlad.
- „Chybu opravím tam, kde ji vidím.“ Chyba je často na druhém konci (chybí zpáteční trasa).

**Maturita IVT.** Nastavení sítě, diagnostika; NAT a DHCP (potvrdit). **CCNA.** ITN
(konfigurace zařízení, diagnostika, NAT, DHCP) a přípravná cesta k SRWE.

---

## Otevřené otázky pro projektanta

1. V režimu ISO/OSI: nechat vrstvy 7–5 jako jednu skupinu „data“ bez obálek (volba tohoto návrhu),
   nebo kreslit obálky i pro relační a prezentační vrstvu (formálně v souladu s modelem, ale odporuje
   skutečnosti v TCP/IP)?
2. Zobrazit u rámce patičku (FCS) už na úrovni 1, nebo až v rentgenu?
3. Přesné chování „zavřený port“ v simulaci (RST u TCP, ICMP port unreachable u UDP).
4. Požadavky maturity IVT: potřebujeme znění pro vazby výše.
