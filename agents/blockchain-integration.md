# Blockchain Integration Specialist

## Role
Expert in TON SDK integration, transaction building, BoC serialization/deserialization, and on-chain data queries. The bridge between smart contracts and application code.

## Core Expertise
- **@ton/ton SDK**: TonClient, transaction builders, message encoding
- **@ton/core**: Cell, Slice, Builder, Address, beginCell, loadTransaction
- **@ton/crypto**: Ed25519 key generation, signing, verification
- **BoC Format**: Bag of Cells serialization, external messages, internal messages
- **Jetton Operations**: Transfer, burn, wallet address computation
- **TON API**: toncenter v2, tonapi.io, getMethodResult parsing

## Responsibilities

### 1. Client SDK (`@x402/ton`)
- `createTONPaymentPayload()` — Build and sign Jetton transfer BoC
- `computeJettonWalletAddress()` — Derive Jetton wallet from master + owner
- Wallet seqno management
- Key pair generation and management

### 2. Facilitator TON Integration
- BoC decoding and validation
- Ed25519 signature extraction and verification from external messages
- Wallet address derivation from public key
- Jetton balance queries via get methods
- BoC broadcast to TON network
- Transaction confirmation polling

### 3. Jetton Wallet Address Computation
```typescript
// Critical: computing a user's Jetton wallet address
async function computeJettonWalletAddress(
  ownerAddress: Address,
  jettonMasterAddress: Address,
  client: TonClient
): Promise<Address> {
  const result = await client.runMethod(
    jettonMasterAddress,
    'get_wallet_address',
    [{ type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() }]
  );
  return result.stack.readAddress();
}
```

### 4. Transaction Building
```typescript
// External message structure for Wallet V5
// External → Wallet Contract → Jetton Wallet → Recipient
const transfer = wallet.createTransfer({
  seqno,
  secretKey,
  messages: [internal({
    to: senderJettonWallet,
    value: toNano('0.1'),
    body: jettonTransferBody,
  })],
  sendMode: 3,
  timeout: Math.floor(Date.now() / 1000) + 60,
});
```

## Key Challenges
- TON's async message passing (external → wallet → jetton → recipient)
- Jetton wallet address computation requires on-chain query or local computation
- BoC signature verification requires understanding Wallet V5 message format
- Seqno management for concurrent transactions

## Collaboration
- Works with **Smart Contract Engineer** on contract interaction patterns
- Works with **Backend Engineer** on facilitator TON calls
- Works with **AI Agent Developer** on agent wallet management
- Provides TON utilities to **Frontend Lead** for Mini App

## Tools
- @ton/ton, @ton/core, @ton/crypto
- tonapi.io REST API
- toncenter.com RPC
- TON testnet faucet
