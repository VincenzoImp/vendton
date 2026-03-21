# x402-TON — First x402 Protocol Implementation on TON

> The missing payment layer for AI agents on Telegram. Port of [Coinbase's x402 protocol](https://github.com/coinbase/x402) to TON, enabling autonomous machine-to-machine payments with USDT.

## What is x402-TON?

x402 is an open standard that revives HTTP status code `402 Payment Required` for machine-to-machine payments. When an AI agent requests a paid API, the server responds `402` with payment options. The agent signs a USDT payment on TON and resends the request. A facilitator verifies and settles on-chain. No accounts, API keys, or human intervention needed.

**x402 supports EVM, Solana, Aptos — but nobody has built it for TON. Until now.**

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Telegram Mini App                      │
│  (React + Vite + TON Connect)                            │
│  Live demo: watch AI agent pay for services in real-time │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐    HTTP 402     ┌──────────────────┐    │
│  │  AI Agent    │ ──────────────→ │  Paid API Server │    │
│  │  (Client)    │                 │  (Express + x402 │    │
│  │              │ ← PaymentReq ── │   middleware)     │    │
│  │  Signs USDT  │                 │                  │    │
│  │  payment     │ ──── PAYMENT ──→│                  │    │
│  │              │   SIGNATURE     │  Verifies via    │    │
│  │              │ ← 200 + data ── │  Facilitator     │    │
│  └─────────────┘                 └──────────────────┘    │
│         │                                │                │
│         │ signs BoC                      │ verify/settle  │
│         ▼                                ▼                │
│  ┌─────────────┐              ┌──────────────────┐       │
│  │ TON Wallet   │              │  TON Facilitator │       │
│  │ (Agent's     │              │  - Verify sig    │       │
│  │  keypair)    │              │  - Check balance │       │
│  └─────────────┘              │  - Submit Jetton │       │
│                                │    transfer      │       │
│                                └────────┬─────────┘       │
│                                         ▼                 │
│                               ┌──────────────────┐       │
│                               │   TON Blockchain  │       │
│                               │   USDT Settlement │       │
│                               └──────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

## Project Structure

```
x402-ton/
├── specs/                        # x402 TON protocol specification
├── packages/ton/                 # @x402/ton SDK (client, facilitator, middleware)
├── facilitator/                  # Facilitator server (verify, settle, broadcast)
├── demo-api/                     # Example paid API endpoints
├── agent/                        # Autonomous AI agent with tool use
├── mini-app/                     # Telegram Mini App (React + TON Connect)
├── bot/                          # Telegram Bot (grammY)
└── agents/                       # Team expert profiles
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract Language | Tact |
| Contract Framework | Blueprint (`@ton/blueprint`) |
| TON SDK | `@ton/ton` + `@ton/core` + `@ton/crypto` |
| Facilitator | Node.js + Express |
| Client SDK | TypeScript (`@x402/ton`) |
| Mini App | React 19 + Vite + `@tma.js/sdk` |
| Wallet Connection | `@tonconnect/ui-react` |
| Telegram Bot | grammY |
| Animations | Framer Motion |
| Styling | Tailwind CSS v4 |

## Why This Matters

- **First-mover**: x402 has no TON implementation — we're bringing it to 1B Telegram users
- **Real demand**: AI agents on TON (Cocoon AI, Claude Connector) need autonomous payment capabilities
- **Open standard**: Compatible with Coinbase's x402 ecosystem (100M+ payments processed)
- **Telegram-native**: Seamless UX through Mini App + TON Connect

## Track: AlphaTON Capital

BSA EPFL Hackathon 2026 — Stablecoins & Payments (March 21-22, EPFL, Lausanne)

## ENS Integration

Bonus: ENS name resolution for human-readable payments. Send USDT to `alice.eth` instead of raw TON addresses, using ENSIP-9 multi-chain records (SLIP-44 coin type 607).

## License

MIT
