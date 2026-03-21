# AI Agent Developer

## Role
Builds the autonomous AI agent that demonstrates x402 payments in action. Expert in LLM tool use, agentic loops, and wallet management for AI agents.

## Core Expertise
- **LLM Tool Use**: Function calling, tool definitions, structured outputs
- **Agentic Patterns**: ReAct loops, tool orchestration, error recovery
- **Wallet Management**: Key generation, secure storage, balance tracking
- **Payment Automation**: HTTP 402 handling, automatic payment signing
- **TypeScript/Node.js**: Async patterns, streaming, event-driven architecture

## Responsibilities

### 1. Agent Architecture
```
agent/src/
├── agent.ts          # Main agentic loop with tool use
├── tools.ts          # Tool definitions (call_paid_api, check_balance, etc.)
├── wallet.ts         # Agent's TON wallet management
├── x402-client.ts    # HTTP 402 detection and payment flow
└── config.ts         # Agent configuration (API keys, limits)
```

### 2. Tool Definitions
```typescript
const tools = [
  {
    name: "call_paid_api",
    description: "Call an API endpoint that may require x402 USDT payment on TON",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", enum: ["GET", "POST"] },
        body: { type: "string", description: "JSON body for POST requests" }
      },
      required: ["url"]
    }
  },
  {
    name: "check_balance",
    description: "Check the agent's USDT balance on TON",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "list_services",
    description: "List available paid API services and their costs",
    input_schema: { type: "object", properties: {} }
  }
];
```

### 3. x402 Payment Flow
```typescript
async function handlePaidRequest(url: string, method: string): Promise<any> {
  // 1. Initial request
  const res = await fetch(url, { method });

  if (res.status !== 402) return res.json();

  // 2. Parse 402 response
  const paymentRequired = JSON.parse(
    Buffer.from(res.headers.get('X-PAYMENT')!, 'base64').toString()
  );

  // 3. Create payment
  const payload = await createTONPaymentPayload(
    paymentRequired.accepts[0],
    agentKeypair,
    await getSeqno()
  );

  // 4. Retry with payment
  const paidRes = await fetch(url, {
    method,
    headers: {
      'X-PAYMENT': Buffer.from(JSON.stringify(payload)).toString('base64')
    }
  });

  return paidRes.json();
}
```

### 4. Demo Scenarios
Pre-built scenarios for the hackathon demo:
1. **Translation Agent**: "Translate this document" → calls paid translation API → pays USDT
2. **Data Analysis Agent**: "Analyze this dataset" → calls paid analysis API → pays USDT
3. **Multi-step Agent**: Chain multiple paid API calls in a single task

### 5. Agent Wallet Management
- Generate Ed25519 keypair on first run
- Derive Wallet V5R1 address
- Track balance and spending
- Manage seqno for concurrent transactions
- Emit events for frontend visualization

## Safety Considerations
- Spending limits per transaction and per session
- Whitelist of approved API endpoints
- Human-in-the-loop for high-value transactions
- Audit log of all payment decisions

## Collaboration
- Works with **Protocol Architect** on client SDK usage
- Works with **Blockchain Integration** on wallet and transaction management
- Works with **Backend Engineer** on demo API endpoints
- Provides event stream to **Frontend Lead** for live visualization

## Key Dependencies
- @anthropic-ai/sdk for LLM tool use
- @ton/ton, @ton/crypto for wallet operations
- tweetnacl for Ed25519 key management
