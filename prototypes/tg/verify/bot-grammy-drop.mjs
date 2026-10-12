import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN, { client: { apiRoot: process.env.TELEGRAM_API_ROOT } });
bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 5 }));
if (process.env.TELEGRAM_DRAIN === "1") bot.api.config.use(async (prev, method, payload, signal) => {
  const r = await prev(method, payload, signal);
  if (method === "getUpdates" && r.ok && r.result.length === 0) setImmediate(() => bot.stop());
  return r;
});
const md = (s) => String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
bot.command("start", (ctx) => ctx.reply(`Hi\\! payload: \`${md(ctx.match || "none")}\``, { parse_mode: "MarkdownV2" }));
bot.command("price", (ctx) => ctx.reply(`STRK \\= ${md("0.5")} USD`, { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } }));
bot.command("setup", async (ctx) => {
  const m = await ctx.getChatMember(ctx.from.id);
  if (!["creator", "administrator"].includes(m.status)) return ctx.reply("Admins only.");
  return ctx.reply("Setup done.");
});
bot.callbackQuery(/^px:/, async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText(`STRK \\= ${md("0.51")} USD`, { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } }); });
bot.on("message:migrate_to_chat_id", () => {});
bot.catch((e) => console.error("handler error:", e.error?.description ?? e.message));
await bot.start({ drop_pending_updates: true, timeout: 1 });
console.log("stopped cleanly");
