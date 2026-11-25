#!/usr/bin/env python3
# Vektory úrovně 3 podle rozhodnutí 39-44 (Bob v 192.168.2.0/24 přímo na R1 Gi0/1).
import sys, copy
import gen3
from gen3 import (M, T, host, router, link, host_routes, router_routes, arp, mt,
                  arp_req, arp_rep, echo, time_exceeded)
gen3.OUT = sys.argv[1]
write = gen3.write

A_IP, B_IP, C_IP = "192.168.1.10", "192.168.2.20", "192.168.1.30"
G0, G1 = "192.168.1.1", "192.168.2.1"

def topo(alice_gw=G0):
    nodes = [
        host("PC1", "Alice", "pc", M["PC1"], A_IP, alice_gw, 128),
        host("PC3", "Cyril", "pc", M["PC3"], C_IP, G0, 128),
        {"id": "SW1", "type": "switch", "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"]},
        router("R1", (M["R1g0"], G0), (M["R1g1"], G1)),
        host("PC2", "Bob", "pc", M["PC2"], B_IP, G1, 128),
    ]
    links = [link("L1", "PC1", "eth0", "SW1", "Fa0/1"), link("L2", "PC3", "eth0", "SW1", "Fa0/3"),
             link("L3", "R1", "Gi0/0", "SW1", "Fa0/4"), link("L4", "R1", "Gi0/1", "PC2", "eth0")]
    return {"nodes": nodes, "links": links}

def routes(alice_gw=G0):
    return {"PC1": host_routes(A_IP, alice_gw), "PC3": host_routes(C_IP, G0),
            "R1": router_routes(G0, G1), "PC2": host_routes(B_IP, G1)}

EMPTY = {k: [] for k in ("PC1", "PC2", "PC3", "R1")}
FULL_ARP = {"PC1": [arp(G0, M["R1g0"], "eth0")], "PC2": [arp(G1, M["R1g1"], "eth0")], "PC3": [],
            "R1": [arp(A_IP, M["PC1"], "Gi0/0"), arp(B_IP, M["PC2"], "Gi0/1")]}
FULL_MT = {"SW1": [mt(M["PC1"], "Fa0/1"), mt(M["R1g0"], "Fa0/4")]}
REFS = ["docs/spec/model.md", "docs/spec/arp.md", "docs/spec/ipv4.md", "docs/spec/icmp.md",
        "docs/spec/routing.md", "docs/spec/vektory.md", "docs/rozhodnuti.md bod 9, 39"]
TOPO_TXT = ("Topologie úrovně 3 (rozhodnutí 39, routing.md kap. 7): Alice (Fa0/1) a Cyril (Fa0/3) na SW1 "
            "v 192.168.1.0/24, R1 Gi0/0 na Fa0/4, Bob se přestěhoval do 192.168.2.0/24 (192.168.2.20, MAC "
            "zůstává 02:00:00:00:00:02) a je přímo na R1 Gi0/1; Fa0/2 je volný. ")

def ER(sm, dm, s, d, ttl, seq): return echo(sm, dm, s, d, ttl, 8, seq)
def RP(sm, dm, s, d, ttl, seq): return echo(sm, dm, s, d, ttl, 0, seq)

# ------------------------------------------------ ping-router (minimální, bez switche)
def ping_router():
    nodes = [host("PC1", "Alice", "pc", M["PC1"], A_IP, G0, 128),
             router("R1", (M["R1g0"], G0), (M["R1g1"], G1)),
             host("PC2", "Bob", "pc", M["PC2"], B_IP, G1, 128)]
    links = [link("L1", "PC1", "eth0", "R1", "Gi0/0"), link("L2", "R1", "Gi0/1", "PC2", "eth0")]
    t = T()
    t.add(1, "L1", "PC1", "R1", "ARP request: kdo má 192.168.1.1? Ptá se 192.168.1.10", arp_req(M["PC1"], A_IP, G0))
    t.add(2, "L1", "R1", "PC1", "ARP reply: 192.168.1.1 má MAC 02:00:00:00:01:01", arp_rep(M["R1g0"], G0, M["PC1"], A_IP))
    t.add(3, "L1", "PC1", "R1", "Echo Request 192.168.1.10 -> 192.168.2.20 (cílová MAC = brána)", ER(M["PC1"], M["R1g0"], A_IP, B_IP, 128, 1))
    t.add(4, "L2", "R1", "PC2", "ARP request: kdo má 192.168.2.20? Ptá se 192.168.2.1", arp_req(M["R1g1"], G1, B_IP))
    t.add(5, "L2", "PC2", "R1", "ARP reply: 192.168.2.20 má MAC 02:00:00:00:00:02", arp_rep(M["PC2"], B_IP, M["R1g1"], G1))
    t.add(6, "L2", "R1", "PC2", "Echo Request (nové MAC, stejné IP, TTL 127)", ER(M["R1g1"], M["PC2"], A_IP, B_IP, 127, 1))
    t.add(7, "L2", "PC2", "R1", "Echo Reply 192.168.2.20 -> 192.168.1.10 (TTL 128)", RP(M["PC2"], M["R1g1"], B_IP, A_IP, 128, 1))
    t.add(8, "L1", "R1", "PC1", "Echo Reply (TTL 127)", RP(M["R1g0"], M["PC1"], B_IP, A_IP, 127, 1))
    ev = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.2.20 není v 192.168.1.0/24 -> výchozí cesta, next hop 192.168.1.1; ARP na bránu, ne na Boba"},
        {"step": 1, "node": "R1", "event": "arp_learn", "detail": "192.168.1.10 -> 02:00:00:00:00:01 na Gi0/0 (z requestu)"},
        {"step": 2, "node": "PC1", "event": "arp_learn", "detail": "192.168.1.1 -> 02:00:00:00:01:01; odeslání paketu z fronty"},
        {"step": 3, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; longest match 192.168.2.0/24 connected Gi0/1; next hop = 192.168.2.20, MAC neznámá"},
        {"step": 3, "node": "R1", "event": "arp_queue", "detail": "paket čeká na ARP 192.168.2.20 na Gi0/1"},
        {"step": 4, "node": "PC2", "event": "arp_learn", "detail": "192.168.2.1 -> 02:00:00:00:01:02 (z requestu)"},
        {"step": 5, "node": "R1", "event": "arp_learn", "detail": "192.168.2.20 -> 02:00:00:00:00:02 na Gi0/1; odeslání z fronty"},
        {"step": 6, "node": "PC2", "event": "ip_deliver", "detail": "Echo Request pro mě; odpověď přes bránu 192.168.2.1, jejíž MAC už znám"},
        {"step": 7, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; 192.168.1.0/24 connected Gi0/0; MAC 192.168.1.10 známá"},
        {"step": 8, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply id 1 seq 1, TTL 127"},
    ]
    arp0 = {"PC1": [], "R1": [], "PC2": []}
    v = {"format": "tcpipsim-vector/1", "id": "ping-router",
         "title": "Ping Alice (192.168.1.0/24) -> Bob (192.168.2.0/24) přes router, přímé kabely",
         "description": "Minimální varianta topologie úrovně 3 (rozhodnutí 39) bez switche, aby vynikla L3 logika. Alice se ARPem ptá na bránu, ne na Boba. Router snižuje TTL, mění MAC adresy rámce, IP adresy zůstávají; paket čeká ve frontě routeru na ARP Boba (rozhodnutí 9). Bob (Windows, TTL 128) odpovídá novým paketem, Alice vidí TTL 127. Plná topologie se switchem je ve vektoru ping-arp-prvni.",
         "level": 3, "spec_refs": REFS,
         "topology": {"nodes": nodes, "links": links},
         "initial_state": {"arp_cache": arp0, "routing_table": {"PC1": host_routes(A_IP, G0), "R1": router_routes(G0, G1), "PC2": host_routes(B_IP, G1)}},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": B_IP, "count": 1}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": {"PC1": [arp(G0, M["R1g0"], "eth0")],
                                                    "R1": [arp(A_IP, M["PC1"], "Gi0/0"), arp(B_IP, M["PC2"], "Gi0/1")],
                                                    "PC2": [arp(G1, M["R1g1"], "eth0")]}},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 1,
                                     "replies": [{"from": B_IP, "bytes": 32, "ttl": 127}]}}}
    write(v)

# ------------------------------------------------ ping-arp-prvni
def ping_arp_prvni():
    t = T()
    rq = arp_req(M["PC1"], A_IP, G0); rp = arp_rep(M["R1g0"], G0, M["PC1"], A_IP)
    t.add(1, "L1", "PC1", "SW1", "ARP request: kdo má 192.168.1.1? Ptá se 192.168.1.10 (brána, ne Bob)", rq)
    t.add(2, "L2", "SW1", "PC3", "ARP request (broadcast, switch flooduje) -> Cyril", rq)
    t.add(2, "L3", "SW1", "R1", "ARP request (broadcast, switch flooduje) -> R1", rq)
    t.add(3, "L3", "R1", "SW1", "ARP reply: 192.168.1.1 má MAC 02:00:00:00:01:01 (unicast)", rp)
    t.add(4, "L1", "SW1", "PC1", "ARP reply přeposlaný jen na Fa0/1", rp)
    def round_(b, seq, with_arp):
        s = b
        t.add(s + 1, "L1", "PC1", "SW1", f"Echo Request seq {seq}: cílová MAC = brána, cílová IP = Bob", ER(M["PC1"], M["R1g0"], A_IP, B_IP, 128, seq))
        t.add(s + 2, "L3", "SW1", "R1", f"Echo Request seq {seq} přeposlaný na Fa0/4", ER(M["PC1"], M["R1g0"], A_IP, B_IP, 128, seq))
        s += 2
        if with_arp:
            t.add(s + 1, "L4", "R1", "PC2", "ARP request: kdo má 192.168.2.20? Ptá se 192.168.2.1 (paket čeká ve frontě routeru)", arp_req(M["R1g1"], G1, B_IP))
            t.add(s + 2, "L4", "PC2", "R1", "ARP reply: 192.168.2.20 má MAC 02:00:00:00:00:02", arp_rep(M["PC2"], B_IP, M["R1g1"], G1))
            s += 2
        t.add(s + 1, "L4", "R1", "PC2", f"Echo Request seq {seq}: nové MAC, stejné IP, TTL 127", ER(M["R1g1"], M["PC2"], A_IP, B_IP, 127, seq))
        t.add(s + 2, "L4", "PC2", "R1", f"Echo Reply seq {seq}, TTL 128 (Bob = Windows)", RP(M["PC2"], M["R1g1"], B_IP, A_IP, 128, seq))
        t.add(s + 3, "L3", "R1", "SW1", f"Echo Reply seq {seq}, TTL 127", RP(M["R1g0"], M["PC1"], B_IP, A_IP, 127, seq))
        t.add(s + 4, "L1", "SW1", "PC1", f"Echo Reply seq {seq} přeposlaný na Fa0/1", RP(M["R1g0"], M["PC1"], B_IP, A_IP, 127, seq))
        return s + 4
    end1 = round_(4, 1, True)          # 12
    end2 = round_(end1 + 1000, 2, False)  # 1 s po odpovědi
    ev = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.2.20 není v 192.168.1.0/24 -> výchozí cesta, next hop 192.168.1.1; Echo Request čeká ve frontě na ARP"},
        {"step": 1, "node": "SW1", "event": "mac_learn", "detail": "02:00:00:00:00:01 na Fa0/1"},
        {"step": 1, "node": "SW1", "event": "flood", "detail": "broadcast -> Fa0/3, Fa0/4 (Fa0/2 je volný)"},
        {"step": 2, "node": "PC3", "event": "arp_ignore", "detail": "TPA 192.168.1.1 není moje; Alici v cache nemám, záznam si nevytvořím (RFC 826)"},
        {"step": 2, "node": "R1", "event": "arp_learn", "detail": "192.168.1.10 -> 02:00:00:00:00:01 na Gi0/0 (z requestu)"},
        {"step": 3, "node": "SW1", "event": "mac_learn", "detail": "02:00:00:00:01:01 na Fa0/4"},
        {"step": 4, "node": "PC1", "event": "arp_learn", "detail": "192.168.1.1 -> 02:00:00:00:01:01; odeslání paketu z fronty"},
        {"step": 6, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; longest match 192.168.2.0/24 connected Gi0/1; next hop = 192.168.2.20"},
        {"step": 6, "node": "R1", "event": "arp_queue", "detail": "paket čeká na ARP 192.168.2.20 na Gi0/1"},
        {"step": 7, "node": "PC2", "event": "arp_learn", "detail": "192.168.2.1 -> 02:00:00:00:01:02 (z requestu)"},
        {"step": 8, "node": "R1", "event": "arp_learn", "detail": "192.168.2.20 -> 02:00:00:00:00:02 na Gi0/1; odeslání z fronty"},
        {"step": 9, "node": "PC2", "event": "ip_deliver", "detail": "Echo Request pro mě; odpověď přes bránu 192.168.2.1, MAC známá"},
        {"step": 10, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; 192.168.1.0/24 connected Gi0/0"},
        {"step": end1, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 1, TTL 127"},
        {"step": end2, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 2, TTL 127; tentokrát bez jediného ARP"},
    ]
    v = {"format": "tcpipsim-vector/1", "id": "ping-arp-prvni",
         "title": "Úroveň 3: první ping Alice -> Bob přes router s prázdnými ARP cache (fronta), druhý už bez ARP",
         "description": TOPO_TXT + "Všechny ARP cache i MAC tabulka jsou prázdné. Alice pošle ping -n 2 na Boba. Seq 1: Alice se ARPem ptá na bránu (ne na Boba), Echo Request čeká ve frontě (rozhodnutí 9, arp.md kap. 6); Cyril broadcast dostane, ale nic si neuloží; router si Alici zapamatuje už z requestu, a proto při odpovědi ARP na Alici neposílá; na druhé straně router ARPem zjistí Boba, paket mezitím čeká v jeho frontě. Seq 2 (1 s po odpovědi): žádný ARP, 6 přenosů místo 13. TTL odpovědi 127 (Bob 128 - 1 router).",
         "level": 3, "spec_refs": REFS + ["docs/spec/ethernet.md"],
         "topology": topo(),
         "initial_state": {"arp_cache": copy.deepcopy(EMPTY), "mac_table": {"SW1": []}, "routing_table": routes()},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": B_IP, "count": 2}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": copy.deepcopy(FULL_ARP), "mac_table": copy.deepcopy(FULL_MT)},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 2, "received": 2,
                                     "replies": [{"from": B_IP, "bytes": 32, "ttl": 127}] * 2}}}
    write(v)

# ------------------------------------------------ ping-bez-brany
def ping_bez_brany():
    v = {"format": "tcpipsim-vector/1", "id": "ping-bez-brany",
         "title": "Úroveň 3: Alice bez výchozí brány pinguje Boba v jiné síti -> nic neodejde",
         "description": TOPO_TXT + "Alice má konfiguraci z úrovně 2 (rozhodnutí 27): Default Gateway prázdná. Cíl 192.168.2.20 není v 192.168.1.0/24 a směrovací tabulka Alice nemá výchozí cestu, takže IP vrstva paket vůbec neodešle: žádný ARP, žádný rámec na lince, switch se nic nenaučí. Chybu hlásí vlastní OS Alice, ne síť. Windows vypíše „PING: transmit failed. General failure.“ (cmd.md kap. 8.2; ověřit při pilotu, rozhodnutí 46). Typická chyba: student hledá problém na routeru, ale paket nikdy neopustil PC.",
         "level": 3, "spec_refs": ["docs/spec/ipv4.md kap. 4.2", "docs/spec/routing.md kap. 6", "docs/spec/cmd.md kap. 8", "docs/rozhodnuti.md bod 39, 41"],
         "topology": topo(alice_gw=None),
         "initial_state": {"arp_cache": copy.deepcopy(EMPTY), "mac_table": {"SW1": []}, "routing_table": routes(alice_gw=None)},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": B_IP, "count": 1}}],
         "expected": {"transmissions": [],
                      "events": [{"step": 0, "node": "PC1", "event": "ip_drop", "detail": "žádná cesta k 192.168.2.20: není v 192.168.1.0/24 a výchozí brána není nastavená"}],
                      "final_state": {"arp_cache": copy.deepcopy(EMPTY), "mac_table": {"SW1": []}},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 0, "replies": [],
                                     "errors": [{"seq": 1, "kind": "no_route"}]}}}
    write(v)

# ------------------------------------------------ ping-spatna-brana
def ping_spatna_brana():
    t = T()
    rq = arp_req(M["PC1"], A_IP, "192.168.1.254")
    for k, b in enumerate((0, 1000, 2000)):
        t.add(b + 1, "L1", "PC1", "SW1", f"ARP request {k + 1}/3: kdo má 192.168.1.254? Ptá se 192.168.1.10", rq)
        t.add(b + 2, "L2", "SW1", "PC3", f"ARP request {k + 1}/3 (broadcast) -> Cyril", rq)
        t.add(b + 2, "L3", "SW1", "R1", f"ARP request {k + 1}/3 (broadcast) -> R1; tu adresu nemá nikdo", rq)
    ev = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.2.20 mimo 192.168.1.0/24 -> výchozí brána 192.168.1.254; Echo Request čeká na ARP"},
        {"step": 2, "node": "R1", "event": "arp_ignore", "detail": "TPA 192.168.1.254 není moje adresa (já jsem 192.168.1.1); proxy ARP by neodpověděl, cíl je ve stejné síti jako Gi0/0"},
        {"step": 2, "node": "PC3", "event": "arp_ignore", "detail": "TPA 192.168.1.254 není moje"},
        {"step": 3000, "node": "PC1", "event": "arp_fail", "detail": "3 pokusy bez odpovědi; paket z fronty zahozen, ping hlásí Destination host unreachable od vlastní adresy"},
    ]
    v = {"format": "tcpipsim-vector/1", "id": "ping-spatna-brana",
         "title": "Úroveň 3: překlep v bráně (192.168.1.254 místo 192.168.1.1) -> ARP bez odpovědi",
         "description": TOPO_TXT + "Alice má výchozí bránu 192.168.1.254 (typická chyba: brána opsaná z jiné sítě, kde router má .254; rozhodnutí 41). Alice správně pozná, že Bob je v jiné síti, a ptá se ARPem na bránu 192.168.1.254. Tu adresu nemá nikdo: request se 3x zopakuje po 1 s (arp.md kap. 6.2), switch ho pokaždé flooduje, router ho ignoruje (není to jeho IP). Pak se paket zahodí a Windows vypíše „Reply from 192.168.1.10: Destination host unreachable.“ — od vlastní adresy Alice, žádná ICMP zpráva na lince není. Student chybu pozná podle cílové IP v ARP requestu (TPA 192.168.1.254). Bob ani linka L4 se nic nedozví; router si Alici nezapamatuje (TPA není jeho, záznam nemá, RFC 826).",
         "level": 3, "spec_refs": ["docs/spec/arp.md kap. 4 a 6", "docs/spec/ipv4.md kap. 4.2", "docs/spec/cmd.md kap. 8", "docs/rozhodnuti.md bod 39, 41"],
         "topology": topo(alice_gw="192.168.1.254"),
         "initial_state": {"arp_cache": copy.deepcopy(EMPTY), "mac_table": {"SW1": []}, "routing_table": routes(alice_gw="192.168.1.254")},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": B_IP, "count": 1}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": copy.deepcopy(EMPTY), "mac_table": {"SW1": [mt(M["PC1"], "Fa0/1")]}},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 0, "replies": [],
                                     "errors": [{"seq": 1, "kind": "arp_failed", "from": A_IP}]}}}
    write(v)

# ------------------------------------------------ tracert-alice-bob
def tracert_alice_bob():
    t = T(); s = 0; ev = []
    def P(ttl): return echo(M["PC1"], M["R1g0"], A_IP, B_IP, ttl, 8, None, 64, None)
    te = time_exceeded(M["R1g0"], M["PC1"], G0, A_IP, 255, A_IP, B_IP)
    for p in range(1, 4):
        t.add(s + 1, "L1", "PC1", "SW1", f"hop 1, sonda {p}: Echo Request TTL 1", P(1))
        t.add(s + 2, "L3", "SW1", "R1", f"hop 1, sonda {p}: Echo Request TTL 1 -> R1", P(1))
        t.add(s + 3, "L3", "R1", "SW1", f"hop 1, sonda {p}: Time Exceeded od 192.168.1.1 (Gi0/0, kudy zpráva odchází), TTL 255", te)
        t.add(s + 4, "L1", "SW1", "PC1", f"hop 1, sonda {p}: Time Exceeded -> Alice", te)
        if p == 1:
            ev.append({"step": 2, "node": "R1", "event": "ip_drop", "detail": "TTL 1: snížením by kleslo na 0 -> zahodit, ICMP Time Exceeded (11/0) zdroji 192.168.1.10 ze zdrojové adresy 192.168.1.1 (RFC 1812 4.3.2.4)"})
        s += 4
    for p in range(1, 4):
        t.add(s + 1, "L1", "PC1", "SW1", f"hop 2, sonda {p}: Echo Request TTL 2", P(2))
        t.add(s + 2, "L3", "SW1", "R1", f"hop 2, sonda {p}: Echo Request TTL 2 -> R1", P(2))
        t.add(s + 3, "L4", "R1", "PC2", f"hop 2, sonda {p}: R1 snížil TTL na 1, connected Gi0/1 - Bob paket přijme",
              echo(M["R1g1"], M["PC2"], A_IP, B_IP, 1, 8, None, 64, None))
        t.add(s + 4, "L4", "PC2", "R1", f"hop 2, sonda {p}: Echo Reply TTL 128", echo(M["PC2"], M["R1g1"], B_IP, A_IP, 128, 0, None, 64, None))
        t.add(s + 5, "L3", "R1", "SW1", f"hop 2, sonda {p}: Echo Reply TTL 127", echo(M["R1g0"], M["PC1"], B_IP, A_IP, 127, 0, None, 64, None))
        t.add(s + 6, "L1", "SW1", "PC1", f"hop 2, sonda {p}: Echo Reply -> Alice", echo(M["R1g0"], M["PC1"], B_IP, A_IP, 127, 0, None, 64, None))
        if p == 1:
            ev += [{"step": s + 2, "node": "R1", "event": "ip_forward", "detail": "TTL 2 -> 1; 192.168.2.0/24 connected Gi0/1"},
                   {"step": s + 3, "node": "PC2", "event": "ip_deliver", "detail": "Echo Request s TTL 1 pro mě: hostitel TTL nekontroluje, paket nepřeposílá"}]
        s += 6
    ev.append({"step": s, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply od cíle 192.168.2.20 -> tracert končí (Trace complete.)"})
    v = {"format": "tcpipsim-vector/1", "id": "tracert-alice-bob",
         "title": "Úroveň 3: tracert -d z Alice na Boba přes jeden router (TTL 1 -> Time Exceeded, TTL 2 -> Echo Reply)",
         "description": TOPO_TXT + "ARP cache a MAC tabulka jsou naplněné předchozím pingem (koncový stav ping-arp-prvni), aby vektor ukazoval jen TTL. Windows tracert posílá ICMP Echo Request s TTL 1, 2, …, 3 sondy na skok, data 64 B nul (ověřit při pilotu). Sonda s TTL 1: R1 ji zahodí a pošle Time Exceeded ze zdrojové adresy rozhraní, kterým zpráva odchází (192.168.1.1, RFC 1812 4.3.2.4). Sonda s TTL 2: R1 sníží TTL na 1 a doručí ji Bobovi, který odpoví Echo Reply; tracert skončí. Výpis: 1 192.168.1.1, 2 192.168.2.20 (rozhodnutí 44). Simulátor zjednodušuje: další sonda odchází hned po odpovědi na předchozí; akce odpovídá tracert -d (bez DNS). Vektor má skip, dokud jádro neumí akci tracert.",
         "level": 3,
         "skip": "jádro zatím neumí akci tracert ani ICMP Time Exceeded (úroveň 3)",
         "spec_refs": ["docs/spec/icmp.md kap. 3 a 4", "docs/spec/ipv4.md kap. 3 a 5", "docs/spec/routing.md", "docs/spec/cmd.md kap. 9", "docs/rozhodnuti.md bod 39, 44"],
         "topology": topo(),
         "initial_state": {"arp_cache": copy.deepcopy(FULL_ARP), "mac_table": copy.deepcopy(FULL_MT), "routing_table": routes()},
         "actions": [{"time": 0, "node": "PC1", "command": "tracert", "args": {"dst": B_IP, "max_hops": 30, "probes": 3, "resolve": False}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": copy.deepcopy(FULL_ARP), "mac_table": copy.deepcopy(FULL_MT)},
                      "app_result": {"node": "PC1", "command": "tracert", "reached": True,
                                     "hops": [{"hop": 1, "from": G0, "replies": 3, "kind": "time_exceeded"},
                                              {"hop": 2, "from": B_IP, "replies": 3, "kind": "echo_reply"}]}}}
    write(v)

ping_router(); ping_arp_prvni(); ping_bez_brany(); ping_spatna_brana(); tracert_alice_bob()
