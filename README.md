# VendTON

**Powerful infrastructure, built on top of TON and x402.**

**APIs earn. AI pays. Wallet controls.**

x402 is just an HTTP header. There's no marketplace to discover paid APIs, no product where users deploy and earn, no AI that finds and pays for data on its own. Everyone ported x402 to TON — we built what goes on top.

## Live

| | |
|---|---|
| **Mini App** | [vendton.vercel.app](https://vendton.vercel.app) |
| **Pitch Deck** | [vendton-deck.vercel.app](https://vendton-deck.vercel.app) |
| **Telegram Bot** | [@vendton_bot](https://t.me/vendton_bot) |
| **Gateway API** | [vendton-gateway.up.railway.app](https://vendton-gateway.up.railway.app/health) |
| **Agent API** | [vendton-agent.up.railway.app](https://vendton-agent.up.railway.app/health) |
| **GitHub** | [github.com/VincenzoImp/vendton](https://github.com/VincenzoImp/vendton) |

## On-Chain Verification

| What | Explorer |
|------|---------|
| DVM provider — platform | [TON Testnet](https://testnet.tonviewer.com/EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD) |
| DVM provider — community | [TON Testnet](https://testnet.tonviewer.com/0QA6eW1bjOhzGOFaPwfbjqufwuaXpVzynPB9q6ZSBoKHl28u) |
| Platform wallet (deploy fees) | [TON Testnet](https://testnet.tonviewer.com/EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD) |
| ENS domain owner | [Ethereum Sepolia](https://sepolia.etherscan.io/address/0x64fC5868273CAd0204dce42527e647db117C284a) |
| vendton.eth | [ENS Sepolia](https://sepolia.app.ens.domains/vendton.eth) |
| Weather DVM subdomain | [ENS Sepolia](https://sepolia.app.ens.domains/weather-data.eqawwaqa.vendton.eth) |

## Beyond the Protocol

VendTON is a complete product where everyone wins:

**Developers earn** — Deploy an API, set a price, earn USDT per call. Your DVM gets an ENS identity on Ethereum automatically.

**TON gets an economy** — A community-driven marketplace of paid APIs on Telegram. More DVMs deployed, more value, more usage.

**Agents pay for data** — Any agent with a TON wallet discovers DVMs via the gateway API or ENS on-chain, pays in USDT, chains multiple DVMs autonomously.

**Agentic chat for everyone** — An AI chat with a wallet and real paid data. Zero complexity — open the app, connect wallet, ask anything. The AI finds DVMs, asks for your approval, pays, returns the answer.

## VendTON on Telegram

Four pages, one Mini App:

### Explore
Browse DVMs deployed by the community. Search by name, filter by tags. Each DVM shows price, description, call count, and ENS identity.

### Create
Three ways to deploy a DVM:
- **Write Code** — JavaScript, runs serverlessly in vm sandbox
- **Upload File** — Drop a `.txt` file with your code
- **External URL** — Proxy to your existing API

Set a price in USDT, connect your wallet, pay 0.05 TON creation fee. Your DVM is live instantly with an automatic ENS subdomain on Ethereum Sepolia.

### Ask
Connect your TON wallet and ask anything. The AI:
1. Searches the marketplace for relevant DVMs
2. Shows which DVM it wants to call and the cost
3. Asks for your approval via TON Connect
4. Calls the DVM, gets the data
5. Chains multiple DVMs if needed
6. Returns the combined answer

You see every step. You approve every payment.

### Profile
See all DVMs you deployed, how many calls each received, total USDT earned. Delete DVMs — the ENS subdomain is revoked on-chain.

## How It Works

### x402 on TON
```
Call a DVM → HTTP 402 → sign USDT Jetton → gateway verifies → DVM executes
```
Users approve via TON Connect. Agents sign automatically with Ed25519 (V5R1 wallet). Same flow, same USDT on TON. DVM owners earn regardless of who calls.

### ENS on Sepolia
Every DVM gets a real on-chain subdomain:
```
<dvm-slug>.<owner-prefix>.vendton.eth
```
Text records: `address.ton` (owner's TON wallet) + `description`. Agents discover DVMs via ENS or gateway API — dual discovery paths.

### Serverless DVMs
JavaScript code executed in a `node:vm` sandbox with 10s timeout. Available globals: `input`, `fetch`, `JSON`, `Math`, `Date`, `URL`.

### TON Connect
Users approve every payment from their own wallet. The AI requests approval, the user taps confirm, USDT moves on TON.

**DVM Identity on Ethereum · Payments on TON · Interface on Telegram**

## What We Built

### Platform
- DVM marketplace with search and tags
- 3 deploy modes: write code, upload file, external URL
- 0.05 TON creation fee (anti-spam)
- Profile with earnings and DVM management

### Protocol
- @x402/ton SDK: verify, settle, paymentMiddleware
- Ed25519 signature verification
- USDT Jetton transfers (TEP-74)
- V5R1 wallet support

### Identity
- ENS subdomains on Ethereum Sepolia
- `address.ton` cross-chain text records
- Auto-created on deploy, revoked on delete
- Dual discovery: ENS on-chain + gateway API

### Intelligence
- AI agent with 4 tools (discover, call, balance, resolve)
- Auto-discovery and DVM chaining
- User wallet payments via TON Connect
- Real-time SSE step streaming

## DVM Code Format

```javascript
const city = input.city || "Lausanne";
const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=46.52&longitude=6.63&current=temperature_2m`);
const data = await res.json();
return { city, temperature: data.current.temperature_2m };
```

## Architecture

```
vendton/
├── packages/ton/       @x402/ton SDK
├── gateway/            Express + SQLite + vm executor + x402 + ENS writer
├── agent/              Claude AI + TON wallet + tool use
├── mini-app/           React 19 + Vite + TMA SDK + TON Connect
├── bot/                grammY Telegram bot
└── examples/           Example DVM code files
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
| AI | Claude with tool use (4 tools) |
| Backend | Express, SQLite (better-sqlite3), WebSocket, Zod, node:vm |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Framer Motion |
| Telegram | TMA SDK, TON Connect, grammY |

## Why Telegram Wins

**Revenue** — Fees on DVM deploys and API usage. A new revenue stream from the community.

**Flywheel** — Developers deploy → users pay → developers earn → more DVMs → better quality → more agents choose TON.

**AI for everyone** — Zero complexity. Open the app, connect wallet, ask AI anything. It just works.

**Agents choose TON** — A real marketplace of paid data incentivizes agents to hold TON wallets.

Telegram provides the AI. Users provide the APIs. **VendTON connects them.**

## Demo Flow

1. Open VendTON — marketplace is empty
2. **Create** a Weather DVM (upload `weather.txt`, 0.10 USDT/call)
3. **Create** a Crypto Price DVM (upload `crypto-price.txt`, 0.10 USDT/call)
4. Go to **Ask**: *"Weather in Lausanne and price of Bitcoin"*
5. Watch the AI discover both DVMs, request payment approval, call them
6. Approve 0.10 + 0.10 USDT from your wallet
7. Get the combined answer — real weather + real Bitcoin price
8. Check **Profile** — see your DVMs earning
9. Verify on [TON explorer](https://testnet.tonviewer.com/EQCaXWPU1Nj5zpxP2nmPGE-iJbxHaEqvj-TTkNmIbmF0QcBK)
10. Verify on [ENS Sepolia](https://sepolia.app.ens.domains/vendton.eth)

## BSA EPFL Hackathon 2026

**AlphaTON Capital Track** · **ENS Track**

Cocoon AI agents run on $82.5M of GPU infrastructure. They can reason — but they can't buy external data. No marketplace exists for agents on TON. VendTON is a complete product: marketplace + AI + wallet payments + ENS identity. Not just x402 — the whole ecosystem.

Developers deploy → agents and users pay → developers earn → more DVMs deployed. A self-growing data economy on TON.

## License

MIT
