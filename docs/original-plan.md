# Project 1: x402-TON — First x402 Protocol Implementation on TON

> **TL;DR**: Port Coinbase's x402 payment protocol to TON, enabling AI agents to pay for HTTP services with USDT on TON — all integrated into a Telegram Mini App demo.

---

## Why This Wins

1. **The hackathon brief explicitly mentions x402 and ERC-8004** as inspiration keywords
2. **AlphaTON Capital** (diamond sponsor, the judges) is building AI agent infrastructure on TON (Cocoon AI, Claude Connector) — this is the missing payment layer they need
3. **First-mover**: x402 supports EVM, Solana, Aptos — **nobody has built it for TON yet**
4. **Narrative**: "We brought Coinbase's $5.6k-star protocol to Telegram's 1 billion users"
5. **Product-market fit**: 500M+ Mini App monthly users × growing AI agent economy = massive TAM

---

## What is x402?

x402 is an open-source protocol by Coinbase that revives HTTP status code `402 Payment Required` for machine-to-machine payments. When an AI agent requests a paid resource, the server responds `402` with payment options. The agent signs a stablecoin payment and resends the request. A facilitator verifies and settles on-chain. No accounts, API keys, or human intervention needed.

**Coalition**: Coinbase, Cloudflare, Circle, Stripe, AWS, Google, Vercel.

**Scale**: 100M+ transactions processed since mainnet launch (Jan 2026).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Telegram Mini App                      │
│  (React + Vite + tma.js + TON Connect)                   │
│  - Live demo dashboard                                    │
│  - Watch AI agent pay for services in real-time           │
│  - Manual payment mode for human users                    │
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
│  │ (Agent's     │              │  (Node.js)       │       │
│  │  keypair)    │              │  - Verify sig    │       │
│  └─────────────┘              │  - Check balance │       │
│                                │  - Submit Jetton │       │
│                                │    transfer      │       │
│                                └────────┬─────────┘       │
│                                         │                 │
│                                         ▼                 │
│                               ┌──────────────────┐       │
│                               │   TON Blockchain  │       │
│                               │   USDT Jetton     │       │
│                               │   Settlement      │       │
│                               └──────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology | Why |
|---|---|---|
| Smart Contract Language | **Tact** | TypeScript-like, fast development, built-in Ed25519 verification |
| Contract Framework | **Blueprint** (`@ton/blueprint`) | Official TON dev tool: compile, test, deploy |
| Contract Testing | **Sandbox** (`@ton/sandbox`) + Jest | Local blockchain emulator, no node needed |
| TON SDK | **@ton/ton** + **@ton/core** | Transaction building, address computation, BoC serialization |
| Facilitator Server | **Node.js** + **Express** or **Hono** | Matches x402's existing server middleware pattern |
| Client SDK | **TypeScript** (`@x402/ton`) | New package following x402's package structure |
| Mini App Frontend | **React** + **Vite** + **TypeScript** | Official Telegram Mini Apps recommended stack |
| TMA SDK | **@tma.js/sdk** | Community-recommended Telegram Mini App SDK |
| Wallet Connection | **@tonconnect/ui-react** | Standard TON wallet connection in Mini Apps |
| AI Agent | **Claude API** (tool use) or simple script | Demonstrates autonomous payment capability |
| Telegram Bot | **grammY** | Leading TypeScript Telegram bot framework |
| Hosting | **Vercel** or **Cloudflare Pages** | Free, instant deploys, HTTPS |

---

## Detailed Component Breakdown

### Component 1: x402 TON Specification (`specs/schemes/exact/scheme_exact_ton.md`)

Following x402's contribution guide, we define the TON-specific payload:

**CAIP-2 Network Identifier**: `ton:0` (TON basechain, workchain 0)

**PaymentRequirements** (server → client):
```json
{
  "scheme": "exact",
  "network": "ton:0",
  "amount": "1000000",
  "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  "payTo": "EQD__________server_address_______________",
  "maxTimeoutSeconds": 60,
  "extra": {
    "name": "USDT",
    "decimals": 6
  }
}
```

**PaymentPayload** (client → server, in `PAYMENT-SIGNATURE` header):
```json
{
  "x402Version": 2,
  "accepted": { "...same PaymentRequirements..." },
  "payload": {
    "boc": "<base64-encoded signed external message BoC>",
    "publicKey": "<hex-encoded Ed25519 public key>",
    "senderAddress": "<bounceable TON address of payer>",
    "senderJettonWallet": "<payer's USDT Jetton wallet address>"
  }
}
```

**Design decision — pre-signed BoC approach**:
- The client constructs a complete Jetton transfer transaction (external message → wallet contract → Jetton wallet → recipient)
- Signs it with their Ed25519 private key
- Sends the signed BoC (Bag of Cells) to the facilitator
- The facilitator broadcasts it to the TON network
- This mirrors how x402 works on Solana (client signs, facilitator submits)

### Component 2: TON Facilitator Server

Three API endpoints (matching x402 spec):

**`POST /verify`**
```typescript
async function verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
  // 1. Decode BoC from base64
  const cell = Cell.fromBase64(payload.payload.boc);
  const externalMessage = loadExternalMessage(cell);

  // 2. Extract signature and verify Ed25519
  const signature = externalMessage.signature; // 512 bits
  const hash = externalMessage.bodyHash;
  const publicKey = Buffer.from(payload.payload.publicKey, 'hex');
  const isValidSig = nacl.sign.detached.verify(hash, signature, publicKey);
  if (!isValidSig) return { isValid: false, invalidReason: "Invalid signature" };

  // 3. Verify sender address matches public key
  // Compute expected wallet address from public key + wallet contract code
  const expectedAddress = WalletContractV5R1.create({ publicKey, workchain: 0 }).address;
  if (!expectedAddress.equals(Address.parse(payload.payload.senderAddress))) {
    return { isValid: false, invalidReason: "Address mismatch" };
  }

  // 4. Check Jetton balance via TON API
  const balance = await tonClient.runMethod(
    Address.parse(payload.payload.senderJettonWallet),
    'get_wallet_data'
  );
  const jettonBalance = balance.stack.readBigNumber();
  if (jettonBalance < BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: "Insufficient USDT balance" };
  }

  // 5. Parse the inner message to verify destination and amount match
  const innerTransfer = parseJettonTransfer(externalMessage.body);
  if (innerTransfer.amount.toString() !== requirements.amount) {
    return { isValid: false, invalidReason: "Amount mismatch" };
  }

  return { isValid: true, payer: payload.payload.senderAddress };
}
```

**`POST /settle`**
```typescript
async function settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
  // 1. Verify first
  const verification = await verify(payload, requirements);
  if (!verification.isValid) {
    return { success: false, errorReason: verification.invalidReason };
  }

  // 2. Broadcast the pre-signed BoC to TON network
  const boc = Cell.fromBase64(payload.payload.boc);
  try {
    await tonClient.sendFile(boc.toBoc());
  } catch (e) {
    return { success: false, errorReason: `Broadcast failed: ${e.message}` };
  }

  // 3. Wait for confirmation (poll for tx)
  const txHash = await waitForTransaction(payload.payload.senderAddress, 30_000);

  return {
    success: true,
    payer: payload.payload.senderAddress,
    transaction: txHash,
    network: "ton:0"
  };
}
```

**`GET /supported`**
```typescript
{
  "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "ton:0" }],
  "extensions": [],
  "signers": { "ton:*": [] }
}
```

### Component 3: Client SDK (`@x402/ton`)

```typescript
// Client-side: create payment payload
import { WalletContractV5R1, internal, beginCell, toNano } from '@ton/ton';
import nacl from 'tweetnacl';

export async function createTONPaymentPayload(
  requirements: PaymentRequirements,
  keypair: nacl.SignKeyPair,
  walletSeqno: number
): Promise<PaymentPayload> {
  // 1. Build Jetton transfer message
  const jettonTransferBody = beginCell()
    .storeUint(0xf8a7ea5, 32)        // op: transfer
    .storeUint(0, 64)                 // query_id
    .storeCoins(BigInt(requirements.amount))
    .storeAddress(Address.parse(requirements.payTo))  // destination
    .storeAddress(senderAddress)      // response_destination
    .storeUint(0, 1)                  // no custom_payload
    .storeCoins(1n)                   // forward_ton_amount (minimal)
    .storeUint(0, 1)                  // no forward_payload
    .endCell();

  // 2. Build wallet external message with this as inner message
  const wallet = WalletContractV5R1.create({ publicKey: keypair.publicKey, workchain: 0 });
  const transfer = wallet.createTransfer({
    seqno: walletSeqno,
    secretKey: Buffer.from(keypair.secretKey),
    messages: [internal({
      to: senderJettonWalletAddress,
      value: toNano('0.1'),  // gas for Jetton transfer
      body: jettonTransferBody,
    })],
    sendMode: 3,
    timeout: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
  });

  // 3. Serialize to BoC
  const boc = transfer.toBoc().toString('base64');

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      boc,
      publicKey: Buffer.from(keypair.publicKey).toString('hex'),
      senderAddress: wallet.address.toString(),
      senderJettonWallet: computeJettonWalletAddress(wallet.address, requirements.asset),
    }
  };
}
```

**Express middleware** (server-side, protecting a route):
```typescript
import { paymentMiddleware } from '@x402/ton';

app.get('/api/premium-data', paymentMiddleware({
  network: 'ton:0',
  asset: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT
  amount: '1000000', // 1 USDT
  facilitatorUrl: 'https://your-facilitator.com',
}), (req, res) => {
  res.json({ data: 'premium content here' });
});
```

### Component 4: AI Agent Demo

A simple autonomous agent that calls paid APIs:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createTONPaymentPayload } from '@x402/ton';

const anthropic = new Anthropic();
const agentKeypair = nacl.sign.keyPair(); // Agent's own wallet

// Tool definitions for Claude
const tools = [{
  name: "call_paid_api",
  description: "Call a paid API endpoint that requires x402 USDT payment on TON",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The API endpoint URL" },
      method: { type: "string", enum: ["GET", "POST"] },
    },
    required: ["url"]
  }
}];

// Agentic loop
async function agentLoop(userMessage: string) {
  let messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content[0].text;
    }

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "call_paid_api") {
        // 1. Make initial request
        const res = await fetch(block.input.url);

        if (res.status === 402) {
          // 2. Parse payment requirements from header
          const paymentRequired = JSON.parse(
            Buffer.from(res.headers.get('PAYMENT-REQUIRED'), 'base64').toString()
          );

          // 3. Create signed payment
          const payload = await createTONPaymentPayload(
            paymentRequired.accepts[0],
            agentKeypair,
            await getWalletSeqno()
          );

          // 4. Retry with payment
          const paidRes = await fetch(block.input.url, {
            headers: {
              'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(payload)).toString('base64')
            }
          });
          const data = await paidRes.json();

          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(data) }]
          });
        }
      }
    }
  }
}
```

### Component 5: Telegram Mini App

**Pages**:
1. **Home**: Connect wallet (TON Connect), see agent activity feed
2. **Agent Demo**: Start the AI agent, watch it call paid APIs in real-time, see USDT payments flow
3. **Manual Mode**: User manually accesses paid content, pays via x402
4. **Dashboard**: Transaction history, total spent, services used

**Key UI elements**:
- Real-time transaction feed (WebSocket from facilitator)
- Payment flow visualization (request → 402 → payment → 200)
- Balance display (fetched from TON via `@ton/ton`)

### Component 6: Optional — Minimal Agent Registry (inspired by ERC-8004)

A Tact smart contract that registers AI agents with their x402 support status:

```tact
struct AgentInfo {
    owner: Address;
    agentURI: String;          // URL to off-chain registration file
    x402Supported: Bool;
    registeredAt: Int as uint32;
}

contract AgentRegistry {
    nextId: Int as uint64 = 0;
    agents: map<Int, AgentInfo>;

    receive("register") {
        let id = self.nextId;
        self.nextId += 1;
        self.agents.set(id, AgentInfo{
            owner: sender(),
            agentURI: "",
            x402Supported: true,
            registeredAt: now(),
        });
    }

    receive(msg: SetAgentURI) {
        let agent = self.agents.get(msg.agentId)!!;
        require(sender() == agent.owner, "Not owner");
        agent.agentURI = msg.uri;
        self.agents.set(msg.agentId, agent);
    }

    get fun getAgent(id: Int): AgentInfo? {
        return self.agents.get(id);
    }

    get fun totalAgents(): Int {
        return self.nextId;
    }
}
```

---

## Project Structure

```
x402-ton/
├── contracts/                     # Tact smart contracts
│   ├── agent_registry.tact        # Optional: minimal ERC-8004 inspired registry
│   └── tests/
│       └── AgentRegistry.spec.ts
├── packages/
│   └── ton/                       # @x402/ton SDK package
│       ├── src/
│       │   ├── exact/
│       │   │   ├── client/
│       │   │   │   └── scheme.ts  # createTONPaymentPayload
│       │   │   ├── facilitator/
│       │   │   │   └── scheme.ts  # verify, settle, supported
│       │   │   └── server/
│       │   │       └── middleware.ts  # Express/Hono middleware
│       │   ├── types.ts           # TON-specific types
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── facilitator/                   # Facilitator server
│   ├── src/
│   │   ├── server.ts             # Express app with /verify, /settle, /supported
│   │   ├── ton-client.ts         # TON RPC client wrapper
│   │   └── config.ts
│   ├── package.json
│   └── Dockerfile
├── demo-api/                      # Example paid API server
│   ├── src/
│   │   ├── server.ts             # Express + x402 middleware
│   │   └── routes/
│   │       ├── translate.ts      # Paid translation endpoint
│   │       ├── analyze.ts        # Paid image analysis endpoint
│   │       └── generate.ts       # Paid text generation endpoint
│   └── package.json
├── agent/                         # AI Agent demo
│   ├── src/
│   │   ├── agent.ts              # Claude-powered autonomous agent
│   │   ├── wallet.ts             # Agent's TON wallet management
│   │   └── tools.ts              # Tool definitions for Claude
│   └── package.json
├── mini-app/                      # Telegram Mini App
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── AgentDemo.tsx
│   │   │   ├── ManualPay.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── components/
│   │   │   ├── PaymentFlow.tsx   # Visual payment flow animation
│   │   │   ├── TransactionFeed.tsx
│   │   │   └── WalletConnect.tsx
│   │   └── hooks/
│   │       ├── useTonConnect.ts
│   │       └── useX402.ts
│   ├── public/
│   │   └── tonconnect-manifest.json
│   ├── package.json
│   └── vite.config.ts
├── bot/                           # Telegram Bot
│   ├── src/
│   │   └── bot.ts                # grammY bot with /demo, /status commands
│   └── package.json
├── specs/
│   └── scheme_exact_ton.md       # x402 TON specification document
├── README.md
└── package.json                   # Monorepo root (npm workspaces)
```

---

## 36-Hour Implementation Timeline

### Hours 0-2: Setup & Scaffolding
- [ ] Init monorepo with npm workspaces
- [ ] `npx blueprint create` for Tact contracts
- [ ] `npx @anthropic-ai/create-agent` or manual setup for agent
- [ ] Clone Telegram Mini App React template
- [ ] Set up grammY bot skeleton

### Hours 2-8: Core Protocol (x402 on TON)
- [ ] Write the `scheme_exact_ton.md` specification
- [ ] Implement `createTONPaymentPayload` (client SDK)
- [ ] Implement facilitator `verify` function
- [ ] Implement facilitator `settle` function (broadcast BoC)
- [ ] Write Express middleware `paymentMiddleware`
- [ ] Test end-to-end: client → 402 → payment → 200

### Hours 8-14: Demo API + AI Agent
- [ ] Build 2-3 paid API endpoints (translation, text generation, data analysis)
- [ ] Implement AI agent with Claude tool use
- [ ] Agent autonomously discovers and pays for API calls
- [ ] Test full agent loop on TON testnet

### Hours 14-20: Mini App + Bot
- [ ] TON Connect wallet integration
- [ ] Home page with agent activity feed
- [ ] Agent Demo page: start/stop agent, real-time payment visualization
- [ ] Manual payment mode
- [ ] Transaction history dashboard
- [ ] Bot commands: `/demo`, `/balance`, `/history`

### Hours 20-26: Agent Registry + Polish
- [ ] Deploy Agent Registry contract to testnet
- [ ] Register demo agents
- [ ] UI polish: animations, loading states, error handling
- [ ] Mobile-optimized layout for Telegram

### Hours 26-32: Testing + Deployment
- [ ] Full end-to-end testing on TON testnet
- [ ] Deploy Mini App to Vercel
- [ ] Deploy facilitator to Railway/Fly.io
- [ ] Deploy bot
- [ ] Write README with architecture diagram

### Hours 32-36: Pitch Preparation
- [ ] Record demo video (agent paying for services in real-time)
- [ ] Prepare 5-minute pitch deck
- [ ] Rehearse pitch + Q&A prep

---

## Pitch Outline (5 minutes)

1. **The Problem** (1 min): AI agents need to pay for services autonomously. x402 solved this for EVM chains but TON — the only blockchain native to Telegram's 1B users — is left out.

2. **The Solution** (1 min): x402-TON — the first implementation of Coinbase's x402 protocol on TON. AI agents pay for HTTP services with USDT via Telegram.

3. **Live Demo** (2 min): Show the AI agent in the Telegram Mini App calling paid APIs and paying with USDT on TON testnet in real-time.

4. **Market & Growth** (1 min): 500M Mini App users × $4B+ AI agent market. Distribution via Telegram. Monetization: facilitator fees (0.1%). Path to adoption: open-source SDK, npm package, developer docs.

---

## Key Dependencies

```json
{
  "@ton/ton": "^15.x",
  "@ton/core": "^0.60.x",
  "@ton/crypto": "^3.x",
  "@ton/sandbox": "^0.22.x",
  "@ton/blueprint": "^0.25.x",
  "@tact-lang/compiler": "^1.6.x",
  "@tonconnect/ui-react": "^2.x",
  "@tma.js/sdk": "^2.x",
  "grammy": "^1.x",
  "@anthropic-ai/sdk": "^0.39.x",
  "express": "^5.x",
  "tweetnacl": "^1.x",
  "react": "^19.x",
  "vite": "^6.x"
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| TON testnet USDT unavailable | Deploy our own test Jetton mimicking USDT |
| BoC broadcast latency | Show "pending" state in UI, poll for confirmation |
| Signature format mismatch | Use `@ton/crypto` for Ed25519, extensive unit tests |
| Time pressure (36h) | Prioritize core protocol + agent demo over Mini App polish |
| Judges unfamiliar with x402 | Start pitch with 30s x402 explainer, show Coinbase backing |
