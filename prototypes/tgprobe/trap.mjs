// Loaded into the entry with NODE_OPTIONS=--import=<this file>: records every outbound connection and DNS lookup.
import net from "node:net"; import dns from "node:dns"; import { appendFileSync } from "node:fs";
const out = process.env.TRAP_LOG;
const note = (kind, dest) => { try { appendFileSync(out, JSON.stringify({ pid: process.pid, kind, dest }) + "\n"); } catch {} };
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) {
  const o = typeof a[0] === "object" && a[0] !== null ? a[0] : { port: a[0], host: a[1] };
  if (!Array.isArray(a[0])) note("connect", o.path ?? `${o.host ?? "localhost"}:${o.port}`);
  return connect.apply(this, a);
};
for (const f of ["lookup", "resolve", "resolve4", "resolve6"]) { const orig = dns[f]; dns[f] = function (host, ...r) { note(`dns.${f}`, host); return orig.call(this, host, ...r); }; }
const pl = dns.promises.lookup; dns.promises.lookup = (h, ...r) => { note("dns.promises.lookup", h); return pl(h, ...r); };
