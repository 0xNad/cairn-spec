import { Bot, Api } from "node-telegram-bot-api";
const opts = { apiRoot: process.env.TELEGRAM_API_ROOT, maxRetries: 2 };
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN, opts);
const md = (s) => String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
const me = await bot.api.getMe();
const cmd = (ctx) => { const m = /^\/(\w+)(?:@(\w+))?(?:\s+(.*))?$/s.exec(ctx.message?.text ?? ""); if (!m || (m[2] && m[2].toLowerCase() !== me.username.toLowerCase())) return null; return { name: m[1], arg: m[3] ?? "" }; };
bot.on("message", async (ctx) => {
  const c = cmd(ctx); if (!c) return;
  if (c.name === "start") return ctx.reply(`Hi\\! payload: \`${md(c.arg || "none")}\``, { parse_mode: "MarkdownV2" });
  if (c.name === "price") return ctx.reply(`STRK \\= ${md("0.5")} USD`, { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } });
  if (c.name === "setup") { const m = await bot.api.getChatMember({ chat_id: ctx.message.chat.id, user_id: ctx.message.from.id }); return ctx.reply(["creator", "administrator"].includes(m.status) ? "Setup done." : "Admins only."); }
});
bot.on("callback_query", async (ctx) => {
  const q = ctx.callbackQuery; await ctx.answerCallbackQuery();
  await bot.api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, text: `STRK \\= ${md("0.51")} USD`, parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } });
});
// drain: poll by hand so we can stop on the first empty batch
let offset = 0;
for (;;) {
  const ups = await bot.api.getUpdates({ offset, timeout: 1 });
  if (!ups.length && process.env.TELEGRAM_DRAIN === "1") break;
  for (const u of ups) { await bot.handleUpdate(u); offset = u.update_id + 1; }
}
await bot.api.getUpdates({ offset, limit: 1 });
console.log("stopped cleanly");
