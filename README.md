# VendTON

**Deploy paid API endpoints in seconds. Earn USDT on TON.**

VendTON is an open marketplace for Data Vending Machines (DVMs) on the TON blockchain. Anyone can deploy a JavaScript function as a paid API endpoint. AI agents and users discover DVMs, pay with USDT via the x402 protocol, and chain multiple DVMs to accomplish complex tasks — all through Telegram.

## Vision

VendTON creates value for every participant in the ecosystem:

**For users** — Deploy your API as a DVM, set a price, and earn USDT every time someone calls it. No infrastructure to manage — write code, upload it, start earning. Your DVM gets a permanent ENS identity on-chain.

**For Telegram** — A community-driven marketplace of paid APIs living inside Telegram. Users build for users. The more DVMs deployed, the more valuable the ecosystem becomes. A new economy powered by TON.

**For AI agents** — TON becomes the blockchain where agents pay for data. Any agent with a wallet can discover DVMs, pay in USDT, and access real-world data — weather, prices, translations, anything the community builds. No API keys, no subscriptions. Just pay and use.

**For end users** — An AI assistant powered by your own wallet. Connect your TON wallet, ask anything, and the AI finds the best DVMs on the marketplace, asks for your approval, pays with your USDT, and returns the answer. You control what you spend.

## Live Demo

- **Mini App**: [vendton.vercel.app](https://vendton.vercel.app)
- **Telegram Bot**: [@vendton_bot](https://t.me/vendton_bot)
- **Gateway API**: [vendton-gateway.up.railway.app](https://vendton-gateway.up.railway.app/health)

## On-Chain Verification

| What | Link |
|------|------|
| Agent wallet (pays for DVMs) | [EQCaXWPU...QcBK](https://testnet.tonviewer.com/EQCaXWPU1Nj5zpxP2nmPGE-iJbxHaEqvj-TTkNmIbmF0QcBK) |
| DVM provider 1 — platform | [EQAWWAQAZJl...MITD](https://testnet.tonviewer.com/EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD) |
| DVM provider 2 — user | [0QA6eW1b...l28u](https://testnet.tonviewer.com/0QA6eW1bjOhzGOFaPwfbjqufwuaXpVzynPB9q6ZSBoKHl28u) |
| ENS domain owner (Sepolia) | [0x64fC...284a](https://sepolia.etherscan.io/address/0x64fC5868273CAd0204dce42527e647db117C284a) |
| vendton.eth on ENS | [vendton.eth](https://sepolia.app.ens.domains/vendton.eth) |
| Weather DVM ENS subdomain | [weather-data.eqawwaqa.vendton.eth](https://sepolia.app.ens.domains/weather-data.eqawwaqa.vendton.eth) |

All payments are real USDT Jetton transfers on TON testnet. All ENS subdomains are real on Ethereum Sepolia.

## How It Works

### 1. Deploy a DVM ("Create" tab)

Write JavaScript, upload a `.txt` file, or paste an external API URL. Set a price in USDT, connect your wallet, pay a 0.05 TON creation fee. Your DVM gets an automatic ENS identity on Sepolia (e.g. `crypto-price.uqa6ew1b.vendton.eth`) with `address.ton` text record pointing to your TON wallet.

### 2. Ask AI ("Ask" tab)

Connect your wallet and ask anything. The AI discovers relevant DVMs on the marketplace, requests payment approval from your wallet via TON Connect, calls the DVMs, and chains results. You see every step in real time.

### 3. Earn ("Profile" tab)

Track your deployed DVMs, see how many calls each received, and how much USDT you earned. Delete DVMs you no longer need — the ENS subdomain is revoked on-chain.

## Payment Flow (x402)

```
1. Agent calls GET /dvm/:owner/:name
2. Gateway returns 402 + payment requirements (payTo = owner's Jetton wallet)
3. User approves payment in TON Connect (or agent signs automatically)
4. Gateway verifies and executes DVM code
5. USDT transfers from caller to DVM owner on TON
```

Two payment paths:
- **Users**: TON Connect → approve in wallet → `X-PAYMENT-TX` header
- **Agents**: Ed25519 signed BoC → `X-PAYMENT` header → verify + broadcast on-chain

## ENS Integration

Every DVM gets a real ENS subdomain on Ethereum Sepolia:

```
<dvm-slug>.<owner-prefix>.vendton.eth
```

Created on-chain via the ENS Registry (`setSubnodeRecord`), with text records:
- `address.ton` → owner's TON wallet address
- `description` → DVM description

The AI agent can discover DVMs by ENS name using the `resolve_ens` tool.

## Architecture

```
vendton/
├── packages/ton/       @x402/ton SDK — verify, settle, paymentMiddleware
├── gateway/            Express + SQLite + vm executor + x402 + ENS writer
├── agent/              Claude AI + TON wallet + tool use
├── mini-app/           React 19 + Vite + TMA SDK + TON Connect
├── bot/                grammY Telegram bot
└── examples/           Example DVM code files (.txt)
```

## Quick Start

```bash
npm install

# Gateway (port 4000)
npm run dev:gateway

# Agent (port 4001)
AGENT_PORT=4001 npm run dev:agent

# Mini App (port 5173)
npm run dev:mini-app

# Bot
BOT_TOKEN=... npm run dev:bot
```

## DVM Code Format

DVMs are JavaScript functions executed serverlessly. They receive an `input` object and must return JSON:

```javascript
const city = input.city || "Lausanne";
const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=46.52&longitude=6.63&current=temperature_2m`);
const data = await res.json();
return { city, temperature: data.current.temperature_2m };
```

Available globals: `input`, `fetch`, `JSON`, `Math`, `Date`, `URL`. 10-second timeout. Sandboxed via `node:vm`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | TON testnet, USDT Jetton (TEP-74), V5R1 wallets |
| Payment | x402 protocol (HTTP 402), Ed25519 signature verification |
| Identity | ENS on Ethereum Sepolia, `address.ton` text records |
| AI | Claude claude-sonnet-4-20250514 with tool use (4 tools) |
| Backend | Express, SQLite (better-sqlite3), WebSocket, Zod |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Framer Motion |
| Telegram | @telegram-apps/sdk-react, @tonconnect/ui-react, grammY |

## Demo Flow

1. Start with empty marketplace — zero DVMs
2. Deploy **Weather Data** DVM (Open-Meteo API, 0.10 USDT/call)
3. Deploy **Crypto Price** DVM (CoinGecko API, 0.10 USDT/call)
4. Open **Ask AI**: "Get the weather in Lausanne and the price of Bitcoin"
5. Watch the AI discover both DVMs, request payment approval, call them, chain results
6. Check **Profile** to see earnings per DVM
7. Verify on [TON testnet explorer](https://testnet.tonviewer.com/EQCaXWPU1Nj5zpxP2nmPGE-iJbxHaEqvj-TTkNmIbmF0QcBK) that USDT actually moved
8. Verify on [ENS Sepolia](https://sepolia.app.ens.domains/vendton.eth) that subdomains were created

## For AlphaTON Capital

Cocoon AI agents run on $82.5M of GPU infrastructure. They can think and plan — but they cannot pay.

VendTON is the payment layer those agents need. Any developer deploys a paid API in 30 seconds. Any agent discovers it, pays in USDT, and gets the data. No API keys, no billing accounts — just USDT on TON.

- First x402 implementation on TON
- Real payments: USDT Jetton transfers on-chain
- Real identity: ENS subdomains on Sepolia with `address.ton` records
- Community-driven: anyone deploys, anyone earns
- Three ways to create DVMs: write code, upload file, proxy URL

## License

MIT
