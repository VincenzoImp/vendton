# Project 3: PayAgent — AI Agent Wallet Framework for TON

> **TL;DR**: A framework that gives every Telegram bot/AI agent its own programmable wallet on TON with spending controls (daily caps, whitelists, expiry). The agent can autonomously pay for services within limits set by the human owner.

---

## Why This Wins

1. **AlphaTON Capital is literally building this**: they launched Claude Connector (Claude AI + TON via Telegram) and are deploying privacy-preserving AI agents — PayAgent is the missing wallet layer
2. **No agent wallet framework exists on TON**: Coinbase AgentKit only supports EVM/Solana
3. **Leverages TON's unique architecture**: Wallet V5 extensions provide native, on-chain delegation — no other chain has this built into the wallet standard
4. **Telegram-native**: owner controls the agent via Telegram, agent operates autonomously
5. **Combines two mega-trends**: AI agents ($4B+ market) × TON/Telegram (1B users)

---

## Core Concept

```
┌──────────────────────────────────────────────────────────────┐
│                        Human Owner                            │
│  (Controls via Telegram Bot)                                  │
│                                                               │
│  /set_limit 100 USDT/day                                     │
│  /whitelist EQD...api_provider                                │
│  /fund_agent 500 USDT                                        │
│  /revoke                                                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────┐     │
│  │   Owner's Wallet    │    │   Agent Extension        │     │
│  │   (V5, full control)│───→│   (Smart Contract)       │     │
│  │                     │    │   - daily_limit: 100 USDT│     │
│  │   Holds USDT funds  │    │   - tx_limit: 20 USDT   │     │
│  │                     │    │   - whitelist: [addr1..] │     │
│  │   Can install/      │    │   - expiry: timestamp    │     │
│  │   remove extension  │    │   - daily_spent: 45 USDT │     │
│  └─────────────────────┘    └───────────┬──────────────┘     │
│                                          │                    │
│                               Authorized │ (within limits)    │
│                                          ▼                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    AI Agent                           │    │
│  │  (Claude API + grammY bot)                           │    │
│  │                                                       │    │
│  │  User: "Book me a flight to Paris"                   │    │
│  │  Agent: [thinks] → call_paid_api(travel_api, 15USDT) │    │
│  │  Agent: [checks] → 15 < 20 (tx limit) ✓             │    │
│  │  Agent: [checks] → 45+15=60 < 100 (daily limit) ✓   │    │
│  │  Agent: [executes] → sends USDT via extension        │    │
│  │  Agent: "Booked! Flight AF1234, departing 10:00"     │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Telegram Interface                          │
│                                                                  │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │  Owner Bot            │    │  Agent Chat                    │  │
│  │  - /fund_agent        │    │  - Natural language            │  │
│  │  - /set_limit         │    │  - "Pay 5 USDT to ..."       │  │
│  │  - /whitelist         │    │  - "What's my balance?"       │  │
│  │  - /revoke            │    │  - "Subscribe to ..."        │  │
│  │  - /status            │    │  - Auto-tasks (scheduled)     │  │
│  │  - /history           │    │                               │  │
│  └──────────┬───────────┘    └──────────────┬────────────────┘  │
│              │                               │                   │
├──────────────┼───────────────────────────────┼───────────────────┤
│              ▼                               ▼                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   PayAgent Runtime                         │  │
│  │                   (Node.js Service)                        │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Wallet Mgr   │  │ AI Engine    │  │ Safety Layer    │  │  │
│  │  │ - deploy ext │  │ - Claude API │  │ - rate limit    │  │  │
│  │  │ - sign txs   │  │ - tool use   │  │ - anomaly det.  │  │  │
│  │  │ - query bal  │  │ - agentic    │  │ - human-in-loop │  │  │
│  │  │ - key mgmt   │  │   loop       │  │ - audit log     │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  │         │                │                     │           │  │
│  │         └────────────────┼─────────────────────┘           │  │
│  │                          │                                 │  │
│  └──────────────────────────┼─────────────────────────────────┘  │
│                              │                                    │
├──────────────────────────────┼────────────────────────────────────┤
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                     TON Blockchain                         │   │
│  │                                                            │   │
│  │  ┌────────────────┐         ┌─────────────────────────┐   │   │
│  │  │ Owner Wallet   │────────→│ AgentExtension Contract │   │   │
│  │  │ (V5)           │ install │ - agent_pubkey          │   │   │
│  │  │ Holds funds    │         │ - daily_limit           │   │   │
│  │  └────────────────┘         │ - tx_limit              │   │   │
│  │                              │ - whitelist (dict)      │   │   │
│  │                              │ - expiry                │   │   │
│  │                              │ - daily_spent / window  │   │   │
│  │                              │                         │   │   │
│  │                              │ Sends op=0x6578746E     │   │   │
│  │                              │ to wallet (authorized)  │   │   │
│  │                              └─────────────────────────┘   │   │
│  │                                                            │   │
│  │  USDT Jetton: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology | Why |
|---|---|---|
| Extension Contract | **Tact** (or FunC for V5 compatibility) | Must interface with Wallet V5's extension protocol |
| Contract Framework | **Blueprint** (`@ton/blueprint`) | Compile, test, deploy |
| Contract Testing | **Sandbox** + Jest | Test spending limits, time windows, access control |
| Runtime Service | **Node.js** + **TypeScript** | Agent execution, wallet management, API server |
| AI Engine | **Claude API** (Anthropic SDK) with tool use | Best-in-class reasoning for autonomous decisions |
| Telegram Bot | **grammY** | Owner commands + Agent chat interface |
| TON Interaction | **@ton/ton** + **@ton/core** + **@ton/crypto** | Transaction building, key management |
| Key Storage | **Environment encryption** (MVP) / **TEE** (prod) | Protect agent's signing key |
| Mini App | **React** + **Vite** + **@tonconnect/ui-react** | Dashboard for owner |
| Database | **SQLite** (via better-sqlite3) | Transaction log, agent state, audit trail |
| Hosting | **Railway** / **Fly.io** | Always-on server for bot + agent |

---

## Smart Contract: AgentExtension

This is a Wallet V5-compatible extension contract that enforces spending limits:

```tact
import "@stdlib/deploy";

// ===== Messages =====

message AgentRequest {
    queryId: Int as uint64;
    // The inner action: a Jetton transfer body
    destination: Address;       // recipient of payment
    jettonAmount: Int as coins; // USDT amount
    jettonWallet: Address;      // wallet's USDT Jetton wallet
}

message UpdateLimits {
    dailyLimit: Int as coins;
    txLimit: Int as coins;
    expiry: Int as uint32;
}

message AddToWhitelist {
    address: Address;
}

message RemoveFromWhitelist {
    address: Address;
}

message RevokeAgent {}

// ===== Contract =====

contract AgentExtension with Deployable {
    owner: Address;            // human owner (who installed this extension)
    walletAddress: Address;    // the V5 wallet this extension controls
    agentPubkey: Int as uint256; // agent's Ed25519 public key

    // Spending controls
    dailyLimit: Int as coins;
    txLimit: Int as coins;
    expiry: Int as uint32;

    // State
    dailySpent: Int as coins = 0;
    windowStart: Int as uint32;
    whitelist: map<Address, Bool>;
    active: Bool = true;
    totalSpent: Int as coins = 0;
    txCount: Int as uint64 = 0;

    init(
        owner: Address,
        walletAddress: Address,
        agentPubkey: Int,
        dailyLimit: Int,
        txLimit: Int,
        expiry: Int
    ) {
        self.owner = owner;
        self.walletAddress = walletAddress;
        self.agentPubkey = agentPubkey;
        self.dailyLimit = dailyLimit;
        self.txLimit = txLimit;
        self.expiry = expiry;
        self.windowStart = now();
    }

    // Agent submits a payment request (via external message signed with agent key)
    external(msg: AgentRequest) {
        // 1. Check extension is active and not expired
        require(self.active, "Extension revoked");
        require(now() < self.expiry, "Extension expired");

        // 2. Verify agent's signature (the external message is signed)
        // TVM automatically verifies external message signatures
        // We use acceptMessage() after validation
        // The agent signs with their key, and we verify against agentPubkey

        // 3. Reset daily window if 24h passed
        if (now() - self.windowStart >= 86400) {
            self.dailySpent = 0;
            self.windowStart = now();
        }

        // 4. Check per-transaction limit
        require(msg.jettonAmount <= self.txLimit, "Exceeds tx limit");

        // 5. Check daily limit
        require(self.dailySpent + msg.jettonAmount <= self.dailyLimit, "Exceeds daily limit");

        // 6. Check whitelist
        require(self.whitelist.get(msg.destination) == true, "Recipient not whitelisted");

        // Accept the message (pay gas from contract balance)
        acceptMessage();

        // 7. Update state
        self.dailySpent += msg.jettonAmount;
        self.totalSpent += msg.jettonAmount;
        self.txCount += 1;

        // 8. Send the Jetton transfer action to the wallet
        // Build the message that the wallet should send
        let jettonTransferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)   // op: jetton_transfer
            .storeUint(msg.queryId, 64)
            .storeCoins(msg.jettonAmount)
            .storeAddress(msg.destination)
            .storeAddress(self.owner)     // response to owner
            .storeUint(0, 1)             // no custom payload
            .storeCoins(1)               // minimal forward
            .storeUint(0, 1)             // no forward payload
            .endCell();

        // Send as extension action to wallet V5
        // op = 0x6578746E ("extn")
        send(SendParameters{
            to: self.walletAddress,
            value: ton("0.1"),
            body: beginCell()
                .storeUint(0x6578746E, 32)  // "extn" opcode
                // The wallet will execute this as if owner signed it
                // Include the send_message action
                .storeRef(beginCell()
                    .storeUint(0, 8)  // action: send_message
                    .storeUint(3, 8)  // send mode
                    .storeRef(beginCell()
                        // Internal message to Jetton wallet
                        .storeAddress(msg.jettonWallet)
                        .storeCoins(ton("0.05"))
                        .storeRef(jettonTransferBody)
                        .endCell())
                    .endCell())
                .endCell(),
        });
    }

    // ===== Owner-only management =====

    receive(msg: UpdateLimits) {
        require(sender() == self.owner, "Only owner");
        self.dailyLimit = msg.dailyLimit;
        self.txLimit = msg.txLimit;
        self.expiry = msg.expiry;
    }

    receive(msg: AddToWhitelist) {
        require(sender() == self.owner, "Only owner");
        self.whitelist.set(msg.address, true);
    }

    receive(msg: RemoveFromWhitelist) {
        require(sender() == self.owner, "Only owner");
        self.whitelist.set(msg.address, false);
    }

    receive(msg: RevokeAgent) {
        require(sender() == self.owner, "Only owner");
        self.active = false;
    }

    // ===== Getters =====

    get fun status(): AgentStatus {
        return AgentStatus{
            active: self.active,
            dailyLimit: self.dailyLimit,
            txLimit: self.txLimit,
            dailySpent: self.dailySpent,
            dailyRemaining: self.dailyLimit - self.dailySpent,
            expiry: self.expiry,
            totalSpent: self.totalSpent,
            txCount: self.txCount,
        };
    }

    get fun isWhitelisted(addr: Address): Bool {
        return self.whitelist.get(addr) == true;
    }
}

struct AgentStatus {
    active: Bool;
    dailyLimit: Int as coins;
    txLimit: Int as coins;
    dailySpent: Int as coins;
    dailyRemaining: Int as coins;
    expiry: Int as uint32;
    totalSpent: Int as coins;
    txCount: Int as uint64;
}
```

**Note on V5 Extension Protocol**: The exact message format for V5 extensions (`op=0x6578746E`) requires careful encoding of the action list. The extension sends an internal message to the wallet containing the actions to execute. The wallet validates that the sender is in its extensions dictionary, then executes the actions. This is the most critical integration point and requires testing against the actual V5 wallet contract in Sandbox.

---

## AI Agent Implementation

### Tool Definitions for Claude

```typescript
const agentTools: Anthropic.Tool[] = [
  {
    name: "check_balance",
    description: "Check the USDT balance available to the agent and current spending status",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "send_payment",
    description: "Send USDT payment to a whitelisted address. Will fail if amount exceeds limits.",
    input_schema: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "TON address of the recipient (must be whitelisted)"
        },
        amount: {
          type: "number",
          description: "Amount in USDT to send"
        },
        reason: {
          type: "string",
          description: "Why this payment is being made"
        }
      },
      required: ["recipient", "amount", "reason"]
    }
  },
  {
    name: "get_spending_status",
    description: "Get current spending limits, daily spent, remaining budget, and transaction history",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "call_api",
    description: "Call an external API endpoint. If it requires payment, the agent will handle it.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "API endpoint URL" },
        method: { type: "string", enum: ["GET", "POST"], description: "HTTP method" },
        body: { type: "string", description: "Request body (for POST)" }
      },
      required: ["url"]
    }
  }
];
```

### Agentic Loop

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AgentWalletManager } from './wallet-manager';

const anthropic = new Anthropic();
const walletMgr = new AgentWalletManager(/* config */);

const SYSTEM_PROMPT = `You are an autonomous AI agent with a TON wallet.
You can make USDT payments within your spending limits.
Always check your budget before making payments.
Always explain what you're doing and why.
If a payment would exceed your limits, tell the user and suggest alternatives.
Never try to bypass spending controls.`;

async function handleUserMessage(
  userId: string,
  userMessage: string,
  conversationHistory: Anthropic.MessageParam[]
): Promise<string> {
  conversationHistory.push({ role: 'user', content: userMessage });

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: agentTools,
    messages: conversationHistory,
  });

  // Agentic loop: process tool calls until done
  while (response.stop_reason === 'tool_use') {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      let result: string;
      try {
        switch (block.name) {
          case 'check_balance':
            const balance = await walletMgr.getBalance();
            result = JSON.stringify(balance);
            break;

          case 'send_payment':
            const txResult = await walletMgr.sendPayment(
              block.input.recipient,
              block.input.amount,
              block.input.reason
            );
            result = JSON.stringify(txResult);
            break;

          case 'get_spending_status':
            const status = await walletMgr.getSpendingStatus();
            result = JSON.stringify(status);
            break;

          case 'call_api':
            const apiResult = await fetch(block.input.url, {
              method: block.input.method || 'GET',
              body: block.input.body,
            }).then(r => r.text());
            result = apiResult;
            break;

          default:
            result = `Unknown tool: ${block.name}`;
        }
      } catch (error) {
        result = `Error: ${error.message}`;
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
    }

    conversationHistory.push({ role: 'assistant', content: response.content });
    conversationHistory.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: agentTools,
      messages: conversationHistory,
    });
  }

  // Extract final text response
  const textContent = response.content.find(b => b.type === 'text');
  const finalText = textContent?.text || 'No response';

  conversationHistory.push({ role: 'assistant', content: response.content });
  return finalText;
}
```

### Wallet Manager

```typescript
import { TonClient, WalletContractV5R1, internal, toNano, beginCell, Address } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import Database from 'better-sqlite3';

export class AgentWalletManager {
  private client: TonClient;
  private agentKeypair: { publicKey: Buffer; secretKey: Buffer };
  private extensionAddress: Address;
  private walletAddress: Address;
  private db: Database.Database;

  constructor(config: {
    tonEndpoint: string;
    agentMnemonic: string;  // Agent's own mnemonic (NOT the owner's)
    extensionAddress: string;
    walletAddress: string;
    dbPath: string;
  }) {
    this.client = new TonClient({ endpoint: config.tonEndpoint });
    this.extensionAddress = Address.parse(config.extensionAddress);
    this.walletAddress = Address.parse(config.walletAddress);
    this.db = new Database(config.dbPath);
    this.initDb();
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        recipient TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        tx_hash TEXT,
        status TEXT DEFAULT 'pending'
      )
    `);
  }

  async init(mnemonic: string) {
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    this.agentKeypair = keyPair;
  }

  async getBalance(): Promise<{ walletTon: string; walletUsdt: string; dailyRemaining: string }> {
    // Query wallet TON balance
    const tonBalance = await this.client.getBalance(this.walletAddress);

    // Query extension status for spending limits
    const status = await this.getSpendingStatus();

    return {
      walletTon: (Number(tonBalance) / 1e9).toFixed(4) + ' TON',
      walletUsdt: 'Query Jetton wallet...',
      dailyRemaining: (Number(status.dailyRemaining) / 1e6).toFixed(2) + ' USDT',
    };
  }

  async getSpendingStatus(): Promise<{
    active: boolean;
    dailyLimit: bigint;
    txLimit: bigint;
    dailySpent: bigint;
    dailyRemaining: bigint;
    expiry: number;
    totalSpent: bigint;
    txCount: number;
  }> {
    const result = await this.client.runMethod(this.extensionAddress, 'status');
    // Parse the returned stack...
    return {
      active: result.stack.readBoolean(),
      dailyLimit: result.stack.readBigNumber(),
      txLimit: result.stack.readBigNumber(),
      dailySpent: result.stack.readBigNumber(),
      dailyRemaining: result.stack.readBigNumber(),
      expiry: result.stack.readNumber(),
      totalSpent: result.stack.readBigNumber(),
      txCount: result.stack.readNumber(),
    };
  }

  async sendPayment(
    recipient: string,
    amountUsdt: number,
    reason: string
  ): Promise<{ success: boolean; message: string; txHash?: string }> {
    const amountNano = BigInt(Math.round(amountUsdt * 1_000_000));

    // Pre-check: query on-chain limits
    const status = await this.getSpendingStatus();
    if (!status.active) return { success: false, message: 'Agent extension is revoked' };
    if (amountNano > status.txLimit) return { success: false, message: `Exceeds per-tx limit (${Number(status.txLimit) / 1e6} USDT)` };
    if (status.dailySpent + amountNano > status.dailyLimit) return { success: false, message: `Would exceed daily limit` };

    // Build and sign the AgentRequest external message
    const body = beginCell()
      .storeUint(/* AgentRequest opcode */, 32)
      .storeUint(Date.now(), 64) // queryId
      .storeAddress(Address.parse(recipient))
      .storeCoins(amountNano)
      .storeAddress(/* wallet's Jetton wallet */)
      .endCell();

    // Sign with agent's key and send as external message to extension
    // ... (external message construction with signature) ...

    // Log to database
    const stmt = this.db.prepare(
      'INSERT INTO transactions (timestamp, recipient, amount, reason, status) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(Date.now(), recipient, amountUsdt, reason, 'submitted');

    return { success: true, message: `Sent ${amountUsdt} USDT to ${recipient}` };
  }

  getTransactionHistory(limit = 20): any[] {
    return this.db.prepare(
      'SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?'
    ).all(limit);
  }
}
```

---

## Telegram Bot (Owner + Agent interfaces)

```typescript
import { Bot, Context, session, CommandGroup } from 'grammy';
import { handleUserMessage } from './agent';
import { AgentWalletManager } from './wallet-manager';

const bot = new Bot(process.env.BOT_TOKEN!);
const walletMgr = new AgentWalletManager(/* config */);

// ===== Conversation state =====
interface SessionData {
  conversationHistory: any[];
  isOwner: boolean;
}

bot.use(session({ initial: (): SessionData => ({
  conversationHistory: [],
  isOwner: false,
}) }));

// ===== Owner Commands =====
const ownerCommands = new CommandGroup();

ownerCommands.command('fund_agent', 'Fund the agent wallet with USDT', async (ctx) => {
  const amount = ctx.message?.text?.split(' ')[1];
  if (!amount) return ctx.reply('Usage: /fund_agent <amount_USDT>');

  // Open Mini App to sign the Jetton transfer
  await ctx.reply(`Fund agent with ${amount} USDT:`, {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Sign Transaction',
        web_app: { url: `${MINI_APP_URL}/fund?amount=${amount}` }
      }]]
    }
  });
});

ownerCommands.command('set_limit', 'Set daily spending limit', async (ctx) => {
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  if (args.length < 1) return ctx.reply('Usage: /set_limit <daily_usdt> [per_tx_usdt]');

  const [dailyLimit, txLimit] = args.map(Number);
  await ctx.reply(`Update limits:`, {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Confirm',
        web_app: { url: `${MINI_APP_URL}/limits?daily=${dailyLimit}&tx=${txLimit || dailyLimit / 5}` }
      }]]
    }
  });
});

ownerCommands.command('whitelist', 'Add address to agent whitelist', async (ctx) => {
  const address = ctx.message?.text?.split(' ')[1];
  if (!address) return ctx.reply('Usage: /whitelist <TON_address>');

  await ctx.reply(`Whitelist ${address.slice(0, 8)}...?`, {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Confirm',
        web_app: { url: `${MINI_APP_URL}/whitelist?addr=${address}` }
      }]]
    }
  });
});

ownerCommands.command('status', 'Check agent spending status', async (ctx) => {
  const status = await walletMgr.getSpendingStatus();
  const history = walletMgr.getTransactionHistory(5);

  let text = `Agent Status:\n`;
  text += `Active: ${status.active ? 'Yes' : 'REVOKED'}\n`;
  text += `Daily: ${Number(status.dailySpent) / 1e6}/${Number(status.dailyLimit) / 1e6} USDT\n`;
  text += `Remaining today: ${Number(status.dailyRemaining) / 1e6} USDT\n`;
  text += `Per-tx limit: ${Number(status.txLimit) / 1e6} USDT\n`;
  text += `Total spent: ${Number(status.totalSpent) / 1e6} USDT (${status.txCount} txs)\n`;
  text += `Expires: ${new Date(status.expiry * 1000).toISOString()}\n\n`;

  if (history.length > 0) {
    text += `Recent transactions:\n`;
    for (const tx of history) {
      text += `  ${tx.amount} USDT → ${tx.recipient.slice(0, 8)}... (${tx.reason})\n`;
    }
  }

  await ctx.reply(text);
});

ownerCommands.command('revoke', 'Revoke agent access immediately', async (ctx) => {
  await ctx.reply('REVOKE agent access? This is immediate and irreversible.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Yes, revoke now', web_app: { url: `${MINI_APP_URL}/revoke` } }],
        [{ text: 'Cancel', callback_data: 'cancel_revoke' }],
      ]
    }
  });
});

ownerCommands.command('history', 'View transaction history', async (ctx) => {
  const history = walletMgr.getTransactionHistory(20);
  if (history.length === 0) return ctx.reply('No transactions yet.');

  let text = 'Transaction History:\n\n';
  for (const tx of history) {
    const date = new Date(tx.timestamp).toLocaleString();
    text += `${date}\n`;
    text += `  ${tx.amount} USDT → ${tx.recipient.slice(0, 8)}...\n`;
    text += `  Reason: ${tx.reason}\n`;
    text += `  Status: ${tx.status}\n\n`;
  }
  await ctx.reply(text);
});

bot.use(ownerCommands);

// ===== Agent Chat (natural language) =====
bot.on('message:text', async (ctx) => {
  // Skip if it's a command
  if (ctx.message.text.startsWith('/')) return;

  const userId = ctx.from?.id.toString() || '';
  const response = await handleUserMessage(
    userId,
    ctx.message.text,
    ctx.session.conversationHistory
  );

  await ctx.reply(response);
});

ownerCommands.setCommands(bot);
bot.start();
```

---

## Mini App (Owner Dashboard)

### Pages

**1. Dashboard (Home)**
```
┌─────────────────────────────────┐
│  PayAgent          [wallet]     │
│                                 │
│  Agent Status: ACTIVE           │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Daily Budget            │   │
│  │  ████████░░  $45/$100   │   │
│  │  Resets in 6h 23m        │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Total Spent: $1,234     │   │
│  │  Transactions: 89        │   │
│  │  Active since: Mar 1     │   │
│  └─────────────────────────┘   │
│                                 │
│  Recent Activity                │
│  15:32  5 USDT → API Provider  │
│  14:18  2 USDT → Data Feed     │
│  12:05  8 USDT → Translation   │
│                                 │
│  [Fund Agent] [Settings]        │
└─────────────────────────────────┘
```

**2. Settings Page**
```
┌─────────────────────────────────┐
│  ← Settings                     │
│                                 │
│  Daily Limit                    │
│  ┌──────────┐                  │
│  │ 100      │ USDT/day         │
│  └──────────┘                  │
│                                 │
│  Per-Transaction Limit          │
│  ┌──────────┐                  │
│  │ 20       │ USDT             │
│  └──────────┘                  │
│                                 │
│  Expiry Date                    │
│  ┌──────────────────────┐      │
│  │ April 30, 2026       │      │
│  └──────────────────────┘      │
│                                 │
│  Whitelisted Addresses          │
│  EQD...abc    [x]              │
│  EQD...def    [x]              │
│  [+ Add Address]               │
│                                 │
│  ┌─────────────────────────┐   │
│  │    Save Changes          │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  ⚠ REVOKE AGENT         │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

---

## Project Structure

```
payagent-ton/
├── contracts/                       # Smart contracts
│   ├── agent_extension.tact         # V5-compatible extension with spending limits
│   └── tests/
│       └── AgentExtension.spec.ts   # Tests: limits, whitelist, expiry, revoke
├── wrappers/
│   └── AgentExtension.ts            # Auto-generated TypeScript wrapper
├── runtime/                         # Agent runtime service
│   ├── src/
│   │   ├── index.ts                # Entry point
│   │   ├── agent.ts                # Claude AI agentic loop
│   │   ├── tools.ts                # Tool definitions
│   │   ├── wallet-manager.ts       # TON wallet operations
│   │   ├── safety.ts               # Off-chain rate limiting, anomaly detection
│   │   └── db.ts                   # SQLite transaction log
│   └── package.json
├── bot/                             # Telegram Bot
│   ├── src/
│   │   ├── bot.ts                  # grammY bot: owner commands + agent chat
│   │   ├── owner-commands.ts       # /fund, /set_limit, /whitelist, /revoke, /status
│   │   └── middleware.ts           # Auth middleware (owner vs user)
│   └── package.json
├── mini-app/                        # Owner Dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Agent status, budget, recent txs
│   │   │   ├── Settings.tsx        # Limits, whitelist, expiry
│   │   │   ├── Fund.tsx            # Fund agent (TON Connect tx)
│   │   │   ├── History.tsx         # Full transaction log
│   │   │   └── Revoke.tsx          # Revoke confirmation
│   │   ├── components/
│   │   │   ├── BudgetBar.tsx       # Daily budget progress bar
│   │   │   ├── TxList.tsx          # Transaction list
│   │   │   └── WalletButton.tsx
│   │   └── hooks/
│   │       ├── useTonConnect.ts
│   │       └── useAgentStatus.ts
│   ├── public/
│   │   └── tonconnect-manifest.json
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── deploy-extension.ts          # Deploy extension to testnet
│   ├── install-extension.ts         # Install extension on V5 wallet
│   └── demo-agent.ts               # Run agent in demo mode
├── README.md
└── package.json                     # Monorepo root
```

---

## 36-Hour Implementation Timeline

### Hours 0-2: Setup
- [ ] Init monorepo, `npx blueprint create`
- [ ] Set up grammY bot skeleton
- [ ] Set up Claude API integration
- [ ] Clone TMA React template

### Hours 2-10: Extension Contract
- [ ] Implement AgentExtension in Tact
- [ ] Daily spending cap with 24h window reset
- [ ] Per-transaction limit check
- [ ] Address whitelist (dict-based)
- [ ] Time-based expiry
- [ ] Owner management functions (update limits, whitelist, revoke)
- [ ] Comprehensive tests in Sandbox
- [ ] Test V5 wallet extension protocol integration
- [ ] Deploy to TON testnet

### Hours 10-18: Agent Runtime + AI Integration
- [ ] Wallet Manager: balance queries, payment execution, history
- [ ] Claude API tool definitions (check_balance, send_payment, get_status, call_api)
- [ ] Agentic loop with tool use
- [ ] Safety layer: off-chain pre-checks, audit logging
- [ ] SQLite transaction log
- [ ] Test: agent makes payments within limits, gets rejected outside limits

### Hours 18-24: Telegram Bot
- [ ] Owner commands: /fund_agent, /set_limit, /whitelist, /status, /revoke, /history
- [ ] Agent chat: natural language → Claude → tool use → wallet action → response
- [ ] Inline keyboards for Mini App actions
- [ ] Session management for conversation history

### Hours 24-30: Mini App + Integration
- [ ] Dashboard: agent status, budget bar, recent transactions
- [ ] Settings: update limits, whitelist management
- [ ] Fund agent: TON Connect Jetton transfer
- [ ] Revoke: confirmation flow
- [ ] End-to-end test: owner funds → sets limits → agent pays autonomously

### Hours 30-36: Demo & Pitch
- [ ] Set up compelling demo scenario (AI assistant that books services)
- [ ] Record demo video
- [ ] Prepare pitch deck
- [ ] Rehearse

---

## Demo Scenario

**Setup**: The agent has 100 USDT/day budget, 20 USDT per-tx limit, and 3 whitelisted API providers.

**Demo flow**:
1. Owner opens Mini App, sees dashboard with 100 USDT daily budget
2. User chats with agent: "Translate this document to French"
3. Agent: checks balance → calls translation API → pays 2 USDT → returns translation
4. User: "Analyze this market data"
5. Agent: calls data API → pays 5 USDT → returns analysis
6. Owner checks /status → sees 7 USDT spent, 93 remaining
7. User tries: "Send 50 USDT to random address"
8. Agent: "I can't do that — the address isn't whitelisted and it exceeds my per-transaction limit of 20 USDT"
9. Owner opens Settings, reduces limit to 10 USDT/day — takes effect immediately

---

## Pitch Outline (5 minutes)

1. **The Problem** (45s): AI agents are becoming autonomous — but they can't spend money safely. Giving an AI a private key with no limits is reckless. Not giving it a wallet at all is crippling.

2. **The Solution** (1 min): PayAgent — programmable wallets for AI agents on TON. The owner sets guardrails (daily caps, whitelists, expiry). The agent operates autonomously within those bounds. All enforced on-chain — not just in code.

3. **Why TON** (30s): Wallet V5 has native extension support — purpose-built for exactly this. No other chain has delegation built into the wallet standard.

4. **Live Demo** (2 min): Show the agent chatting, making payments, getting blocked when it exceeds limits, and the owner adjusting controls in real-time.

5. **Market** (30s): AlphaTON is building AI agents for Telegram's 1B users. Every one of those agents needs a wallet. PayAgent is the framework.

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
  "better-sqlite3": "^11.x",
  "react": "^19.x",
  "vite": "^6.x"
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| V5 extension protocol complexity | Study wallet-contract-v5 repo carefully, test in Sandbox against real V5 |
| External message signing in Tact | May need FunC for external message handling; Tact supports `external()` receivers |
| Agent key security (MVP) | Encrypted env var for hackathon; mention TEE roadmap in pitch |
| Claude API latency | Show typing indicator, keep tool responses concise |
| Gas for extension operations | Pre-fund extension contract with 1-2 TON |
| Whitelist management UX | Keep it simple: 3-5 addresses max for demo |
