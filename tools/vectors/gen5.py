#!/usr/bin/env python3
# Vektory úrovně 4 „Transport a aplikace“ podle rozhodnutí 59 (DNS, TCP, HTTP; SRV1 v síti 2).
# Spuštění: python3 tools/vectors/gen5.py tests/vectors
import sys, copy
import gen3
from gen3 import M, T, host, router, link, host_routes, router_routes, arp, mt
gen3.OUT = sys.argv[1] if len(sys.argv) > 1 else "."
write = gen3.write

A_IP, B_IP, C_IP, S_IP = "192.168.1.10", "192.168.2.20", "192.168.1.30", "192.168.2.10"
G0, G1 = "192.168.1.1", "192.168.2.1"
NAME = "www.skola.lan"
SEED = 1
CPORT = 49152          # první dynamický port (udp.md kap. 4.2, tcp.md kap. 6); čítač zvlášť pro TCP a UDP
MSS = 1460
WIN = 64240            # tcp.md kap. 5: bez Window Scale, hodnota se jen zobrazuje
RTO_STEPS = 1000       # 1 s = 1000 kroků (model.md kap. 7, stejně jako opakování ARP po 1 s)

# ----------------------------------------------------------------- ISN (tcp.md kap. 4)
def fnv1a32(s):
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h

def isn(local, remote, seed=SEED):
    return fnv1a32(f"{seed}|{local}|{remote}")

# ----------------------------------------------------------------- topologie (tcp.md kap. 10, routing.md kap. 9)
def topo():
    a = host("PC1", "Alice", "pc", M["PC1"], A_IP, G0, 128)
    a["dns_servers"] = [S_IP]
    a["apps"] = [{"name": "curl", "proto": "tcp", "port": None}]
    c = host("PC3", "Cyril", "pc", M["PC3"], C_IP, G0, 128)
    c["dns_servers"] = [S_IP]
    b = host("PC2", "Bob", "pc", M["PC2"], B_IP, G1, 128)
    b["dns_servers"] = [S_IP]
    b["apps"] = [{"name": "zpravy", "proto": "udp", "port": 5000, "auto_reply": "Ahoj, Alice!"},
                 {"name": "poznamky", "proto": "udp", "port": 6000}]
    s = host("SRV1", "Server", "server", M["SRV1"], S_IP, G1, 64)
    s["apps"] = [{"name": "dns", "proto": "udp", "port": 53}, {"name": "dns", "proto": "tcp", "port": 53},
                 {"name": "web", "proto": "tcp", "port": 80}]
    s["dns_zone"] = {"zone": "skola.lan", "records": [
        {"name": "www.skola.lan", "type": "A", "ttl": 3600, "data": S_IP},
        {"name": "srv1.skola.lan", "type": "A", "ttl": 3600, "data": S_IP}]}
    nodes = [a, c,
             {"id": "SW1", "type": "switch", "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"]},
             router("R1", (M["R1g0"], G0), (M["R1g1"], G1)),
             {"id": "SW2", "type": "switch", "ports": ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4"]},
             b, s]
    links = [link("L1", "PC1", "eth0", "SW1", "Fa0/1"), link("L2", "PC3", "eth0", "SW1", "Fa0/3"),
             link("L3", "R1", "Gi0/0", "SW1", "Fa0/4"), link("L4", "R1", "Gi0/1", "SW2", "Fa0/1"),
             link("L5", "PC2", "eth0", "SW2", "Fa0/2"), link("L6", "SRV1", "eth0", "SW2", "Fa0/3")]
    return {"nodes": nodes, "links": links}

def routes():
    return {"PC1": host_routes(A_IP, G0), "PC3": host_routes(C_IP, G0), "PC2": host_routes(B_IP, G1),
            "R1": router_routes(G0, G1), "SRV1": host_routes(S_IP, G1)}

ARP = {"PC1": [arp(G0, M["R1g0"], "eth0")], "PC2": [], "PC3": [], "SRV1": [arp(G1, M["R1g1"], "eth0")],
       "R1": [arp(A_IP, M["PC1"], "Gi0/0"), arp(S_IP, M["SRV1"], "Gi0/1")]}
MT = {"SW1": [mt(M["PC1"], "Fa0/1"), mt(M["R1g0"], "Fa0/4")],
      "SW2": [mt(M["R1g1"], "Fa0/1"), mt(M["SRV1"], "Fa0/3")]}
LISTEN = [{"local": "0.0.0.0:53", "remote": "0.0.0.0:0", "state": "LISTEN"},
          {"local": "0.0.0.0:80", "remote": "0.0.0.0:0", "state": "LISTEN"}]
UDPS = {"SRV1": [{"app": "dns", "port": 53}], "PC2": [{"app": "zpravy", "port": 5000}, {"app": "poznamky", "port": 6000}]}

def init_state():
    return {"arp_cache": copy.deepcopy(ARP), "mac_table": copy.deepcopy(MT), "routing_table": routes(),
            "udp_sockets": copy.deepcopy(UDPS), "tcp_connections": {"SRV1": copy.deepcopy(LISTEN)}}

TOPO_TXT = ("Topologie úrovně 4 (rozhodnutí 59, routing.md kap. 9): síť 1 jako v úrovni 3 (Alice Fa0/1, Cyril Fa0/3 na SW1, "
            "R1 Gi0/0 na Fa0/4); v síti 2 je nově přepínač SW2 (Fa0/1 R1 Gi0/1, Fa0/2 Bob, Fa0/3 SRV1 192.168.2.10, Linux TTL 64). "
            "ARP cache a MAC tabulky jsou předvyplněné stavem po předchozí komunikaci (Alice zná bránu, R1 zná Alici a SRV1, SRV1 zná bránu), "
            "aby vektor ukazoval jen L4 a L7; ARP přes router už ukazují vektory úrovně 3. ")

# ----------------------------------------------------------------- cesta Alice <-> SRV1 (4 linky)
UP = [("L1", "PC1", "SW1"), ("L3", "SW1", "R1"), ("L4", "R1", "SW2"), ("L6", "SW2", "SRV1")]
DOWN = [("L6", "SRV1", "SW2"), ("L4", "SW2", "R1"), ("L3", "R1", "SW1"), ("L1", "SW1", "PC1")]

def frame(l3, l4len, l4, proto, src_mac, dst_mac, sip, dip, ttl, extra):
    p = {"eth": {"dst": dst_mac, "src": src_mac, "ethertype": "0x0800"},
         "ip": {"src": sip, "dst": dip, "ttl": ttl, "protocol": proto, "total_length": 20 + l4len}}
    p.update(l4)
    p.update(extra)
    p["frame_len"] = max(60, 14 + 20 + l4len)
    return p

def send_path(t, step, up, summary, build, lost_on=None):
    """Pošle PDU po celé cestě. build(src_mac, dst_mac, ttl) -> pdu. Vrací krok doručení."""
    path = UP if up else DOWN
    ttl0 = 128 if up else 64
    for i, (l, f, to) in enumerate(path):
        if up:
            sm, dm = (M["PC1"], M["R1g0"]) if i < 2 else (M["R1g1"], M["SRV1"])
            ttl = ttl0 if i < 2 else ttl0 - 1
        else:
            sm, dm = (M["SRV1"], M["R1g1"]) if i < 2 else (M["R1g0"], M["PC1"])
            ttl = ttl0 if i < 2 else ttl0 - 1
        pdu = build(sm, dm, ttl)
        t.add(step + i, l, f, to, summary + (f" ({f} -> {to})" if i else ""), pdu)
        if lost_on == l:
            t.l[-1]["lost"] = True
            t.l[-1]["summary"] += " — ZTRACENO na lince"
            return None
    return step + len(path) - 1

# ----------------------------------------------------------------- DNS (dns.md)
def qname_len(n):
    return sum(1 + len(x) for x in n.split(".")) + 1

def dns_query_pdu(qid):
    dlen = 12 + qname_len(NAME) + 4
    dns = {"id": qid, "flags": "0x0100", "qr": 0, "opcode": 0, "aa": 0, "tc": 0, "rd": 1, "ra": 0, "rcode": 0,
           "qdcount": 1, "ancount": 0, "nscount": 0, "arcount": 0,
           "question": {"name": NAME, "type": "A", "class": "IN"}}
    return dlen, dns

def dns_answer_pdu(qid):
    qlen, _ = dns_query_pdu(qid)
    dlen = qlen + 2 + 2 + 2 + 4 + 2 + 4
    dns = {"id": qid, "flags": "0x8500", "qr": 1, "opcode": 0, "aa": 1, "tc": 0, "rd": 1, "ra": 0, "rcode": 0,
           "qdcount": 1, "ancount": 1, "nscount": 0, "arcount": 0,
           "question": {"name": NAME, "type": "A", "class": "IN"},
           "answers": [{"name": NAME, "type": "A", "class": "IN", "ttl": 3600, "rdlength": 4, "data": S_IP}]}
    return dlen, dns

def dns_dotaz():
    t = T()
    qlen, qd = dns_query_pdu(1)
    alen, ad = dns_answer_pdu(1)
    def bq(sm, dm, ttl):
        return frame(None, 8 + qlen, {"udp": {"sport": CPORT, "dport": 53, "length": 8 + qlen}}, 17, sm, dm, A_IP, S_IP, ttl, {"dns": qd})
    def ba(sm, dm, ttl):
        return frame(None, 8 + alen, {"udp": {"sport": 53, "dport": CPORT, "length": 8 + alen}}, 17, sm, dm, S_IP, A_IP, ttl, {"dns": ad})
    end = send_path(t, 1, True, f"DNS dotaz: A {NAME}? (ID 1, UDP {CPORT} -> 53)", bq)
    send_path(t, end + 1, False, f"DNS odpověď: {NAME} A {S_IP}, TTL 3600, AA=1", ba)
    ev = [{"step": 0, "node": "PC1", "event": "udp_send", "detail": f"resolver: nový UDP socket, dynamický port {CPORT}; DNS server 192.168.2.10 je v jiné síti -> přes bránu"},
          {"step": 3, "node": "R1", "event": "ip_forward", "detail": "TTL 128 -> 127; 192.168.2.0/24 connected Gi0/1"},
          {"step": 4, "node": "SRV1", "event": "udp_deliver", "detail": "cílový port 53 -> aplikace dns"},
          {"step": 4, "node": "SRV1", "event": "dns_answer", "detail": "skola.lan je moje zóna: www.skola.lan A 192.168.2.10 (autoritativní odpověď, AA=1)"},
          {"step": 7, "node": "R1", "event": "ip_forward", "detail": "TTL 64 -> 63"},
          {"step": 8, "node": "PC1", "event": "udp_deliver", "detail": f"cílový port {CPORT} -> resolver; ID 1 sedí s dotazem; záznam do DNS cache na 3600 s; socket se zavře"}]
    v = {"format": "tcpipsim-vector/1", "id": "dns-dotaz",
         "title": "Úroveň 4: DNS dotaz Alice na A záznam www.skola.lan (UDP 53) a autoritativní odpověď SRV1",
         "description": TOPO_TXT + f"Alice (resolver operačního systému, stejně jako před otevřením stránky v prohlížeči nebo curl) pošle DNS dotaz typu A "
                        f"z dynamického portu {CPORT} na port 53 DNS serveru 192.168.2.10 (nastaveného v konfiguraci Alice). SRV1 je pro zónu skola.lan "
                        "autoritativní: odpověď má QR=1, AA=1, RD=1, RA=0 (flags 0x8500; server rekurzi nenabízí), stejné ID 1, zopakovanou otázku a jednu odpověď A s TTL 3600 "
                        "(jméno v odpovědi komprimované ukazatelem 0xC00C, dns.md kap. 3). Simulátor zjednodušuje: resolver se ptá jen na A (bez AAAA, IPv6 "
                        "simulace nemá), ID dotazu je čítač od 1, odpověď nemá záznamy v sekcích Authority/Additional.",
         "level": 4, "seed": SEED,
         "skip": "jádro zatím neumí DNS (akce dns_resolve, aplikace dns na serveru) ani úroveň 4",
         "spec_refs": ["docs/spec/dns.md", "docs/spec/udp.md kap. 4", "docs/spec/vektory.md kap. 10", "docs/rozhodnuti.md bod 59"],
         "topology": topo(), "initial_state": init_state(),
         "actions": [{"time": 0, "node": "PC1", "command": "dns_resolve", "args": {"name": NAME, "type": "A"}}],
         "expected": {"transmissions": t.l, "events": ev,
                      "final_state": {"arp_cache": copy.deepcopy(ARP), "mac_table": copy.deepcopy(MT),
                                      "dns_cache": {"PC1": [{"name": NAME, "type": "A", "data": S_IP, "ttl": 3600}]}},
                      "app_result": {"node": "PC1", "command": "dns_resolve", "name": NAME, "server": S_IP,
                                     "authoritative": True, "rcode": 0,
                                     "answers": [{"name": NAME, "type": "A", "data": S_IP, "ttl": 3600}]}}}
    write(v)

# ----------------------------------------------------------------- HTTP (http.md)
REQ = (f"GET / HTTP/1.1\r\nHost: {NAME}\r\nUser-Agent: curl/8.9.1\r\nAccept: */*\r\n\r\n")
BODY = ('<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Škola</title></head>\n'
        '<body><h1>Vítej na www.skola.lan</h1></body></html>\n')
BLEN = len(BODY.encode("utf-8"))
RESP = ("HTTP/1.1 200 OK\r\nDate: Wed, 25 Nov 2026 08:00:00 GMT\r\n"
        f"Content-Type: text/html; charset=utf-8\r\nContent-Length: {BLEN}\r\n\r\n") + BODY
LQ, LR = len(REQ.encode("utf-8")), len(RESP.encode("utf-8"))

def tcp_conv(t, lost=False):
    """Celé spojení podle tcp.md kap. 8. Vrací (události, poslední krok)."""
    a_isn = isn(f"{A_IP}:{CPORT}", f"{S_IP}:80")
    s_isn = isn(f"{S_IP}:80", f"{A_IP}:{CPORT}")
    M32 = 0xFFFFFFFF
    def seg(up, flags, rs, ra, payload=b"", syn_opts=False, data=None, http=None):
        hl = 24 if syn_opts else 20
        isn_s, isn_r = (a_isn, s_isn) if up else (s_isn, a_isn)
        tcp = {"sport": CPORT if up else 80, "dport": 80 if up else CPORT,
               "seq": (isn_s + rs) & M32, "ack": ((isn_r + ra) & M32) if "ACK" in flags else 0,
               "rel_seq": rs, "rel_ack": ra if "ACK" in flags else 0,
               "flags": flags, "hdr_len": hl, "window": WIN, "payload_len": len(payload)}
        if syn_opts: tcp["options"] = [{"kind": 2, "name": "MSS", "value": MSS}]
        extra = {}
        if data is not None: extra["data"] = {"text": data, "len": len(payload)}
        if http is not None: extra["http"] = http
        def b(sm, dm, ttl):
            sip, dip = (A_IP, S_IP) if up else (S_IP, A_IP)
            return frame(None, hl + len(payload), {"tcp": copy.deepcopy(tcp)}, 6, sm, dm, sip, dip, ttl, copy.deepcopy(extra))
        return b
    rq, rr = REQ.encode(), RESP.encode("utf-8")
    ev = []
    s = 1
    send_path(t, s, True, "TCP SYN: Alice chce spojení na 192.168.2.10:80 (rel. seq 0, MSS 1460)", seg(True, "SYN", 0, 0, syn_opts=True))
    ev += [{"step": 0, "node": "PC1", "event": "tcp_state", "detail": f"CLOSED -> SYN-SENT; dynamický port {CPORT}; ISN {a_isn}"},
           {"step": 4, "node": "SRV1", "event": "tcp_state", "detail": f"port 80 naslouchá (LISTEN): nové spojení SYN-RECEIVED; ISN {s_isn}"}]
    send_path(t, 5, False, "TCP SYN, ACK: server souhlasí (rel. seq 0, ack 1)", seg(False, "SYN, ACK", 0, 1, syn_opts=True))
    ev.append({"step": 8, "node": "PC1", "event": "tcp_state", "detail": "SYN-SENT -> ESTABLISHED (ack = můj ISN + 1)"})
    send_path(t, 9, True, "TCP ACK: třetí krok handshaku (rel. seq 1, ack 1)", seg(True, "ACK", 1, 1))
    ev.append({"step": 12, "node": "SRV1", "event": "tcp_state", "detail": "SYN-RECEIVED -> ESTABLISHED"})
    get = seg(True, "PSH, ACK", 1, 1, rq, data=REQ, http={"kind": "request", "method": "GET", "target": "/", "version": "HTTP/1.1", "host": NAME})
    if lost:
        send_path(t, 10, True, f"HTTP GET / ({LQ} B dat, rel. seq 1)", get, lost_on="L4")
        ev += [{"step": 12, "node": "SW2", "event": "link_loss", "detail": "rámec s HTTP GET se na lince L4 ztratil (akce link_loss)"},
               {"step": 1010, "node": "PC1", "event": "tcp_retransmit", "detail": "RTO 1 s vypršel, rel. seq 1 nepotvrzen -> stejný segment znovu (Wireshark: [TCP Retransmission]); další RTO by byl 2 s"}]
        g0 = 1010
    else:
        g0 = 10
    send_path(t, g0, True, f"HTTP GET / ({LQ} B dat, rel. seq 1, PSH)" + (" — retransmise" if lost else ""), get)
    d = g0 + 3
    ev.append({"step": d, "node": "SRV1", "event": "http_request", "detail": f"port 80 -> aplikace web: GET / Host {NAME}"})
    send_path(t, d + 1, False, f"TCP ACK: server potvrzuje {LQ} B (ack {1 + LQ})", seg(False, "ACK", 1, 1 + LQ))
    send_path(t, d + 2, False, f"HTTP/1.1 200 OK ({LR} B dat, Content-Length {BLEN})",
              seg(False, "PSH, ACK", 1, 1 + LQ, rr, data=RESP, http={"kind": "response", "version": "HTTP/1.1", "status": 200, "reason": "OK", "content_length": BLEN}))
    r = d + 2 + 3
    ev.append({"step": r, "node": "PC1", "event": "http_response", "detail": f"200 OK, tělo {BLEN} B = Content-Length -> stránka je celá, curl zavírá spojení"})
    send_path(t, r + 1, True, f"TCP ACK: Alice potvrzuje {LR} B (ack {1 + LR})", seg(True, "ACK", 1 + LQ, 1 + LR))
    send_path(t, r + 2, True, "TCP FIN, ACK: Alice končí (FIN zabere 1 číslo sekvence)", seg(True, "FIN, ACK", 1 + LQ, 1 + LR))
    ev.append({"step": r + 2, "node": "PC1", "event": "tcp_state", "detail": "ESTABLISHED -> FIN-WAIT-1"})
    f = r + 2 + 3
    ev.append({"step": f, "node": "SRV1", "event": "tcp_state", "detail": "ESTABLISHED -> CLOSE-WAIT; aplikace web dostane konec dat a zavře socket -> LAST-ACK"})
    send_path(t, f + 1, False, f"TCP ACK: server potvrzuje FIN (ack {2 + LQ})", seg(False, "ACK", 1 + LR, 2 + LQ))
    send_path(t, f + 2, False, "TCP FIN, ACK: server také končí", seg(False, "FIN, ACK", 1 + LR, 2 + LQ))
    ev += [{"step": f + 4, "node": "PC1", "event": "tcp_state", "detail": "FIN-WAIT-1 -> FIN-WAIT-2"},
           {"step": f + 5, "node": "PC1", "event": "tcp_state", "detail": "FIN-WAIT-2 -> TIME-WAIT (2 MSL, tcp.md kap. 9)"}]
    send_path(t, f + 6, True, f"TCP ACK: Alice potvrzuje FIN serveru (ack {2 + LR})", seg(True, "ACK", 2 + LQ, 2 + LR))
    ev.append({"step": f + 9, "node": "SRV1", "event": "tcp_state", "detail": "LAST-ACK -> CLOSED (zůstává jen naslouchající socket :80)"})
    return ev, a_isn, s_isn

def http_vector(vid, lost):
    t = T()
    ev, a_isn, s_isn = tcp_conv(t, lost)
    actions = [{"time": 0, "node": "PC1", "command": "http_get", "args": {"dst": S_IP, "host": NAME, "path": "/", "port": 80, "client": "curl"}}]
    if lost:
        actions.insert(0, {"time": 0, "node": None, "command": "link_loss",
                           "args": {"link": "L4", "from": "R1", "count": 1, "match": {"proto": "tcp", "payload": True}}})
    final = {"arp_cache": copy.deepcopy(ARP), "mac_table": copy.deepcopy(MT),
             "tcp_connections": {"PC1": [{"local": f"{A_IP}:{CPORT}", "remote": f"{S_IP}:80", "state": "TIME-WAIT"}],
                                 "SRV1": copy.deepcopy(LISTEN)}}
    base = (TOPO_TXT + f"Adresa serveru je už známá (DNS ukazuje vektor dns-dotaz; akce http_get dostane IP i jméno pro hlavičku Host). "
            f"Seed {SEED}: ISN Alice {a_isn}, ISN SRV1 {s_isn} (FNV-1a, tcp.md kap. 4); rentgen ukazuje relativní i absolutní čísla. "
            f"Průběh (tcp.md kap. 8): SYN (MSS 1460) -> SYN, ACK -> ACK; HTTP GET ({LQ} B, PSH) -> ACK serveru -> 200 OK ({LR} B) -> ACK Alice; "
            "curl po přijetí celého těla (Content-Length) zavře spojení: FIN, ACK -> ACK -> FIN, ACK -> ACK. Alice končí v TIME-WAIT, server "
            "v CLOSED (zůstává LISTEN na 80). Simulátor zjednodušuje: ACK se posílá hned (bez delayed ACK), proto je ukončení ve 4 segmentech "
            "(reálně často 3: server pošle ACK a FIN v jednom segmentu); SYN nese jen volbu MSS; okno 64240 bez škálování. Rámce, které uzel "
            "posílá po sobě, jdou po lince v po sobě jdoucích krocích (tcp.md kap. 10).")
    if lost:
        title = "Úroveň 4: ztráta HTTP GET na lince R1 -> SW2 a retransmise po RTO 1 s"
        desc = (base + " Akce link_loss zahodí první TCP segment s daty, který R1 pošle po L4: rámec s GET je na L4 vyslán, ale SW2 ho "
                "nepřijme. Server nic nedostal, proto nic nepotvrdí. Alice po RTO 1 s (= 1000 kroků) pošle stejný segment znovu (stejné "
                "seq, stejná data, Wireshark [TCP Retransmission]); zbytek spojení proběhne normálně o 1000 kroků později. Server nedostane "
                "nic dvakrát a aplikace web dostane požadavek jednou. Simulátor zjednodušuje: RTO je pevně 1 s (minimum RFC 6298 kap. 2.4).")
        refs = ["docs/spec/tcp.md kap. 7 a 8", "docs/spec/http.md", "docs/spec/vektory.md kap. 10", "docs/rozhodnuti.md bod 59"]
    else:
        title = "Úroveň 4: TCP spojení Alice -> SRV1:80, HTTP GET / 200 OK a ukončení FIN"
        desc = base
        refs = ["docs/spec/tcp.md", "docs/spec/http.md", "docs/spec/vektory.md kap. 10", "docs/rozhodnuti.md bod 59"]
    v = {"format": "tcpipsim-vector/1", "id": vid, "title": title, "description": desc,
         "level": 4, "seed": SEED,
         "skip": "jádro zatím neumí TCP, HTTP ani akce http_get" + (" a link_loss" if lost else "") + " (úroveň 4)",
         "spec_refs": refs, "topology": topo(), "initial_state": init_state(), "actions": actions,
         "expected": {"transmissions": t.l, "events": ev, "final_state": final,
                      "app_result": {"node": "PC1", "command": "http_get", "status": 200, "reason": "OK",
                                     "content_length": BLEN, "body_len": BLEN, "local": f"{A_IP}:{CPORT}",
                                     "remote": f"{S_IP}:80", "retransmissions": 1 if lost else 0}}}
    write(v)

dns_dotaz()
http_vector("tcp-handshake-http", False)
http_vector("tcp-ztrata-retransmise", True)
print(f"LQ={LQ} LR={LR} BLEN={BLEN} ISN_A={isn(f'{A_IP}:{CPORT}', f'{S_IP}:80')} ISN_S={isn(f'{S_IP}:80', f'{A_IP}:{CPORT}')}")
