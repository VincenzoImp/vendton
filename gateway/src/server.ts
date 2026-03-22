import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { TonClient } from "@ton/ton";
import { Address, beginCell } from "@ton/core";
import { z } from "zod";
import {
  verify as sdkVerify,
  settle as sdkSettle,
  TON_NETWORK,
  X402_VERSION,
  type PaymentPayload,
  type PaymentRequirements,
} from "@x402/ton";
import { config } from "./config.js";
import { registry } from "./registry.js";
import { executeDVM } from "./executor.js";
import { resolveENSToTON, getENSAvatar, getENSDescription } from "./ens.js";
import { createDVMSubname, deleteDVMSubname } from "./ens-writer.js";
// TON client
const tonClient = new TonClient({
  endpoint: config.tonRpcUrl,
  ...(config.tonApiKey ? { apiKey: config.tonApiKey } : {}),
});

// Zod schemas
const VerifySettleBodySchema = z.object({
  payload: z.object({
    x402Version: z.number(),
    accepted: z.object({
      scheme: z.string(),
      network: z.string(),
      amount: z.string(),
      asset: z.string(),
      payTo: z.string(),
      maxTimeoutSeconds: z.number(),
      extra: z.record(z.unknown()).optional().default({}),
    }),
    payload: z.object({
      boc: z.string(),
      publicKey: z.string(),
      senderAddress: z.string(),
      senderJettonWallet: z.string(),
    }),
  }),
  requirements: z.object({
    scheme: z.string(),
    network: z.string(),
    amount: z.string(),
    asset: z.string(),
    payTo: z.string(),
    maxTimeoutSeconds: z.number(),
    extra: z.record(z.unknown()).optional().default({}),
  }),
});

const RegisterDVMSchema = z.object({
  name: z.string().min(1).max(100),
  endpoint: z.string().optional(),
  code: z.string().optional(),
  method: z.enum(["GET", "POST"]),
  description: z.string().min(1).max(500),
  tags: z.array(z.string()).min(1).max(10),
  priceUSDT: z.string().regex(/^\d+$/),
  ownerAddress: z.string().min(1),
  ensName: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputExample: z.record(z.unknown()).optional(),
}).refine((data) => data.endpoint || data.code, {
  message: "Either 'endpoint' or 'code' must be provided",
});

// Verify and settle via SDK, with WebSocket broadcast on settlement
async function verify(payload: PaymentPayload, requirements: PaymentRequirements) {
  return sdkVerify(payload, requirements, tonClient);
}

async function settle(payload: PaymentPayload, requirements: PaymentRequirements) {
  const result = await sdkSettle(payload, requirements, tonClient);
  if (result.success) {
    broadcastEvent({
      type: "settlement",
      payer: result.payer,
      amount: requirements.amount,
      transaction: result.transaction,
      timestamp: Date.now(),
    });
  }
  return result;
}

// WebSocket
const wsClients = new Set<WebSocket>();

function broadcastEvent(event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

// Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
  ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
});

const startTime = Date.now();

app.use(cors({ origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(",") }));
app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  if (req.path !== "/health") console.log(`${req.method} ${req.path}`);
  next();
});

// === Registry Routes ===

app.post("/api/dvms/register", (req: Request, res: Response) => {
  const parsed = RegisterDVMSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const dvm = registry.register(parsed.data);
  broadcastEvent({ type: "dvm_registered", dvmId: dvm.id, dvmName: dvm.name, timestamp: Date.now() });
  console.log(`[registry] New DVM: ${dvm.name} (${dvm.id}) at ${dvm.priceReadable}`);
  res.status(201).json({ success: true, dvm });

  // Fire and forget — create real ENS subdomain on Sepolia without blocking the response
  const ensName = dvm.ensName;
  if (ensName && ensName.endsWith(".vendton.eth")) {
    const parts = ensName.split(".");
    // parts = ["weather", "eqawwaqaaz", "vendton", "eth"]
    const label = parts[0];
    const parentName = parts.slice(1).join(".");  // "eqawwaqaaz.vendton.eth"

    createDVMSubname({
      label,
      parentName,
      tonAddress: dvm.ownerAddress,
      description: dvm.description,
    }).then(result => {
      if (result.success) {
        console.log(`[ens] Subdomain registered on-chain: ${result.ensName}`);
        broadcastEvent({ type: "ens_registered", ensName: result.ensName, txHash: result.txHash, timestamp: Date.now() });
      } else {
        console.error(`[ens] Subdomain failed: ${result.error}`);
      }
    });
  }
});

app.get("/api/dvms", (req: Request, res: Response) => {
  const query = {
    q: req.query.q as string | undefined,
    tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
    maxPrice: req.query.maxPrice as string | undefined,
    owner: req.query.owner as string | undefined,
    sortBy: req.query.sortBy as "price" | "calls" | "created" | "revenue" | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = registry.search(query);
  res.json(result);
});

app.get("/api/dvms/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const dvm = registry.get(id) ?? registry.getBySlug(id);
  if (!dvm) {
    res.status(404).json({ error: "DVM not found" });
    return;
  }
  res.json({ dvm });
});

app.delete("/api/dvms/:id", async (req: Request, res: Response) => {
  const dvmId = req.params.id as string;
  const ownerAddress = req.headers["x-owner-address"] as string;

  if (!ownerAddress) {
    res.status(401).json({ error: "Missing X-OWNER-ADDRESS header" });
    return;
  }

  const dvm = registry.get(dvmId);
  if (!dvm) {
    res.status(404).json({ error: "DVM not found" });
    return;
  }

  const normalizedOwner = ownerAddress.replace(/^0:/, "").toLowerCase();
  const normalizedDvmOwner = dvm.ownerAddress.replace(/^0:/, "").toLowerCase();
  if (normalizedOwner !== normalizedDvmOwner) {
    res.status(403).json({ error: "Not the owner of this DVM" });
    return;
  }

  registry.remove(dvmId);

  // Delete ENS subdomain in background
  if (dvm.ensName && dvm.ensName.endsWith(".vendton.eth")) {
    deleteDVMSubname(dvm.ensName).then(result => {
      console.log(`[ens] Subdomain ${dvm.ensName}: ${result.success ? "deleted" : result.error}`);
    });
  }

  broadcastEvent({ type: "dvm_deleted", dvmId: dvm.id, dvmName: dvm.name, timestamp: Date.now() });
  res.json({ success: true, message: `DVM "${dvm.name}" deleted` });
});

// === Proxy Route — the x402 gateway ===

app.all("/dvm/:owner/:name", async (req: Request, res: Response) => {
  const { owner, name } = req.params as { owner: string; name: string };

  const dvm = registry.getByOwnerAndSlug(owner, name);
  if (!dvm) {
    res.status(404).json({ error: "DVM not found", owner, name });
    return;
  }

  // Check for TON Connect payment proof (transaction already on-chain)
  const paymentTxHash = req.headers["x-payment-tx"] as string | undefined;
  if (paymentTxHash) {
    console.log(`[proxy] TON Connect payment proof: ${paymentTxHash} for DVM ${dvm.name}`);

    // Increment stats
    registry.incrementCalls(dvm.id, dvm.priceUSDT);

    // Broadcast event
    broadcastEvent({
      type: "dvm_called",
      dvmId: dvm.id,
      dvmName: dvm.name,
      payer: "tonconnect",
      amount: dvm.priceUSDT,
      transaction: paymentTxHash,
      timestamp: Date.now(),
    });

    // Execute code-based DVM
    if (dvm.code) {
      const input = { ...req.query, ...(req.body || {}) };
      const execResult = await executeDVM(dvm.code, input as Record<string, unknown>);
      if (!execResult.success) {
        res.status(500).json({ error: "DVM execution failed", message: execResult.error });
        return;
      }
      res.json({
        data: execResult.data,
        dvm: { id: dvm.id, name: dvm.name },
        payment: { amount: dvm.priceReadable, transaction: paymentTxHash, method: "tonconnect" },
      });
      return;
    }

    // Forward to external endpoint
    if (dvm.endpoint) {
      const fetchOptions: RequestInit = { method: dvm.method, headers: { "Content-Type": "application/json" } };
      if (dvm.method === "POST" && req.body) fetchOptions.body = JSON.stringify(req.body);
      const url = new URL(dvm.endpoint);
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === "string") url.searchParams.set(key, value);
        }
      }
      const externalRes = await fetch(url.toString(), fetchOptions);
      const data = await externalRes.json().catch(() => externalRes.text());
      res.json({ data, payment: { amount: dvm.priceReadable, transaction: paymentTxHash, method: "tonconnect" } });
      return;
    }

    res.status(500).json({ error: "DVM has no code or endpoint" });
    return;
  }

  const paymentHeader = req.headers["x-payment"] as string | undefined;

  // No payment → return 402
  if (!paymentHeader) {
    // Derive the owner's Jetton wallet address (where USDT should be sent)
    let payToAddress = dvm.ownerAddress;
    try {
      const ownerAddr = Address.parse(dvm.ownerAddress);
      const jettonMaster = Address.parse(config.usdtAssetAddress);
      const result = await tonClient.runMethod(jettonMaster, "get_wallet_address", [
        { type: "slice", cell: beginCell().storeAddress(ownerAddr).endCell() },
      ]);
      payToAddress = result.stack.readAddress().toString();
      console.log(`[proxy] Jetton wallet for ${dvm.ownerAddress.slice(0,10)}...: ${payToAddress}`);
    } catch (err) {
      console.warn(`[proxy] Could not derive Jetton wallet, using owner address directly`);
    }

    const requirements = {
      x402Version: X402_VERSION,
      accepts: [{
        scheme: "exact",
        network: TON_NETWORK,
        amount: dvm.priceUSDT,
        asset: config.usdtAssetAddress,
        payTo: payToAddress,
        maxTimeoutSeconds: 60,
        extra: { name: "USDT", decimals: 6, dvmId: dvm.id, dvmName: dvm.name },
      }],
    };

    const encoded = Buffer.from(JSON.stringify(requirements), "utf-8").toString("base64");
    res.status(402).set("X-PAYMENT-REQUIRED", encoded).json({
      error: "Payment Required",
      message: `This DVM costs ${dvm.priceReadable}`,
      dvm: { id: dvm.id, name: dvm.name, price: dvm.priceReadable },
      requirements,
    });
    return;
  }

  // Payment present → settle
  try {
    const paymentPayload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: TON_NETWORK,
      amount: dvm.priceUSDT,
      asset: config.usdtAssetAddress,
      payTo: dvm.ownerAddress,
      maxTimeoutSeconds: 60,
      extra: { name: "USDT", decimals: 6 },
    };

    const result = await settle(paymentPayload, requirements);

    if (!result.success) {
      const encoded = Buffer.from(JSON.stringify({ x402Version: X402_VERSION, accepts: [requirements] }), "utf-8").toString("base64");
      res.status(402).set("X-PAYMENT-REQUIRED", encoded).json({
        error: "Payment settlement failed",
        reason: result.errorReason,
      });
      return;
    }

    // Payment succeeded — increment stats
    registry.incrementCalls(dvm.id, dvm.priceUSDT);
    broadcastEvent({ type: "dvm_called", dvmId: dvm.id, dvmName: dvm.name, payer: result.payer, amount: dvm.priceUSDT, transaction: result.transaction, timestamp: Date.now() });

    // Execute code-based DVM
    if (dvm.code) {
      const input = { ...req.query, ...(req.body || {}) };
      const execResult = await executeDVM(dvm.code, input as Record<string, unknown>);
      if (!execResult.success) {
        res.status(500).json({ error: "DVM execution failed", message: execResult.error, durationMs: execResult.durationMs });
        return;
      }
      res.json({ data: execResult.data, dvm: { id: dvm.id, name: dvm.name }, durationMs: execResult.durationMs, paidAmount: dvm.priceReadable, payment: { amount: dvm.priceReadable, transaction: result.transaction } });
      return;
    }

    // Forward to external endpoint
    if (dvm.endpoint) {
      try {
        const fetchOptions: RequestInit = { method: dvm.method, headers: { "Content-Type": "application/json" } };
        if (dvm.method === "POST" && req.body) fetchOptions.body = JSON.stringify(req.body);

        const url = new URL(dvm.endpoint);
        if (req.query) {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === "string") url.searchParams.set(key, value);
          }
        }

        const externalRes = await fetch(url.toString(), fetchOptions);
        const data = await externalRes.json().catch(() => externalRes.text());
        res.json({ data, payment: { amount: dvm.priceReadable, transaction: result.transaction } });
      } catch (error) {
        res.json({ error: "DVM call failed", message: error instanceof Error ? error.message : String(error), payment: { amount: dvm.priceReadable, transaction: result.transaction } });
      }
      return;
    }

    res.status(500).json({ error: "DVM has no code or endpoint configured" });
  } catch (err) {
    res.status(502).json({ error: "Payment processing error", message: err instanceof Error ? err.message : String(err) });
  }
});

// === Legacy proxy route (fallback for agent compatibility) ===

app.all("/proxy/:dvmId", async (req: Request, res: Response) => {
  const dvmId = req.params.dvmId as string;
  const dvm = registry.get(dvmId) ?? registry.getBySlug(dvmId);
  if (!dvm) {
    res.status(404).json({ error: "DVM not found" });
    return;
  }

  // Redirect to the canonical /dvm/:owner/:name route
  const ownerShort = dvm.ownerAddress.replace(/^0:/, "").slice(0, 8).toLowerCase();
  const newPath = `/dvm/${ownerShort}/${dvm.slug}`;
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, newPath + qs);
});

// === Facilitator Routes ===

app.post("/verify", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const result = await verify(parsed.data.payload as unknown as PaymentPayload, parsed.data.requirements as unknown as PaymentRequirements);
  res.json(result);
});

app.post("/settle", async (req: Request, res: Response) => {
  const parsed = VerifySettleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const result = await settle(parsed.data.payload as unknown as PaymentPayload, parsed.data.requirements as unknown as PaymentRequirements);
  res.json(result);
});

app.get("/supported", (_req: Request, res: Response) => {
  res.json({ kinds: [{ x402Version: X402_VERSION, scheme: "exact", network: TON_NETWORK }] });
});

// === ENS Resolution ===

app.get("/api/ens/resolve/:name", async (req: Request, res: Response) => {
  const ensName = req.params.name as string;
  try {
    // Try local resolution first (DVMs registered on this gateway)
    const localDVMs = registry.search({ ensName });
    if (localDVMs.dvms.length > 0) {
      const dvm = localDVMs.dvms[0];
      return res.json({
        ensName,
        tonAddress: dvm.ownerAddress,
        dvm: { id: dvm.id, name: dvm.name, price: dvm.priceReadable, description: dvm.description },
        source: "vendton-registry",
      });
    }

    // Fall back to on-chain Sepolia resolution
    const [tonAddress, avatar, description] = await Promise.all([
      resolveENSToTON(ensName),
      getENSAvatar(ensName),
      getENSDescription(ensName),
    ]);

    res.json({
      ensName,
      tonAddress,
      avatar,
      description,
      dvms: [],
      source: "ens-sepolia",
    });
  } catch (error) {
    res.json({
      ensName,
      tonAddress: null,
      avatar: null,
      description: null,
      dvms: [],
      error: error instanceof Error ? error.message : "Resolution failed",
    });
  }
});

// === Health ===

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    name: "vendton-gateway",
    dvms: registry.getAll().length,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    wsClients: wsClients.size,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// Seed and start
registry.seed();

server.listen(config.port, () => {
  console.log(`\nVendTON gateway listening on port ${config.port}`);
  console.log(`TON RPC: ${config.tonRpcUrl}`);
  console.log(`WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/dvms/register          Register a new DVM`);
  console.log(`  GET  /api/dvms                   Search & browse DVMs`);
  console.log(`  GET  /api/dvms/:id               Get DVM details`);
  console.log(`  ALL  /dvm/:owner/:name            Call DVM (x402 gated)`);
  console.log(`  ALL  /proxy/:dvmId               Legacy proxy (redirects)`);
  console.log(`  POST /verify                    Verify payment`);
  console.log(`  POST /settle                    Settle payment`);
  console.log(`  GET  /supported                 Supported schemes`);
  console.log(`  GET  /health                    Health check\n`);
});
