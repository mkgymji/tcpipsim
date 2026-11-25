// HTTP/1.1 (L7, http.md): požadavek GET od curl a odpověď 200 OK / 404 webového serveru. Text s CRLF.
// Bez DOM.

export const HTTP_PORT = 80;
export const CURL_UA = 'curl/8.9.1';
export const HTTP_DATE = 'Wed, 25 Nov 2026 08:00:00 GMT';   // Simulátor zjednodušuje: pevný čas
export const PAGE = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Škola</title></head>\n'
  + '<body><h1>Vítej na www.skola.lan</h1></body></html>\n';
const NOT_FOUND = 'Stránka nenalezena.\n';

const blen = (s) => new TextEncoder().encode(s).length;

export function httpRequest(host, path = '/') {
  return `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${CURL_UA}\r\nAccept: */*\r\n\r\n`;
}

export function httpResponse(path) {
  const ok = path === '/';
  const body = ok ? PAGE : NOT_FOUND;
  const status = ok ? '200 OK' : '404 Not Found';
  const type = ok ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  return `HTTP/1.1 ${status}\r\nDate: ${HTTP_DATE}\r\nContent-Type: ${type}\r\nContent-Length: ${blen(body)}\r\n\r\n${body}`;
}

/** Rozbor zprávy: požadavek { kind, method, target, version, host } nebo odpověď { kind, version, status, reason, content_length }. */
export function parseHttp(text) {
  if (typeof text !== 'string') return null;
  const end = text.indexOf('\r\n\r\n');
  if (end < 0) return null;
  const [start, ...lines] = text.slice(0, end).split('\r\n');
  const headers = {};
  for (const l of lines) {
    const i = l.indexOf(':');
    if (i > 0) headers[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim();
  }
  const body = text.slice(end + 4);
  let m = start.match(/^(HTTP\/\d\.\d) (\d{3}) (.*)$/);
  if (m) {
    return { kind: 'response', version: m[1], status: Number(m[2]), reason: m[3],
      content_length: headers['content-length'] != null ? Number(headers['content-length']) : null,
      headers, body, body_len: blen(body), head_len: blen(text.slice(0, end + 4)) };
  }
  m = start.match(/^([A-Z]+) (\S+) (HTTP\/\d\.\d)$/);
  if (m) return { kind: 'request', method: m[1], target: m[2], version: m[3], host: headers.host ?? null, headers, body };
  return null;
}
