# VendTON

**The community-driven marketplace where anyone deploys paid APIs, AI agents pay for data, and users power their own AI — all on TON.**

## What is VendTON?

VendTON turns every developer into a data vendor and every Telegram user into an AI-powered consumer. Deploy a JavaScript function as a paid endpoint — a **Data Vending Machine (DVM)** — and earn USDT every time it's called. On the other side, users connect their TON wallet, ask an AI anything, and the AI autonomously discovers the best DVMs on the marketplace, requests payment approval, and delivers answers powered by real paid data.

No API keys. No subscriptions. No billing accounts. Just USDT on TON.

## Who Benefits

**Developers & data providers** — Write code, set a price, start earning. Your DVM runs serverlessly on VendTON's infrastructure. Every call pays you in USDT. Your DVM gets a permanent cross-chain identity via ENS on Ethereum Sepolia.

**Telegram & TON ecosystem** — A new community-driven economy inside Telegram. Users build paid APIs for other users. The more DVMs deployed, the more powerful the ecosystem becomes. Every payment settles in USDT on TON — growing transaction volume and real utility.

**AI agents** — Any autonomous agent with a TON wallet can browse the marketplace, pay for data, and chain multiple DVMs together. No human in the loop. TON becomes the blockchain where agents pay for real-world data — weather, prices, analysis, anything the community builds.

**End users** — An AI assistant powered by your own wallet. You ask a question. The AI finds the right DVMs, shows you the cost, asks for approval, pays from your wallet, and returns the answer. You see every step. You control every payment.

## Live Demo

| | |
|---|---|
| **Mini App** | [vendton.vercel.app](https://vendton.vercel.app) |
| **Telegram Bot** | [@vendton_bot](https://t.me/vendton_bot) |
| **Gateway API** | [vendton-gateway.up.railway.app](https://vendton-gateway.up.railway.app/health) |

## On-Chain Verification

Every transaction and identity is verifiable on-chain:

| What | Explorer |
|------|---------|
| Agent wallet (pays for DVMs) | [TON Testnet](https://testnet.tonviewer.com/EQCaXWPU1Nj5zpxP2nmPGE-iJbxHaEqvj-TTkNmIbmF0QcBK) |
| DVM provider — platform | [TON Testnet](https://testnet.tonviewer.com/EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD) |
| DVM provider — community user | [TON Testnet](https://testnet.tonviewer.com/0QA6eW1bjOhzGOFaPwfbjqufwuaXpVzynPB9q6ZSBoKHl28u) |
| Platform wallet (receives deploy fees) | [TON Testnet](https://testnet.tonviewer.com/EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD) |
| ENS domain owner | [Ethereum Sepolia](https://sepolia.etherscan.io/address/0x64fC5868273CAd0204dce42527e647db117C284a) |
| vendton.eth | [ENS Sepolia](https://sepolia.app.ens.domains/vendton.eth) |
| Weather DVM subdomain | [ENS Sepolia](https://sepolia.app.ens.domains/weather-data.eqawwaqa.vendton.eth) |

## The Four Pages

### Explore — Browse the marketplace

Discover DVMs deployed by the community. Search by name, filter by tags. Each DVM shows its price, description, call count, and ENS identity.

### Create — Deploy your DVM and earn

Three ways to deploy:
- **Write Code** — JavaScript editor, runs serverlessly
- **Upload File** — Drop a `.txt` file with your code
- **External URL** — Proxy to your existing self-hosted API

Set a price in USDT, connect your wallet, pay 0.05 TON creation fee. Your DVM is live instantly with an automatic ENS identity on Ethereum Sepolia (e.g. `weather-data.uqa6ew1b.vendton.eth`).

### Ask — Your AI, your wallet

Connect your TON wallet and ask anything. The AI:
1. Searches the marketplace for relevant DVMs
2. Shows you which DVM it wants to call and the cost
3. Asks for your approval via TON Connect
4. Calls the DVM, gets the data
5. Chains multiple DVMs if needed
6. Returns the combined answer

You see every step. You approve every payment. Your wallet, your data, your control.

### Profile — Track your earnings

See all DVMs you deployed, how many calls each received, and your total USDT earned. Delete DVMs you no longer need — the ENS subdomain is revoked on-chain.

## Payment: Two Paths

VendTON supports two payment methods on the same infrastructure:

**For users (TON Connect):**
```
User asks AI → AI finds DVM → 402 Payment Required →
  → "Approve 0.10 USDT?" → User approves in wallet →
  → USDT sent on TON → DVM executes → Answer returned
```

**For autonomous agents (x402 protocol):**
```
Agent calls /dvm/:owner/:name → 402 →
  → Agent signs Jetton transfer (Ed25519, V5R1) →
  → Gateway verifies signature, broadcasts to TON →
  → DVM executes → Data returned
```

Both paths settle in USDT on TON. Both are verifiable on-chain.

## ENS: Cross-Chain Identity

Every DVM gets a real ENS subdomain on Ethereum Sepolia:

```
<dvm-slug>.<owner-prefix>.vendton.eth
```

Created on-chain via the ENS Registry with text records:
- `address.ton` → owner's TON wallet (cross-chain link)
- `description` → what the DVM does

AI agents can discover DVMs by ENS name. A DVM's identity lives on Ethereum, its payments on TON, its interface on Telegram — three chains, one seamless experience.

## Architecture

```
vendton/
├── packages/ton/       @x402/ton SDK — verify, settle, paymentMiddleware
├── gateway/            Express + SQLite + vm executor + x402 + ENS writer
├── agent/              Claude AI + TON wallet + tool use (4 tools)
├── mini-app/           React 19 + Vite + TMA SDK + TON Connect
├── bot/                grammY Telegram bot
└── examples/           Example DVM code files
```

## DVM Code Format

```javascript
// Receives `input` (query params + body). Has fetch, JSON, Math, Date.
// Must return JSON. Runs in vm sandbox with 10s timeout.

const city = input.city || "Lausanne";
const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=46.52&longitude=6.63&current=temperature_2m`);
const data = await res.json();
return { city, temperature: data.current.temperature_2m };
```

## Quick Start

```bash
npm install
npm run dev:gateway    # port 4000
npm run dev:agent      # port 4001 (AGENT_PORT=4001)
npm run dev:mini-app   # port 5173
npm run dev:bot        # BOT_TOKEN=...
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | TON testnet, USDT Jetton (TEP-74), V5R1 wallets |
| Payment | x402 protocol (HTTP 402), Ed25519 verification |
| Identity | ENS on Ethereum Sepolia, `address.ton` text records |
| AI | Claude with tool use (discover, call, balance, resolve) |
| Backend | Express, SQLite, WebSocket, Zod, node:vm sandbox |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Framer Motion |
| Telegram | TMA SDK, TON Connect, grammY |

## Demo Flow

1. Open VendTON — marketplace is empty
2. **Create** a Weather DVM (upload `weather.txt`, 0.10 USDT/call)
3. **Create** a Crypto Price DVM (upload `crypto-price.txt`, 0.10 USDT/call)
4. Go to **Ask**: *"What's the weather in Lausanne and the price of Bitcoin?"*
5. Watch the AI discover both DVMs, ask for payment approval, call them
6. Approve 0.10 USDT + 0.10 USDT from your wallet via TON Connect
7. Get the combined answer — real weather data + real Bitcoin price
8. Check **Profile** — see your DVMs earning from other users' calls
9. Verify payments on [TON explorer](https://testnet.tonviewer.com/EQCaXWPU1Nj5zpxP2nmPGE-iJbxHaEqvj-TTkNmIbmF0QcBK)
10. Verify ENS on [Sepolia](https://sepolia.app.ens.domains/vendton.eth)

## For AlphaTON Capital

Cocoon AI agents run on $82.5M of GPU infrastructure. They can think — but they cannot pay.

VendTON makes TON the blockchain where AI agents buy data. Any developer deploys a paid API. Any agent discovers it and pays in USDT. Any user gets an AI assistant powered by their own wallet.

- First x402 implementation on TON — nobody else has built this
- Real USDT payments on-chain, not mocks
- Real ENS identity on Sepolia with `address.ton` cross-chain records
- Community-driven: anyone deploys DVMs, anyone earns
- Three interfaces: write code, upload file, proxy your existing API
- Two payment paths: TON Connect for users, x402 for autonomous agents

## License

MIT
