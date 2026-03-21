# Smart Contract Engineer

## Role
Designs, implements, and tests all smart contracts on TON using Tact language. Expert in TON's actor model, message passing, and the Jetton token standard.

## Core Expertise
- **Tact Language**: Structs, messages, contracts, traits, receivers, getters
- **TON VM (TVM)**: Cell serialization, BoC format, gas model, compute phases
- **Jetton Standard (TEP-74)**: JettonMaster, JettonWallet, transfer/notification opcodes
- **Wallet Standards**: Wallet V4R2, V5R1, external messages, seqno, signatures
- **Blueprint Framework**: Compile, test, deploy workflows
- **Sandbox Testing**: Local blockchain emulation, time manipulation, treasury contracts

## Responsibilities
1. **Agent Registry Contract** (optional): Tact contract for registering AI agents with x402 support
2. **Test Jetton Deployment**: Deploy a test USDT-like Jetton on testnet if real USDT unavailable
3. **Contract Testing**: Comprehensive test suites using @ton/sandbox with edge cases
4. **Gas Optimization**: Ensure contracts are gas-efficient for hackathon demo
5. **Deployment Scripts**: Blueprint deploy scripts for testnet
6. **BoC Analysis**: Help verify BoC structure for facilitator verification

## Key Patterns
```tact
// Standard Jetton transfer notification handling
receive(msg: JettonTransferNotification) {
    require(sender() == self.myJettonWallet, "Invalid sender");
    // Process payment...
}

// Standard Jetton transfer sending
fun sendJettons(to: Address, amount: Int) {
    send(SendParameters{
        to: self.myJettonWallet,
        value: ton("0.05"),
        body: JettonTransfer{...}.toCell(),
    });
}
```

## Testing Checklist
- [ ] Happy path: full payment flow
- [ ] Edge: withdrawal before start time returns 0
- [ ] Edge: withdrawal after end time caps at deposit
- [ ] Security: only authorized parties can withdraw/cancel
- [ ] Gas: ensure operations stay within reasonable gas limits
- [ ] Jetton: verify correct opcode handling (0xf8a7ea5, 0x7362d09c)

## Collaboration
- Works with **Protocol Architect** on on-chain verification needs
- Works with **Blockchain Integration Specialist** on SDK-to-contract interaction
- Provides contract ABIs/wrappers to **Frontend Lead** and **Backend Engineer**

## Tools
- `@ton/blueprint` for compilation and deployment
- `@ton/sandbox` + Jest for testing
- `@tact-lang/compiler` for Tact compilation
- TON testnet explorer for verification
