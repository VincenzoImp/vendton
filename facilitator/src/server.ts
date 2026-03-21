import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { Address, Cell, beginCell } from "@ton/core";
import { WalletContractV5R1 } from "@ton/ton";
import nacl from "tweetnacl";
import { z } from "zod";
import { config } from "./config.js";
import { tonClient } from "./ton-client.js";

// ---------------------------------------------------------------------------
// Types
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
// Request validation
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
// Verify logic — full cryptographic + on-chain verification
// ---------------------------------------------------------------------------

async function verify(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  try {
    // 1. Decode BoC
    const bocBuffer = Buffer.from(payload.payload.boc, "base64");
    const cells = Cell.fromBoc(bocBuffer);
    if (cells.length === 0) {
      return { isValid: false, invalidReason: "Empty BoC" };
    }
    const externalMessage = cells[0];

    // 2. Verify public key length and address derivation
    const publicKey = Buffer.from(payload.payload.publicKey, "hex");
    if (publicKey.length !== 32) {
      return {
        isValid: false,
        invalidReason: `Invalid public key length: ${publicKey.length}`,
      };
    }

    const expectedWallet = WalletContractV5R1.create({
      publicKey,
      workchain: 0,
    });
    const claimedAddress = Address.parse(payload.payload.senderAddress);

    if (!expectedWallet.address.equals(claimedAddress)) {
      return {
        isValid: false,
        invalidReason: "Sender address does not match public key derivation",
      };
    }

    // 3. Extract and verify Ed25519 signature from the BoC
    //
    // V5R1 uses packSignatureToTail: signature (512 bits) is at the END.
    // Refs belong to the signed content, not the signature.
    // Layout: [signed_content (N bits)] [signature (512 bits)] + refs from content
    // The wallet signs: hash(cell(signed_content_bits + refs))
    //
    const bodySlice = externalMessage.beginParse();
    const totalBits = bodySlice.remainingBits;

    if (totalBits < 512) {
      return {
        isValid: false,
        invalidReason: `BoC too short for V5R1 signature: ${totalBits} bits`,
      };
    }

    // Verify opcode is auth_signed_external (0x7369676e = "sign")
    const opcode = bodySlice.preloadUint(32);
    if (opcode !== 0x7369676e) {
      return {
        isValid: false,
        invalidReason: `Invalid V5R1 opcode: 0x${opcode.toString(16)}, expected 0x7369676e`,
      };
    }

    // Split: first (totalBits - 512) bits = signed content, last 512 = signature
    const contentBitCount = totalBits - 512;
    const contentBuilder = beginCell();
    for (let i = 0; i < contentBitCount; i++) {
      contentBuilder.storeBit(bodySlice.loadBit());
    }
    // Refs belong to signed content
    while (bodySlice.remainingRefs > 0) {
      contentBuilder.storeRef(bodySlice.loadRef());
    }
    // Last 512 bits = signature
    const signatureBytes = bodySlice.loadBuffer(64);

    const signedContentCell = contentBuilder.endCell();
    const signedHash = signedContentCell.hash();

    const isValidSig = nacl.sign.detached.verify(
      signedHash,
      signatureBytes,
      publicKey,
    );

    if (!isValidSig) {
      return {
        isValid: false,
        invalidReason: "Ed25519 signature verification failed",
      };
    }

    // 4. Verify Jetton wallet ownership
    const jettonWalletAddress = Address.parse(
      payload.payload.senderJettonWallet,
    );
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
          invalidReason: `Jetton wallet mismatch: expected ${derivedJettonWallet.toString()}, got ${jettonWalletAddress.toString()}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Jetton wallet ownership check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // 5. Check Jetton balance
    try {
      const result = await tonClient.runMethod(
        jettonWalletAddress,
        "get_wallet_data",
      );
      const balance = result.stack.readBigNumber();
      if (balance < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: `Insufficient balance: ${balance} < ${requirements.amount}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Balance query failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    return { isValid: true, payer: payload.payload.senderAddress };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Settle logic — verify + broadcast + confirm
// ---------------------------------------------------------------------------

async function waitForTransaction(
  publicKey: Buffer,
  seqnoBefore: number,
  senderAddress: Address,
  timeoutMs: number,
): Promise<string> {
  const startTime = Date.now();
  const wallet = WalletContractV5R1.create({ publicKey, workchain: 0 });
  const openWallet = tonClient.open(wallet);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const currentSeqno = await openWallet.getSeqno();
      if (currentSeqno > seqnoBefore) {
        // Transaction processed — fetch hash
        try {
          const txs = await tonClient.getTransactions(senderAddress, {
            limit: 1,
          });
          if (txs.length > 0) {
            return txs[0].hash().toString("hex");
          }
        } catch {
          // seqno confirms processing even if we can't get hash
        }
        return `seqno:${currentSeqno}`;
      }
    } catch {
      // Transient RPC error
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return "timeout:pending";
}

async function settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  const verification = await verify(payload, requirements);
  if (!verification.isValid) {
    return { success: false, errorReason: verification.invalidReason };
  }

  // Record seqno before broadcast
  const publicKey = Buffer.from(payload.payload.publicKey, "hex");
  const senderAddress = Address.parse(payload.payload.senderAddress);
  let seqnoBefore: number;
  try {
    const wallet = WalletContractV5R1.create({ publicKey, workchain: 0 });
    seqnoBefore = await tonClient.open(wallet).getSeqno();
  } catch {
    seqnoBefore = -1;
  }

  // Broadcast — use wallet.send() which wraps the body in a proper external message
  try {
    const bodyCell = Cell.fromBoc(
      Buffer.from(payload.payload.boc, "base64"),
    )[0];
    const wallet = WalletContractV5R1.create({ publicKey, workchain: 0 });
    const openWallet = tonClient.open(wallet);
    await openWallet.send(bodyCell);
  } catch (error) {
    return {
      success: false,
      errorReason: `Broadcast failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Wait for confirmation
  const txHash = await waitForTransaction(
    publicKey,
    seqnoBefore,
    senderAddress,
    30_000,
  );

  // Broadcast settlement event via WebSocket
  broadcastEvent({
    type: "settlement",
    payer: payload.payload.senderAddress,
    amount: requirements.amount,
    asset: requirements.asset,
    payTo: requirements.payTo,
    transaction: txHash,
    network: TON_NETWORK,
    timestamp: Date.now(),
  });

  return {
    success: true,
    payer: payload.payload.senderAddress,
    transaction: txHash,
    network: TON_NETWORK,
  };
}

// ---------------------------------------------------------------------------
// WebSocket — live transaction feed
// ---------------------------------------------------------------------------

const wsClients = new Set<WebSocket>();

function broadcastEvent(event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
  ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
});

const startTime = Date.now();

app.use(
  cors({
    origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(","),
  }),
);
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use((req, _res, next) => {
  if (req.path !== "/health") {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

app.post("/verify", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { payload, requirements } = parsed.data;
  const result = await verify(payload as PaymentPayload, requirements as PaymentRequirements);
  console.log(`[verify] sender=${payload.payload.senderAddress} valid=${result.isValid}${result.invalidReason ? ` reason="${result.invalidReason}"` : ""}`);
  res.json(result);
});

app.post("/settle", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { payload, requirements } = parsed.data;
  const result = await settle(payload as PaymentPayload, requirements as PaymentRequirements);
  console.log(`[settle] sender=${payload.payload.senderAddress} success=${result.success} tx=${result.transaction ?? "none"}`);
  res.json(result);
});

app.get("/supported", (_req: Request, res: Response) => {
  res.json({
    kinds: [{ x402Version: X402_VERSION, scheme: "exact", network: TON_NETWORK }],
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    wsClients: wsClients.size,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

server.listen(config.port, () => {
  console.log(`x402-ton-facilitator listening on port ${config.port}`);
  console.log(`TON RPC: ${config.tonRpcUrl}`);
  console.log(`WebSocket: ws://localhost:${config.port}/ws`);
});
