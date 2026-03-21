# mesh402

**The missing payment layer for autonomous AI on Telegram.**

Cocoon AI processes 132,000 inference jobs per month. AlphaTON Capital has deployed $82.5M in GPU infrastructure to power it. But when those agents need to call an external API — get weather data, translate text, run a computation — they hit a wall. There is no way for an AI agent on Telegram to pay for a service.

mesh402 fixes that.

## The Problem

AI agents on Telegram are compute-rich but commerce-poor. They can reason, plan, and execute — but they cannot spend a dollar. Every agent-to-service interaction requires a human in the loop to approve payment, copy-paste an API key, or set up a billing account.

Meanwhile, the agent economy is exploding:
- **183 AI bots** on Telegram with **44.3M combined MAU**
- Cocoon AI launched by Pavel Durov in Nov 2025, revenue-generating since Dec 2025
- Stripe launched Money-Programmable Payments on March 18 — but it doesn't work on TON
- Visa launched CLI-based payments on March 19 — but it doesn't work on Telegram

The infrastructure for agent payments exists on Ethereum (Coinbase's x402 protocol, 5.6k GitHub stars). It exists on Solana. It does not exist on TON — the blockchain with 900M users in its ecosystem.

## The Solution

mesh402 is an open marketplace where AI agents discover, use, and pay for services on the TON blockchain. Anyone can publish an API, set a price in USDT, and start earning. Agents autonomously find what they need, pay $0.10 in transaction fees, and chain services together to accomplish complex tasks.

Four protocols, one platform:

| Layer | Protocol | Role |
|-------|----------|------|
| **Payment** | x402 | HTTP 402 status code triggers automatic USDT payment |
| **Identity** | ENS | Human-readable names: `weather.mesh402.eth` |
| **Settlement** | TON | $0.10 per transaction, sub-second finality |
| **Distribution** | Telegram | 900M users, native Mini App integration |

## Why Now

The x402 protocol has a demand problem: $28K/day in volume, down 92% from peak. It needs distribution. TON has a payments problem: 900M users but no agent commerce layer. mesh402 connects supply (x402's payment protocol) to demand (TON's massive user base).

Stripe and Visa are racing to build agent payments for traditional finance. Neither serves the 900M users in the Telegram ecosystem. mesh402 is the first to bring x402 to TON — the first implementation on any non-EVM/Solana chain.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Telegram Mini App                    │
│         Marketplace · Deploy · Playground · Dashboard │
└────────────────────────┬────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Gateway  │  Registry + Facilitator + Proxy + WebSocket
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
    │ Service A  │  │ Service B│  │ Service C  │
    │ Weather    │  │ Translate│  │ Summarize  │
    │ 0.10 USDT  │  │ 0.50 USDT│  │ 0.25 USDT  │
    └───────────┘  └─────────┘  └───────────┘
          ▲              ▲              ▲
          │              │              │
    ┌─────┴──────────────┴──────────────┴─────┐
    │              AI Agent                     │
    │   discover → select → pay → chain → report│
    └─────────────────────┬───────────────────┘
                          │
                    ┌─────▼─────┐
                    │ TON Chain  │  USDT Jetton settlements
                    └───────────┘
```

## Live Demo

**Prompt:** "Get the weather in Paris and translate it to French"

```
Agent → discover_services("weather")         → Weather API found (0.10 USDT)
Agent → discover_services("translation")     → Translation Service found (0.50 USDT)
Agent → call_service(weather, {city:"Paris"}) → 402 → signs BoC → pays 0.10 USDT → gets data
Agent → call_service(translate, {text:..., lang:"fr"}) → 402 → pays 0.50 USDT → gets translation
Agent → returns combined result

Total: 0.60 USDT, 2 services chained, zero human intervention
```

Every payment is a real USDT Jetton transfer on TON, verified with Ed25519 signature validation and on-chain balance checks.

## For Developers

```bash
npm install @mesh402/sdk
```

**Add payments to any Express API in 3 lines:**

```typescript
import { paymentMiddleware } from "@mesh402/sdk";

app.use("/api/premium", paymentMiddleware({
  amount: "100000",  // 0.10 USDT (6 decimals)
  payTo: "UQ...",
  asset: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
}));
```

**Run the full stack locally:**

```bash
npm install

# Gateway (port 4000) — registry, facilitator, proxy, WebSocket
npm run dev:gateway

# Agent (port 4001) — autonomous service discovery and payment
ANTHROPIC_API_KEY=sk-... AGENT_PORT=4001 npm run dev:agent

# Mini App (port 5173) — Telegram Mini App UI
npm run dev:mini-app

# Bot — Telegram bot entry point
BOT_TOKEN=... npm run dev:bot
```

## Technical Details

### x402 Payment Flow

1. Client sends `GET /proxy/:serviceId` without payment
2. Gateway returns `402 Payment Required` with payment requirements in `X-PAYMENT-REQUIRED` header
3. Client constructs a Jetton transfer, signs it with Ed25519 (V5R1 wallet)
4. Client retries with signed BoC in `X-PAYMENT` header
5. Gateway verifies: signature, wallet derivation, Jetton ownership, balance sufficiency
6. Gateway broadcasts BoC to TON, polls seqno for confirmation
7. Gateway returns `200` with service data and payment receipt

### Security Model

- **Cryptographic verification:** Ed25519 signature over V5R1 external message
- **Wallet derivation check:** Public key must derive to claimed sender address
- **On-chain Jetton ownership:** Verifies sender's Jetton wallet via `get_wallet_address`
- **Balance sufficiency:** Queries `get_wallet_data` before settlement
- **Spending limits:** 10 USDT maximum per transaction

### ENS Integration

Services register with ENS names for discoverability:
- `weather.mesh402.eth` resolves to the Weather API service
- Resolution via ENSIP-5 text records with `address.ton` key
- Agents can discover services by ENS name: `resolve_ens("weather.mesh402.eth")`

### Stack

- **Contracts:** TON, USDT Jetton (TEP-74), V5R1 wallets
- **Backend:** TypeScript, Express, WebSocket, Zod validation
- **Frontend:** React 19, Vite 6, Tailwind CSS v4, Framer Motion
- **Agent:** Claude API with tool use for autonomous service chaining
- **Bot:** grammY framework, Telegram Mini App SDK
- **Identity:** ENS via viem, cross-chain resolution

## For AlphaTON Capital

Your Cocoon AI agents process 132K inference jobs per month on 570+ NVIDIA B300 GPUs. They can think. They can plan. But they cannot pay.

mesh402 is the payment layer those agents need. When a Cocoon agent needs weather data, a translation, or any external service — mesh402 handles discovery, payment, and settlement autonomously. No human approval. No API keys. Just USDT on TON.

**The numbers that matter:**
- 900M users in the Telegram ecosystem, zero agent commerce infrastructure
- $0.10 per USDT transaction on TON vs $2+ on Ethereum
- First x402 implementation on TON — first-mover on the largest untapped chain
- Open-source SDK: `npm install @mesh402/sdk`

This is not a proof of concept. This is working infrastructure — agents discovering services, signing transactions, settling payments on-chain, all in real time.

## Monorepo Structure

```
mesh402/
├── packages/ton/       @mesh402/sdk — x402 client, facilitator, middleware
├── gateway/            Unified server: registry + facilitator + proxy + WebSocket
├── agent/              Autonomous AI agent with tool use and wallet
├── mini-app/           Telegram Mini App (React + Vite + TON Connect)
└── bot/                Telegram Bot entry point
```

## License

MIT
