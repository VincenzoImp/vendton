import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { TonClient } from "@ton/ton";
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
import { handleBuiltinService } from "./builtin-services.js";
import { resolveENSToTON, getENSAvatar, getENSDescription } from "./ens.js";
import type { RegistryEvent } from "./types.js";

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

const RegisterServiceSchema = z.object({
  name: z.string().min(1).max(100),
  endpoint: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  description: z.string().min(1).max(500),
  tags: z.array(z.string()).min(1).max(10),
  priceUSDT: z.string().regex(/^\d+$/),
  ownerAddress: z.string().min(1),
  ensName: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputExample: z.record(z.unknown()).optional(),
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

app.post("/api/services/register", (req: Request, res: Response) => {
  const parsed = RegisterServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const service = registry.register(parsed.data);
  broadcastEvent({ type: "service_registered", serviceId: service.id, serviceName: service.name, timestamp: Date.now() });
  console.log(`[registry] New service: ${service.name} (${service.id}) at ${service.priceReadable}`);
  res.status(201).json({ success: true, service });
});

app.get("/api/services", (req: Request, res: Response) => {
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

app.get("/api/services/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const service = registry.get(id) ?? registry.getBySlug(id);
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json({ service });
});

// === Proxy Route — the x402 gateway ===

app.all("/proxy/:serviceId", async (req: Request, res: Response) => {
  const serviceId = req.params.serviceId as string;
  const service = registry.get(serviceId) ?? registry.getBySlug(serviceId);
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const paymentHeader = req.headers["x-payment"] as string | undefined;

  // No payment → return 402
  if (!paymentHeader) {
    const requirements = {
      x402Version: X402_VERSION,
      accepts: [{
        scheme: "exact",
        network: TON_NETWORK,
        amount: service.priceUSDT,
        asset: config.usdtAssetAddress,
        payTo: service.ownerAddress,
        maxTimeoutSeconds: 60,
        extra: { name: "USDT", decimals: 6, serviceId: service.id, serviceName: service.name },
      }],
    };

    const encoded = Buffer.from(JSON.stringify(requirements), "utf-8").toString("base64");
    res.status(402).set("X-PAYMENT-REQUIRED", encoded).json({
      error: "Payment Required",
      message: `This service costs ${service.priceReadable}`,
      service: { id: service.id, name: service.name, price: service.priceReadable },
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
      amount: service.priceUSDT,
      asset: config.usdtAssetAddress,
      payTo: service.ownerAddress,
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
    registry.incrementCalls(service.id, service.priceUSDT);
    broadcastEvent({ type: "service_called", serviceId: service.id, serviceName: service.name, payer: result.payer, amount: service.priceUSDT, transaction: result.transaction, timestamp: Date.now() });

    // Handle built-in or external service
    if (service.endpoint === "__BUILTIN__") {
      const data = await handleBuiltinService(service.slug, req);
      res.json({ data, payment: { amount: service.priceReadable, transaction: result.transaction } });
    } else {
      // Forward to external endpoint
      try {
        const fetchOptions: RequestInit = { method: service.method, headers: { "Content-Type": "application/json" } };
        if (service.method === "POST" && req.body) fetchOptions.body = JSON.stringify(req.body);

        const url = new URL(service.endpoint);
        if (req.query) {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === "string") url.searchParams.set(key, value);
          }
        }

        const externalRes = await fetch(url.toString(), fetchOptions);
        const data = await externalRes.json().catch(() => externalRes.text());
        res.json({ data, payment: { amount: service.priceReadable, transaction: result.transaction } });
      } catch (error) {
        res.json({ error: "Service call failed", message: error instanceof Error ? error.message : String(error), payment: { amount: service.priceReadable, transaction: result.transaction } });
      }
    }
  } catch (err) {
    res.status(502).json({ error: "Payment processing error", message: err instanceof Error ? err.message : String(err) });
  }
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
    const [tonAddress, avatar, description] = await Promise.all([
      resolveENSToTON(ensName),
      getENSAvatar(ensName),
      getENSDescription(ensName),
    ]);

    // Find services registered under this ENS name
    const result = registry.search({ ensName });

    res.json({
      ensName,
      tonAddress,
      avatar,
      description,
      services: result.services,
    });
  } catch (error) {
    res.json({
      ensName,
      tonAddress: null,
      avatar: null,
      description: null,
      services: [],
      error: error instanceof Error ? error.message : "Resolution failed",
    });
  }
});

// === Health ===

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "mesh402-gateway",
    services: registry.getAll().length,
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
  console.log(`\nmesh402 gateway listening on port ${config.port}`);
  console.log(`TON RPC: ${config.tonRpcUrl}`);
  console.log(`WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/services/register    Register a new service`);
  console.log(`  GET  /api/services             Search & browse services`);
  console.log(`  GET  /api/services/:id          Get service details`);
  console.log(`  ALL  /proxy/:serviceId          Call service (x402 gated)`);
  console.log(`  POST /verify                    Verify payment`);
  console.log(`  POST /settle                    Settle payment`);
  console.log(`  GET  /supported                 Supported schemes`);
  console.log(`  GET  /health                    Health check\n`);
});
