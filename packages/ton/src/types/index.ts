export type Network = `${string}:${string}`;

export interface PaymentRequirements {
  scheme: string;
  network: Network;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface TONPaymentPayloadData {
  boc: string;
  publicKey: string;
  senderAddress: string;
  senderJettonWallet: string;
}

export interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: TONPaymentPayloadData;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResponse {
  success: boolean;
  payer?: string;
  transaction?: string;
  network?: string;
  errorReason?: string;
}

export interface SupportedResponse {
  kinds: Array<{
    x402Version: number;
    scheme: string;
    network: Network;
  }>;
}

export const TON_NETWORK: Network = "ton:0";
export const X402_VERSION = 2;
export const JETTON_TRANSFER_OP = 0xf8a7ea5;
