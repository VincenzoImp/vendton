# Project 2: StreamPay TON — Real-Time Payment Streaming on TON

> **TL;DR**: First payment streaming protocol on TON. Smart contracts that send USDT in real-time (second by second). Telegram Mini App with live streaming counter + Bot for creating streams via chat commands.

---

## Why This Wins

1. **Payment streaming does NOT exist on TON** — Sablier has $3B+ TVL on Ethereum, this primitive is completely absent from TON
2. **Visual wow factor**: a counter ticking up in real-time showing USDT flowing is incredibly compelling for a demo
3. **Immediate use cases**: freelancer salaries, creator subscriptions, token vesting, recurring payments
4. **Telegram-native**: create a stream by chatting with a bot, manage via Mini App
5. **Theme alignment**: directly addresses "Stablecoins and Payments" hackathon theme

---

## How Payment Streaming Works (inspired by Sablier)

The key insight: **no tokens move per second**. The smart contract stores a `deposit`, `startTime`, `stopTime`, and `ratePerSecond`. The withdrawable amount is computed on-demand:

```
withdrawable = ratePerSecond × min(now - startTime, stopTime - startTime) - alreadyWithdrawn
```

The recipient can call `withdraw` at any time to claim their accrued amount. The UI shows a real-time counter computed client-side using `requestAnimationFrame`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Telegram Mini App                        │
│  (React + Vite + tma.js + TON Connect + Framer Motion)       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Create Stream │  │  Dashboard   │  │  Stream Detail    │  │
│  │ - recipient   │  │ - incoming   │  │  - LIVE counter   │  │
│  │ - amount      │  │ - outgoing   │  │  - withdraw btn   │  │
│  │ - duration    │  │ - total $    │  │  - cancel btn     │  │
│  │ - confirm tx  │  │ - status     │  │  - tx history     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Telegram Bot (grammY)                     │
│  /createstream @user 100USDT 30d                             │
│  /mystreams                                                  │
│  /withdraw <stream_id>                                       │
│  /cancel <stream_id>                                         │
├─────────────────────────────────────────────────────────────┤
│                     Backend API (Express)                     │
│  - Stream indexer (reads on-chain state)                      │
│  - WebSocket for real-time updates                           │
│  - TON API integration                                       │
├─────────────────────────────────────────────────────────────┤
│                     TON Blockchain                            │
│                                                              │
│  ┌──────────────────┐     ┌──────────────────────────────┐  │
│  │  StreamFactory    │────→│  PaymentStream (per stream)  │  │
│  │  - createStream() │     │  - deposit, rate, times      │  │
│  │  - getStream()    │     │  - withdraw()                │  │
│  │  - streamCount    │     │  - cancel()                  │  │
│  └──────────────────┘     │  - getWithdrawable()         │  │
│                            │  - getStreamInfo()           │  │
│                            └──────────────────────────────┘  │
│                                                              │
│  USDT Jetton: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology | Why |
|---|---|---|
| Smart Contracts | **Tact** | High-level, safe integer math (overflow-safe), built-in Jetton support |
| Contract Framework | **Blueprint** (`@ton/blueprint`) | Compile, test, deploy |
| Contract Testing | **Sandbox** (`@ton/sandbox`) + **Jest** | Time manipulation via `blockchain.now`, local emulation |
| Backend | **Node.js** + **Express** + **ws** | REST API + WebSocket for real-time |
| Mini App | **React 19** + **Vite** + **TypeScript** | Fast builds, HMR, official TMA template |
| TMA SDK | **@tma.js/sdk** | Telegram Mini App lifecycle, theme, viewport |
| Wallet | **@tonconnect/ui-react** | One-click wallet connection |
| Animations | **Framer Motion** | Smooth streaming counter, spring physics |
| Bot | **grammY** | Type-safe, plugin ecosystem, command groups |
| TON SDK | **@ton/ton** + **@ton/core** | Build messages, parse state, compute addresses |
| Hosting | **Vercel** (mini app) + **Railway** (backend/bot) | Free tier, easy deploys |

---

## Smart Contract Design (Tact)

### PaymentStream Contract

Each stream is a separate contract (TON's actor model favors this for parallelism and state isolation):

```tact
import "@stdlib/ownable";
import "@stdlib/deploy";

// ===== Messages =====

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell? = null;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message Withdraw {
    amount: Int as coins;
}

message Cancel {}

// ===== Structs =====

struct StreamInfo {
    sender: Address;
    recipient: Address;
    deposit: Int as coins;
    ratePerSecond: Int as coins;
    startTime: Int as uint32;
    stopTime: Int as uint32;
    withdrawn: Int as coins;
    jettonMaster: Address;
    active: Bool;
}

// ===== Contract =====

contract PaymentStream with Deployable {
    sender: Address;          // stream creator
    recipient: Address;       // stream receiver
    deposit: Int as coins;
    ratePerSecond: Int as coins;
    startTime: Int as uint32;
    stopTime: Int as uint32;
    withdrawn: Int as coins = 0;
    active: Bool = false;
    jettonMaster: Address;
    myJettonWallet: Address;  // this contract's USDT wallet

    init(
        sender: Address,
        recipient: Address,
        startTime: Int,
        stopTime: Int,
        jettonMaster: Address,
        myJettonWallet: Address
    ) {
        self.sender = sender;
        self.recipient = recipient;
        self.startTime = startTime;
        self.stopTime = stopTime;
        self.deposit = 0;
        self.ratePerSecond = 0;
        self.jettonMaster = jettonMaster;
        self.myJettonWallet = myJettonWallet;
    }

    // Fund the stream by sending USDT to this contract
    receive(msg: JettonTransferNotification) {
        require(sender() == self.myJettonWallet, "Not from Jetton wallet");
        require(!self.active, "Stream already funded");
        require(msg.sender == self.sender, "Only stream sender can fund");

        let duration: Int = self.stopTime - self.startTime;
        require(duration > 0, "Invalid duration");
        require(msg.amount >= duration, "Deposit too small for duration");

        // Calculate rate (truncate to avoid rounding issues)
        self.ratePerSecond = msg.amount / duration;
        self.deposit = self.ratePerSecond * duration; // adjusted deposit
        self.active = true;

        // Refund excess (if msg.amount > adjusted deposit)
        let excess: Int = msg.amount - self.deposit;
        if (excess > 0) {
            self.sendJettons(self.sender, excess);
        }
    }

    // Recipient withdraws accrued funds
    receive(msg: Withdraw) {
        require(sender() == self.recipient, "Only recipient");
        require(self.active, "Stream not active");

        let withdrawable: Int = self.computeWithdrawable();
        require(msg.amount <= withdrawable, "Amount exceeds withdrawable");
        require(msg.amount > 0, "Nothing to withdraw");

        self.withdrawn += msg.amount;
        self.sendJettons(self.recipient, msg.amount);

        // Auto-close if fully withdrawn
        if (self.withdrawn >= self.deposit) {
            self.active = false;
        }
    }

    // Either party can cancel — pro-rata split
    receive(msg: Cancel) {
        require(sender() == self.sender || sender() == self.recipient, "Not authorized");
        require(self.active, "Stream not active");

        let recipientBalance: Int = self.computeWithdrawable();
        let senderBalance: Int = self.deposit - self.withdrawn - recipientBalance;

        self.active = false;

        // Send accrued amount to recipient
        if (recipientBalance > 0) {
            self.sendJettons(self.recipient, recipientBalance);
        }
        // Refund remaining to sender
        if (senderBalance > 0) {
            self.sendJettons(self.sender, senderBalance);
        }
    }

    // ===== Internal =====

    fun computeStreamed(): Int {
        if (now() <= self.startTime) { return 0; }
        let elapsed: Int = 0;
        if (now() >= self.stopTime) {
            elapsed = self.stopTime - self.startTime;
        } else {
            elapsed = now() - self.startTime;
        }
        return elapsed * self.ratePerSecond;
    }

    fun computeWithdrawable(): Int {
        return self.computeStreamed() - self.withdrawn;
    }

    fun sendJettons(to: Address, amount: Int) {
        send(SendParameters{
            to: self.myJettonWallet,
            value: ton("0.05"),
            body: JettonTransfer{
                queryId: 0,
                amount: amount,
                destination: to,
                responseDestination: to,
                customPayload: null,
                forwardTonAmount: 1,
                forwardPayload: rawSlice("F"),
            }.toCell(),
        });
    }

    // ===== Getters =====

    get fun streamInfo(): StreamInfo {
        return StreamInfo{
            sender: self.sender,
            recipient: self.recipient,
            deposit: self.deposit,
            ratePerSecond: self.ratePerSecond,
            startTime: self.startTime,
            stopTime: self.stopTime,
            withdrawn: self.withdrawn,
            jettonMaster: self.jettonMaster,
            active: self.active,
        };
    }

    get fun withdrawable(): Int {
        return self.computeWithdrawable();
    }

    get fun streamed(): Int {
        return self.computeStreamed();
    }

    get fun senderBalance(): Int {
        if (!self.active) { return 0; }
        return self.deposit - self.withdrawn - self.computeWithdrawable();
    }
}
```

### StreamFactory Contract

```tact
import "@stdlib/deploy";

message CreateStream {
    recipient: Address;
    startTime: Int as uint32;
    stopTime: Int as uint32;
    jettonMaster: Address;
}

struct StreamRecord {
    streamAddress: Address;
    sender: Address;
    recipient: Address;
    createdAt: Int as uint32;
}

contract StreamFactory with Deployable {
    nextStreamId: Int as uint64 = 0;
    streams: map<Int, StreamRecord>;

    init() {}

    receive(msg: CreateStream) {
        require(msg.stopTime > msg.startTime, "Invalid time range");
        require(msg.startTime >= now(), "Start must be in future");

        let streamId: Int = self.nextStreamId;
        self.nextStreamId += 1;

        // Compute the stream contract's Jetton wallet address
        // (would need off-chain computation or a helper)
        let streamInit = initOf PaymentStream(
            sender(),
            msg.recipient,
            msg.startTime,
            msg.stopTime,
            msg.jettonMaster,
            // myJettonWallet: computed off-chain and passed, or set later
        );

        let streamAddress = contractAddress(streamInit);

        // Deploy the stream contract
        send(SendParameters{
            to: streamAddress,
            value: ton("0.1"),
            code: streamInit.code,
            data: streamInit.data,
            body: null,
        });

        self.streams.set(streamId, StreamRecord{
            streamAddress: streamAddress,
            sender: sender(),
            recipient: msg.recipient,
            createdAt: now(),
        });
    }

    get fun streamCount(): Int {
        return self.nextStreamId;
    }

    get fun getStream(id: Int): StreamRecord? {
        return self.streams.get(id);
    }
}
```

---

## Contract Testing Strategy

```typescript
import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentStream } from '../wrappers/PaymentStream';

describe('PaymentStream', () => {
    let blockchain: Blockchain;
    let sender: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let stream: SandboxContract<PaymentStream>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        sender = await blockchain.treasury('sender');
        recipient = await blockchain.treasury('recipient');

        // Deploy stream: 1000 USDT over 1000 seconds = 1 USDT/sec
        const startTime = blockchain.now + 10;
        const stopTime = startTime + 1000;

        stream = blockchain.openContract(
            await PaymentStream.fromInit(
                sender.address,
                recipient.address,
                BigInt(startTime),
                BigInt(stopTime),
                jettonMasterAddress,
                streamJettonWalletAddress
            )
        );
    });

    it('should compute withdrawable correctly after 500 seconds', async () => {
        // Fund stream (simulate Jetton notification)
        // ... fund with 1000 USDT ...

        // Advance time by 500 seconds
        blockchain.now += 500 + 10; // +10 for startTime offset

        const withdrawable = await stream.getWithdrawable();
        expect(withdrawable).toBe(500_000_000n); // 500 USDT (6 decimals)
    });

    it('should allow partial withdrawal', async () => {
        blockchain.now += 300 + 10;

        const result = await stream.send(
            recipient.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Withdraw', amount: 200_000_000n } // withdraw 200 USDT
        );

        expect(result.transactions).toHaveTransaction({ success: true });

        // Remaining withdrawable should be 100 USDT
        const withdrawable = await stream.getWithdrawable();
        expect(withdrawable).toBe(100_000_000n);
    });

    it('should split pro-rata on cancel', async () => {
        blockchain.now += 600 + 10; // 60% elapsed

        const result = await stream.send(
            sender.getSender(),
            { value: toNano('0.1') },
            { $$type: 'Cancel' }
        );

        // Should send 600 USDT to recipient, 400 USDT to sender
        expect(result.transactions).toHaveTransaction({ success: true });
        // Verify Jetton transfer messages...
    });

    it('should reject withdrawal from non-recipient', async () => {
        blockchain.now += 100 + 10;

        const result = await stream.send(
            sender.getSender(), // wrong person!
            { value: toNano('0.05') },
            { $$type: 'Withdraw', amount: 50_000_000n }
        );

        expect(result.transactions).toHaveTransaction({ success: false });
    });

    it('should return 0 before start time', async () => {
        const withdrawable = await stream.getWithdrawable();
        expect(withdrawable).toBe(0n);
    });

    it('should cap at deposit after stop time', async () => {
        blockchain.now += 2000 + 10; // well past stopTime

        const withdrawable = await stream.getWithdrawable();
        expect(withdrawable).toBe(1000_000_000n); // full deposit
    });
});
```

---

## Mini App — Real-Time Streaming Counter

The killer feature: a smoothly animated counter showing USDT accumulating in real-time.

```tsx
// StreamingCounter.tsx
import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface StreamingCounterProps {
  ratePerSecond: number;  // e.g., 0.001157 USDT/sec for ~$100/day
  startTime: number;      // UNIX timestamp
  withdrawn: number;      // already claimed
  stopTime: number;
}

export function StreamingCounter({ ratePerSecond, startTime, withdrawn, stopTime }: StreamingCounterProps) {
  const [amount, setAmount] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const tick = () => {
      const now = Date.now() / 1000;
      const elapsed = Math.min(now - startTime, stopTime - startTime);
      const streamed = Math.max(0, ratePerSecond * elapsed - withdrawn);
      setAmount(streamed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ratePerSecond, startTime, withdrawn, stopTime]);

  const spring = useSpring(amount, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (v) => v.toFixed(6));

  useEffect(() => { spring.set(amount); }, [amount, spring]);

  // Progress bar
  const totalDuration = stopTime - startTime;
  const elapsed = Math.min(Date.now() / 1000 - startTime, totalDuration);
  const progress = (elapsed / totalDuration) * 100;

  return (
    <div className="stream-counter">
      <div className="amount" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <motion.span className="digits">{display}</motion.span>
        <span className="currency"> USDT</span>
      </div>
      <div className="progress-bar">
        <motion.div
          className="progress-fill"
          style={{ width: `${progress}%` }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>
      <div className="rate">
        {(ratePerSecond * 86400).toFixed(2)} USDT/day
      </div>
    </div>
  );
}
```

### Mini App Pages

**1. Create Stream Page**
```
┌─────────────────────────────────┐
│  ← Create Stream                │
│                                 │
│  Recipient                      │
│  ┌─────────────────────────┐   │
│  │ EQD...paste address...  │   │
│  └─────────────────────────┘   │
│                                 │
│  Total Amount                   │
│  ┌──────────┐                  │
│  │ 1000     │ USDT             │
│  └──────────┘                  │
│                                 │
│  Duration                       │
│  [7 days] [30 days] [Custom]   │
│                                 │
│  Summary:                       │
│  Rate: 1.388 USDT/hour         │
│  Start: Now                     │
│  End: April 8, 2026             │
│                                 │
│  ┌─────────────────────────┐   │
│  │    Create Stream  →      │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**2. Dashboard Page**
```
┌─────────────────────────────────┐
│  StreamPay           [wallet]   │
│                                 │
│  Incoming Streams               │
│  ┌─────────────────────────┐   │
│  │ From: EQD...abc         │   │
│  │ ▶ 456.789012 USDT      │   │ ← live counter
│  │ 30d remaining           │   │
│  │ [Withdraw]              │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ From: EQD...def         │   │
│  │ ▶ 12.345678 USDT       │   │ ← live counter
│  │ 5d remaining            │   │
│  │ [Withdraw]              │   │
│  └─────────────────────────┘   │
│                                 │
│  Outgoing Streams               │
│  ┌─────────────────────────┐   │
│  │ To: EQD...xyz           │   │
│  │ 750/1000 USDT streamed  │   │
│  │ [Cancel]                │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### TON Connect Integration for Transactions

```tsx
import { useTonConnectUI } from '@tonconnect/ui-react';
import { beginCell, toNano, Address } from '@ton/ton';

function useCreateStream() {
  const [tonConnectUI] = useTonConnectUI();

  const createStream = async (params: {
    factoryAddress: string;
    recipient: string;
    startTime: number;
    stopTime: number;
    usdtAmount: number;
    userJettonWallet: string;
    streamJettonWallet: string;
  }) => {
    // Step 1: Call factory to deploy stream contract
    const createStreamBody = beginCell()
      .storeUint(/* CreateStream opcode */, 32)
      .storeAddress(Address.parse(params.recipient))
      .storeUint(params.startTime, 32)
      .storeUint(params.stopTime, 32)
      .storeAddress(Address.parse(USDT_MASTER))
      .endCell();

    // Step 2: Fund the stream with USDT (Jetton transfer)
    const jettonTransferBody = beginCell()
      .storeUint(0xf8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(BigInt(params.usdtAmount * 1_000_000))
      .storeAddress(Address.parse(params.streamJettonWallet))
      .storeAddress(Address.parse(params.recipient)) // response
      .storeUint(0, 1)
      .storeCoins(toNano('0.05'))
      .storeUint(0, 1)
      .endCell();

    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [
        {
          address: params.factoryAddress,
          amount: toNano('0.15').toString(),
          payload: createStreamBody.toBoc().toString('base64'),
        },
        {
          address: params.userJettonWallet,
          amount: toNano('0.1').toString(),
          payload: jettonTransferBody.toBoc().toString('base64'),
        }
      ],
    });
  };

  return { createStream };
}
```

---

## Telegram Bot Commands

```typescript
import { Bot, CommandGroup } from 'grammy';

const bot = new Bot(process.env.BOT_TOKEN!);
const commands = new CommandGroup();

commands.command('createstream', 'Create a payment stream', async (ctx) => {
  // Usage: /createstream EQD...address 100 30d
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  if (args.length < 3) {
    return ctx.reply(
      '📊 Create a payment stream\n\n' +
      'Usage: `/createstream <address> <amount_USDT> <duration>`\n' +
      'Example: `/createstream EQD...abc 100 30d`\n\n' +
      'Durations: `1h`, `1d`, `7d`, `30d`, `90d`, `365d`',
      { parse_mode: 'Markdown' }
    );
  }

  const [recipient, amount, duration] = args;
  const params = encodeURIComponent(JSON.stringify({ recipient, amount, duration }));

  await ctx.reply(
    `Stream: ${amount} USDT → ${recipient.slice(0, 8)}...${recipient.slice(-4)}\n` +
    `Duration: ${duration}\n` +
    `Rate: ${(parseFloat(amount) / parseDurationSeconds(duration) * 86400).toFixed(4)} USDT/day`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Confirm & Sign',
          web_app: { url: `${MINI_APP_URL}/create?params=${params}` }
        }]]
      }
    }
  );
});

commands.command('mystreams', 'View your streams', async (ctx) => {
  await ctx.reply('View your active streams:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open Dashboard',
        web_app: { url: `${MINI_APP_URL}/dashboard` }
      }]]
    }
  });
});

commands.command('withdraw', 'Withdraw from a stream', async (ctx) => {
  const streamId = ctx.message?.text?.split(' ')[1];
  if (!streamId) return ctx.reply('Usage: `/withdraw <stream_address>`', { parse_mode: 'Markdown' });

  await ctx.reply('Withdraw available funds:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Withdraw Now',
        web_app: { url: `${MINI_APP_URL}/withdraw?stream=${streamId}` }
      }]]
    }
  });
});

commands.command('cancel', 'Cancel a stream', async (ctx) => {
  const streamId = ctx.message?.text?.split(' ')[1];
  if (!streamId) return ctx.reply('Usage: `/cancel <stream_address>`', { parse_mode: 'Markdown' });

  await ctx.reply('Cancel stream and split remaining funds pro-rata:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Confirm Cancel',
        web_app: { url: `${MINI_APP_URL}/cancel?stream=${streamId}` }
      }]]
    }
  });
});

bot.use(commands);
commands.setCommands(bot);
bot.start();
```

---

## Project Structure

```
streampay-ton/
├── contracts/                      # Tact smart contracts
│   ├── payment_stream.tact         # Individual stream contract
│   ├── stream_factory.tact         # Factory that deploys streams
│   └── tests/
│       ├── PaymentStream.spec.ts   # Unit tests with time manipulation
│       └── StreamFactory.spec.ts
├── wrappers/                       # Auto-generated TypeScript wrappers
│   ├── PaymentStream.ts
│   └── StreamFactory.ts
├── backend/                        # API + indexer
│   ├── src/
│   │   ├── server.ts              # Express API
│   │   ├── indexer.ts             # Polls TON for stream states
│   │   ├── ws.ts                  # WebSocket server for real-time updates
│   │   └── ton-client.ts         # TON API wrapper
│   └── package.json
├── mini-app/                       # Telegram Mini App
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Overview + wallet connect
│   │   │   ├── CreateStream.tsx   # Stream creation form
│   │   │   ├── Dashboard.tsx      # All streams list
│   │   │   └── StreamDetail.tsx   # Single stream with live counter
│   │   ├── components/
│   │   │   ├── StreamingCounter.tsx  # The real-time USDT counter
│   │   │   ├── StreamCard.tsx     # Stream summary card
│   │   │   ├── ProgressBar.tsx    # Visual stream progress
│   │   │   └── WalletButton.tsx
│   │   ├── hooks/
│   │   │   ├── useTonConnect.ts
│   │   │   ├── useStreams.ts      # Fetch user's streams
│   │   │   └── useStreamState.ts  # Real-time stream state
│   │   └── lib/
│   │       ├── contracts.ts       # Contract interaction helpers
│   │       └── constants.ts       # Addresses, ABIs
│   ├── public/
│   │   └── tonconnect-manifest.json
│   ├── package.json
│   └── vite.config.ts
├── bot/                            # Telegram Bot
│   ├── src/
│   │   └── bot.ts                 # grammY bot with stream commands
│   └── package.json
├── scripts/
│   ├── deploy-factory.ts          # Deploy factory to testnet
│   └── create-test-stream.ts     # Create a test stream
├── README.md
└── package.json                    # Monorepo root
```

---

## 36-Hour Implementation Timeline

### Hours 0-2: Setup
- [ ] Init monorepo, `npx blueprint create` for contracts
- [ ] Clone TMA React template
- [ ] Set up grammY bot skeleton
- [ ] Init backend with Express + ws

### Hours 2-10: Smart Contracts
- [ ] Implement PaymentStream in Tact (deposit, withdraw, cancel, getters)
- [ ] Implement StreamFactory in Tact
- [ ] Write comprehensive tests with time manipulation
- [ ] Test Jetton integration (mock USDT notifications)
- [ ] Deploy to TON testnet

### Hours 10-18: Mini App
- [ ] TON Connect integration
- [ ] StreamingCounter component with Framer Motion
- [ ] Create Stream page (form → TON Connect transaction)
- [ ] Dashboard page (list streams, live counters)
- [ ] Stream Detail page (withdraw, cancel)
- [ ] Mobile-optimized CSS for Telegram

### Hours 18-24: Bot + Backend
- [ ] Bot commands (/createstream, /mystreams, /withdraw, /cancel)
- [ ] Backend indexer (poll stream contract states)
- [ ] WebSocket for real-time Mini App updates
- [ ] Connect bot → Mini App via inline keyboards

### Hours 24-30: Integration & Polish
- [ ] End-to-end test: create stream via bot → fund → watch counter → withdraw
- [ ] Deploy Mini App to Vercel
- [ ] Deploy bot + backend
- [ ] UI animations and transitions
- [ ] Error handling and edge cases

### Hours 30-36: Demo & Pitch
- [ ] Record demo: create 100 USDT stream, watch counter, withdraw after 1 minute
- [ ] Prepare pitch deck (problem → solution → demo → market)
- [ ] Rehearse

---

## Pitch Outline (5 minutes)

1. **The Problem** (45s): Payments are discrete events. But many financial relationships are continuous: salaries, subscriptions, rent. On Ethereum, Sablier streams $3B+. On TON? Nothing.

2. **The Solution** (45s): StreamPay — real-time USDT streaming on TON via Telegram. Create a stream in 3 taps. Watch money flow second by second.

3. **Live Demo** (2 min): Create a stream in the Mini App. Show the counter ticking up. Withdraw. Cancel with pro-rata split. All on testnet.

4. **Use Cases & Market** (30s): Freelancer salaries (no more "payment coming soon"), creator subscriptions, token vesting, recurring B2B payments.

5. **Growth** (30s): Telegram-native distribution (share stream link in chat), open-source protocol (others build on it), fee model (0.1% on stream creation).

---

## Key Dependencies

```json
{
  "@ton/ton": "^15.x",
  "@ton/core": "^0.60.x",
  "@ton/sandbox": "^0.22.x",
  "@ton/blueprint": "^0.25.x",
  "@tact-lang/compiler": "^1.6.x",
  "@tonconnect/ui-react": "^2.x",
  "@tma.js/sdk": "^2.x",
  "grammy": "^1.x",
  "framer-motion": "^12.x",
  "react": "^19.x",
  "vite": "^6.x",
  "express": "^5.x",
  "ws": "^8.x"
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tact Jetton integration complexity | Use official tact-by-example Jetton code, test extensively in Sandbox |
| Testnet USDT unavailable | Deploy custom test Jetton with same interface |
| Stream contract gas costs | Pre-fund contracts with 0.5 TON for operations |
| Factory address computation | Pre-compute off-chain using `contractAddress(initOf ...)` |
| Time manipulation in demo | Use short streams (5 min) for visible real-time effect |
