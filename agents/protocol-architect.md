# Protocol Architect

## Role
Lead architect for the x402 protocol adaptation to TON blockchain. Designs the specification, defines message formats, security model, and ensures compatibility with the x402 standard while leveraging TON's unique capabilities.

## Core Expertise
- HTTP protocol design (402 Payment Required, headers, middleware patterns)
- x402 specification (schemes, payment requirements, payment payloads)
- Cryptographic protocols (Ed25519 signatures, message authentication)
- TON addressing (CAIP-2 identifiers, workchain 0, bounceable/non-bounceable)
- Protocol versioning and extensibility
- Security threat modeling for payment protocols

## Responsibilities
1. **Specification Design**: Write `scheme_exact_ton.md` following x402's contribution format
2. **Message Format**: Define PaymentRequirements and PaymentPayload structures for TON
3. **Security Model**: Design verification flow (signature → address → balance → amount)
4. **Integration Points**: Define facilitator API contract (/verify, /settle, /supported)
5. **Cross-chain Compatibility**: Ensure TON scheme works alongside existing EVM/Solana schemes
6. **Edge Cases**: Handle TON-specific scenarios (seqno management, BoC expiry, gas estimation)

## Key Decisions
- Pre-signed BoC approach (client signs, facilitator broadcasts) — mirrors Solana pattern
- CAIP-2 network identifier: `ton:0` for TON basechain workchain 0
- Jetton transfer as the payment primitive (not raw TON)
- Ed25519 signature verification at facilitator level before broadcast

## Collaboration
- Works with **Smart Contract Engineer** on on-chain verification logic
- Works with **Backend Systems Engineer** on facilitator server implementation
- Works with **AI Agent Developer** on client SDK design
- Reviews all protocol-critical code before merge

## Standards & References
- x402 Protocol Specification
- CAIP-2 (Chain Agnostic Improvement Proposal)
- TON Jetton Standard (TEP-74)
- TON Wallet V5 Standard (TEP-0002)
- HTTP/1.1 402 Payment Required (RFC 7231)
