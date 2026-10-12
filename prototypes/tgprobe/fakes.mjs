// Minimal fakes: Telegram Bot API + Starknet JSON-RPC on loopback.
import { createServer } from "node:http";
const body = (req) => new Promise((ok) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => ok(b)); });
export function fakeTelegram(token) {
  const queue = [], sent = [], calls = [], waiters = [];
  let nextId = 1, offset = 0;
  const server = createServer(async (req, res) => {
    const raw = await body(req);
    const m = req.url.match(/^\/bot([^/]+)\/(\w+)/);
    const reply = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (!m || m[1] !== token) return reply(401, { ok: false, error_code: 401, description: "Unauthorized" });
    let p = {};
    try { p = raw ? JSON.parse(raw) : Object.fromEntries(new URL(req.url, "http://x").searchParams); } catch { p = {}; }
    const method = m[2]; calls.push({ method, p });
    if (method === "getMe") return reply(200, { ok: true, result: { id: 42, is_bot: true, first_name: "Fake", username: "fake_bot" } });
    if (method === "getUpdates") {
      if (p.offset) offset = Math.max(offset, Number(p.offset));
      const ready = () => queue.filter((u) => u.update_id >= offset);
      const deadline = Date.now() + Math.min(Number(p.timeout ?? 0), 2) * 1000;
      while (ready().length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
      return reply(200, { ok: true, result: ready().slice(0, Number(p.limit ?? 100)) });
    }
    if (method === "sendMessage") {
      const msg = { message_id: nextId++, chat: { id: Number(p.chat_id) }, text: p.text, date: 0 };
      sent.push({ ...p }); for (const w of waiters.splice(0)) w();
      return reply(200, { ok: true, result: msg });
    }
    if (["setMyCommands", "deleteWebhook", "answerCallbackQuery", "editMessageText"].includes(method)) return reply(200, { ok: true, result: true });
    return reply(404, { ok: false, error_code: 404, description: "Not Found: method" });
  });
  let uid = 1;
  return {
    server, sent, calls,
    say(chatId, text, from = chatId) { queue.push({ update_id: uid++, message: { message_id: uid, date: 1793000000, chat: { id: chatId, type: "private" }, from: { id: from, is_bot: false, first_name: "U" }, text, ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}) } }); },
    async reply(chatId, ms = 5000) {
      const end = Date.now() + ms; const seen = sent.length;
      while (Date.now() < end) { const r = sent.slice(seen).find((s) => Number(s.chat_id) === chatId); if (r) return r; await new Promise((r) => setTimeout(r, 20)); }
      throw new Error(`no sendMessage to ${chatId} within ${ms} ms`);
    },
  };
}
export function fakeRpc(handlers) {
  const log = [];
  const server = createServer(async (req, res) => {
    const raw = await body(req);
    let msg; try { msg = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
    const one = (m) => { log.push(m.method); const h = handlers[m.method];
      if (!h) return { jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } };
      try { return { jsonrpc: "2.0", id: m.id, result: h(m.params) }; } catch (e) { return { jsonrpc: "2.0", id: m.id, error: e.rpc ?? { code: -32603, message: String(e.message) } }; } };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
  });
  return { server, log };
}
