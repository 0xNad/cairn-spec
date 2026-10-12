import { fakeTelegram, fakeRpc } from "./fakes.mjs";
import { Bot } from "grammy";
import { RpcProvider } from "starknet";
const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(s.address().port)));
const tg = fakeTelegram("123:TEST");
const rpc = fakeRpc({
  starknet_specVersion: () => "0.9.0",
  starknet_blockNumber: () => 1234,
  starknet_chainId: () => "0x534e5f4d41494e",
  starknet_getBlockWithTxHashes: () => ({ status: "ACCEPTED_ON_L2", block_hash: "0x1", parent_hash: "0x0", block_number: 1234, new_root: "0x2", timestamp: 1793000000, sequencer_address: "0x3", l1_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" }, l2_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" }, l1_data_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" }, l1_da_mode: "BLOB", starknet_version: "0.14.0", transactions: [] }),
  starknet_call: (p) => ["0x0de0b6b3a7640000", "0x0"],
  starknet_getEvents: () => ({ events: [] }),
});
const tport = await listen(tg.server), rport = await listen(rpc.server);
const provider = new RpcProvider({ nodeUrl: `http://127.0.0.1:${rport}` });
const t0 = Date.now();
console.log("blockNumber", await provider.getBlockNumber());
const b = await provider.getBlock("latest"); console.log("block ts", b.timestamp);
const bal = await provider.callContract({ contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d", entrypoint: "balance_of", calldata: ["0x123"] });
console.log("call", bal);
console.log("rpc methods seen", rpc.log, Date.now() - t0, "ms");
const bot = new Bot("123:TEST", { client: { apiRoot: `http://127.0.0.1:${tport}` } });
bot.command("start", (ctx) => ctx.reply("hi " + ctx.from.id));
bot.on("message:text", (ctx) => ctx.reply("echo " + ctx.message.text));
bot.start({ timeout: 1, drop_pending_updates: false });
tg.say(7, "/start"); console.log("reply1", (await tg.reply(7)).text);
tg.say(7, "gm"); console.log("reply2", (await tg.reply(7)).text);
console.log("tg methods", [...new Set(tg.calls.map((c) => c.method))]);
await bot.stop();
const Database = (await import("better-sqlite3")).default; const db = new Database(":memory:"); db.exec("create table t(a)"); console.log("better-sqlite3 ok", db.prepare("select 1 as x").get());
process.exit(0);
