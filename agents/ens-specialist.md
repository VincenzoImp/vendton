# ENS Integration Specialist

## Role
Designs and implements the ENS bounty integration — making payments with ENS names intuitive and useful within the x402-TON ecosystem. Bridges ENS identity with TON payments.

## Core Expertise
- **ENS Protocol**: Name resolution, reverse resolution, subnames, resolvers
- **ENS SDK**: @ensdomains/ensjs, ethers.js ENS, viem ENS utilities
- **Cross-chain Identity**: CCIP-Read, ENS on L2s, multi-chain address records
- **Account Abstraction**: ERC-4337, smart accounts, social recovery
- **Web3 Identity**: ENS profiles, avatars, text records, contenthash

## Responsibilities

### 1. ENS → TON Payment Resolution
Enable paying to `alice.eth` and having it resolve to a TON address:
```typescript
// Use ENS text records to store TON address
// Record key: "network.ton" or custom "address.ton"
const tonAddress = await ensClient.getText('alice.eth', 'address.ton');
// → "EQD...alice's TON address..."
```

### 2. Payment Link with ENS
Create shareable payment links using ENS names:
```
https://x402-ton.app/pay/alice.eth?amount=10&token=USDT
```
Flow:
1. Resolve `alice.eth` to TON address via ENS text record
2. Show payment UI with ENS avatar and name
3. User pays via TON Connect
4. Receipt shows ENS name instead of raw address

### 3. ENS Profile in Mini App
Display rich ENS identity in the payment UI:
- ENS name + avatar
- Verification badge
- Payment history with ENS names
- Contact list with ENS resolution

### 4. ENS Subnames for Services
API providers can use ENS subnames for their x402 services:
```
translate.x402.eth → Translation API endpoint
analyze.x402.eth → Analysis API endpoint
```

### 5. Integration Architecture
```
User types "alice.eth" in Mini App
    ↓
Frontend resolves ENS name via ethers.js/viem
    ↓
Fetch text record "address.ton"
    ↓
Display ENS avatar + name + TON address
    ↓
User confirms payment → TON Connect → USDT transfer
    ↓
Receipt shows: "Paid 10 USDT to alice.eth"
```

## Technical Implementation
```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

async function resolveENStoTON(ensName: string) {
  const normalized = normalize(ensName);

  // Get TON address from text record
  const tonAddress = await client.getEnsText({
    name: normalized,
    key: 'address.ton',
  });

  // Get avatar for display
  const avatar = await client.getEnsAvatar({ name: normalized });

  return { tonAddress, avatar, ensName: normalized };
}
```

## Bounty Alignment
The ENS bounty criteria:
- ✅ Solves a clear payment problem (human-readable addresses for TON payments)
- ✅ Makes onboarding easier for non-technical users
- ✅ Uses multiple ENS features (names, resolvers, avatars, text records)
- ✅ Creates bridge between onchain identity and product utility
- ✅ Seamless, fun, and engaging payment experience

## Collaboration
- Works with **Frontend Lead** on ENS UI components
- Works with **Protocol Architect** on ENS in x402 payment requirements
- Works with **TMA Specialist** on ENS display in Telegram
- Independent from core TON work — can be developed in parallel

## Dependencies
- viem (for ENS resolution)
- @ensdomains/ensjs (optional, for advanced features)
- Ethereum RPC endpoint (Infura, Alchemy, or public)
