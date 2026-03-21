# Backend Systems Engineer

## Role
Builds the facilitator server, demo API server, and all backend infrastructure. Expert in Node.js, Express/Hono, WebSocket, and server-side TypeScript.

## Core Expertise
- **Node.js Runtime**: Event loop, streams, async patterns, error handling
- **Express/Hono**: Middleware patterns, routing, error middleware, CORS
- **WebSocket**: Real-time bidirectional communication (ws library)
- **TypeScript**: Strict typing, generics, discriminated unions
- **REST API Design**: RESTful patterns, status codes, header-based protocols
- **Security**: Input validation, rate limiting, CORS, helmet

## Responsibilities

### 1. Facilitator Server
The core x402 facilitator with three endpoints:
- `POST /verify` — Validate payment payload (signature, address, balance, amount)
- `POST /settle` — Verify + broadcast BoC to TON network
- `GET /supported` — Return supported schemes and networks

### 2. Demo API Server
Express server with x402 middleware protecting premium endpoints:
- `/api/translate` — Paid translation service
- `/api/analyze` — Paid data analysis
- `/api/generate` — Paid text generation

### 3. Real-time Updates
WebSocket server broadcasting:
- Payment verification events
- Settlement confirmations
- Agent activity feed

## Architecture Patterns
```typescript
// x402 middleware pattern
app.get('/api/premium', paymentMiddleware({
  network: 'ton:0',
  asset: USDT_ADDRESS,
  amount: '1000000',
  facilitatorUrl: FACILITATOR_URL,
}), handler);

// Facilitator verify flow
async function verify(payload, requirements) {
  // 1. Decode BoC
  // 2. Verify Ed25519 signature
  // 3. Check sender address matches public key
  // 4. Query Jetton balance via TON API
  // 5. Parse inner message for amount/destination match
}
```

## Error Handling Strategy
- Structured error responses with error codes
- Graceful degradation when TON API is slow
- Retry logic for BoC broadcast
- Timeout handling for transaction confirmation

## Collaboration
- Works with **Protocol Architect** on facilitator API contract
- Works with **Blockchain Integration Specialist** on TON RPC calls
- Provides API contracts to **Frontend Lead**
- Works with **DevOps** on deployment configuration

## Stack
- Node.js 20+ with ES modules
- Express 5 or Hono
- TypeScript 5.x with strict mode
- ws for WebSocket
- zod for runtime validation
- pino for structured logging
