// Fake Telegram Bot API for offline checks. Node built-ins only.
import http from "node:http";

const INT = new Set(["chat_id", "message_id", "offset", "limit", "timeout", "user_id", "cache_time", "message_thread_id"]);
const BOOL = new Set(["show_alert", "disable_notification", "drop_pending_updates", "protect_content"]);
const JSONF = new Set(["reply_markup", "allowed_updates", "entities", "link_preview_options", "reply_parameters", "commands", "scope"]);
const HIDDEN = ["chat_member", "message_reaction", "message_reaction_count"]; // not delivered unless asked for
const TAGS = new Set(["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "span", "tg-spoiler", "a", "tg-emoji", "tg-time", "code", "pre", "blockquote"]);
const E = {
  parse: (why) => [400, `Bad Request: can't parse entities: ${why}`],
  notModified: [400, "Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message"],
};

function coerce(p) {
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== "string") continue;
    if (INT.has(k) && /^-?\d+$/.test(v)) p[k] = Number(v);
    else if (BOOL.has(k)) p[k] = v === "true";
    else if (JSONF.has(k)) { try { p[k] = JSON.parse(v); } catch { /* leave as string: handler rejects */ } }
  }
  return p;
}

// Returns [plainText, error|null]. HTML is checked strictly; MarkdownV2 by the escaping rules for prose.
export function parseText(text, mode) {
  const m = String(mode ?? "").toLowerCase();
  if (m === "html") {
    const stack = [];
    for (const t of text.matchAll(/<(\/?)([a-zA-Z-]*)([^<>]*)>|<|&(?!(?:lt|gt|amp|quot|#\d+|#x[0-9a-fA-F]+);)/g)) {
      if (t[0] === "<") return ["", `Unsupported start tag at byte offset ${Buffer.byteLength(text.slice(0, t.index))}`];
      if (t[0] === "&") return ["", `Can't find end of HTML entity at byte offset ${Buffer.byteLength(text.slice(0, t.index))}`];
      if (!TAGS.has(t[2].toLowerCase())) return ["", `Unsupported start tag "${t[2]}" at byte offset ${Buffer.byteLength(text.slice(0, t.index))}`];
      if (t[1]) { if (stack.pop() !== t[2].toLowerCase()) return ["", `Unmatched end tag "${t[2]}"`]; }
      else stack.push(t[2].toLowerCase());
    }
    if (stack.length) return ["", `Can't find end tag corresponding to start tag "${stack.at(-1)}"`];
    return [text.replace(/<[^>]*>/g, "").replace(/&(lt|gt|amp|quot);/g, "x").replace(/&#x?[0-9a-fA-F]+;/g, "x"), null];
  }
  if (m === "markdownv2") {
    let out = "", code = false, url = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "\\") { i++; if (!url) out += text[i] ?? ""; continue; }
      if (code) { if (c === "`") code = false; else out += c; continue; }
      if (url) { if (c === ")") url = false; continue; }
      if (c === "`") { code = true; continue; }
      if (c === "(" && text[i - 1] === "]") { url = true; continue; }
      if (".!-+=#{}()".includes(c) || (c === ">" && i > 0 && text[i - 1] !== "\n") || (c === "|" && text[i + 1] !== "|" && text[i - 1] !== "|"))
        return ["", `Character '${c}' is reserved and must be escaped with the preceding '\\'`];
      if (!"*_~|[]>".includes(c)) out += c;
    }
    return code ? ["", "Can't find end of the entity"] : [out, null];
  }
  if (m && m !== "markdown") return ["", null, `Bad Request: unsupported parse_mode`];
  return [text, null];
}

function checkMarkup(rm) {
  for (const row of rm?.inline_keyboard ?? []) for (const b of row) {
    if (typeof b.text !== "string") return "Bad Request: text buttons are unallowed in the inline keyboard";
    if (b.callback_data !== undefined && (Buffer.byteLength(b.callback_data) < 1 || Buffer.byteLength(b.callback_data) > 64)) return "Bad Request: BUTTON_DATA_INVALID";
  }
  return null;
}

export function fakeBotApi({ token = "123456:TEST-token", me = { id: 999000, is_bot: true, first_name: "Hotpod Test Bot", username: "hotpod_test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false }, holdMs = 300 } = {}) {
  const calls = [], queue = [], msgs = new Map(), openCbq = new Set(), chats = new Map(), members = new Map(), fail = [], reactions = [];
  const blocked = new Set(), kicked = new Set(), migrated = new Map();
  let updateId = 1, messageId = 1000, cbqId = 1, acked = 0, webhook = "", allowed = null, poll = null;
  const now = () => Math.floor(Date.now() / 1000);
  const wake = () => { if (poll) poll.wake(); };
  const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const ok = (res, result) => send(res, 200, { ok: true, result });
  const err = (res, [code, description], parameters) => send(res, code, { ok: false, error_code: code, description, ...(parameters && { parameters }) });

  const push = (kind, payload) => {
    for (const c of [payload.chat, payload.message?.chat]) if (c) chats.set(c.id, c);
    const u = { update_id: updateId++, [kind]: payload };
    queue.push(u); wake(); return u;
  };
  const pushMessage = (from, chat, text, extra = {}) => {
    const entities = /^\/\w+(@\w+)?/.exec(text) ? [{ type: "bot_command", offset: 0, length: /^\/\w+(@\w+)?/.exec(text)[0].length }] : undefined;
    return push("message", { message_id: messageId++, from, chat, date: now(), text, ...(entities && { entities }), ...extra });
  };
  const pushCallback = (from, message, data) => {
    const id = `cbq-${cbqId++}`; openCbq.add(id);
    return push("callback_query", { id, from, message, chat_instance: "-7700000000000000001", data });
  };

  const handlers = {
    getme: () => [me],
    deletewebhook: (p) => { webhook = ""; if (p.drop_pending_updates) queue.length = 0; return [true]; },
    setwebhook: (p) => { webhook = p.url ?? ""; return [true]; },
    getwebhookinfo: () => [{ url: webhook, has_custom_certificate: false, pending_update_count: queue.length }],
    setmycommands: () => [true], sendchataction: () => [true], setmessagereaction: (p) => (reactions.push(p), [true]),
    getchatmember: (p) => [{ status: members.get(`${p.chat_id}:${p.user_id}`) ?? "member", user: { id: p.user_id, is_bot: false, first_name: "User" } }],
    sendmessage: (p) => {
      if (p.chat_id === undefined || p.chat_id === "") return [, [400, "Bad Request: chat_id is empty"]];
      if (!p.text) return [, [400, "Bad Request: message text is empty"]];
      if (migrated.has(p.chat_id)) return [, [400, "Bad Request: group chat was upgraded to a supergroup chat"], { migrate_to_chat_id: migrated.get(p.chat_id) }];
      if (blocked.has(p.chat_id)) return [, [403, "Forbidden: bot was blocked by the user"]];
      if (kicked.has(p.chat_id)) return [, [403, "Forbidden: bot was kicked from the group chat"]];
      const chat = chats.get(p.chat_id); if (!chat) return [, [400, "Bad Request: chat not found"]];
      const [plain, why, bad] = parseText(p.text, p.parse_mode);
      if (bad) return [, [400, bad]]; if (why) return [, E.parse(why)];
      if (plain.length > 4096) return [, [400, "Bad Request: message is too long"]];
      const mk = checkMarkup(p.reply_markup); if (mk) return [, [400, mk]];
      const m = { message_id: messageId++, from: me, chat, date: now(), text: plain, ...(p.reply_markup && { reply_markup: p.reply_markup }), _raw: p.text };
      msgs.set(`${p.chat_id}:${m.message_id}`, m); return [strip(m)];
    },
    answercallbackquery: (p) => {
      if (!openCbq.delete(p.callback_query_id)) return [, [400, "Bad Request: query is too old and response timeout expired or query ID is invalid"]];
      if ((p.text ?? "").length > 200) return [, [400, "Bad Request: MESSAGE_TOO_LONG"]];
      return [true];
    },
    editmessagetext: (p) => {
      const m = msgs.get(`${p.chat_id}:${p.message_id}`); if (!m) return [, [400, "Bad Request: message to edit not found"]];
      const [plain, why, bad] = parseText(p.text ?? "", p.parse_mode);
      if (bad) return [, [400, bad]]; if (why) return [, E.parse(why)]; if (!plain) return [, [400, "Bad Request: message text is empty"]];
      if (plain.length > 4096) return [, [400, "Bad Request: message is too long"]];
      if (plain === m.text && JSON.stringify(p.reply_markup ?? null) === JSON.stringify(m.reply_markup ?? null)) return [, E.notModified];
      Object.assign(m, { text: plain, reply_markup: p.reply_markup, edit_date: now(), _raw: p.text });
      return [strip(m)];
    },
  };
  const strip = ({ _raw, ...m }) => m;

  async function getUpdates(p, res) {
    if (webhook) return err(res, [409, "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first"]);
    if (p.allowed_updates !== undefined) allowed = p.allowed_updates;
    const offset = p.offset ?? 0, limit = Math.min(Math.max(p.limit ?? 100, 1), 100);
    if (offset > 0) { while (queue.length && queue[0].update_id < offset) queue.shift(); acked = Math.max(acked, offset - 1); }
    const want = (u) => { const k = Object.keys(u).find((x) => x !== "update_id"); return allowed?.length ? allowed.includes(k) : !HIDDEN.includes(k); };
    const pick = () => queue.filter(want).slice(0, limit);
    if (!pick().length && (p.timeout ?? 0) > 0) {
      if (poll) poll.kill();
      await new Promise((r) => {
        const t = setTimeout(done, Math.min(p.timeout * 1000, holdMs));
        function done() { clearTimeout(t); poll = null; r(); }
        poll = { wake: done, kill: () => { err(res, [409, "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running"]); res.killed = true; done(); } };
      });
      if (res.killed) return;
    }
    ok(res, pick());
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const u = new URL(req.url, "http://x"), m = /^\/bot([^/]+)\/(?:test\/)?([A-Za-z]+)$/.exec(u.pathname);
      if (!m) return err(res, [404, "Not Found"]);
      if (m[1] !== token) return err(res, [401, "Unauthorized"]);
      const type = req.headers["content-type"] ?? "", body = Buffer.concat(chunks).toString("utf8");
      if (type.startsWith("multipart/")) return err(res, [400, "Bad Request: the fake Bot API takes no file uploads"]);
      let p = Object.fromEntries(u.searchParams);
      try { if (type.startsWith("application/json") && body) p = { ...p, ...JSON.parse(body) }; else if (body) p = { ...p, ...Object.fromEntries(new URLSearchParams(body)) }; }
      catch { return err(res, [400, "Bad Request: can't parse JSON object"]); }
      coerce(p);
      const method = m[2].toLowerCase(), call = { method: m[2], params: p, at: Date.now() };
      calls.push(call);
      const f = fail.findIndex((x) => x.method.toLowerCase() === method);
      if (f >= 0) { const [x] = fail.splice(f, 1); call.failed = x.code; return err(res, [x.code, x.description], x.parameters); }
      if (method === "getupdates") { for (const r of fake.reactions) r(call, undefined); return getUpdates(p, res); }
      const h = handlers[method]; if (!h) return err(res, [404, "Not Found: method not found"]);
      const [result, e, params] = h(p);
      if (e) { call.failed = e[0]; return err(res, e, params); }
      ok(res, result);
      for (const r of fake.reactions) r(call, result);
    });
  });

  const fake = {
    calls, msgs, members, blocked, kicked, migrated, reactions: [], setReactions: reactions,
    get acked() { return acked; }, get pending() { return queue.length; },
    push, pushMessage, pushCallback,
    failNext: (method, code, description, parameters) => fail.push({ method, code, description, parameters }),
    on: (fn) => fake.reactions.push(fn),
    listen: () => new Promise((r) => server.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${server.address().port}`))),
    close: () => new Promise((r) => { poll?.wake(); server.close(r); server.closeAllConnections?.(); }),
  };
  return fake;
}
