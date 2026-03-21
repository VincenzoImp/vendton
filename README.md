# mesh402

**Open marketplace where AI agents and users discover, use, and pay for skills on TON.**

## The Problem

AI agents on Telegram can reason, plan, and execute — but they cannot pay. Every agent-to-API interaction requires a human in the loop. Meanwhile:

- Cocoon AI (launched by Pavel Durov, Nov 2025) powers privacy-preserving AI on Telegram
- AlphaTON Capital committed $82.5M in GPU infrastructure for Cocoon
- Stripe launched Machine Payments Protocol (March 18, 2026) — doesn't work on TON
- Visa launched CLI for AI agent payments (March 18, 2026) — doesn't work on Telegram

x402 (Coinbase's HTTP payment protocol) exists on Ethereum and Solana. It does not exist on TON — the blockchain powering Telegram's 950M+ users.

## The Solution

mesh402 is a community-driven marketplace for paid AI skills on TON:

1. **Skill providers** publish their APIs, set prices in USDT, connect their wallet → earn every time someone calls their skill
2. **Users** bring their own Claude API key, connect their TON wallet, ask Claude anything → Claude discovers and pays for skills autonomously
3. **Autonomous agents** with their own wallets browse and pay for skills via the gateway API

Skills persist in a SQLite database. Payments settle in USDT on TON via x402. Identity via ENS (`mesh402.eth` registered on Sepolia with `address.ton` text record).

## How It Works

| Page | What it does |
|------|-------------|
| **Marketplace** | Browse all available skills with search, tags, and pricing |
| **Deploy** | Publish your API as a skill — connect wallet, set price, start earning |
| **Playground** | Enter your Claude API key → ask anything → Claude uses paid skills from the marketplace |
| **Dashboard** | Track your earnings (as provider) and spending (as consumer) |

### Payment Flow (x402)

```
1. Agent calls GET /proxy/:skillId
2. Gateway responds: 402 Payment Required (X-PAYMENT-REQUIRED header)
3. Agent signs USDT Jetton transfer (Ed25519, V5R1 wallet)
4. Agent retries with signed BoC in X-PAYMENT header
5. Gateway verifies: signature, wallet derivation, Jetton balance
6. Gateway broadcasts to TON, confirms via seqno polling
7. Gateway returns 200 with skill data
```

## Architecture

```
mesh402/
├── packages/ton/       @x402/ton SDK — client, facilitator, middleware
├── gateway/            Express + SQLite + WebSocket + x402 proxy
├── agent/              Claude with tool use + TON wallet
├── mini-app/           React 19 + Vite + TMA SDK + TON Connect
└── bot/                grammY Telegram bot
```

## Quick Start

```bash
npm install

# Gateway (port 4000) — skill registry, x402 facilitator, proxy
npm run dev:gateway

# Agent (port 4001) — AI with autonomous skill discovery
AGENT_PORT=4001 npm run dev:agent

# Mini App (port 5173)
npm run dev:mini-app

# Telegram Bot
BOT_TOKEN=... npm run dev:bot
```

## Built-in Demo Skills

| Skill | Price | What it does |
|-------|-------|-------------|
| Weather API | 0.10 USDT | Real weather data from wttr.in (any city) |
| Translation | 0.50 USDT | Text translation (FR/DE/ES/JA) |
| Joke Generator | 0.05 USDT | Programming and crypto jokes |
| Sentiment Analysis | 0.20 USDT | Text sentiment with intensifier detection |

Anyone can deploy additional skills via the Marketplace UI or API.

## Technical Details

**Security model:**
- Ed25519 signature verification over V5R1 external message
- Wallet derivation check (public key → address)
- On-chain Jetton ownership via `get_wallet_address`
- Balance sufficiency via `get_wallet_data`
- 10 USDT max per transaction

**ENS integration:**
- `mesh402.eth` registered on Sepolia testnet
- `address.ton` text record for cross-chain identity
- Agent tool: `resolve_ens("weather.mesh402.eth")`

**Stack:**
- TypeScript across the full stack
- TON: @ton/core, @ton/ton, V5R1 wallets, USDT Jetton (TEP-74)
- AI: Anthropic Claude with tool use (user provides their own API key)
- Frontend: React 19, Vite 6, Tailwind CSS v4, Framer Motion
- Database: SQLite (better-sqlite3) for skill persistence
- Identity: ENS via viem on Sepolia
- Bot: grammY + Telegram Mini App SDK

## For AlphaTON Capital

Your Cocoon AI agents run on $82.5M of GPU infrastructure. They can think and plan — but they cannot pay.

mesh402 is the payment layer those agents need. When a Cocoon agent needs weather data, a translation, or any external capability — mesh402 handles discovery, payment, and settlement autonomously. No human approval. Just USDT on TON.

- First x402 implementation on TON — first-mover on the largest untapped chain
- USDT transfers cost ~0.01-0.05 TON vs $2+ on Ethereum
- Community-driven: anyone publishes skills, anyone consumes them
- Working prototype with real on-chain payments on TON testnet
- Open-source SDK: `@x402/ton`

## License

MIT
