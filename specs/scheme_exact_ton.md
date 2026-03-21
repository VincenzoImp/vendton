# Scheme: `exact` on TON

## Summary

The `exact` scheme on TON executes a one-time Jetton (TEP-74) transfer using a pre-signed Bag of Cells (BoC). The client constructs, signs, and serializes the full transaction chain. The facilitator validates the payload and broadcasts the BoC to the TON network.

This approach mirrors the Solana x402 pattern: the client drives the transaction, the facilitator only broadcasts.

## Network Identifier

- **CAIP-2**: `ton:0` (TON basechain, workchain 0)

## Asset

- **USDT Jetton Master** (mainnet): `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- **Standard**: TEP-74 (Jettons)
- **Decimals**: 6

## Transaction Chain

```
External Message
  → Wallet V5R1 Contract (sender's wallet)
    → Sender's Jetton Wallet (USDT wallet)
      → Recipient's Jetton Wallet
```

The BoC encodes this entire chain as a single signed external message.

---

## Phase 1: PaymentRequirements (Server → Client)

The resource server returns HTTP `402` with an `X-PAYMENT-REQUIRED` header containing base64-encoded JSON:

```json
{
  "x402Version": 2,
  "accepts": [
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
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `scheme` | string | Always `"exact"` |
| `network` | string | Always `"ton:0"` |
| `amount` | string | Amount in smallest units (1 USDT = 1000000) |
| `asset` | string | Jetton master contract address (bounceable) |
| `payTo` | string | Recipient TON address (bounceable) |
| `maxTimeoutSeconds` | number | Maximum time for payment validity |
| `extra.name` | string | Token name for display |
| `extra.decimals` | number | Token decimals for display |

---

## Phase 2: PaymentPayload (Client → Server)

The client sends the `X-PAYMENT` header containing base64-encoded JSON:

```json
{
  "x402Version": 2,
  "accepted": {
    "scheme": "exact",
    "network": "ton:0",
    "amount": "1000000",
    "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    "payTo": "EQD__________server_address_______________",
    "maxTimeoutSeconds": 60,
    "extra": { "name": "USDT", "decimals": 6 }
  },
  "payload": {
    "boc": "<base64-encoded signed external message BoC>",
    "publicKey": "<hex-encoded Ed25519 public key (64 chars)>",
    "senderAddress": "<bounceable TON address of payer>",
    "senderJettonWallet": "<payer's USDT Jetton wallet address>"
  }
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `boc` | string | Base64-encoded Bag of Cells containing the signed external message |
| `publicKey` | string | Hex-encoded Ed25519 public key of the sender (32 bytes → 64 hex chars) |
| `senderAddress` | string | Sender's Wallet V5R1 address (derived from public key) |
| `senderJettonWallet` | string | Sender's Jetton wallet address for the payment asset |

### BoC Construction

```typescript
// 1. Build Jetton transfer body (TEP-74, opcode 0xf8a7ea5)
const body = beginCell()
  .storeUint(0xf8a7ea5, 32)     // op: transfer
  .storeUint(0, 64)              // query_id
  .storeCoins(amount)            // Jetton amount
  .storeAddress(payTo)           // destination (new owner)
  .storeAddress(sender)          // response_destination
  .storeBit(false)               // no custom_payload
  .storeCoins(1n)                // forward_ton_amount (minimal)
  .storeBit(false)               // no forward_payload
  .endCell();

// 2. Wrap in wallet transfer
const transfer = WalletV5R1.createTransfer({
  seqno,
  secretKey,
  messages: [internal({ to: senderJettonWallet, value: toNano("0.1"), body })],
  sendMode: 3,
  timeout: Math.floor(Date.now() / 1000) + maxTimeoutSeconds,
});

// 3. Serialize
const boc = transfer.toBoc().toString("base64");
```

---

## Phase 3: Verification Logic

The facilitator executes these checks in order:

1. **Decode BoC**: `Cell.fromBoc(Buffer.from(boc, "base64"))`
2. **Verify public key → address**: Derive `WalletContractV5R1.create({ publicKey, workchain: 0 })` and compare with `senderAddress`
3. **Verify Jetton wallet ownership**: Call `get_wallet_address(senderAddress)` on the Jetton master. Result must equal `senderJettonWallet`
4. **Check Jetton balance**: Call `get_wallet_data()` on `senderJettonWallet`. Balance must be ≥ `amount`
5. **Validate BoC structure**: Ensure the BoC parses as a valid external message

### Verification Response

```json
{
  "isValid": true,
  "payer": "EQD...sender_address..."
}
```

Or on failure:

```json
{
  "isValid": false,
  "invalidReason": "Insufficient USDT balance: has 500000, needs 1000000"
}
```

---

## Phase 4: Settlement Logic

1. **Verify** the payment (Phase 3)
2. **Broadcast**: `tonClient.sendFile(bocBuffer)` — submit the pre-signed BoC to the TON network
3. **Confirm**: Poll for transaction on the sender's address (30s timeout)
4. **Return** settlement result

### Settlement Response

```json
{
  "success": true,
  "payer": "EQD...sender_address...",
  "transaction": "abc123...hex_hash...",
  "network": "ton:0"
}
```

---

## Security Considerations

1. **Facilitator cannot alter payment**: The BoC is pre-signed by the client. The facilitator can only broadcast it — they cannot change the amount, destination, or any other field.

2. **Replay protection**: TON wallet seqno prevents replay attacks. Each external message increments the seqno, so the same BoC cannot be broadcast twice.

3. **Time bounds**: The wallet transfer includes a `timeout` field. After expiry, the BoC is rejected by the network.

4. **Balance check before broadcast**: The facilitator verifies the sender has sufficient Jetton balance before broadcasting, preventing wasted gas.

5. **Address verification**: Public key → Wallet V5R1 derivation ensures the claimed sender address matches the signing key.

---

## Differences from EVM Scheme

| Aspect | EVM (exact) | TON (exact) |
|--------|-------------|-------------|
| Signature | EIP-3009 / Permit2 | Ed25519 on external message |
| Transaction | Facilitator submits on-chain call | Facilitator broadcasts pre-signed BoC |
| Gas | Facilitator pays gas | Gas included in BoC (sender pays) |
| Token standard | ERC-20 | TEP-74 Jetton |
| Replay protection | Nonce in signature | Wallet seqno |
| Address derivation | Not needed (signature recovery) | Public key → Wallet V5R1 |
