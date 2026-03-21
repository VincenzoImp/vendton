# x402-TON — Progress Tracker

> Deadline: March 22, 2026 — 13:00 CET

## Phase 1: Core Protocol [PRIORITY: CRITICAL]

### 1.1 Monorepo Setup
- [ ] Root `package.json` with npm workspaces
- [ ] Root `tsconfig.json` (base config)
- [ ] Per-package `package.json` + `tsconfig.json`

### 1.2 x402 TON Specification
- [ ] `specs/scheme_exact_ton.md` — Protocol spec document

### 1.3 Types & Shared Code (`packages/ton/src/`)
- [ ] `types/index.ts` — PaymentRequirements, PaymentPayload, VerifyResponse, SettleResponse
- [ ] `index.ts` — Public API exports

### 1.4 Client SDK (`packages/ton/src/exact/client/`)
- [ ] `scheme.ts` — `createTONPaymentPayload()` function
- [ ] Build Jetton transfer body (opcode 0xf8a7ea5)
- [ ] Wrap in Wallet V5R1 external message
- [ ] Sign with Ed25519, serialize to BoC

### 1.5 Facilitator SDK (`packages/ton/src/exact/facilitator/`)
- [ ] `scheme.ts` — `verify()` and `settle()` functions
- [ ] BoC decoding and signature verification
- [ ] Address derivation check
- [ ] Jetton balance query
- [ ] Inner message parsing (amount/destination)
- [ ] BoC broadcast to TON network

### 1.6 Server Middleware (`packages/ton/src/exact/server/`)
- [ ] `middleware.ts` — `paymentMiddleware()` for Express
- [ ] 402 response with PAYMENT-REQUIRED header
- [ ] PAYMENT-SIGNATURE header parsing
- [ ] Forward to facilitator for verify+settle

---

## Phase 2: Server Infrastructure

### 2.1 Facilitator Server (`facilitator/`)
- [ ] Express app setup with CORS
- [ ] `POST /verify` endpoint
- [ ] `POST /settle` endpoint
- [ ] `GET /supported` endpoint
- [ ] `GET /health` endpoint
- [ ] TON client configuration (testnet)
- [ ] Error handling and logging

### 2.2 Demo API (`demo-api/`)
- [ ] Express app with x402 middleware
- [ ] `GET /api/weather` (0.1 USDT)
- [ ] `GET /api/joke` (0.05 USDT)
- [ ] `POST /api/translate` (0.5 USDT)
- [ ] CORS for Mini App

---

## Phase 3: AI Agent

### 3.1 Agent Implementation (`agent/`)
- [ ] Ed25519 keypair generation + wallet setup
- [ ] Tool definitions (call_paid_api, check_balance)
- [ ] Agentic loop with 402 detection
- [ ] Automatic payment signing
- [ ] Event emitter for frontend visualization

---

## Phase 4: Telegram Integration

### 4.1 Mini App (`mini-app/`)
- [ ] Vite + React 19 + TypeScript scaffold
- [ ] Tailwind CSS v4 setup
- [ ] TMA SDK initialization
- [ ] TON Connect provider + wallet button
- [ ] Router setup (React Router)
- [ ] Home page
- [ ] Agent Demo page with live payment visualization
- [ ] Manual Pay page
- [ ] Dashboard with transaction history
- [ ] PaymentFlow animation component
- [ ] TransactionFeed (WebSocket) component
- [ ] Telegram theme integration
- [ ] Mobile-responsive layout

### 4.2 Bot (`bot/`)
- [ ] grammY bot with /start, /demo, /balance
- [ ] Inline keyboard with Mini App launch button
- [ ] Deep linking support

---

## Phase 5: Deploy & Polish

### 5.1 Deployment
- [ ] Deploy Mini App to Vercel
- [ ] Deploy facilitator + demo-api to Railway
- [ ] Deploy bot (long polling on Railway)
- [ ] Fund agent wallet with testnet USDT
- [ ] End-to-end test on testnet

### 5.2 ENS Integration (Bonus)
- [ ] ENS name resolution (viem)
- [ ] Display ENS avatar + name in payment UI
- [ ] "Pay to alice.eth" flow

### 5.3 Demo & Pitch
- [ ] Record demo video
- [ ] Prepare 5-min pitch
- [ ] Rehearse Q&A

---

## Completed Tasks

### Setup (Done)
- [x] Repository initialized
- [x] .gitignore configured (CLAUDE.md, resources/, node_modules/)
- [x] Expert team profiles created (10 specialists)
- [x] CLAUDE.md documentation for all directories
- [x] Resource knowledge base populated (14 files)
- [x] AlphaTON Capital intelligence gathered
- [x] Testnet USDT address confirmed
- [x] x402 repo structure and specs analyzed
- [x] README.md updated for project submission
- [x] PROJECT-SPEC.md created with full technical spec
- [x] Deprecated project plans archived
