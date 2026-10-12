import { createServer } from "node:http";
const s = createServer((q, r) => r.end("ok")); await new Promise((r) => s.listen(0, "127.0.0.1", r));
console.log(await (await fetch(`http://127.0.0.1:${s.address().port}/x`)).text());
try { await fetch("https://api.telegram.org/botX/getMe"); } catch (e) { console.log("telegram:", e.cause?.code ?? e.message); }
try { await fetch("https://starknet-mainnet.public.blastapi.io/rpc/v0_8", { method: "POST", body: "{}" }); } catch (e) { console.log("public rpc:", e.cause?.code ?? e.message); }
try { await fetch("http://1.1.1.1/"); } catch (e) { console.log("ip:", e.cause?.code ?? e.message); }
process.exit(0);
