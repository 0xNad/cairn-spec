import { Telegraf } from "telegraf";
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { telegram: { apiRoot: process.env.TELEGRAM_API_ROOT } });
const call = bot.telegram.callApi.bind(bot.telegram);
bot.telegram.callApi = async (method, payload, opts) => {
  for (let i = 0; ; i++) {
    try {
      const r = await call(method, payload, opts);
      if (process.env.TELEGRAM_DRAIN === "1" && method === "getUpdates" && r.length === 0) setImmediate(() => bot.stop("drain"));
      return r;
    } catch (e) {
      const ra = e.response?.parameters?.retry_after;
      if (e.code === 429 && ra && i < 2) { await new Promise((r) => setTimeout(r, ra * 1000)); continue; }
      throw e;
    }
  }
};
const md = (s) => String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
bot.start((ctx) => ctx.reply(`Hi\\! payload: \`${md(ctx.payload || "none")}\``, { parse_mode: "MarkdownV2" }));
bot.command("price", (ctx) => ctx.reply(`STRK \\= ${md("0.5")} USD`, { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } }));
bot.command("setup", async (ctx) => {
  const m = await ctx.getChatMember(ctx.from.id);
  return ctx.reply(["creator", "administrator"].includes(m.status) ? "Setup done." : "Admins only.");
});
bot.action(/^px:/, async (ctx) => { await ctx.answerCbQuery(); await ctx.editMessageText(`STRK \\= ${md("0.51")} USD`, { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [[{ text: "Refresh", callback_data: "px:STRK" }]] } }); });
bot.catch((e) => console.error("handler error:", e.description ?? e.message));
await bot.launch({ dropPendingUpdates: false });
console.log("stopped cleanly");
