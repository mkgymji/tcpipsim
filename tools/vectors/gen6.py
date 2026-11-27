#!/usr/bin/env python3
# Vektory modelových situací (docs/spec/ulohy.md, rozhodnutí 66 a 68).
# Spuštění: python3 tools/vectors/gen6.py tests/vectors
import sys, copy, contextlib, io
import gen3
from gen3 import M, T, host, link, arp, mt, arp_req, arp_rep, echo
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
gen3.OUT = OUT
_real_write = gen3.write
gen3.write = lambda v: None              # import gen5 nesmí přepsat jeho vektory
with contextlib.redirect_stdout(io.StringIO()):
    import gen5
gen3.write = _real_write
gen5.write = _real_write
from gen5 import A_IP, C_IP, S_IP, G0, CPORT, isn, frame, send_path
write = _real_write

PRN_MAC = "02:00:00:00:00:05"
PRN_IP = G0   # rozhodnutí 69: tiskárna má omylem IP brány
REFS = ["docs/spec/ulohy.md", "docs/spec/vektory.md kap. 10", "docs/rozhodnuti.md bod 66, 68"]
TXT = ("Topologie úrovně 4 (routing.md kap. 9) jako základ modelové situace (ulohy.md kap. 1). ")

def base():
    return gen5.topo(), gen5.routes()

def empty(nodes):
    return {n: [] for n in nodes}

# ------------------------------------------------------------ situace 1: odpojený kabel
def kabel():
    topo, rt = base()
    for l in topo["links"]:
        if l["id"] == "L1":
            l["connected"] = False
    rt["PC1"] = []
    v = {"format": "tcpipsim-vector/1", "id": "uloha-kabel", "level": 4,
         "title": "Modelová situace 1: kabel Alice vytažený, ping na bránu bez jediného přenosu",
         "description": TXT + "Linka L1 (Alice - SW1) má connected: false. Rozhraní eth0 Alice je bez linky (ipconfig: "
                        "Media State . . . : Media disconnected), Windows mu odebere adresu i cesty, proto odvozená "
                        "směrovací tabulka Alice je prázdná. Ping na 192.168.1.1 nemá kudy odejít: žádný ARP, žádný "
                        "přenos; chyba link_down (Windows: PING: transmit failed. General failure., ověřit).",
         "spec_refs": REFS + ["docs/spec/cmd.md kap. 8.2"],
         "topology": topo,
         "initial_state": {"arp_cache": empty(["PC1", "PC2", "PC3", "R1", "SRV1"]), "mac_table": {"SW1": [], "SW2": []},
                           "routing_table": rt},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": G0, "count": 1}}],
         "expected": {"transmissions": [],
                      "events": [{"step": 0, "node": "PC1", "event": "ip_drop",
                                  "detail": "eth0 bez linky (Media disconnected) -> žádná cesta k 192.168.1.1"}],
                      "final_state": {"arp_cache": empty(["PC1", "PC2", "PC3", "R1", "SRV1"])},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 0, "replies": [],
                                     "errors": [{"seq": 1, "kind": "link_down"}]}}}
    write(v)

# ------------------------------------------------------------ situace 3: konflikt IP (tiskárna)
def konflikt():
    # rozhodnutí 69: tiskárna PRT1 má omylem IP brány 192.168.1.1 (ne Cyrila)
    topo, rt = base()
    prn = host("PRT1", "Tiskárna", "pc", PRN_MAC, PRN_IP, G0, 64)
    prn.update({"device": "printer", "acd": False, "proc_delay_steps": 1})
    topo["nodes"].append(prn)
    topo["links"].append(link("L7", "PRT1", "eth0", "SW1", "Fa0/2"))
    rt["PRT1"] = gen3.host_routes(PRN_IP, G0)
    A, R, P = M["PC1"], M["R1g0"], PRN_MAC
    t = T()
    t.add(1, "L1", "PC1", "SW1", "ARP request: kdo má 192.168.1.1? Ptá se 192.168.1.10", arp_req(A, A_IP, G0))
    for l, to in (("L2", "PC3"), ("L3", "R1"), ("L7", "PRT1")):
        t.add(2, l, "SW1", to, f"flooding broadcastu -> {to}", arp_req(A, A_IP, G0))
    t.add(3, "L3", "R1", "SW1", "ARP reply od R1: 192.168.1.1 má 02:00:00:00:01:01", arp_rep(R, G0, A, A_IP))
    t.add(4, "L1", "SW1", "PC1", "ARP reply od R1", arp_rep(R, G0, A, A_IP))
    t.add(4, "L7", "PRT1", "SW1", "ARP reply od TISKÁRNY: 192.168.1.1 má 02:00:00:00:00:05 (o krok později)", arp_rep(P, PRN_IP, A, A_IP))
    t.add(5, "L1", "PC1", "SW1", "Echo Request seq 1 na MAC R1 (první odpověď)", echo(A, R, A_IP, G0, 128, 8, 1))
    t.add(5, "L1", "SW1", "PC1", "ARP reply od tiskárny: druhá odpověď na tentýž dotaz", arp_rep(P, PRN_IP, A, A_IP))
    t.add(6, "L3", "SW1", "R1", "Echo Request seq 1", echo(A, R, A_IP, G0, 128, 8, 1))
    t.add(7, "L3", "R1", "SW1", "Echo Reply seq 1 od R1 (TTL 255)", echo(R, A, G0, A_IP, 255, 0, 1))
    t.add(8, "L1", "SW1", "PC1", "Echo Reply seq 1 (TTL 255)", echo(R, A, G0, A_IP, 255, 0, 1))
    s2 = 8 + 1000 + 1
    t.add(s2, "L1", "PC1", "SW1", "Echo Request seq 2 — ARP cache už ukazuje na tiskárnu", echo(A, P, A_IP, G0, 128, 8, 2))
    t.add(s2 + 1, "L7", "SW1", "PRT1", "Echo Request seq 2 -> Fa0/2 (tiskárna)", echo(A, P, A_IP, G0, 128, 8, 2))
    t.add(s2 + 3, "L7", "PRT1", "SW1", "Echo Reply seq 2 od tiskárny (TTL 64)", echo(P, A, PRN_IP, A_IP, 64, 0, 2))
    t.add(s2 + 4, "L1", "SW1", "PC1", "Echo Reply seq 2 (TTL 64)", echo(P, A, PRN_IP, A_IP, 64, 0, 2))
    ev = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.1.1 je v mé síti -> ARP přímo na cíl"},
        {"step": 1, "node": "SW1", "event": "flood", "detail": "broadcast -> Fa0/2, Fa0/3, Fa0/4"},
        {"step": 2, "node": "R1", "event": "arp_learn", "detail": "TPA je moje -> záznam 192.168.1.10, odpověď"},
        {"step": 2, "node": "PC3", "event": "arp_ignore", "detail": "TPA není moje, Alici v cache nemám"},
        {"step": 3, "node": "PRT1", "event": "arp_learn", "detail": "TPA 192.168.1.1 je (taky) moje -> záznam 192.168.1.10, odpověď o 1 krok později"},
        {"step": 4, "node": "PC1", "event": "arp_learn", "detail": "192.168.1.1 -> 02:00:00:00:01:01 (R1); Echo Request z fronty"},
        {"step": 5, "node": "PC1", "event": "arp_learn", "detail": "192.168.1.1 už v cache je -> RFC 826 merge: přepis na 02:00:00:00:00:05 (tiskárna)"},
        {"step": 8, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 1, TTL 255 (Cisco)"},
        {"step": s2 + 4, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 2, TTL 64 — stejná IP, jiné zařízení"},
    ]
    nodes = ["PC1", "PC2", "PC3", "R1", "SRV1", "PRT1"]
    fin_arp = empty(nodes)
    fin_arp["PC1"] = [arp(G0, P, "eth0")]
    fin_arp["R1"] = [arp(A_IP, A, "Gi0/0")]
    fin_arp["PRT1"] = [arp(A_IP, A, "eth0")]
    v = {"format": "tcpipsim-vector/1", "id": "uloha-konflikt-ip", "level": 4,
         "title": "Modelová situace 3: tiskárna bez detekce konfliktu má IP brány, ARP cache Alice se přepíše",
         "description": TXT + "Rozhodnutí 69: na SW1 Fa0/2 (linka L7) je tiskárna PRT1 se statickou 192.168.1.1 (IP brány R1), "
                        "bez RFC 5227 (acd: false), TTL 64, odpovídá o 1 krok později (proc_delay_steps: 1; ve skutečnosti "
                        "rozhoduje náhoda). ARP cache a MAC tabulky jsou prázdné. Alice pošle ping -n 2 na 192.168.1.1: na jeden "
                        "ARP request přijdou dvě odpovědi s různou MAC (R1 a tiskárna). Alice pošle seq 1 routeru (první odpověď), "
                        "druhá odpověď záznam přepíše (RFC 826 merge, arp.md kap. 4), takže seq 2 jde tiskárně: odpovědi TTL 255 "
                        "a pak TTL 64. Provoz do jiné sítě by tiskárna zahodila (cílová IP není její): web pak nejde. "
                        "Zda Windows druhou odpovědí záznam opravdu přepíše, je třeba ověřit (ulohy.md kap. 7).",
         "spec_refs": REFS + ["docs/rozhodnuti.md bod 69", "docs/spec/arp.md kap. 4", "RFC 5227 kap. 2.4"],
         "topology": topo,
         "initial_state": {"arp_cache": empty(nodes), "mac_table": {"SW1": [], "SW2": []}, "routing_table": rt},
         "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": G0, "count": 2}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": fin_arp,
                                      "mac_table": {"SW1": [mt(A, "Fa0/1"), mt(R, "Fa0/4"), mt(P, "Fa0/2")], "SW2": []}},
                      "app_result": {"node": "PC1", "command": "ping", "sent": 2, "received": 2,
                                     "replies": [{"from": G0, "bytes": 32, "ttl": 255}, {"from": G0, "bytes": 32, "ttl": 64}]}}}
    write(v)

# ------------------------------------------------------------ situace 10: web neběží -> RST
def web_rst():
    topo = gen5.topo()
    for n in topo["nodes"]:
        if n["id"] == "SRV1":
            for a in n["apps"]:
                if a["name"] == "web":
                    a["running"] = False
    init = gen5.init_state()
    init["tcp_connections"] = {"SRV1": [{"local": "0.0.0.0:53", "remote": "0.0.0.0:0", "state": "LISTEN"}]}
    a_isn = isn(f"{A_IP}:{CPORT}", f"{S_IP}:80")
    def syn(sm, dm, ttl):
        tcp = {"sport": CPORT, "dport": 80, "seq": a_isn, "ack": 0, "rel_seq": 0, "rel_ack": 0, "flags": "SYN",
               "hdr_len": 24, "window": gen5.WIN, "payload_len": 0,
               "options": [{"kind": 2, "name": "MSS", "value": gen5.MSS}]}
        return frame(None, 24, {"tcp": tcp}, 6, sm, dm, A_IP, S_IP, ttl, {})
    def rst(sm, dm, ttl):
        # RFC 9293 kap. 3.10.7.1: SYN bez ACK -> <SEQ=0><ACK=SEG.SEQ+SEG.LEN><CTL=RST,ACK>; rel_* se nekontrolují
        tcp = {"sport": 80, "dport": CPORT, "seq": 0, "ack": (a_isn + 1) & 0xFFFFFFFF, "flags": "RST, ACK",
               "hdr_len": 20, "window": 0, "payload_len": 0}
        return frame(None, 20, {"tcp": tcp}, 6, sm, dm, S_IP, A_IP, ttl, {})
    t = T()
    end = send_path(t, 1, True, "TCP SYN: Alice chce spojení na 192.168.2.10:80", syn)
    send_path(t, end + 1, False, "TCP RST, ACK: na portu 80 nikdo nenaslouchá (nginx neběží)", rst)
    ev = [{"step": 0, "node": "PC1", "event": "tcp_state", "detail": f"CLOSED -> SYN-SENT; port {CPORT}; ISN {a_isn}"},
          {"step": 4, "node": "SRV1", "event": "tcp_rst", "detail": "port 80: žádný socket (služba web zastavená) -> RST, ACK"},
          {"step": 8, "node": "PC1", "event": "tcp_state", "detail": "SYN-SENT -> CLOSED (RST přijat): curl Connection refused"}]
    v = {"format": "tcpipsim-vector/1", "id": "uloha-web-rst", "level": 4, "seed": gen5.SEED,
         "title": "Modelová situace 10: web na SRV1 neběží, SYN na port 80 dostane RST, ACK",
         "description": TXT + "Aplikace web na SRV1 má running: false (nginx zastavený), DNS běží; ARP cache a MAC tabulky "
                        "předvyplněné jako ve vektorech úrovně 4. Alice pošle SYN na 192.168.2.10:80, SRV1 odpoví RST, ACK "
                        "(seq 0, ack = ISN Alice + 1, okno 0; RFC 9293 kap. 3.10.7.1, tcp.md kap. 7.3). L3 je v pořádku "
                        "(TTL 64 -> 63 přes R1), selhává L4. Simulátor zjednodušuje: Windows po RST zkouší SYN ještě dvakrát, "
                        "simulátor ne.",
         "spec_refs": REFS + ["docs/spec/tcp.md kap. 7.3"],
         "topology": topo, "initial_state": init,
         "actions": [{"time": 0, "node": "PC1", "command": "http_get",
                      "args": {"dst": S_IP, "host": gen5.NAME, "path": "/", "port": 80, "client": "curl"}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"tcp_connections": {"PC1": [], "SRV1": copy.deepcopy(init["tcp_connections"]["SRV1"])}},
                      "app_result": {"node": "PC1", "command": "http_get", "status": None, "error": "connection_refused",
                                     "local": f"{A_IP}:{CPORT}", "remote": f"{S_IP}:80", "retransmissions": 0}}}
    write(v)

kabel()
konflikt()
web_rst()
