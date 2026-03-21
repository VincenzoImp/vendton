import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { Address, Cell, beginCell } from "@ton/core";
import { WalletContractV5R1 } from "@ton/ton";
import { z } from "zod";
import { config } from "./config.js";
import { tonClient } from "./ton-client.js";

// ---------------------------------------------------------------------------
// Types (mirrored from @x402/ton to avoid workspace import issues with tsx)
// ---------------------------------------------------------------------------

type Network = `${string}:${string}`;

interface PaymentRequirements {
  scheme: string;
  network: Network;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

interface TONPaymentPayloadData {
  boc: string;
  publicKey: string;
  senderAddress: string;
  senderJettonWallet: string;
}

interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: TONPaymentPayloadData;
}

interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

interface SettleResponse {
  success: boolean;
  payer?: string;
  transaction?: string;
  network?: string;
  errorReason?: string;
}

const TON_NETWORK: Network = "ton:0";
const X402_VERSION = 2;

// ---------------------------------------------------------------------------
// Request validation schemas
// ---------------------------------------------------------------------------

const PaymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  amount: z.string(),
  asset: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number(),
  extra: z.record(z.unknown()).optional().default({}),
});

const TONPaymentPayloadDataSchema = z.object({
  boc: z.string(),
  publicKey: z.string(),
  senderAddress: z.string(),
  senderJettonWallet: z.string(),
});

const PaymentPayloadSchema = z.object({
  x402Version: z.number(),
  accepted: PaymentRequirementsSchema,
  payload: TONPaymentPayloadDataSchema,
});

const VerifySettleBodySchema = z.object({
  payload: PaymentPayloadSchema,
  requirements: PaymentRequirementsSchema,
});

// ---------------------------------------------------------------------------
// Verify logic
// ---------------------------------------------------------------------------

async function verify(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  try {
    // 1. Decode BoC
    const bocBuffer = Buffer.from(payload.payload.boc, "base64");
    const cell = Cell.fromBoc(bocBuffer)[0];

    // 2. Verify public key -> address derivation (Wallet V5R1)
    const publicKey = Buffer.from(payload.payload.publicKey, "hex");
    const expectedWallet = WalletContractV5R1.create({
      publicKey,
      workchain: 0,
    });
    const expectedAddress = expectedWallet.address;
    const claimedAddress = Address.parse(payload.payload.senderAddress);

    if (!expectedAddress.equals(claimedAddress)) {
      return {
        isValid: false,
        invalidReason: "Sender address does not match public key",
      };
    }

    // 3. Validate BoC structure
    const slice = cell.beginParse();
    if (slice.remainingBits < 2) {
      return { isValid: false, invalidReason: "Invalid BoC structure" };
    }

    // 4. Check Jetton balance
    const jettonWalletAddress = Address.parse(
      payload.payload.senderJettonWallet,
    );
    try {
      const result = await tonClient.runMethod(
        jettonWalletAddress,
        "get_wallet_data",
      );
      const balance = result.stack.readBigNumber();
      if (balance < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: `Insufficient Jetton balance: has ${balance}, needs ${requirements.amount}`,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "Failed to query Jetton wallet balance",
      };
    }

    // 5. Verify the Jetton wallet belongs to the sender
    const jettonMaster = Address.parse(requirements.asset);
    try {
      const walletResult = await tonClient.runMethod(
        jettonMaster,
        "get_wallet_address",
        [
          {
            type: "slice",
            cell: beginCell().storeAddress(claimedAddress).endCell(),
          },
        ],
      );
      const derivedJettonWallet = walletResult.stack.readAddress();
      if (!derivedJettonWallet.equals(jettonWalletAddress)) {
        return {
          isValid: false,
          invalidReason: "Jetton wallet address mismatch",
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "Failed to verify Jetton wallet ownership",
      };
    }

    return {
      isValid: true,
      payer: payload.payload.senderAddress,
    };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Settle logic
// ---------------------------------------------------------------------------

async function waitForTransaction(
  address: Address,
  timeoutMs: number,
): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const txs = await tonClient.getTransactions(address, { limit: 5 });
      if (txs.length > 0) {
        const latest = txs[0];
        return latest.hash().toString("hex");
      }
    } catch {
      // Continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return null;
}

async function settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  // 1. Verify first
  const verification = await verify(payload, requirements);
  if (!verification.isValid) {
    return {
      success: false,
      errorReason: verification.invalidReason,
    };
  }

  // 2. Broadcast the pre-signed BoC
  const bocBuffer = Buffer.from(payload.payload.boc, "base64");
  try {
    await tonClient.sendFile(bocBuffer);
  } catch (error) {
    return {
      success: false,
      errorReason: `Broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 3. Wait for transaction confirmation
  const txHash = await waitForTransaction(
    Address.parse(payload.payload.senderAddress),
    30_000,
  );

  return {
    success: true,
    payer: payload.payload.senderAddress,
    transaction: txHash ?? "pending",
    network: TON_NETWORK,
  };
}

// ---------------------------------------------------------------------------
// Supported schemes
// ---------------------------------------------------------------------------

function supported() {
  return {
    kinds: [
      {
        x402Version: X402_VERSION,
        scheme: "exact",
        network: TON_NETWORK,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------

const app = express();
const startTime = Date.now();

// Middleware
app.use(
  cors({
    origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(","),
  }),
);
app.use(express.json());

// Routes
app.post("/verify", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues,
    });
    return;
  }

  const { payload, requirements } = parsed.data;
  const result = await verify(
    payload as PaymentPayload,
    requirements as PaymentRequirements,
  );

  console.log(
    `[verify] sender=${payload.payload.senderAddress} valid=${result.isValid}`,
  );
  res.json(result);
});

app.post("/settle", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues,
    });
    return;
  }

  const { payload, requirements } = parsed.data;
  const result = await settle(
    payload as PaymentPayload,
    requirements as PaymentRequirements,
  );

  console.log(
    `[settle] sender=${payload.payload.senderAddress} success=${result.success}`,
  );
  res.json(result);
});

app.get("/supported", (_req: Request, res: Response) => {
  res.json(supported());
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`x402-ton-facilitator listening on port ${config.port}`);
  console.log(`TON RPC: ${config.tonRpcUrl}`);
});
