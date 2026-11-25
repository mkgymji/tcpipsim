// Úroveň 4: TCP (stavy, handshake, data, potvrzení, FIN ve 4 segmentech, TIME-WAIT, RST, retransmise
// po RTO), resolver a server DNS (UDP 53), HTTP klient curl a webový server (tcp.md, dns.md, http.md).
// Instaluje se do runNetwork (netsim.js), jen když je zapnutý protokol 'tcp'. Bez DOM, deterministické.
//
// Tabulka spojení uzlu je `state.tcp_connections` ve tvaru vektorů ({ local, remote, state }); řídicí
// blok spojení (TCB) visí na záznamu jako neenumerovatelná vlastnost `tcb`, takže se do kopií tabulek
// a do porovnání s vektory nedostane.
import { dataPdu, encapsulate } from './pdu.js';
import { FLAG, flagsString, TCP_PARAMS, isnOf, seqAdd } from '../proto/tcp.js';
import { dnsQuery, dnsAnswer, DNS_PARAMS, DNS_PORT } from '../proto/dns.js';
import { httpRequest, httpResponse, parseHttp } from '../proto/http.js';
import { isHost } from '../devices/types.js';
import { sameSubnet } from './addr.js';

const IP_TCP = 6, IP_UDP = 17;
const EPHEMERAL_FIRST = 49152;
const blen = (s) => new TextEncoder().encode(s ?? '').length;
const sock = (ip, port) => `${ip}:${port}`;

export function installTransport(c) {
  const { sched, emit, world, nextId, ipOutput, newIpPacket, ttlOf, onTx } = c;
  const seed = c.seed ?? 1;
  const runs = {};
  let runSeq = 0;
  const losses = [];
  // odložená akce aplikace („přemýšlení“ programu; ve vektorech 0, ve scénáři kvůli čitelným krokům)
  const later = new Map();
  let laterSeq = 0;
  function after(us, fn) {
    if (!us) { fn(); return; }
    later.set(++laterSeq, fn);
    sched.schedule({ type: 'tcp.later', delay: us, payload: { id: laterSeq } });
  }
  sched.on('tcp.later', (ev) => { const fn = later.get(ev.payload.id); later.delete(ev.payload.id); fn?.(); });
  const appDelay = (tcb) => Math.round((world.nodes[tcb.node].apps ?? []).find((a) => a.name === tcb.app)?.delay * 1e6 || 0);

  // ---- tabulky uzlů ----
  for (const n of Object.values(world.nodes)) {
    if (!isHost(n.type)) continue;
    const init = c.initialState.tcp_connections?.[n.id]
      ?? (n.apps ?? []).filter((a) => a.proto === 'tcp' && a.port != null)
        .map((a) => ({ local: sock('0.0.0.0', a.port), remote: '0.0.0.0:0', state: 'LISTEN' }));
    n.state.tcp_connections = [];
    for (const e of init) {
      const port = Number(e.local.split(':')[1]);
      const app = (n.apps ?? []).find((a) => a.proto === 'tcp' && a.port === port)?.name ?? null;
      addConn(n, { local: e.local, remote: e.remote, state: e.state }, { app, lport: port, listen: e.state === 'LISTEN' });
    }
    n.state.dns_cache = JSON.parse(JSON.stringify(c.initialState.dns_cache?.[n.id] ?? []));
  }

  function addConn(node, entry, tcb) {
    Object.defineProperty(entry, 'tcb', { value: { ...tcb, entry, node: node.id }, enumerable: false });
    node.state.tcp_connections.push(entry);
    return entry.tcb;
  }
  const snapshot = (node) => node.state.tcp_connections.map((e) => ({ local: e.local, remote: e.remote, state: e.state,
    app: e.tcb.app ?? null }));

  function setState(tcb, to, detail) {
    const node = world.nodes[tcb.node];
    const from = tcb.entry.state;
    if (to === 'CLOSED') {
      const t = node.state.tcp_connections;
      t.splice(t.indexOf(tcb.entry), 1);
      for (const r of tcb.rtx ?? []) if (r.timer != null) sched.cancel(r.timer);
      tcb.rtx = [];
      tcb.closed = true;
    } else tcb.entry.state = to;
    emit('tcp_state', { node: tcb.node, from, to, local: tcb.entry.local, remote: tcb.entry.remote, app: tcb.app,
      conns: snapshot(node), detail: detail ?? `${from} -> ${to}` });
  }

  // Dynamický port pro TCP (čítač zvlášť pro TCP a UDP, tcp.md kap. 6); obsazené porty (i TIME-WAIT) přeskočí.
  function tcpPort(node) {
    let p = node.state.tcpNext ?? EPHEMERAL_FIRST;
    const used = (x) => node.state.tcp_connections.some((e) => Number(e.local.split(':')[1]) === x);
    while (used(p)) p++;
    node.state.tcpNext = p + 1;
    return p;
  }
  function udpPort(node) {
    let p = node.state.udpNext ?? EPHEMERAL_FIRST;
    while (node.state.udp_sockets.some((s) => s.port === p)) p++;
    node.state.udpNext = p + 1;
    return p;
  }

  // ---- odeslání TCP segmentu ----
  function tcpSend(tcb, flags, text = null, opt = {}) {
    const node = world.nodes[tcb.node];
    const seq = opt.seq ?? tcb.sndNxt;
    const ack = flags & FLAG.ACK ? tcb.rcvNxt : 0;
    const syn = Boolean(flags & FLAG.SYN);
    const h = { sport: tcb.lport, dport: tcb.rport, seq, ack, flags, flagsText: flagsString(flags),
      hdrLen: syn ? 24 : 20, window: TCP_PARAMS.window, urgent: 0,
      options: syn ? [{ kind: 2, name: 'MSS', value: TCP_PARAMS.mss }] : undefined,
      rel: { seq: (seq - (tcb.iss ?? 0)) >>> 0, ack: flags & FLAG.ACK ? (ack - (tcb.irs ?? 0)) >>> 0 : 0 },
      isn: { local: tcb.iss ?? 0, remote: tcb.irs ?? 0 }, retransmit: Boolean(opt.retransmit) };
    let inner = null;
    if (text != null) {
      inner = dataPdu(nextId(), text);
      emit('app.send', { node: tcb.node, app: tcb.app, layer: 7, pdu: inner, text, dst: tcb.rip, dport: tcb.rport, sport: tcb.lport });
    }
    const seg = encapsulate(nextId(), 'tcp', 4, h, inner);
    const len = blen(text) + (syn ? 1 : 0) + (flags & FLAG.FIN ? 1 : 0);
    emit('tcp_send', { node: tcb.node, pdu: seg, flags: h.flagsText, local: tcb.entry.local, remote: tcb.entry.remote,
      rel: h.rel, len: blen(text), retransmit: h.retransmit,
      detail: `${h.flagsText}: seq ${h.rel.seq}, ack ${h.rel.ack}${text != null ? `, ${blen(text)} B dat` : ''}${h.retransmit ? ' (retransmise)' : ''}` });
    emit('encap', { node: tcb.node, layer: 4, proto: 'tcp', pdu: seg });
    const pkt = newIpPacket(node, { src: tcb.lip, dst: tcb.rip, ttl: ttlOf(node), protocol: IP_TCP }, seg);
    emit('encap', { node: tcb.node, layer: 3, proto: 'ipv4', pdu: pkt });
    if (!opt.retransmit) tcb.sndNxt = seqAdd(tcb.sndNxt, len);
    if (len > 0) {
      // nepotvrzený segment: časovač RTO se spustí, až rámec opravdu odejde (fronta rozhraní)
      const r = opt.entry ?? { seq, end: seqAdd(seq, len), flags, text, tries: 0, rto: TCP_PARAMS.rto, timer: null };
      if (!opt.entry) (tcb.rtx ??= []).push(r);
      onTx(pkt.id, () => {
        if (tcb.closed || !tcb.rtx.includes(r)) return;
        r.timer = sched.schedule({ type: 'tcp.rto', delay: r.rto, payload: { tcb, r } });
      });
    }
    ipOutput(tcb.node, pkt, null);
    return seg;
  }

  sched.on('tcp.rto', (ev) => {
    const { tcb, r } = ev.payload;
    if (tcb.closed || !tcb.rtx.includes(r)) return;
    r.timer = null;
    if (r.tries >= TCP_PARAMS.maxRetries) {
      emit('tcp_abort', { node: tcb.node, detail: `${r.tries} opakování bez potvrzení: spojení zrušeno` });
      setState(tcb, 'CLOSED', `${tcb.entry.state} -> CLOSED (spojení přerušeno)`);
      appEvent(tcb, 'error', { kind: 'timeout' });
      return;
    }
    r.tries++;
    tcb.retransmissions = (tcb.retransmissions ?? 0) + 1;
    const rel = (r.seq - tcb.iss) >>> 0;
    emit('tcp_retransmit', { node: tcb.node, local: tcb.entry.local, remote: tcb.entry.remote, rel, try: r.tries,
      detail: `RTO ${r.rto / 1e6} s vypršel, rel. seq ${rel} nepotvrzen -> stejný segment znovu; další RTO ${r.rto * 2 / 1e6} s` });
    r.rto *= 2;
    tcpSend(tcb, r.flags, r.text, { seq: r.seq, retransmit: true, entry: r });
  });

  // RST na segment bez spojení a bez naslouchající aplikace (tcp.md kap. 7.3).
  function sendRst(node, pkt) {
    const h = pkt.payload.h;
    const len = blen(pkt.payload.payload?.payload) + (h.flags & FLAG.SYN ? 1 : 0) + (h.flags & FLAG.FIN ? 1 : 0);
    const withAck = !(h.flags & FLAG.ACK);
    const tcb = { node: node.id, lport: h.dport, rport: h.sport, lip: pkt.h.dst, rip: pkt.h.src,
      sndNxt: withAck ? 0 : h.ack, rcvNxt: seqAdd(h.seq, len), iss: 0, irs: h.seq,
      entry: { local: sock(pkt.h.dst, h.dport), remote: sock(pkt.h.src, h.sport) } };
    emit('tcp_rst', { node: node.id, port: h.dport, detail: `na portu ${h.dport} nikdo nenaslouchá: odpověď RST` });
    tcpSend(tcb, FLAG.RST | (withAck ? FLAG.ACK : 0));
  }

  // ---- příjem TCP ----
  function tcpReceive(node, pkt) {
    const seg = pkt.payload, h = seg.h;
    const text = seg.payload?.payload ?? null;
    const dlen = blen(text);
    const local = sock(pkt.h.dst, h.dport), remote = sock(pkt.h.src, h.sport);
    emit('ip_deliver', { node: node.id, pdu: pkt, detail: `cílová IP ${pkt.h.dst} je moje, Protocol 6 -> TCP` });
    emit('decap', { node: node.id, layer: 3, proto: 'ipv4', removed: pkt, pdu: seg });
    const conns = node.state.tcp_connections;
    let e = conns.find((x) => x.local === local && x.remote === remote);
    if (!e) {
      const lis = conns.find((x) => x.state === 'LISTEN' && Number(x.local.split(':')[1]) === h.dport);
      if (h.flags & FLAG.RST) return;
      if (!lis || !(h.flags & FLAG.SYN) || (h.flags & FLAG.ACK)) { sendRst(node, pkt); return; }
      // nové spojení z naslouchajícího socketu (naslouchající zůstává)
      const iss = isnOf(seed, local, remote);
      const tcb = addConn(node, { local, remote, state: 'SYN-RECEIVED' }, { app: lis.tcb.app, role: 'server',
        lip: pkt.h.dst, lport: h.dport, rip: pkt.h.src, rport: h.sport, iss, sndNxt: iss, sndUna: iss,
        irs: h.seq, rcvNxt: seqAdd(h.seq, 1), rtx: [], buf: '' });
      emit('tcp_deliver', { node: node.id, pdu: seg, local, remote, app: tcb.app, detail: `cílový port ${h.dport} -> aplikace ${tcb.app} (naslouchá)` });
      emit('tcp_state', { node: node.id, from: 'LISTEN', to: 'SYN-RECEIVED', local, remote, app: tcb.app, conns: snapshot(node),
        detail: `port ${h.dport} naslouchá (LISTEN): nové spojení SYN-RECEIVED; ISN ${iss}` });
      tcpSend(tcb, FLAG.SYN | FLAG.ACK);
      return;
    }
    const tcb = e.tcb;
    emit('tcp_deliver', { node: node.id, pdu: seg, local, remote, app: tcb.app, detail: `spojení ${local} <- ${remote} (${e.state})` });
    if (h.flags & FLAG.RST) {
      setState(tcb, 'CLOSED', `${e.state} -> CLOSED (RST: spojení odmítnuto)`);
      appEvent(tcb, 'error', { kind: 'refused' });
      return;
    }
    if (e.state === 'SYN-SENT') {
      if ((h.flags & FLAG.SYN) && (h.flags & FLAG.ACK) && h.ack === seqAdd(tcb.iss, 1)) {
        tcb.irs = h.seq; tcb.rcvNxt = seqAdd(h.seq, 1);
        ackUpTo(tcb, h.ack);
        setState(tcb, 'ESTABLISHED', 'SYN-SENT -> ESTABLISHED (ack = můj ISN + 1)');
        tcpSend(tcb, FLAG.ACK);
        appEvent(tcb, 'connected');
      }
      return;
    }
    if (h.flags & FLAG.ACK) {
      ackUpTo(tcb, h.ack);
      if (e.state === 'SYN-RECEIVED' && h.ack === seqAdd(tcb.iss, 1)) setState(tcb, 'ESTABLISHED', 'SYN-RECEIVED -> ESTABLISHED');
      else if (e.state === 'FIN-WAIT-1' && h.ack === tcb.sndNxt) setState(tcb, 'FIN-WAIT-2', 'FIN-WAIT-1 -> FIN-WAIT-2');
      else if (e.state === 'LAST-ACK' && h.ack === tcb.sndNxt) {
        setState(tcb, 'CLOSED', 'LAST-ACK -> CLOSED (zůstává jen naslouchající socket)');
        return;
      }
    }
    const fin = Boolean(h.flags & FLAG.FIN);
    if (dlen === 0 && !fin) return;
    if (h.seq !== tcb.rcvNxt) {
      // duplikát (už mám) nebo mimo pořadí: znovu potvrdit, aplikaci nic nepředat
      emit('tcp_dup', { node: node.id, detail: `seq ${(h.seq - tcb.irs) >>> 0} nečekám (čekám ${(tcb.rcvNxt - tcb.irs) >>> 0}): znovu ACK` });
      tcpSend(tcb, FLAG.ACK);
      return;
    }
    tcb.rcvNxt = seqAdd(tcb.rcvNxt, dlen + (fin ? 1 : 0));
    // záznam: data vystoupají do aplikace dřív, než OS pošle potvrzení (na drátě je pořadí stejné: ACK
    // odchází hned, odpověď aplikace až po něm); krok scénáře tak může skončit u příjemce zprávy
    if (dlen > 0) emit('app.recv', { node: node.id, app: tcb.app, port: tcb.lport, layer: 7, pdu: seg.payload, text, from: remote });
    tcpSend(tcb, FLAG.ACK);   // potvrzení hned a samostatně (tcp.md kap. 7.1)
    if (dlen > 0) appEvent(tcb, 'data', { text });
    if (fin) {
      if (e.state === 'ESTABLISHED') {
        setState(tcb, 'CLOSE-WAIT', 'ESTABLISHED -> CLOSE-WAIT (druhá strana už nic nepošle)');
        appEvent(tcb, 'eof');
      } else if (e.state === 'FIN-WAIT-2') {
        setState(tcb, 'TIME-WAIT', 'FIN-WAIT-2 -> TIME-WAIT (2 MSL, tcp.md kap. 9)');
        appEvent(tcb, 'closed');
      }
    }
  }

  function ackUpTo(tcb, ack) {
    tcb.sndUna = ack;
    tcb.rtx = (tcb.rtx ?? []).filter((r) => {
      const done = ((ack - r.end) | 0) >= 0;
      if (done && r.timer != null) sched.cancel(r.timer);
      return !done;
    });
  }

  function tcpClose(tcb) {
    const st = tcb.entry.state;
    if (st === 'ESTABLISHED') {
      tcpSend(tcb, FLAG.FIN | FLAG.ACK);
      setState(tcb, 'FIN-WAIT-1', 'ESTABLISHED -> FIN-WAIT-1');
    } else if (st === 'CLOSE-WAIT') {
      tcpSend(tcb, FLAG.FIN | FLAG.ACK);
      setState(tcb, 'LAST-ACK', 'CLOSE-WAIT -> LAST-ACK (aplikace zavřela socket)');
    }
  }

  // ---- aplikace nad TCP ----
  function appEvent(tcb, kind, arg = {}) {
    if (tcb.role === 'server') return serverApp(tcb, kind, arg);
    const run = runs[tcb.run];
    if (run) clientApp(run, tcb, kind, arg);
  }

  function serverApp(tcb, kind, arg) {
    if (kind === 'data') {
      tcb.buf += arg.text;
      const rq = parseHttp(tcb.buf);
      if (tcb.app === 'web' && rq?.kind === 'request') {
        tcb.buf = '';
        const target = rq.target;
        emit('http_request', { node: tcb.node, app: tcb.app, detail: `port ${tcb.lport} -> aplikace ${tcb.app}: ${rq.method} ${rq.target} Host ${rq.host}` });
        after(appDelay(tcb), () => { if (!tcb.closed) tcpSend(tcb, FLAG.PSH | FLAG.ACK, httpResponse(target)); });
      }
    } else if (kind === 'eof') {
      after(appDelay(tcb), () => tcpClose(tcb));
    }
  }

  function clientApp(run, tcb, kind, arg) {
    if (kind === 'connected') {
      emit('app.event', { node: run.node, app: run.app, run: run.id, result: { kind: 'connected', local: tcb.entry.local, remote: tcb.entry.remote } });
      if (run.command === 'http_get') after(run.think, () => tcpSend(tcb, FLAG.PSH | FLAG.ACK, httpRequest(run.host, run.path)));
      else finish(run, { kind: 'open', local: tcb.entry.local, remote: tcb.entry.remote });
    } else if (kind === 'data') {
      tcb.buf = (tcb.buf ?? '') + arg.text;
      const rs = parseHttp(tcb.buf);
      if (rs?.kind === 'response' && rs.body_len >= (rs.content_length ?? 0)) {
        emit('http_response', { node: run.node, app: run.app, text: tcb.buf,
          detail: `${rs.status} ${rs.reason}, tělo ${rs.body_len} B = Content-Length -> stránka je celá${run.keep ? '' : ', curl zavírá spojení'}` });
        finish(run, { kind: 'response', status: rs.status, reason: rs.reason, content_length: rs.content_length,
          body_len: rs.body_len, local: tcb.entry.local, remote: tcb.entry.remote, retransmissions: tcb.retransmissions ?? 0, text: tcb.buf });
        tcb.buf = '';
        if (!run.keep) after(run.think, () => tcpClose(tcb));
      }
    } else if (kind === 'eof') {
      tcpClose(tcb);
    } else if (kind === 'error') {
      finish(run, { kind: arg.kind, local: tcb.entry.local, remote: tcb.entry.remote });
    }
  }

  function finish(run, result) {
    if (run.done) return;
    run.done = true;
    emit('app.result', { node: run.node, app: run.app, run: run.id, command: run.command, result });
  }

  function tcpConnect(run, dst, port) {
    const node = world.nodes[run.node];
    const iface = node.interfaces[0];
    const lport = tcpPort(node);
    const local = sock(iface.ip, lport), remote = sock(dst, port);
    const iss = isnOf(seed, local, remote);
    const tcb = addConn(node, { local, remote, state: 'SYN-SENT' }, { app: run.app, role: 'client', run: run.id,
      lip: iface.ip, lport, rip: dst, rport: port, iss, sndNxt: iss, sndUna: iss, irs: 0, rcvNxt: 0, rtx: [] });
    run.tcb = tcb;
    emit('tcp_state', { node: run.node, from: 'CLOSED', to: 'SYN-SENT', local, remote, app: run.app, conns: snapshot(node),
      detail: `CLOSED -> SYN-SENT; dynamický port ${lport}; ISN ${iss}` });
    tcpSend(tcb, FLAG.SYN);
  }

  // ---- DNS: resolver (klient) a server ----
  function udpOut(node, sport, dst, dport, inner) {
    const iface = node.interfaces[0];
    const dg = encapsulate(nextId(), 'udp', 4, { sport, dport }, inner);
    emit('encap', { node: node.id, layer: 4, proto: 'udp', pdu: dg });
    const pkt = newIpPacket(node, { src: iface.ip, dst, ttl: ttlOf(node), protocol: IP_UDP }, dg);
    emit('encap', { node: node.id, layer: 3, proto: 'ipv4', pdu: pkt });
    ipOutput(node.id, pkt, null);
  }

  function dnsResolve(run) {
    const node = world.nodes[run.node];
    const hit = !run.noCache && node.state.dns_cache.find((r) => r.name.toLowerCase() === run.name.toLowerCase() && r.type === run.qtype);
    if (hit) {
      emit('dns_cache_hit', { node: run.node, detail: `${run.name} je v DNS cache: ${hit.data} (na síť nic nejde)` });
      return dnsDone(run, { kind: 'answer', name: run.name, server: null, authoritative: false, rcode: 0, cached: true,
        answers: [{ name: hit.name, type: hit.type, data: hit.data, ttl: hit.ttl }] });
    }
    const server = node.dns_servers?.[0];
    if (!server) return dnsDone(run, { kind: 'no_server', name: run.name });
    run.server = server;
    run.port = udpPort(node);
    node.state.udp_sockets.push({ app: 'resolver', port: run.port });
    run.qid = node.state.dnsId = (node.state.dnsId ?? 0) + 1;
    run.tries = 0;
    dnsSend(run);
  }

  function dnsSend(run) {
    const node = world.nodes[run.node];
    run.tries++;
    const q = dnsQuery(run.qid, run.name, run.qtype);
    const pdu = encapsulate(nextId(), 'dns', 7, q, null);
    const iface = node.interfaces[0];
    const remote = !sameSubnet(run.server, iface.ip, iface.prefix);
    emit('app.send', { node: run.node, app: run.app, layer: 7, pdu, dst: run.server, dport: DNS_PORT, sport: run.port });
    emit('udp_send', { node: run.node, app: 'resolver', sport: run.port, dst: run.server, dport: DNS_PORT,
      detail: `resolver: ${run.tries > 1 ? `opakovaný dotaz (pokus ${run.tries})` : `nový UDP socket, dynamický port ${run.port}`}; DNS server ${run.server}${remote ? ' je v jiné síti -> přes bránu' : ''}` });
    udpOut(node, run.port, run.server, DNS_PORT, pdu);
    run.timer = sched.schedule({ type: 'dns.timeout', delay: run.timeout, payload: { run: run.id } });
  }

  sched.on('dns.timeout', (ev) => {
    const run = runs[ev.payload.run];
    if (!run || run.done) return;
    if (run.tries <= run.retries) {
      emit('dns_timeout', { node: run.node, app: run.app, tries: run.tries,
        detail: `odpověď nepřišla do ${run.timeout / 1e6} s: UDP nic neopakuje, dotaz pošle znovu aplikace (${run.app})` });
      dnsSend(run);
      return;
    }
    closeResolver(run);
    dnsDone(run, { kind: 'timeout', name: run.name, server: run.server });
  });

  function closeResolver(run) {
    const s = world.nodes[run.node].state.udp_sockets;
    const i = s.findIndex((x) => x.app === 'resolver' && x.port === run.port);
    if (i >= 0) s.splice(i, 1);
  }

  function dnsDone(run, result) {
    finish(run, result);
    if (run.then && result.kind === 'answer' && result.answers.length) run.then(result.answers[0].data);
    else if (run.then) run.thenFail?.(result);
  }

  // UDP datagram s DNS zprávou doručený socketu `s` (resolver nebo server dns).
  function dnsReceive(node, pkt, dg, s) {
    const msg = dg.payload.h;
    if (!msg.qr && s.app === 'dns') {
      const ans = dnsAnswer(node.dns_zone, msg);
      emit('dns_answer', { node: node.id, rcode: ans.rcode,
        detail: ans.rcode === 0 ? `${node.dns_zone.zone} je moje zóna: ${ans.answers.map((a) => `${a.name} ${a.type} ${a.data}`).join(', ')} (autoritativní odpověď, AA=1)`
          : ans.rcode === 3 ? `${msg.question.name} v zóně ${node.dns_zone?.zone} neexistuje (NXDOMAIN)` : `${msg.question.name} není moje zóna a rekurzi nedělám (REFUSED)` });
      const pdu = encapsulate(nextId(), 'dns', 7, ans, null);
      emit('app.send', { node: node.id, app: 'dns', layer: 7, pdu, dst: pkt.h.src, dport: dg.h.sport, sport: dg.h.dport });
      udpOut(node, dg.h.dport, pkt.h.src, dg.h.sport, pdu);
      return;
    }
    if (msg.qr && s.app === 'resolver') {
      const run = Object.values(runs).find((r) => r.node === node.id && !r.done && r.port === s.port && r.qid === msg.id);
      if (!run) return;
      sched.cancel(run.timer);
      closeResolver(run);
      const answers = msg.answers.map((a) => ({ name: a.name, type: a.type, data: a.data, ttl: a.ttl }));
      if (msg.rcode === 0 && !run.noCache) {
        for (const a of answers) if (!node.state.dns_cache.some((x) => x.name === a.name && x.type === a.type)) node.state.dns_cache.push({ ...a });
      }
      emit('dns_result', { node: node.id, app: run.app, rcode: msg.rcode, answers,
        detail: `ID ${msg.id} sedí s dotazem${msg.rcode === 0 && !run.noCache ? `; záznam do DNS cache na ${answers[0]?.ttl} s` : ''}; socket se zavře` });
      dnsDone(run, { kind: 'answer', name: run.name, server: pkt.h.src, authoritative: Boolean(msg.aa), rcode: msg.rcode, answers });
    }
  }

  // ---- akce ----
  function newRun(node, command, app, extra) {
    const run = { id: ++runSeq, node, command, app, done: false, ...extra };
    runs[run.id] = run;
    emit('app.start', { node, app, run: run.id, command, dst: extra.dst ?? extra.name ?? extra.host });
    return run;
  }

  function startResolve(nodeId, name, opts = {}) {
    const run = newRun(nodeId, 'dns_resolve', opts.app ?? 'resolver', { dst: world.nodes[nodeId].dns_servers?.[0] ?? null, name, qtype: opts.type ?? 'A',
      noCache: Boolean(opts.noCache), timeout: opts.timeout ?? DNS_PARAMS.timeout, retries: opts.retries ?? DNS_PARAMS.retries,
      then: opts.then, thenFail: opts.thenFail });
    dnsResolve(run);
    return run;
  }

  function startHttp(nodeId, a, command = 'http_get') {
    const port = a.port ?? 80;
    const run = newRun(nodeId, command, a.client ?? 'curl', { dst: a.dst, host: a.host ?? a.dst, path: a.path ?? '/', port,
      keep: Boolean(a.keep), think: Math.round((a.think ?? 0) * 1e6) });
    if (a.via) {
      // další požadavek po existujícím spojení (místní port `via`)
      const e = world.nodes[nodeId].state.tcp_connections.find((x) => x.tcb.lport === a.via && x.state === 'ESTABLISHED');
      if (!e) return finish(run, { kind: 'no_connection' });
      e.tcb.run = run.id;
      run.tcb = e.tcb;
      tcpSend(e.tcb, FLAG.PSH | FLAG.ACK, httpRequest(run.host, run.path));
      return run;
    }
    if (!a.dst && /^\d{1,3}(\.\d{1,3}){3}$/.test(a.host ?? '')) run.dst = a.host;   // curl na IP adresu: bez DNS
    if (run.dst) tcpConnect(run, run.dst, port);
    else {
      startResolve(nodeId, a.host, { then: (ip) => { run.dst = ip; after(run.think, () => tcpConnect(run, ip, port)); },
        thenFail: (res) => finish(run, { kind: 'dns_failed', dns: res }) });
    }
    return run;
  }

  function onAction(a) {
    const args = a.args ?? {};
    switch (a.command) {
      case 'dns_resolve': startResolve(a.node, args.name, args); return true;
      case 'nslookup': startResolve(a.node, args.name, { app: 'nslookup', noCache: true, timeout: args.timeout ?? 2_000_000, retries: args.retries ?? 1 }); return true;
      case 'http_get': startHttp(a.node, args); return true;
      case 'tcp_open': startHttp(a.node, args, 'tcp_open'); return true;
      case 'tcp_close': {
        for (const e of [...world.nodes[a.node].state.tcp_connections]) {
          if (e.state !== 'LISTEN' && (args.port == null || e.tcb.lport === args.port)) tcpClose(e.tcb);
        }
        return true;
      }
      case 'tcp_expire': {
        // konec TIME-WAIT (2 MSL); jádro ho samo neplánuje, aby koncový stav vektoru TIME-WAIT ukázal
        for (const e of [...world.nodes[a.node].state.tcp_connections]) if (e.state === 'TIME-WAIT') setState(e.tcb, 'CLOSED', 'TIME-WAIT -> CLOSED (uplynulo 2 MSL)');
        return true;
      }
      case 'link_loss': losses.push({ ...args, left: args.count ?? 1 }); return true;
      default: return false;
    }
  }

  // Ztráta rámce naplánovaná akcí link_loss (vektory.md kap. 10). Vrací true = rámec se ztratí.
  function lossCheck(from, linkId, frame) {
    const ip = frame.payload?.proto === 'ipv4' ? frame.payload : null;
    for (const l of losses) {
      if (l.left <= 0 || l.link !== linkId || (l.from && l.from !== from)) continue;
      const m = l.match ?? {};
      const l4 = ip?.payload;
      if (m.proto && l4?.proto !== m.proto) continue;
      if (m.payload && !(l4?.payload)) continue;
      l.left--;
      return true;
    }
    return false;
  }

  return { tcpReceive, dnsReceive, onAction, lossCheck, runs };
}
