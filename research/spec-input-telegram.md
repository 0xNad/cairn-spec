# Telegram Bot API reference for a Starknet bot on Hotpod (checked 2026-10-12)

## 0. What matters most for the spec

1. **The bot must not have a Mini App.** Section 7 of Telegram's Bot Developer Terms says any Mini App with crypto features "either within the Mini App itself or within its connected bot" must use TON only, and must connect wallets only through TON Connect. The Blockchain Guidelines then say: "Regular Telegram bots that do not have a Mini App component are exempt." So a Starknet bot can exist only as a plain chat bot. Wallet linking has to happen on an external web page reached by an ordinary URL button or link. (Confidence: high, from the primary terms.)
2. **Starknet addresses don't fit into button data or deep links.** `callback_data` is limited to 1–64 bytes, and a `/start` payload to 64 characters from `[A-Za-z0-9_-]`. A Starknet address is 66 characters (`0x` plus 64 hex digits). Use short keys stored on the server, or base64url of the 32 bytes (43 characters, fits in a payload). Use the `copy_text` button (1–256 characters) when users need to copy an address. (Confidence: high.)
3. **The current Bot API is 10.3, released 2026-08-24.** grammY 1.46.0 and node-telegram-bot-api 2.1.0 both claim Bot API 10.3. The last Telegraf release, 4.16.3 (2024-02-29), targets Bot API 7.1. (Confidence: high.)
4. **The fake Bot API below runs.** I tested it against bots built on grammY, Telegraf and node-telegram-bot-api v2 (183 lines, Node built-ins only).

## 1. Bot API version and features useful to a crypto bot

| Feature | Bot API version (date) | Use in the Starknet bot | Confidence |
|---|---|---|---|
| `LinkPreviewOptions` (`is_disabled`, `url`, `prefer_small_media`, `show_above_text`); replaces `disable_web_page_preview` | 7.0 (2023-12-29) | Turn off previews for explorer links | high |
| Reactions (`setMessageReaction`, `message_reaction` updates) | 7.0 | Quick acknowledgements. Receiving reaction updates needs admin rights and an explicit `allowed_updates` entry | high |
| Inline keyboards and callback queries | long-standing | Main way users interact. `callback_data` is 1–64 bytes. You must call `answerCallbackQuery` (text 0–200 characters), or the client keeps showing a progress bar | high |
| `copy_text` button | 7.11 (2024-10-31) | "Copy address" or "Copy calldata" | high |
| `allow_paid_broadcast` (up to 1000 messages/s, 0.1 Star per message above the free limit) | 7.11 | Alert fan-out at scale | high |
| Telegram Stars payments (currency `XTR`, empty `provider_token`) | 7.4 (2024-05-28) | Digital goods sold in Telegram "must be carried out in Telegram Stars". Relevant if premium alerts are paid. Selling them for STRK inside the bot is a policy risk | high on the rule, moderate on how it applies |
| Business connections | 7.2 (2024-03-31) | Not needed | high |
| Forum topics (`message_thread_id`, `is_topic_message`); topics in private chats | long-standing; private-chat topics 9.3/9.4 | Post to a group's "Alerts" topic | high |
| Button `style` (`danger`, `success`, `primary`) | 9.4 (2026-02-09) | Red "Remove alert" button | high |
| `date_time` entity / `<tg-time>` | 9.5 (2026-03-01) | Unlock or vote deadlines shown in each user's local time | high |
| Guest mode (`guest_message`, `answerGuestQuery`) | 10.0 (2026-05-08) | `@bot price STRK` in chats the bot hasn't joined, one reply per mention | high on the API, moderate on fit |
| Rich messages (`sendRichMessage`) and message drafts | 10.1–10.3 | Not needed for the MVP | high |
| Ephemeral messages (`ephemeral_message_parameters`, shown to one user in a group) | 10.2 (2026-07-14), reshaped in 10.3 | Answer `/balance` in a group so only the requester sees it. Very new: the parameter names changed between 10.2 and 10.3, and delivery to offline users isn't guaranteed | high on the API, low on stability |
| Disabled buttons; `force_reply` on keyboards | 10.3 (2026-08-24) | Show a pending state on buttons | high |

## 2. Getting updates: long polling vs webhooks

- **One or the other.** The two methods are "mutually exclusive". Calling `getUpdates` while a webhook is set gives 409 with "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first".
- **Retention.** Telegram keeps updates for at most 24 hours.
- **`offset` semantics.**
  - An update counts as confirmed once `getUpdates` is called with an offset higher than its `update_id`.
  - A negative offset returns the last `-offset` updates and forgets everything before them.
  - Docs: "recalculate offset after each server response".
  - If there have been no updates for a week, the next `update_id` is random rather than sequential.
- **Other `getUpdates` parameters.**
  - `limit` is 1–100 (default 100).
  - `timeout` is in seconds (default 0). Use 0 only for testing.
- **`allowed_updates`.**
  - An empty list means every update type except `chat_member`, `message_reaction` and `message_reaction_count`.
  - If the parameter is left out, the previous setting is kept.
- **Two pollers.** A second concurrent `getUpdates` gives 409 "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running" (string taken from the server source).
- **`setWebhook`.**
  - Takes `url` (HTTPS), `secret_token` (1–256 characters from `A-Z a-z 0-9 _ -`), `max_connections` (1–100, default 40), `drop_pending_updates`, `allowed_updates` and `ip_address`.
  - When `secret_token` is set, every webhook request carries it in the `X-Telegram-Bot-Api-Secret-Token` header. Compare it in constant time.
  - Allowed ports are 443, 80, 88 and 8443. TLS 1.2 or later; IPv4 only.
  - Requests come from 149.154.160.0/20 and 91.108.4.0/22.
  - Any response other than 2xx is retried.
- **Which to use on Hotpod.** Hotpod runs on Vercel, so webhook mode is the natural fit: verify the header, then reply 200 quickly. Long polling needs a process that stays up; it is what offline checks use. (Confidence: high.)

## 3. Rate limits and 429

- **Official FAQ numbers.**
  - At most one message per second per chat (short bursts are allowed, then 429).
  - 20 messages per minute in a group.
  - About 30 messages per second for broadcasts; paid broadcasts raise this to 1000/s.
- **grammY's view.** Its docs say the real limits are unspecified, that the only correct handling is to wait `retry_after` seconds and then retry, and that throttling up front is "useless and harmful". (Confidence: high that they say this; moderate on the advice.)
- **The 429 response has a fixed shape** (from the server source, `Query.cpp`). The HTTP status equals `error_code`:

```json
{"ok":false,"error_code":429,"description":"Too Many Requests: retry after 35","parameters":{"retry_after":35}}
```

- **How the libraries handle it.**
  - grammY: the polling loop honours `retry_after`. API calls need the `@grammyjs/auto-retry` plugin (2.0.2).
  - node-telegram-bot-api v2: retries 429 itself (`maxRetries`, `maxRetryAfterMs`).
  - Telegraf 4.16.3: no built-in retry for API calls.
- **Plan for alert fan-out:** a queue per chat at about 1 message/s, about 25 messages/s overall, and honour `retry_after` exactly. (Confidence: moderate.)

## 4. Formatting

**MarkdownV2**
- Outside entities, these characters must be escaped with `\`: `_ * [ ] ( ) ~ ` > # + - = | { } . !`
- Inside `code` and `pre`, only `` ` `` and `\` need escaping. Inside the `(...)` of a link, only `)` and `\`.
- Any character with code 1–126 may be escaped anywhere.
- The most common crypto-bot bug is an unescaped `.` or `-` in amounts like `0.5` or `-3%`. Telegram rejects it with 400 "can't parse entities: Character '.' is reserved…".
- An ambiguous `___` needs an empty bold entity as a separator.

**HTML** (usually the safer choice for user-supplied text)
- Supported tags: `b/strong`, `i/em`, `u/ins`, `s/strike/del`, `span class="tg-spoiler"`/`tg-spoiler`, `a href`, `tg-emoji`, `tg-time`, `code`, `pre` (with `<code class="language-x">` inside), `blockquote`/`blockquote expandable`.
- Any `<`, `>` or `&` that isn't part of a tag must be written as `&lt;`, `&gt;`, `&amp;`. The only named entities are `&lt; &gt; &amp; &quot;`; all numeric entities are allowed.
- Escaping a user string means replacing three characters, `& < >` (and `"` inside attributes).

**Limits**
- `text` is 1–4096 characters *after entity parsing*; captions are 0–1024.
- The docs don't say whether "characters" means code points or UTF-16 units. Splitting at 4096 UTF-16 units is safe under either reading.
- The server rejects raw text over 32 KB before parsing.
- `parse_mode` is case-insensitive; the server lowercases it.

## 5. Groups

**Privacy mode** (on by default). In a group the bot only sees:
- `/cmd@this_bot`;
- `/cmd` without a suffix, but only if this bot was the last bot to post;
- replies to its own messages;
- service messages.

Admin bots see everything. Turning privacy off only takes effect after the bot is re-added. ForceReply lets the bot run multi-step flows without turning privacy off.

**Commands**
- Up to 32 characters, Latin letters, digits and `_`.
- Updates say nothing about command scope, so the bot must check both the command and the sender's rights itself.
- Parse `^/(\w+)(@(\w+))?` and ignore commands addressed to another bot. grammY does this, but only once `getMe` has run or `botInfo` is set.

**Admin checks**
- Call `getChatMember(chat_id, user_id)` and check that `status` is `creator` or `administrator`.
- It is only guaranteed to work for other users when the bot is an admin.
- Statuses: `creator`, `administrator`, `member`, `restricted`, `left`, `kicked`.

**Membership changes**
- `my_chat_member` (delivered by default) fires when the bot is added, removed or promoted. In private chats it only fires when the user blocks or unblocks the bot.
- `chat_member` needs admin rights plus an explicit `allowed_updates` entry.

**Group-to-supergroup migration**
- The old group sees a service message with `migrate_to_chat_id`.
- Sending to the old ID returns 400 "group chat was upgraded to a supergroup chat" with `parameters.migrate_to_chat_id`. The bot must re-key stored subscriptions to the new ID and resend.
- IDs have at most 52 significant bits, so a JS `Number` is safe.

**Errors to handle without crashing**
- 403 "Forbidden: bot was blocked by the user"
- 403 "Forbidden: bot was kicked from the group chat"
- 400 "message is not modified…"

(Confidence: high. The error strings come from the `tdlib/telegram-bot-api` source.)

## 6. Deep links

- Private chat: `https://t.me/<bot>?start=<payload>` arrives as the text `/start <payload>`.
- Group: `?startgroup=<payload>` arrives as `/start@<bot> <payload>`.
- Payload: up to 64 characters from `A-Z a-z 0-9 _ -`; Telegram recommends base64url.
- `?startapp` links exist only for Mini Apps, which are ruled out here (section 0).
- Treat the payload as untrusted input: validate it with `^[A-Za-z0-9_-]{1,64}$`. Make link tokens single-use and short-lived.

(Confidence: high.)

## 7. Node libraries

| Library | Latest (npm) | Bot API | Custom API root | Body encoding | Maintenance |
|---|---|---|---|---|---|
| grammY | 1.46.0 (2026-08-26) | 10.3 | `new Bot(token, { client: { apiRoot: "http://127.0.0.1:PORT" } })`. No trailing slash (it throws). `client.environment: "test"` adds `/test/`; `buildUrl` overrides the URL | JSON; multipart only for files | Active (last push 2026-10-01). Updates are handled one at a time; `@grammyjs/runner` adds concurrency |
| Telegraf | 4.16.3 (2024-02-29) | 7.1 | `new Telegraf(token, { telegram: { apiRoot } })`. `http://` works; `testEnv` option | JSON; multipart for files | No release in about 2.5 years; the repo only gets maintenance commits (2026-09-24). In my run it handled the updates in a batch concurrently. Avoid for new work |
| node-telegram-bot-api | 2.1.0 (2026-08-24); 2.2.0-rc2 | 10.3 | v2: `new Bot(token, { apiRoot })`. v0.x used `baseApiUrl` (seen in older guides) | `application/x-www-form-urlencoded`, with nested objects as JSON strings; multipart for files | Rewritten from scratch in 2026 (v1 in June, v2 in August), no dependencies, built-in 429 retry. The new API is still settling |

**Recommendation:** grammY. Confidence: moderate-high.

**Startup calls a fake server must support:**
- grammY: `getMe` (skipped if `botInfo` is passed), then `deleteWebhook`, then `getUpdates{offset,timeout:30,allowed_updates:[]}`. On stop, `getUpdates{offset,limit:1}`.
- Telegraf: `getMe`, `deleteWebhook`, then `getUpdates{timeout:50}`.
- node-telegram-bot-api v2: no automatic `getMe` or `deleteWebhook`.

## 8. How other projects test bots offline

- **Intercept calls in-process.** In grammY, `bot.api.config.use(transformer)` plus `bot.handleUpdate(update)` with a stubbed `botInfo`. Fast, but it bypasses HTTP, so encoding, error handling and polling bugs go unseen. (grammy-with-tests uses this pattern.)
- **A fake HTTP server the bot is pointed at:**
  - telegram-test-api (Node, last released 2022, stale)
  - telegraf-test
  - chatwright (Go; any language)
  - telegram-mock-ai and telegym (Go, Docker)
  - teremock and teloxide_tests (Rust)
- **Telegram's test environment** (`/bot<token>/test/METHOD`): a real network and a separate account, so it isn't offline.
- **The local `telegram-bot-api` server:** still talks to Telegram, so also not offline.

For Hotpod, the fake HTTP server is the right fit: it tests the real wire format and uses Node built-ins only. (Confidence: moderate-high.)

## 9. Wire format a fake must reproduce

- **URL:** `POST|GET {root}/bot<token>/<method>`. Method names are case-insensitive; text is UTF-8.
- **Parameters** may come four ways: query string, `application/x-www-form-urlencoded`, `application/json`, or `multipart/form-data` (files only).
- **Success:** `{"ok":true,"result":…}` with HTTP 200.
- **Error:** `{"ok":false,"error_code":N,"description":"…","parameters":{"retry_after"|"migrate_to_chat_id":…}}`, with HTTP status equal to N.
- **Probed live** with a fake token:
  - a bad token gives 401 `{"ok":false,"error_code":401,"description":"Unauthorized"}`;
  - a malformed path gives 404 `"Not Found"`;
  - an unknown method returns 404 "Not Found: method not found" (from source).
- **Error prefixes:** "Bad Request: " (400), "Unauthorized" (401), "Forbidden: " (403), "Conflict: " (409), "Too Many Requests: retry after N" (429).

## 10. Fake Bot API contract for a Hotpod check

**Code:** `/private/tmp/claude-501/-Volumes-Crucial-X9-Project-Zero/d800fe91-298c-4880-a918-3f58ce7625b8/scratchpad/tg/verify/fake-bot-api.mjs` (183 lines, `node:http` only). The driver is `check.mjs` in the same folder, with the sample bots `bot-grammy.mjs`, `bot-grammy-drop.mjs`, `bot-telegraf.mjs` and `bot-ntba.mjs`. It lives in the session scratchpad, so copy it out before it's lost.

**What I tested:**
- grammY and node-telegram-bot-api v2 bots: exit 0, all 6 updates confirmed, retry about 1003 ms after an injected `retry_after: 1`.
- A grammY bot using `drop_pending_updates: true`: also passes.
- The Telegraf bot: my retry wrapper didn't cover `ctx.telegram`, so the fake caught the lost `/start` reply. That is the kind of bug this check exists to find.

**Server rules:**
- Listen on `127.0.0.1:0`. Path regex `^/bot([^/]+)/(?:test/)?([A-Za-z]+)$`. Wrong token gives 401; unmatched path gives 404.
- Accept JSON, urlencoded and query parameters. Reject multipart with 400.
- For urlencoded input, convert known integer fields (`chat_id`, `message_id`, `offset`, `limit`, `timeout`, `user_id`…), booleans, and fields that hold JSON (`reply_markup`, `allowed_updates`, `entities`, `link_preview_options`, `reply_parameters`).
- Log every call as `{method, params, at, failed?}`.

**Methods:**

| Method | Request (JSON) | `result` / error |
|---|---|---|
| getMe | `{}` | `{"id":999000,"is_bot":true,"first_name":"Hotpod Test Bot","username":"hotpod_test_bot","can_join_groups":true,"can_read_all_group_messages":false,"supports_inline_queries":false}` |
| deleteWebhook / setWebhook / getWebhookInfo | `{drop_pending_updates?}` / `{url,secret_token?}` | `true` (`drop_pending_updates` empties the queue) / `{url,has_custom_certificate:false,pending_update_count}` |
| getUpdates | `{offset?,limit?,timeout?,allowed_updates?}` | `[Update…]`. Removes updates with `update_id < offset` and records the confirmed offset. Hides `chat_member`/`message_reaction*` unless they are listed. Holds the request until an update arrives or `min(timeout, holdMs=300ms)`. A second concurrent poll gives 409; a set webhook gives 409 |
| sendMessage | `{chat_id,text,parse_mode?,reply_markup?,link_preview_options?,message_thread_id?}` | `{"message_id":1006,"from":<me>,"chat":{"id":-1001234567890,"type":"supergroup","title":"Stark Devs"},"date":1760270000,"text":"STRK = 0.5 USD","reply_markup":{…}}`. Errors: 400 chat_id is empty / message text is empty / chat not found / can't parse entities: … / message is too long / BUTTON_DATA_INVALID / group chat was upgraded… with `parameters.migrate_to_chat_id`; 403 bot was blocked by the user / kicked |
| answerCallbackQuery | `{callback_query_id,text?,show_alert?,cache_time?}` | `true`. An unknown or already-answered ID gives 400 "query is too old and response timeout expired or query ID is invalid" |
| editMessageText | `{chat_id,message_id,text,parse_mode?,reply_markup?}` | The edited Message, with `edit_date`. Errors: 400 "message to edit not found"; 400 "message is not modified: …" when text and markup are identical |
| getChatMember | `{chat_id,user_id}` | `{"status":"administrator"\|"member"\|…,"user":{"id":…,"is_bot":false,"first_name":"User"}}` |
| setMyCommands, sendChatAction, setMessageReaction | any | `true` |
| anything else | — | 404 "Not Found: method not found". Unexpected methods fail loudly |

**Updates the check injects:**

```json
{"update_id":1,"message":{"message_id":1000,"from":{"id":4242,"is_bot":false,"first_name":"Alice","username":"alice","language_code":"en"},"chat":{"id":4242,"type":"private","first_name":"Alice","username":"alice"},"date":1760270000,"text":"/start ref_abc-1","entities":[{"type":"bot_command","offset":0,"length":6}]}}
{"update_id":2,"message":{"message_id":1001,"from":{…alice},"chat":{"id":-1001234567890,"type":"supergroup","title":"Stark Devs"},"date":1760270000,"text":"/price@hotpod_test_bot","entities":[{"type":"bot_command","offset":0,"length":22}]}}
{"update_id":6,"callback_query":{"id":"cbq-1","from":{…alice},"message":{<the bot's sent message>},"chat_instance":"-7700000000000000001","data":"px:STRK"}}
{"update_id":7,"my_chat_member":{"chat":{…group},"from":{…admin},"date":1760270000,"old_chat_member":{"status":"left","user":{…bot}},"new_chat_member":{"status":"member","user":{…bot}}}}
{"update_id":8,"message":{"message_id":1010,"from":{…},"chat":{"id":-4567,"type":"group","title":"Old"},"date":1760270000,"migrate_to_chat_id":-1009876543210}}
```

**Control API inside the check:**
- `fakeBotApi({token, me, holdMs})` returns `{listen(), close(), push(kind, payload), pushMessage(from, chat, text, extra), pushCallback(from, message, data), failNext(method, code, description, parameters), on((call, result) => …), calls, msgs, members, blocked, kicked, migrated, acked, pending}`.
- `on` also fires on each `getUpdates`. Push the script on the first poll so bots that drop pending updates still see it.
- Push reactive steps from inside the `sendMessage` hook (for example, a button press on the message the bot just sent).

**What the round brief must require of the bot entry:**
- Read `TELEGRAM_API_ROOT` (no trailing slash) and `TELEGRAM_BOT_TOKEN` from the environment. Never hardcode `api.telegram.org`.
- When `TELEGRAM_DRAIN=1`, exit 0 after the first `getUpdates` that returns `[]`. The kit's `entry()` only supports runs that end on their own (10 s limit by default). In grammY this is a 4-line API transformer that calls `bot.stop()`, which confirms the offset with `getUpdates{limit:1}`.
- No other network access during checks. Starknet RPC goes through `STARKNET_RPC_URL` to its own fake.

**Assertions worth having:**
1. Every `callback_query` is answered exactly once.
2. No 400 from formatting when user or amount strings contain `. - _ < &`.
3. Replies longer than 4096 are split.
4. After a 429, the resend is no earlier than `retry_after` and isn't duplicated.
5. `/cmd@other_bot` is ignored.
6. An admin-only command checks `getChatMember` and refuses non-admins.
7. On `migrate_to_chat_id`, the bot re-keys and resends.
8. After a 403, the bot marks the chat inactive and keeps running.
9. A bad deep-link payload is refused.
10. At exit, `acked` is at least the last `update_id`.
11. Every request used the env root and token.
12. Ordering is asserted per chat only: Telegraf handles a batch concurrently.

**Known gaps:**
- The MarkdownV2 check is a heuristic. It is strict on punctuation in prose but doesn't check that `*`/`_` are balanced.
- The plain-text length is approximate (a code block's language tag counts).
- No files or webhook delivery. A webhook test would POST updates to the bot with and without `X-Telegram-Bot-Api-Secret-Token`, about 20 more lines.
- Unknown: whether the gate lets the entry reach the check's loopback port when the two run as different users.

## Sources
- [Bot API](https://core.telegram.org/bots/api), [changelog](https://core.telegram.org/bots/api-changelog), [features: privacy, commands, deep linking, test env, guest mode](https://core.telegram.org/bots/features), [FAQ: limits](https://core.telegram.org/bots/faq), [webhook guide](https://core.telegram.org/bots/webhooks), [Mini Apps: initData validation](https://core.telegram.org/bots/webapps), [Stars payments](https://core.telegram.org/bots/payments-stars)
- [Blockchain Guidelines](https://core.telegram.org/bots/blockchain-guidelines), [Bot Developer Terms §7](https://telegram.org/tos/bot-developers), [Cointelegraph on the TON-only rule](https://cointelegraph.com/news/ton-exclusive-network-telegram-mini-apps), [Decrypt](https://decrypt.co/302023/telegram-exclusive-ton-barring-other-networks)
- [tdlib/telegram-bot-api Client.cpp / Query.cpp](https://github.com/tdlib/telegram-bot-api) (error strings and the 429 JSON)
- [grammY flood limits](https://grammy.dev/advanced/flood), npm registry and GitHub API for [grammY](https://github.com/grammyjs/grammY), [Telegraf](https://github.com/telegraf/telegraf), [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) (package source read directly)
- Testing: [telegram-test-api](https://github.com/jehy/telegram-test-api), [grammy-with-tests](https://deepwiki.com/PavelPolyakov/grammy-with-tests/3.2-api-interception-with-transformer-functions), [chatwright](https://pkg.go.dev/chatwright.dev/runtime@v0.5.1/telegram), [telegram-mock-ai](https://pkg.go.dev/github.com/skrashevich/telegram-mock-ai), [teremock](https://docs.rs/teremock), [telegraf-test](https://npmjs.com/package/telegraf-test)
- Error-string corroboration: [bytenote "Character '(' is reserved"](https://bytenote.net/article/176023138860007420)