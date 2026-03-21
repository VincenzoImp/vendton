import type { Request, Response, NextFunction } from "express";
import {
  PaymentRequirements,
  PaymentPayload,
  TON_NETWORK,
  X402_VERSION,
} from "../../types/index.js";

export interface PaymentMiddlewareConfig {
  network?: string;
  asset: string;
  amount: string;
  payTo: string;
  facilitatorUrl: string;
  maxTimeoutSeconds?: number;
  description?: string;
}

/**
 * Express middleware that gates an endpoint behind an x402 payment.
 *
 * Flow:
 * 1. Check for PAYMENT header
 * 2. If absent → respond 402 with payment requirements
 * 3. If present → forward to facilitator for verification + settlement
 * 4. If valid → call next()
 * 5. If invalid → respond 402 with error
 */
export function paymentMiddleware(config: PaymentMiddlewareConfig) {
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: (config.network ?? TON_NETWORK) as PaymentRequirements["network"],
    amount: config.amount,
    asset: config.asset,
    payTo: config.payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 60,
    extra: {
      name: "USDT",
      decimals: 6,
    },
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // No payment header → respond 402
    if (!paymentHeader) {
      const paymentRequired = {
        x402Version: X402_VERSION,
        accepts: [requirements],
        description: config.description ?? "Payment required",
      };

      res.status(402).setHeader(
        "X-PAYMENT-REQUIRED",
        Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      );

      res.json({
        error: "Payment Required",
        accepts: [requirements],
      });
      return;
    }

    // Payment header present → verify and settle via facilitator
    try {
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );

      // Call facilitator /settle endpoint
      const settleResponse = await fetch(
        `${config.facilitatorUrl}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: paymentPayload,
            requirements,
          }),
        },
      );

      const settleResult = await settleResponse.json();

      if (!settleResult.success) {
        res.status(402).json({
          error: "Payment Failed",
          reason: settleResult.errorReason,
          accepts: [requirements],
        });
        return;
      }

      // Payment successful — attach settlement info and continue
      (req as any).x402 = {
        payer: settleResult.payer,
        transaction: settleResult.transaction,
        network: settleResult.network,
      };

      next();
    } catch (error) {
      res.status(402).json({
        error: "Payment Processing Error",
        reason:
          error instanceof Error ? error.message : "Invalid payment payload",
        accepts: [requirements],
      });
    }
  };
}
