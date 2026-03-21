import {
  Address,
  beginCell,
  internal,
  toNano,
  SendMode,
} from "@ton/core";
import { WalletContractV5R1, TonClient } from "@ton/ton";
import nacl from "tweetnacl";
import {
  getWalletSeqno,
  getJettonWalletAddress,
  type AgentWallet,
} from "./wallet.js";

const JETTON_TRANSFER_OP = 0xf8a7ea5;

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

interface X402Response {
  x402Version: number;
  accepts: PaymentRequirements[];
  description?: string;
}

export interface PaymentEvent {
  type: "payment";
  service: string;
  amount: string;
  recipient: string;
  timestamp: number;
}

/**
 * Make an HTTP request that handles x402 payments automatically.
 *
 * 1. Send initial request
 * 2. If 402 → parse requirements, sign payment, retry
 * 3. Return the final response data
 */
export async function makePayableRequest(
  url: string,
  method: string,
  body: string | undefined,
  agentWallet: AgentWallet,
  tonClient: TonClient,
  onPayment?: (event: PaymentEvent) => void,
): Promise<{ status: number; data: unknown }> {
  // Initial request
  const initialRes = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });

  // Not a 402 — return directly
  if (initialRes.status !== 402) {
    const data = await initialRes.json().catch(() => initialRes.text());
    return { status: initialRes.status, data };
  }

  // Parse 402 response
  const paymentRequiredHeader = initialRes.headers.get("x-payment-required");
  let requirements: PaymentRequirements;

  if (paymentRequiredHeader) {
    const decoded: X402Response = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"),
    );
    requirements = decoded.accepts[0];
  } else {
    const errorBody = await initialRes.json();
    requirements = errorBody.accepts?.[0];
  }

  if (!requirements) {
    throw new Error("Could not parse payment requirements from 402 response");
  }

  // Create payment
  const seqno = await getWalletSeqno(tonClient, agentWallet.wallet);
  const jettonMaster = Address.parse(requirements.asset);
  const senderJettonWallet = await getJettonWalletAddress(
    tonClient,
    agentWallet.address,
    jettonMaster,
  );

  const destination = Address.parse(requirements.payTo);

  // Build Jetton transfer body
  const jettonTransferBody = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32)
    .storeUint(0, 64)
    .storeCoins(BigInt(requirements.amount))
    .storeAddress(destination)
    .storeAddress(agentWallet.address)
    .storeBit(false)
    .storeCoins(1n)
    .storeBit(false)
    .endCell();

  // Build wallet transfer
  const transfer = agentWallet.wallet.createTransfer({
    seqno,
    secretKey: Buffer.from(agentWallet.keypair.secretKey),
    messages: [
      internal({
        to: senderJettonWallet,
        value: toNano("0.1"),
        body: jettonTransferBody,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    timeout: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
  });

  const boc = transfer.toBoc().toString("base64");

  const paymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: {
      boc,
      publicKey: Buffer.from(agentWallet.keypair.publicKey).toString("hex"),
      senderAddress: agentWallet.address.toString(),
      senderJettonWallet: senderJettonWallet.toString(),
    },
  };

  // Emit payment event
  onPayment?.({
    type: "payment",
    service: url,
    amount: requirements.amount,
    recipient: requirements.payTo,
    timestamp: Date.now(),
  });

  // Retry with payment
  const paidRes = await fetch(url, {
    method,
    headers: {
      "X-PAYMENT": Buffer.from(JSON.stringify(paymentPayload)).toString(
        "base64",
      ),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });

  const data = await paidRes.json().catch(() => paidRes.text());
  return { status: paidRes.status, data };
}
