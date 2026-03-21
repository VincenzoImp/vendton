# VendTON

**Open marketplace where AI agents discover, use, and pay for DVMs (Data Vending Machines) on TON.**

## The Problem

AI agents on Telegram can reason, plan, and execute — but they cannot pay for services. Every agent-to-API interaction requires a human in the loop.

Coinbase's x402 protocol (HTTP 402-based payments) exists on Ethereum and Solana. It does not exist on TON — the blockchain behind Telegram and its 1B+ users.

Traditional payment rails (Stripe, Visa) don't support autonomous machine-to-machine payments. There is no way for an AI agent on TON to pay for an API call without human approval.

## The Solution

VendTON brings x402 to TON and wraps it in an open marketplace:

1. **DVM providers** publish APIs, set prices in USDT, connect their wallet — earn every time someone calls their DVM
2. **Users** bring their own Claude API key, connect their TON wallet, ask anything — Claude discovers and pays for DVMs autonomously
3. **Autonomous agents** with their own wallets browse and pay for DVMs via the gateway API

Payments settle in USDT (Jetton) on TON via x402. Identity uses ENS on Sepolia (`vendton.eth` with `address.ton` text records).

## How It Works

| Page | What it does |
|------|-------------|
| **Marketplace** | Browse available DVMs with search, tags, and pricing |
| **Deploy** | Publish your API as a DVM — connect wallet, set price, start earning |
| **Playground** | Enter your Claude API key, ask anything — Claude discovers and pays DVMs from the marketplace |
| **Dashboard** | Track your earnings (as provider) and spending (as consumer) |

### Payment Flow (x402)

```
1. Agent calls GET /dvm/:owner/:name
2. Gateway responds: 402 Payment Required (X-PAYMENT-REQUIRED header)
3. Agent signs USDT Jetton transfer (Ed25519, V5R1 wallet)
4. Agent retries with signed BoC in X-PAYMENT header
5. Gateway verifies: signature, wallet derivation, Jetton balance
6. Gateway broadcasts to TON, confirms via seqno polling
7. Gateway returns 200 with DVM data
```

## Architecture

```
vendton/
├── packages/ton/       x402 SDK for TON — client, facilitator, Express middleware
├── gateway/            Express + SQLite + WebSocket + x402 payment gate
├── agent/              Claude with tool use + TON wallet (autonomous payments)
├── mini-app/           React 19 + Vite + Telegram Mini App SDK + TON Connect
└── bot/                grammY Telegram bot with deep links
```

## Quick Start

```bash
npm install

# Gateway (port 4000) — DVM registry, x402 facilitator, proxy
npm run dev:gateway

# Agent (port 4001) — AI with autonomous DVM discovery and payment
AGENT_PORT=4001 npm run dev:agent

# Mini App (port 5173)
npm run dev:mini-app

# Telegram Bot (requires BOT_TOKEN env var)
BOT_TOKEN=... npm run dev:bot
```

## Example DVMs

The gateway starts empty. Anyone can deploy DVMs via the Deploy page or API. During the demo, we deploy these:

| DVM | Price | What it does |
|-----|-------|-------------|
| Weather Data | 0.10 USDT | Weather from wttr.in for any city |
| Crypto Price | 0.05 USDT | Crypto prices from CoinGecko for any coin |
| Sum Calculator | 0.02 USDT | Adds two numbers — demonstrates DVM composability |

## Demo Flow

1. Start with empty marketplace
2. Deploy "Weather Data", "Crypto Price", and "Sum Calculator" DVMs
3. Open Playground, enter Claude API key
4. Ask: "Get the temperature in Lausanne, the price of Bitcoin, and sum them"
5. Watch Claude discover 3 DVMs, call each one, pay 0.17 USDT total, chain results

## Technical Details

**x402 verification:**
- Ed25519 signature verification over V5R1 external message
- Wallet derivation check (public key → address)
- On-chain Jetton ownership via `get_wallet_address`
- Balance sufficiency via `get_wallet_data`
- 10 USDT max per transaction

**ENS integration (Sepolia testnet):**
- `vendton.eth` registered on Sepolia
- `address.ton` text record for cross-chain identity
- Hierarchical naming: `<dvm>.<owner>.vendton.eth`

**Stack:**
- TypeScript across the full stack
- TON: @ton/core, @ton/ton, V5R1 wallets, USDT Jetton (TEP-74)
- AI: Anthropic Claude with tool use (user provides their own API key)
- Frontend: React 19, Vite 6, Tailwind CSS v4, Framer Motion
- Database: SQLite with better-sqlite3 (WAL mode)
- Identity: ENS via viem + @ensdomains/ensjs on Sepolia
- Bot: grammY + Telegram Mini App SDK

## Status

Working prototype on TON testnet (runs locally). The x402 payment flow, DVM registry, AI agent, Mini App, and ENS integration are all implemented and functional.

## License

MIT
