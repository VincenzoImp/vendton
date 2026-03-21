# x402-TON — Complete Project Specification

## 1. Protocol Specification

### 1.1 Network Identifier
- **CAIP-2**: `ton:0` (TON basechain, workchain 0)

### 1.2 PaymentRequirements (server → client)
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

### 1.3 PaymentPayload (client → server)
```json
{
  "x402Version": 2,
  "accepted": { "...PaymentRequirements..." },
  "payload": {
    "boc": "<base64-encoded signed external message BoC>",
    "publicKey": "<hex Ed25519 public key>",
    "senderAddress": "<bounceable TON address>",
    "senderJettonWallet": "<payer's USDT Jetton wallet address>"
  }
}
```

### 1.4 Verification Flow
1. Decode BoC from base64 → `Cell.fromBase64(boc)`
2. Load external message, extract signature (512 bits)
3. Verify Ed25519 signature against body hash using public key
4. Derive Wallet V5R1 address from public key, verify matches `senderAddress`
5. Query Jetton balance via `get_wallet_data` on `senderJettonWallet`
6. Parse inner Jetton transfer message: verify destination = `payTo`, amount = `amount`
7. Return `{ isValid: true/false, invalidReason? }`

### 1.5 Settlement Flow
1. Run verification (above)
2. Broadcast pre-signed BoC to TON network: `client.sendFile(boc.toBoc())`
3. Poll for transaction confirmation (30s timeout)
4. Return `{ success, transaction, network: "ton:0" }`

### 1.6 Key Design Decision: Pre-signed BoC
Client constructs the FULL transaction chain:
```
External Message → Wallet V5R1 → Jetton Wallet → Recipient Jetton Wallet
```
Signs with Ed25519 private key. Facilitator only broadcasts — cannot alter amount or destination. Mirrors Solana's x402 pattern.

---

## 2. Component Specifications

### 2.1 @x402/ton SDK Package (`packages/ton/`)

**Exports:**
```typescript
// Client
export function createTONPaymentPayload(
  requirements: PaymentRequirements,
  keypair: nacl.SignKeyPair,
  walletSeqno: number,
  senderJettonWallet: string
): Promise<PaymentPayload>;

// Facilitator
export function verify(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  tonClient: TonClient
): Promise<VerifyResponse>;

export function settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  tonClient: TonClient
): Promise<SettleResponse>;

// Server Middleware
export function paymentMiddleware(config: {
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  facilitatorUrl: string;
  maxTimeoutSeconds?: number;
}): RequestHandler;
```

**Types:**
```typescript
type Network = `${string}:${string}`;

interface PaymentRequirements {
  scheme: string;
  network: Network;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: {
    boc: string;         // base64 BoC
    publicKey: string;   // hex Ed25519 public key
    senderAddress: string;
    senderJettonWallet: string;
  };
}

interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

interface SettleResponse {
  success: boolean;
  payer?: string;
  transaction?: string;
  network?: string;
  errorReason?: string;
}
```

### 2.2 Facilitator Server (`facilitator/`)

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/verify` | Validate payment without broadcasting |
| POST | `/settle` | Verify + broadcast + confirm |
| GET | `/supported` | Return supported schemes/networks |
| GET | `/health` | Health check |

**Stack:** Express 5, TypeScript, zod for validation, pino for logging

### 2.3 Demo API (`demo-api/`)

**Paid endpoints (protected by x402 middleware):**
| Endpoint | Price | Description |
|----------|-------|-------------|
| GET `/api/weather` | 0.1 USDT | Weather data |
| GET `/api/joke` | 0.05 USDT | Random joke |
| POST `/api/translate` | 0.5 USDT | Text translation |

### 2.4 AI Agent (`agent/`)

**Tools:**
```typescript
tools = [
  { name: "call_paid_api", description: "Call x402-gated API" },
  { name: "check_balance", description: "Check USDT balance" },
  { name: "list_services", description: "List available paid APIs" }
]
```

**Flow:** User message → LLM decides tool → 402 detected → auto-sign payment → retry → return result

### 2.5 Telegram Mini App (`mini-app/`)

**Pages:**
1. **Home** `/` — Wallet connect, project overview, live stats
2. **Agent Demo** `/agent-demo` — Start AI agent, watch payments in real-time
3. **Manual Pay** `/manual-pay` — User manually accesses paid content
4. **Dashboard** `/dashboard` — Transaction history

**Key Components:**
- `PaymentFlow` — Animated visualization: request → 402 → sign → pay → 200
- `TransactionFeed` — WebSocket-fed live transaction list
- `WalletConnect` — TON Connect button with USDT balance

### 2.6 Telegram Bot (`bot/`)

**Commands:**
- `/start` — Welcome + "Open App" button
- `/demo` — Launch agent demo
- `/balance` — Check agent wallet balance

### 2.7 ENS Integration (Bonus)

**How:** Resolve ENS names to TON addresses via ENSIP-9 (SLIP-44 coin type 607) or text records (`address.ton`). Display ENS avatars in payment UI.

---

## 3. Testnet Configuration

```
USDT_MASTER_ADDRESS=kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy  (testnet)
TON_RPC_URL=https://testnet.toncenter.com/api/v2/jsonRPC
TON_EXPLORER=https://testnet.tonviewer.com
TON_FAUCET=https://t.me/testgiver_ton_bot
```

---

## 4. Dependencies

```json
{
  "@ton/ton": "^15.x",
  "@ton/core": "^0.60.x",
  "@ton/crypto": "^3.x",
  "@tonconnect/ui-react": "^2.x",
  "@telegram-apps/sdk-react": "^2.x",
  "grammy": "^1.x",
  "express": "^5.x",
  "react": "^19.x",
  "vite": "^6.x",
  "framer-motion": "^12.x",
  "tailwindcss": "^4.x",
  "tweetnacl": "^1.x",
  "zod": "^3.x",
  "typescript": "^5.x"
}
```
