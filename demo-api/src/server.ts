import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { weatherHandler } from "./routes/weather.js";
import { jokeHandler } from "./routes/joke.js";
import { translateHandler } from "./routes/translate.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3002", 10);
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "http://localhost:3001";
const USDT_ASSET_ADDRESS =
  process.env.USDT_ASSET_ADDRESS ||
  "EQAAYQf_d4ekMhxzZ-DQeKXK_KMFwdmK7SvFRxNlkHhN0VBi"; // Testnet USDT
const PAY_TO_ADDRESS =
  process.env.PAY_TO_ADDRESS ||
  "EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD";

// ---------------------------------------------------------------------------
// Service catalog — single source of truth for endpoints & pricing
// ---------------------------------------------------------------------------

interface ServiceEntry {
  path: string;
  method: string;
  description: string;
  cost: number;
  costReadable: string;
  parameters?: Record<string, string>;
}

const services: ServiceEntry[] = [
  {
    path: "/api/weather",
    method: "GET",
    description:
      "Current weather data for a given city (London, Tokyo, New York, Paris, Sydney, Zurich)",
    cost: 100_000,
    costReadable: "0.1 USDT",
    parameters: { city: "City name (query param, default: london)" },
  },
  {
    path: "/api/joke",
    method: "GET",
    description: "A random programming / crypto joke",
    cost: 50_000,
    costReadable: "0.05 USDT",
  },
  {
    path: "/api/translate",
    method: "POST",
    description:
      "Translate text into French, German, Spanish, or Japanese",
    cost: 500_000,
    costReadable: "0.5 USDT",
    parameters: {
      text: "Text to translate (body)",
      targetLanguage: "Target language code: fr | de | es | ja (body)",
    },
  },
];

// Quick lookup: path -> cost
const costByPath: Record<string, number> = {};
for (const svc of services) {
  costByPath[svc.path] = svc.cost;
}

// ---------------------------------------------------------------------------
// x402 payment middleware (inline implementation)
// ---------------------------------------------------------------------------

function buildPaymentRequirements(amount: number) {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "ton:0",
        amount: String(amount),
        asset: USDT_ASSET_ADDRESS,
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USDT",
          decimals: 6,
          facilitatorUrl: FACILITATOR_URL,
        },
      },
    ],
  };
}

function paymentRequired(amount: number): express.RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // ----- No payment header → 402 with requirements -----
    if (!paymentHeader) {
      const requirements = buildPaymentRequirements(amount);
      const encoded = Buffer.from(
        JSON.stringify(requirements),
        "utf-8",
      ).toString("base64");

      res.status(402).set("X-PAYMENT-REQUIRED", encoded).json({
        error: "Payment Required",
        message:
          "This endpoint requires payment via the x402 protocol. See the X-PAYMENT-REQUIRED header for details.",
        requirements,
      });
      return;
    }

    // ----- Payment header present → settle via facilitator -----
    try {
      const paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );
      const reqs = buildPaymentRequirements(amount);

      const settleUrl = `${FACILITATOR_URL}/settle`;
      const settleResponse = await fetch(settleUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: paymentPayload,
          requirements: reqs.accepts[0],
        }),
      });

      const settleResult = await settleResponse.json();

      if (!settleResponse.ok || !settleResult.success) {
        console.error(
          `Facilitator settlement failed: ${JSON.stringify(settleResult)}`,
        );

        const requirements = buildPaymentRequirements(amount);
        const encoded = Buffer.from(
          JSON.stringify(requirements),
          "utf-8",
        ).toString("base64");

        res
          .status(402)
          .set("X-PAYMENT-REQUIRED", encoded)
          .json({
            error: "Payment settlement failed",
            message: settleResult.errorReason ?? "Settlement rejected",
            requirements,
          });
        return;
      }

      // Settlement succeeded — attach payment info and continue
      (req as any).x402 = {
        payer: settleResult.payer,
        transaction: settleResult.transaction,
        network: settleResult.network,
      };
      next();
    } catch (err) {
      console.error("Error contacting facilitator:", err);
      res.status(502).json({
        error: "Facilitator unavailable",
        message:
          "Could not reach the payment facilitator. Please try again later.",
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

// ---- Free endpoints ----

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "x402-ton-demo-api",
    version: "0.1.0",
    uptime: process.uptime(),
  });
});

app.get("/api/services", (_req: Request, res: Response) => {
  res.json({
    status: "success",
    data: {
      services,
      paymentProtocol: "x402",
      network: "ton-testnet",
      facilitatorUrl: FACILITATOR_URL,
      asset: USDT_ASSET_ADDRESS,
    },
    timestamp: new Date().toISOString(),
  });
});

// ---- Paid endpoints ----

app.get("/api/weather", paymentRequired(costByPath["/api/weather"]), weatherHandler);
app.get("/api/joke", paymentRequired(costByPath["/api/joke"]), jokeHandler);
app.post("/api/translate", paymentRequired(costByPath["/api/translate"]), translateHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`x402-ton demo API listening on http://localhost:${PORT}`);
  console.log(`Facilitator URL: ${FACILITATOR_URL}`);
  console.log(`Pay-to address:  ${PAY_TO_ADDRESS}`);
  console.log(`USDT asset:      ${USDT_ASSET_ADDRESS}`);
  console.log("");
  console.log("Endpoints:");
  console.log("  GET  /health          (free)");
  console.log("  GET  /api/services    (free)");
  for (const svc of services) {
    console.log(
      `  ${svc.method.padEnd(4)} ${svc.path.padEnd(20)} ${svc.costReadable}`,
    );
  }
});
