import { spawn } from "node:child_process";
import { fakeBotApi } from "./fake-bot-api.mjs";
const [,, botFile] = process.argv;
const fake = fakeBotApi();
const root = await fake.listen();
const alice = { id: 4242, is_bot: false, first_name: "Alice", username: "alice", language_code: "en" };
const bob = { id: 4343, is_bot: false, first_name: "Bob" };
const dm = { id: 4242, type: "private", first_name: "Alice", username: "alice" };
const grp = { id: -1001234567890, type: "supergroup", title: "Stark Devs" };
fake.members.set(`${grp.id}:${alice.id}`, "administrator");
let scripted = false;
const script = () => {
fake.pushMessage(alice, dm, "/start ref_abc-1");
fake.pushMessage(alice, grp, "/price@hotpod_test_bot");
fake.pushMessage(alice, grp, "/price@other_bot");
fake.pushMessage(bob, grp, "/setup@hotpod_test_bot");
fake.pushMessage(alice, grp, "/setup@hotpod_test_bot");
};
fake.on((call) => { if (call.method === "getUpdates" && !scripted) { scripted = true; script(); } });
let pushedCb = false;
fake.on((call, result) => {
  if (call.method.toLowerCase() === "sendmessage" && result?.reply_markup && !pushedCb) { pushedCb = true; fake.pushCallback(alice, result, "px:STRK"); }
});
fake.failNext("sendMessage", 429, "Too Many Requests: retry after 1", { retry_after: 1 });
const t0 = Date.now();
const child = spawn(process.execPath, [botFile], { env: { PATH: process.env.PATH, TELEGRAM_API_ROOT: root, TELEGRAM_BOT_TOKEN: "123456:TEST-token", TELEGRAM_DRAIN: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let out = ""; child.stdout.on("data", (d) => out += d); child.stderr.on("data", (d) => out += d);
const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
const code = await new Promise((r) => child.on("close", r)); clearTimeout(timer);
await fake.close();
console.log("exit", code, "in", Date.now() - t0, "ms;", out.trim());
for (const c of fake.calls) console.log(String(c.at - t0).padStart(5), c.method, c.failed ?? "ok");
console.log("acked", fake.acked, "pending", fake.pending);
