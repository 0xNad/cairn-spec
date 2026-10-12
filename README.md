# Cairn: a Starknet Telegram bot, planned as a Hotpod project

Planning material for **Cairn** (working name), an open-source, self-hostable Telegram bot for Starknet that only
reads the chain: no keys, no signing, no Mini App. It is to be built by coding agents in four judged rounds on
[Hotpod](https://agent-launchpad-six.vercel.app). Draft of 12 October 2026: nothing here is launched yet.

## Milestones (35,000,000 points)

1. **Lookups** (9M): balances, transactions and chain status in chat, in private chats and groups.
2. **Wallet alerts** (9M): watched wallets, approvals, whale alerts, transaction tracking; each alert delivered exactly once.
3. **Group feeds, prices and names** (9M): Ekubo and AVNU buy feed, Pragma USD prices, .stark names.
4. **Network guard and operations** (8M): stall and reorg alerts with corrections, RPC failover, health endpoint,
   seed-phrase and phishing-link guards.

Out of scope: trading, custody, a Mini App, signing transactions.

## What is here

| Path | What it is |
| --- | --- |
| [`pod/.launchpad/project.md`](pod/.launchpad/project.md) | The pod file: settings, pitch and the four rounds' briefs and rubrics. Hotpod's project-file check accepts it |
| [`form/launch-form.pdf`](form/launch-form.pdf) | Hotpod's "Launch a pod" form filled from that file, rendered locally |
| [`FEATURES.md`](FEATURES.md) | The feature list by round, with what is checked and what is judged |
| [`SPEC.md`](SPEC.md) | The full spec: architecture, fixed interface, check design, risks and open decisions. Its round 4 "Stakers and calm" was dropped; `project.md` is authoritative |
| [`research/BEST-TELEGRAM-BOTS.md`](research/BEST-TELEGRAM-BOTS.md) | The best Telegram crypto bots and their offering, fact-checked |
| [`research/BUILD-ON-STARKNET.md`](research/BUILD-ON-STARKNET.md) | How to build a Telegram bot on Starknet, fact-checked |
| `research/draft-*.md`, `research/spec-input-*.md` | The three competing spec drafts and the research notes behind them |
| `prototypes/` | Research prototypes: a fake Telegram Bot API, probes, and Starknet selector and RPC helpers |

## Open before round 1

- The final name and @handle (no trademark or handle search done yet).
- The dependency policy: none, or only `starknet` at version 10.8 or later.
- Proof that the bot can reach the checks' loopback fakes inside Hotpod's gate.
