import {
  Address,
  beginCell,
  internal,
  toNano,
  SendMode,
} from "@ton/core";
import { WalletContractV5R1 } from "@ton/ton";
import {
  PaymentRequirements,
  PaymentPayload,
  X402_VERSION,
  JETTON_TRANSFER_OP,
} from "../../types/index.js";

/**
 * Create a signed x402 payment payload for TON.
 *
 * Builds a Jetton transfer transaction:
 *   External Message → Wallet V5R1 → Sender's Jetton Wallet → Recipient
 *
 * The BoC is fully signed and self-contained — the facilitator
 * only broadcasts it without modification.
 */
export async function createTONPaymentPayload(
  requirements: PaymentRequirements,
  secretKey: Buffer,
  publicKey: Buffer,
  walletSeqno: number,
  senderJettonWallet: string,
): Promise<PaymentPayload> {
  const wallet = WalletContractV5R1.create({
    publicKey,
    workchain: 0,
  });

  const senderAddress = wallet.address;
  const destination = Address.parse(requirements.payTo);
  const jettonWalletAddress = Address.parse(senderJettonWallet);

  // Build Jetton transfer body (TEP-74)
  const jettonTransferBody = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32) // op: transfer
    .storeUint(0, 64) // query_id
    .storeCoins(BigInt(requirements.amount)) // amount
    .storeAddress(destination) // destination (new owner)
    .storeAddress(senderAddress) // response_destination (refund excess)
    .storeBit(false) // no custom_payload
    .storeCoins(1n) // forward_ton_amount (minimal notification)
    .storeBit(false) // no forward_payload
    .endCell();

  // Build wallet transfer wrapping the Jetton transfer
  const transfer = wallet.createTransfer({
    seqno: walletSeqno,
    secretKey,
    messages: [
      internal({
        to: jettonWalletAddress,
        value: toNano("0.1"), // gas for Jetton transfer chain
        body: jettonTransferBody,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    timeout: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
  });

  const boc = transfer.toBoc().toString("base64");

  return {
    x402Version: X402_VERSION,
    accepted: requirements,
    payload: {
      boc,
      publicKey: publicKey.toString("hex"),
      senderAddress: senderAddress.toString(),
      senderJettonWallet,
    },
  };
}
