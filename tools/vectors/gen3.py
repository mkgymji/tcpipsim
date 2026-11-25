#!/usr/bin/env python3
# Generátor vektorů úrovně 3 (projektant). Výstup do tests/vectors/.
import json, sys, copy

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
BC = "ff:ff:ff:ff:ff:ff"
Z = "00:00:00:00:00:00"
M = {"PC1": "02:00:00:00:00:01", "PC2": "02:00:00:00:00:02", "PC3": "02:00:00:00:00:03",
     "SRV1": "02:00:00:00:00:04",
     "R1g0": "02:00:00:00:01:01", "R1g1": "02:00:00:00:01:02",
     "R2g0": "02:00:00:00:02:01", "R2g1": "02:00:00:00:02:02"}

def host(id_, label, typ, mac, ip, gw, ttl):
    n = {"id": id_, "type": typ, "label": label, "ttl_default": ttl,
         "interfaces": [{"name": "eth0", "mac": mac, "ip": ip, "prefix": 24}]}
    if gw: n["gateway"] = gw
    return n

def router(id_, if0, if1, static=None):
    n = {"id": id_, "type": "router", "label": id_, "ttl_default": 255,
         "interfaces": [{"name": "Gi0/0", "mac": if0[0], "ip": if0[1], "prefix": 24},
                        {"name": "Gi0/1", "mac": if1[0], "ip": if1[1], "prefix": 24}]}
    if static: n["static_routes"] = static
    return n

def link(i, a, ai, b, bi):
    return {"id": i, "a": {"node": a, "if": ai}, "b": {"node": b, "if": bi}}

def net(ip):  # /24
    return ".".join(ip.split(".")[:3]) + ".0/24"

def host_routes(ip, gw):
    r = [{"prefix": net(ip), "next_hop": None, "if": "eth0", "type": "connected"}]
    if gw: r.append({"prefix": "0.0.0.0/0", "next_hop": gw, "if": "eth0", "type": "default"})
    return r

def router_routes(ip0, ip1, extra=()):
    r = []
    for ip, ifn in ((ip0, "Gi0/0"), (ip1, "Gi0/1")):
        r.append({"prefix": net(ip), "next_hop": None, "if": ifn, "type": "connected"})
        r.append({"prefix": ip + "/32", "next_hop": None, "if": ifn, "type": "local"})
    r.extend(extra)
    return r

def arp(ip, mac, ifn):
    return {"ip": ip, "mac": mac, "if": ifn, "type": "dynamic"}

def mt(mac, port):
    return {"mac": mac, "port": port, "vlan": 1, "type": "dynamic"}

class T:
    def __init__(self): self.l = []
    def add(self, step, link_, frm, to, summary, pdu):
        self.l.append({"n": len(self.l) + 1, "step": step, "link": link_, "from": frm, "to": to,
                       "summary": summary, "pdu": pdu})

def arp_req(smac, sip, tip):
    return {"eth": {"dst": BC, "src": smac, "ethertype": "0x0806"},
            "arp": {"op": "request", "sha": smac, "spa": sip, "tha": Z, "tpa": tip}, "frame_len": 60}

def arp_rep(smac, sip, dmac, dip):
    return {"eth": {"dst": dmac, "src": smac, "ethertype": "0x0806"},
            "arp": {"op": "reply", "sha": smac, "spa": sip, "tha": dmac, "tpa": dip}, "frame_len": 60}

def echo(src_mac, dst_mac, sip, dip, ttl, typ, seq=None, data=32, icmp_id=1):
    ic = {"type": typ, "code": 0}
    if icmp_id is not None: ic["id"] = icmp_id
    if seq is not None: ic["seq"] = seq
    ic["data_len"] = data
    return {"eth": {"dst": dst_mac, "src": src_mac, "ethertype": "0x0800"},
            "ip": {"src": sip, "dst": dip, "ttl": ttl, "protocol": 1, "total_length": 20 + 8 + data},
            "icmp": ic, "frame_len": max(60, 14 + 20 + 8 + data)}

def time_exceeded(src_mac, dst_mac, sip, dip, ttl, orig_src, orig_dst):
    return {"eth": {"dst": dst_mac, "src": src_mac, "ethertype": "0x0800"},
            "ip": {"src": sip, "dst": dip, "ttl": ttl, "protocol": 1, "total_length": 56},
            "icmp": {"type": 11, "code": 0,
                     "orig": {"src": orig_src, "dst": orig_dst, "protocol": 1}},
            "frame_len": 70}

def write(v):
    with open(f"{OUT}/{v['id']}.json", "w", encoding="utf-8") as f:
        json.dump(v, f, ensure_ascii=False, indent=2)
        f.write("\n")

# ---------------------------------------------------------------- topologie úrovně 3
def base_topology(alice_gw="192.168.1.1"):
    nodes = [
        host("PC1", "Alice", "pc", M["PC1"], "192.168.1.10", alice_gw, 128),
        host("PC2", "Bob", "pc", M["PC2"], "192.168.1.20", "192.168.1.1", 128),
        host("PC3", "Cyril", "pc", M["PC3"], "192.168.1.30", "192.168.1.1", 128),
        {"id": "SW1", "type": "switch", "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"]},
        router("R1", (M["R1g0"], "192.168.1.1"), (M["R1g1"], "192.168.2.1")),
        host("SRV1", "Server", "server", M["SRV1"], "192.168.2.10", "192.168.2.1", 64),
    ]
    links = [link("L1", "PC1", "eth0", "SW1", "Fa0/1"), link("L2", "PC2", "eth0", "SW1", "Fa0/2"),
             link("L3", "PC3", "eth0", "SW1", "Fa0/3"), link("L4", "R1", "Gi0/0", "SW1", "Fa0/4"),
             link("L5", "R1", "Gi0/1", "SRV1", "eth0")]
    return {"nodes": nodes, "links": links}

def base_routes(alice_gw="192.168.1.1"):
    return {"PC1": host_routes("192.168.1.10", alice_gw),
            "PC2": host_routes("192.168.1.20", "192.168.1.1"),
            "PC3": host_routes("192.168.1.30", "192.168.1.1"),
            "R1": router_routes("192.168.1.1", "192.168.2.1"),
            "SRV1": host_routes("192.168.2.10", "192.168.2.1")}

EMPTY_ARP = {k: [] for k in ("PC1", "PC2", "PC3", "R1", "SRV1")}
REFS = ["docs/spec/model.md", "docs/spec/arp.md", "docs/spec/ipv4.md", "docs/spec/icmp.md",
        "docs/spec/routing.md", "docs/spec/vektory.md"]

# ---------------------------------------------------------------- ping-arp-prvni
def ping_arp_prvni():
    t = T()
    t.add(1, "L1", "PC1", "SW1", "ARP request: kdo má 192.168.1.1? Ptá se 192.168.1.10 (brána, ne server)",
          arp_req(M["PC1"], "192.168.1.10", "192.168.1.1"))
    for s, l, to in ((2, "L2", "PC2"), (2, "L3", "PC3"), (2, "L4", "R1")):
        t.add(s, l, "SW1", to, f"ARP request (broadcast, switch flooduje) -> {to}",
              arp_req(M["PC1"], "192.168.1.10", "192.168.1.1"))
    t.add(3, "L4", "R1", "SW1", "ARP reply: 192.168.1.1 má MAC 02:00:00:00:01:01 (unicast)",
          arp_rep(M["R1g0"], "192.168.1.1", M["PC1"], "192.168.1.10"))
    t.add(4, "L1", "SW1", "PC1", "ARP reply přeposlaný jen na Fa0/1",
          arp_rep(M["R1g0"], "192.168.1.1", M["PC1"], "192.168.1.10"))
    t.add(5, "L1", "PC1", "SW1", "Echo Request seq 1 z fronty: cílová MAC = brána, cílová IP = server",
          echo(M["PC1"], M["R1g0"], "192.168.1.10", "192.168.2.10", 128, 8, 1))
    t.add(6, "L4", "SW1", "R1", "Echo Request seq 1 přeposlaný na Fa0/4 (MAC routeru už switch zná)",
          echo(M["PC1"], M["R1g0"], "192.168.1.10", "192.168.2.10", 128, 8, 1))
    t.add(7, "L5", "R1", "SRV1", "ARP request: kdo má 192.168.2.10? Ptá se 192.168.2.1 (paket čeká ve frontě routeru)",
          arp_req(M["R1g1"], "192.168.2.1", "192.168.2.10"))
    t.add(8, "L5", "SRV1", "R1", "ARP reply: 192.168.2.10 má MAC 02:00:00:00:00:04",
          arp_rep(M["SRV1"], "192.168.2.10", M["R1g1"], "192.168.2.1"))
    t.add(9, "L5", "R1", "SRV1", "Echo Request seq 1: nové MAC, stejné IP, TTL 127",
          echo(M["R1g1"], M["SRV1"], "192.168.1.10", "192.168.2.10", 127, 8, 1))
    t.add(10, "L5", "SRV1", "R1", "Echo Reply seq 1, TTL 64 (server = Linux)",
          echo(M["SRV1"], M["R1g1"], "192.168.2.10", "192.168.1.10", 64, 0, 1))
    t.add(11, "L4", "R1", "SW1", "Echo Reply seq 1, TTL 63, MAC Alice router zná z jejího ARP requestu",
          echo(M["R1g0"], M["PC1"], "192.168.2.10", "192.168.1.10", 63, 0, 1))
    t.add(12, "L1", "SW1", "PC1", "Echo Reply seq 1 přeposlaný na Fa0/1",
          echo(M["R1g0"], M["PC1"], "192.168.2.10", "192.168.1.10", 63, 0, 1))
    b = 1012  # druhý dotaz 1 s po přijetí odpovědi (krok 12 = 12 ms)
    t.add(b + 1, "L1", "PC1", "SW1", "Echo Request seq 2: MAC brány už v ARP cache, žádný ARP",
          echo(M["PC1"], M["R1g0"], "192.168.1.10", "192.168.2.10", 128, 8, 2))
    t.add(b + 2, "L4", "SW1", "R1", "Echo Request seq 2",
          echo(M["PC1"], M["R1g0"], "192.168.1.10", "192.168.2.10", 128, 8, 2))
    t.add(b + 3, "L5", "R1", "SRV1", "Echo Request seq 2, TTL 127, bez ARP",
          echo(M["R1g1"], M["SRV1"], "192.168.1.10", "192.168.2.10", 127, 8, 2))
    t.add(b + 4, "L5", "SRV1", "R1", "Echo Reply seq 2, TTL 64",
          echo(M["SRV1"], M["R1g1"], "192.168.2.10", "192.168.1.10", 64, 0, 2))
    t.add(b + 5, "L4", "R1", "SW1", "Echo Reply seq 2, TTL 63",
          echo(M["R1g0"], M["PC1"], "192.168.2.10", "192.168.1.10", 63, 0, 2))
    t.add(b + 6, "L1", "SW1", "PC1", "Echo Reply seq 2",
          echo(M["R1g0"], M["PC1"], "192.168.2.10", "192.168.1.10", 63, 0, 2))
    events = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.2.10 není v 192.168.1.0/24 -> výchozí cesta, next hop 192.168.1.1; Echo Request čeká ve frontě na ARP"},
        {"step": 1, "node": "SW1", "event": "mac_learn", "detail": "02:00:00:00:00:01 na Fa0/1"},
        {"step": 1, "node": "SW1", "event": "flood", "detail": "broadcast -> Fa0/2, Fa0/3, Fa0/4"},
        {"step": 2, "node": "PC2", "event": "arp_ignore", "detail": "TPA 192.168.1.1 není moje; Alici v cache nemám, záznam si nevytvořím (RFC 826)"},
        {"step": 2, "node": "PC3", "event": "arp_ignore", "detail": "TPA 192.168.1.1 není moje"},
        {"step": 2, "node": "R1", "event": "arp_learn", "detail": "192.168.1.10 -> 02:00:00:00:00:01 na Gi0/0 (z requestu)"},
        {"step": 3, "node": "SW1", "event": "mac_learn", "detail": "02:00:00:00:01:01 na Fa0/4"},
        {"step": 4, "node": "PC1", "event": "arp_learn", "detail": "192.168.1.1 -> 02:00:00:00:01:01; odeslání paketu z fronty"},
        {"step": 6, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; longest match 192.168.2.0/24 connected Gi0/1; next hop = 192.168.2.10"},
        {"step": 6, "node": "R1", "event": "arp_queue", "detail": "paket čeká na ARP 192.168.2.10 na Gi0/1"},
        {"step": 7, "node": "SRV1", "event": "arp_learn", "detail": "192.168.2.1 -> 02:00:00:00:01:02 (z requestu)"},
        {"step": 8, "node": "R1", "event": "arp_learn", "detail": "192.168.2.10 -> 02:00:00:00:00:04 na Gi0/1; odeslání z fronty"},
        {"step": 9, "node": "SRV1", "event": "ip_deliver", "detail": "Echo Request pro mě; odpověď přes bránu 192.168.2.1, MAC známá"},
        {"step": 10, "node": "R1", "event": "ip_forward", "detail": "TTL 64 -> 63; 192.168.1.0/24 connected Gi0/0"},
        {"step": 12, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 1, TTL 63"},
        {"step": 1018, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply seq 2, TTL 63; tentokrát bez jediného ARP"},
    ]
    v = {
        "format": "tcpipsim-vector/1", "id": "ping-arp-prvni",
        "title": "Úroveň 3: první ping přes router s prázdnými ARP cache (fronta), druhý už bez ARP",
        "description": "Topologie úrovně 3 (routing.md kap. 7): Alice, Bob, Cyril na SW1 jako v úrovni 2, router R1 na Fa0/4, server v síti 192.168.2.0/24. Všechny ARP cache i MAC tabulka jsou prázdné (zařízení právě zapnutá). Alice pošle ping -n 2 na server. Seq 1: Alice se ARPem ptá na bránu (ne na server), Echo Request čeká ve frontě (rozhodnutí 9, arp.md kap. 6); Bob a Cyril broadcast dostanou, ale nic si neuloží; router si Alici zapamatuje už z requestu, a proto při odpovědi ARP na Alici neposílá; na druhé straně router ARPem zjistí server, paket mezitím čeká v jeho frontě. Seq 2 (1 s po odpovědi): žádný ARP, 6 přenosů místo 12. TTL odpovědi 63 (server 64 - 1 router).",
        "level": 3, "spec_refs": REFS + ["docs/spec/ethernet.md", "docs/rozhodnuti.md bod 9, 25"],
        "topology": base_topology(),
        "initial_state": {"arp_cache": copy.deepcopy(EMPTY_ARP), "mac_table": {"SW1": []},
                          "routing_table": base_routes()},
        "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": "192.168.2.10", "count": 2}}],
        "expected": {
            "transmissions": t.l, "events": events,
            "final_state": {
                "arp_cache": {"PC1": [arp("192.168.1.1", M["R1g0"], "eth0")], "PC2": [], "PC3": [],
                              "R1": [arp("192.168.1.10", M["PC1"], "Gi0/0"), arp("192.168.2.10", M["SRV1"], "Gi0/1")],
                              "SRV1": [arp("192.168.2.1", M["R1g1"], "eth0")]},
                "mac_table": {"SW1": [mt(M["PC1"], "Fa0/1"), mt(M["R1g0"], "Fa0/4")]}},
            "app_result": {"node": "PC1", "command": "ping", "sent": 2, "received": 2,
                           "replies": [{"from": "192.168.2.10", "bytes": 32, "ttl": 63},
                                       {"from": "192.168.2.10", "bytes": 32, "ttl": 63}]}}}
    write(v)

# ---------------------------------------------------------------- ping-bez-brany
def ping_bez_brany():
    v = {
        "format": "tcpipsim-vector/1", "id": "ping-bez-brany",
        "title": "Úroveň 3: Alice bez výchozí brány pinguje server v jiné síti -> nic neodejde",
        "description": "Stejná topologie jako ping-arp-prvni, ale Alice má konfiguraci z úrovně 2 (rozhodnutí 27): Default Gateway prázdná. Cíl 192.168.2.10 není v 192.168.1.0/24 a směrovací tabulka Alice nemá výchozí cestu, takže IP vrstva paket vůbec nevytvoří k odeslání: žádný ARP, žádný rámec na lince, switch se nic nenaučí. Chybu hlásí vlastní OS Alice, ne síť. Windows vypíše „PING: transmit failed. General failure.“ (cmd.md kap. 8.2; ověřit při pilotu). Typická chyba: student hledá problém na routeru, ale paket nikdy neopustil PC.",
        "level": 3, "spec_refs": ["docs/spec/ipv4.md kap. 4.2", "docs/spec/routing.md kap. 3", "docs/spec/cmd.md kap. 8"],
        "topology": base_topology(alice_gw=None),
        "initial_state": {"arp_cache": copy.deepcopy(EMPTY_ARP), "mac_table": {"SW1": []},
                          "routing_table": base_routes(alice_gw=None)},
        "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": "192.168.2.10", "count": 1}}],
        "expected": {
            "transmissions": [],
            "events": [{"step": 0, "node": "PC1", "event": "ip_drop",
                        "detail": "žádná cesta k 192.168.2.10: není v 192.168.1.0/24 a výchozí brána není nastavená"}],
            "final_state": {"arp_cache": copy.deepcopy(EMPTY_ARP), "mac_table": {"SW1": []}},
            "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 0, "replies": [],
                           "errors": [{"seq": 1, "kind": "no_route"}]}}}
    write(v)

# ---------------------------------------------------------------- ping-spatna-brana
def ping_spatna_brana():
    t = T()
    req = arp_req(M["PC1"], "192.168.1.10", "192.168.1.254")
    for k, base in enumerate((0, 1000, 2000)):
        t.add(base + 1, "L1", "PC1", "SW1", f"ARP request {k + 1}/3: kdo má 192.168.1.254? Ptá se 192.168.1.10", req)
        for l, to in (("L2", "PC2"), ("L3", "PC3"), ("L4", "R1")):
            t.add(base + 2, l, "SW1", to, f"ARP request {k + 1}/3 (broadcast) -> {to}; nikdo tu adresu nemá", req)
    events = [
        {"step": 0, "node": "PC1", "event": "arp_queue", "detail": "192.168.2.10 mimo 192.168.1.0/24 -> výchozí brána 192.168.1.254; Echo Request čeká na ARP"},
        {"step": 2, "node": "R1", "event": "arp_ignore", "detail": "TPA 192.168.1.254 není moje adresa (já jsem 192.168.1.1); proxy ARP by neodpověděl, cíl je ve stejné síti jako Gi0/0"},
        {"step": 2, "node": "PC2", "event": "arp_ignore", "detail": "TPA 192.168.1.254 není moje"},
        {"step": 2, "node": "PC3", "event": "arp_ignore", "detail": "TPA 192.168.1.254 není moje"},
        {"step": 3000, "node": "PC1", "event": "arp_fail", "detail": "3 pokusy bez odpovědi; paket z fronty zahozen, ping hlásí Destination host unreachable od vlastní adresy"},
    ]
    v = {
        "format": "tcpipsim-vector/1", "id": "ping-spatna-brana",
        "title": "Úroveň 3: překlep v bráně (192.168.1.254 místo 192.168.1.1) -> ARP bez odpovědi",
        "description": "Topologie úrovně 3, Alice má výchozí bránu 192.168.1.254 (typická chyba: brána opsaná z jiné sítě, kde router má .254). Alice správně pozná, že server je v jiné síti, a ptá se ARPem na bránu 192.168.1.254. Tu adresu nemá nikdo: request se 3x zopakuje po 1 s (arp.md kap. 6), switch ho pokaždé flooduje, router ho ignoruje (není to jeho IP). Pak se paket zahodí a Windows vypíše „Reply from 192.168.1.10: Destination host unreachable.“ — od vlastní adresy Alice, žádná ICMP zpráva na lince neexistuje. Student chybu pozná podle cílové IP v ARP requestu (TPA 192.168.1.254) a podle toho, že odpověď přišla od jeho vlastní adresy. Server ani linka L5 se nic nedozví. Router si Alici nezapamatuje (TPA není jeho, záznam nemá, RFC 826).",
        "level": 3, "spec_refs": ["docs/spec/arp.md kap. 4 a 6", "docs/spec/ipv4.md kap. 4.2", "docs/spec/cmd.md kap. 8"],
        "topology": base_topology(alice_gw="192.168.1.254"),
        "initial_state": {"arp_cache": copy.deepcopy(EMPTY_ARP), "mac_table": {"SW1": []},
                          "routing_table": base_routes(alice_gw="192.168.1.254")},
        "actions": [{"time": 0, "node": "PC1", "command": "ping", "args": {"dst": "192.168.2.10", "count": 1}}],
        "expected": {
            "transmissions": t.l, "events": events,
            "final_state": {"arp_cache": copy.deepcopy(EMPTY_ARP), "mac_table": {"SW1": [mt(M["PC1"], "Fa0/1")]}},
            "app_result": {"node": "PC1", "command": "ping", "sent": 1, "received": 0, "replies": [],
                           "errors": [{"seq": 1, "kind": "arp_failed", "from": "192.168.1.10"}]}}}
    write(v)

# ---------------------------------------------------------------- tracert-dva-routery
def tracert():
    nodes = [
        host("PC1", "Alice", "pc", M["PC1"], "192.168.1.10", "192.168.1.1", 128),
        router("R1", (M["R1g0"], "192.168.1.1"), (M["R1g1"], "192.168.2.1"),
               static=[{"prefix": "192.168.3.0/24", "next_hop": "192.168.2.2"}]),
        router("R2", (M["R2g0"], "192.168.2.2"), (M["R2g1"], "192.168.3.1"),
               static=[{"prefix": "0.0.0.0/0", "next_hop": "192.168.2.1"}]),
        host("SRV1", "Server", "server", M["SRV1"], "192.168.3.10", "192.168.3.1", 64),
    ]
    links = [link("L1", "PC1", "eth0", "R1", "Gi0/0"), link("L2", "R1", "Gi0/1", "R2", "Gi0/0"),
             link("L3", "R2", "Gi0/1", "SRV1", "eth0")]
    arp0 = {"PC1": [arp("192.168.1.1", M["R1g0"], "eth0")],
            "R1": [arp("192.168.1.10", M["PC1"], "Gi0/0"), arp("192.168.2.2", M["R2g0"], "Gi0/1")],
            "R2": [arp("192.168.2.1", M["R1g1"], "Gi0/0"), arp("192.168.3.10", M["SRV1"], "Gi0/1")],
            "SRV1": [arp("192.168.3.1", M["R2g1"], "eth0")]}
    routes = {"PC1": host_routes("192.168.1.10", "192.168.1.1"),
              "R1": router_routes("192.168.1.1", "192.168.2.1",
                                  [{"prefix": "192.168.3.0/24", "next_hop": "192.168.2.2", "if": "Gi0/1", "type": "static"}]),
              "R2": router_routes("192.168.2.2", "192.168.3.1",
                                  [{"prefix": "0.0.0.0/0", "next_hop": "192.168.2.1", "if": "Gi0/0", "type": "default"}]),
              "SRV1": host_routes("192.168.3.10", "192.168.3.1")}
    A, D = "192.168.1.10", "192.168.3.10"
    D64 = 64
    t = T(); s = 0; ev = []
    for p in range(1, 4):   # hop 1
        t.add(s + 1, "L1", "PC1", "R1", f"hop 1, sonda {p}: Echo Request TTL 1", echo(M["PC1"], M["R1g0"], A, D, 1, 8, None, D64, None))
        t.add(s + 2, "L1", "R1", "PC1", f"hop 1, sonda {p}: Time Exceeded od 192.168.1.1 (adresa Gi0/0, kudy zpráva odchází)",
              time_exceeded(M["R1g0"], M["PC1"], "192.168.1.1", A, 255, A, D))
        if p == 1:
            ev.append({"step": 1, "node": "R1", "event": "ip_drop", "detail": "TTL 1: snížením by kleslo na 0 -> zahodit, ICMP Time Exceeded (11/0) zdroji 192.168.1.10"})
        s += 2
    for p in range(1, 4):   # hop 2
        t.add(s + 1, "L1", "PC1", "R1", f"hop 2, sonda {p}: Echo Request TTL 2", echo(M["PC1"], M["R1g0"], A, D, 2, 8, None, D64, None))
        t.add(s + 2, "L2", "R1", "R2", f"hop 2, sonda {p}: R1 snížil TTL na 1, static 192.168.3.0/24 via 192.168.2.2",
              echo(M["R1g1"], M["R2g0"], A, D, 1, 8, None, D64, None))
        t.add(s + 3, "L2", "R2", "R1", f"hop 2, sonda {p}: Time Exceeded od 192.168.2.2 (R2 Gi0/0), TTL 255",
              time_exceeded(M["R2g0"], M["R1g1"], "192.168.2.2", A, 255, A, D))
        t.add(s + 4, "L1", "R1", "PC1", f"hop 2, sonda {p}: Time Exceeded přeposlaný, TTL 254",
              time_exceeded(M["R1g0"], M["PC1"], "192.168.2.2", A, 254, A, D))
        if p == 1:
            ev += [{"step": 7, "node": "R1", "event": "ip_forward", "detail": "TTL 2 -> 1; longest match 192.168.3.0/24 static via 192.168.2.2 (Gi0/1)"},
                   {"step": 8, "node": "R2", "event": "ip_drop", "detail": "TTL 1 -> zahodit, Time Exceeded ze zdrojové adresy 192.168.2.2 (rozhraní Gi0/0, kudy zpráva odchází, RFC 1812 4.3.2.4)"},
                   {"step": 9, "node": "R1", "event": "ip_forward", "detail": "Time Exceeded pro 192.168.1.10: TTL 255 -> 254, connected Gi0/0"}]
        s += 4
    for p in range(1, 4):   # hop 3
        t.add(s + 1, "L1", "PC1", "R1", f"hop 3, sonda {p}: Echo Request TTL 3", echo(M["PC1"], M["R1g0"], A, D, 3, 8, None, D64, None))
        t.add(s + 2, "L2", "R1", "R2", f"hop 3, sonda {p}: TTL 2", echo(M["R1g1"], M["R2g0"], A, D, 2, 8, None, D64, None))
        t.add(s + 3, "L3", "R2", "SRV1", f"hop 3, sonda {p}: TTL 1 (R2: 192.168.3.0/24 connected) - cíl ho přijme",
              echo(M["R2g1"], M["SRV1"], A, D, 1, 8, None, D64, None))
        t.add(s + 4, "L3", "SRV1", "R2", f"hop 3, sonda {p}: Echo Reply TTL 64", echo(M["SRV1"], M["R2g1"], D, A, 64, 0, None, D64, None))
        t.add(s + 5, "L2", "R2", "R1", f"hop 3, sonda {p}: Echo Reply TTL 63 (R2 výchozí cesta 0.0.0.0/0 via 192.168.2.1)",
              echo(M["R2g0"], M["R1g1"], D, A, 63, 0, None, D64, None))
        t.add(s + 6, "L1", "R1", "PC1", f"hop 3, sonda {p}: Echo Reply TTL 62", echo(M["R1g0"], M["PC1"], D, A, 62, 0, None, D64, None))
        if p == 1:
            ev += [{"step": 21, "node": "SRV1", "event": "ip_deliver", "detail": "Echo Request s TTL 1 pro mě: hostitel TTL nekontroluje, paket nepřeposílá"},
                   {"step": 22, "node": "R2", "event": "ip_forward", "detail": "TTL 64 -> 63; 192.168.1.10 nemá konkrétní cestu -> 0.0.0.0/0 via 192.168.2.1"}]
        s += 6
    ev.append({"step": 36, "node": "PC1", "event": "ip_deliver", "detail": "Echo Reply od cíle 192.168.3.10 -> tracert končí (Trace complete.)"})
    v = {
        "format": "tcpipsim-vector/1", "id": "tracert-dva-routery",
        "title": "Úroveň 3: tracert -d přes dva routery (TTL 1, 2, 3 -> Time Exceeded, Time Exceeded, Echo Reply)",
        "description": "Alice — R1 — R2 — server, přímé kabely. Síť 192.168.2.0/24 je tranzitní mezi routery (R1 Gi0/1 .1, R2 Gi0/0 .2). R1 má statickou cestu 192.168.3.0/24 via 192.168.2.2, R2 výchozí cestu 0.0.0.0/0 via 192.168.2.1. ARP cache jsou naplněné předchozím pingem, aby vektor ukazoval jen TTL. Windows tracert posílá ICMP Echo Request (ne UDP jako Linux a Cisco), 3 sondy na každý skok, TTL 1, 2, 3; data 64 B nul (podle záznamu provozu, ověřit při pilotu). Router, kterému by TTL kleslo na 0, paket zahodí a pošle Time Exceeded ze zdrojové adresy rozhraní, kterým zpráva odchází (RFC 1812 4.3.2.4) - proto tracert ukáže 192.168.1.1 a 192.168.2.2, tj. adresy rozhraní směrem k Alici. Cíl odpoví Echo Reply a tracert skončí. Simulátor zjednodušuje: další sonda odchází hned po příchodu odpovědi na předchozí; Windows bez -d by se navíc ptal DNS na jména (reverzní dotazy), proto akce odpovídá tracert -d. Vektor má skip, dokud jádro neumí akci tracert.",
        "level": 3,
        "skip": "jádro zatím neumí akci tracert ani ICMP Time Exceeded (úroveň 3)",
        "spec_refs": ["docs/spec/icmp.md kap. 3 a 4", "docs/spec/ipv4.md kap. 3 a 5", "docs/spec/routing.md", "docs/spec/cmd.md kap. 8"],
        "topology": {"nodes": nodes, "links": links},
        "initial_state": {"arp_cache": arp0, "routing_table": routes},
        "actions": [{"time": 0, "node": "PC1", "command": "tracert",
                     "args": {"dst": D, "max_hops": 30, "probes": 3, "resolve": False}}],
        "expected": {
            "transmissions": t.l, "events": ev,
            "final_state": {"arp_cache": copy.deepcopy(arp0)},
            "app_result": {"node": "PC1", "command": "tracert", "reached": True,
                           "hops": [{"hop": 1, "from": "192.168.1.1", "replies": 3, "kind": "time_exceeded"},
                                    {"hop": 2, "from": "192.168.2.2", "replies": 3, "kind": "time_exceeded"},
                                    {"hop": 3, "from": "192.168.3.10", "replies": 3, "kind": "echo_reply"}]}}}
    write(v)

if __name__ == "__main__": tracert()
