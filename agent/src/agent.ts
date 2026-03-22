import "dotenv/config";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { TonClient } from "@ton/ton";
import { Address } from "@ton/core";
import { meshAgentTools } from "./tools.js";
import {
  createAgentWallet,
  getJettonBalance,
  getJettonWalletAddress,
} from "./wallet.js";
import { makePayableRequest, type PaymentEvent } from "./x402-client.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TON_RPC_URL = process.env.TON_RPC_URL ?? "https://testnet.toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = process.env.TON_API_KEY;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const USDT_MASTER = process.env.USDT_MASTER_ADDRESS ?? "EQAAYQf_d4ekMhxzZ-DQeKXK_KMFwdmK7SvFRxNlkHhN0VBi";
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:4000";

// Whitelist of wallet addresses allowed to use the hosted AI
// If empty, everyone can use it. Comma-separated in env.
const ALLOWED_WALLETS = process.env.ALLOWED_WALLETS
  ? process.env.ALLOWED_WALLETS.split(",").map(w => w.trim().toLowerCase())
  : [];

if (!ANTHROPIC_API_KEY) {
  console.warn("ANTHROPIC_API_KEY not set — users must provide their own API key");
}

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;
const tonClient = new TonClient({ endpoint: TON_RPC_URL, apiKey: TON_API_KEY });
const agentWallet = createAgentWallet(AGENT_PRIVATE_KEY);

console.log(`Agent wallet: ${agentWallet.address.toString()}`);

const paymentLog: PaymentEvent[] = [];

// In-memory payment requests for user-wallet flow (keyed by requestId)
const paymentRequests = new Map<
  string,
  { resolve: (txHash: string) => void; reject: (reason: string) => void }
>();

const PAYMENT_TIMEOUT_MS = 120_000;

function onPayment(event: PaymentEvent) {
  paymentLog.push(event);
  const amountUSDT = (Number(event.amount) / 1_000_000).toFixed(2);
  console.log(`[PAYMENT] ${amountUSDT} USDT -> ${event.dvmName ?? event.dvm}`);
}

async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "discover_dvms": {
      const query = input.query as string;
      const tags = input.tags as string[] | undefined;
      const maxPrice = input.max_price as string | undefined;

      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (tags && tags.length > 0) params.set("tags", tags.join(","));
        if (maxPrice) params.set("maxPrice", maxPrice);

        const res = await fetch(`${GATEWAY_URL}/api/dvms?${params}`);
        const data = await res.json();

        if (!data.dvms || data.dvms.length === 0) {
          return "No DVMs found matching your query. Try a broader search.";
        }

        return data.dvms
          .map((s: Record<string, unknown>) =>
            `- **${s.name}** (ID: ${s.id})\n  ${s.description}\n  Price: ${s.priceReadable} | Tags: ${(s.tags as string[]).join(", ")}${s.ensName ? ` | ENS: ${s.ensName}` : ""}`,
          )
          .join("\n\n");
      } catch (error) {
        return `Error discovering DVMs: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "call_dvm": {
      const dvmId = input.dvm_id as string;
      const params = input.params as Record<string, unknown> | undefined;

      try {
        // Get DVM details to determine method and build canonical URL
        const infoRes = await fetch(`${GATEWAY_URL}/api/dvms/${dvmId}`);
        let method = "GET";
        let url: string;

        if (infoRes.ok) {
          const info = await infoRes.json();
          method = info.dvm?.method ?? "GET";
          const slug = info.dvm?.slug || dvmId;
          const ownerShort = info.dvm?.ownerAddress?.replace(/^0:/, "").slice(0, 8).toLowerCase() || "unknown";
          url = `${GATEWAY_URL}/dvm/${ownerShort}/${slug}`;
        } else {
          // Fallback to legacy proxy route
          url = `${GATEWAY_URL}/proxy/${dvmId}`;
        }

        let body: string | undefined;

        if (method === "GET" && params) {
          const queryParams = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            queryParams.set(key, String(value));
          }
          url += `?${queryParams}`;
        } else if (method === "POST" && params) {
          body = JSON.stringify(params);
        }

        const result = await makePayableRequest(url, method, body, agentWallet, tonClient, onPayment);
        return JSON.stringify(result.data, null, 2);
      } catch (error) {
        return `Error calling DVM: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "check_balance": {
      try {
        const jettonMaster = Address.parse(USDT_MASTER);
        const jettonWallet = await getJettonWalletAddress(tonClient, agentWallet.address, jettonMaster);
        const balance = await getJettonBalance(tonClient, jettonWallet);
        const usdtBalance = (Number(balance) / 1_000_000).toFixed(6);
        return `Agent USDT balance: ${usdtBalance} USDT\nWallet: ${agentWallet.address.toString()}`;
      } catch (error) {
        return `Could not fetch balance: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "resolve_ens": {
      const ensName = input.name as string;
      try {
        const res = await fetch(`${GATEWAY_URL}/api/ens/resolve/${encodeURIComponent(ensName)}`);
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      } catch (error) {
        return `ENS resolution failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

const MAX_ITERATIONS = 15;

const SYSTEM_PROMPT =
  "You are an AI assistant on the VendTON marketplace — an open platform where users and AI agents " +
  "discover, use, and pay for DVMs (Data Vending Machines) on the TON blockchain using USDT.\n\n" +
  "Your workflow:\n" +
  "1. ALWAYS start by discovering available DVMs using discover_dvms\n" +
  "2. Select the best DVM(s) for the task\n" +
  "3. Call DVMs using call_dvm — payment happens automatically via x402\n" +
  "4. Chain multiple DVMs when needed (e.g. get data, then translate it)\n" +
  "5. Report results clearly, including costs\n\n" +
  "You have access to a TON wallet with USDT. Be cost-conscious but don't hesitate to pay for quality DVMs. " +
  "When chaining DVMs, pass the output of one as input to the next.\n\n" +
  `Gateway: ${GATEWAY_URL}`;

export async function runAgent(userMessage: string, userApiKey?: string): Promise<string> {
  // Clear payment log for this run
  paymentLog.length = 0;

  const client = userApiKey
    ? new Anthropic({ apiKey: userApiKey })
    : anthropic;

  if (!client) {
    throw new Error("No API key available — provide an apiKey in the request body or set ANTHROPIC_API_KEY");
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: meshAgentTools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return textBlocks.map((b) => b.text).join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`[TOOL] ${block.name}(${JSON.stringify(block.input)})`);
        const result = await handleToolCall(
          block.name,
          block.input as Record<string, unknown>,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return "Agent reached maximum iteration limit. Please try a simpler request.";
}

type SendEventFn = (type: string, data: unknown) => void;

/**
 * Build the canonical URL and HTTP method for a DVM call.
 * Shared between auto-pay and user-wallet payment paths.
 */
async function buildDvmRequest(
  dvmId: string,
  params: Record<string, unknown> | undefined,
): Promise<{ url: string; method: string; body: string | undefined }> {
  const infoRes = await fetch(`${GATEWAY_URL}/api/dvms/${dvmId}`);
  let method = "GET";
  let url: string;

  if (infoRes.ok) {
    const info = await infoRes.json();
    method = info.dvm?.method ?? "GET";
    const slug = info.dvm?.slug || dvmId;
    const ownerShort =
      info.dvm?.ownerAddress?.replace(/^0:/, "").slice(0, 8).toLowerCase() ||
      "unknown";
    url = `${GATEWAY_URL}/dvm/${ownerShort}/${slug}`;
  } else {
    url = `${GATEWAY_URL}/proxy/${dvmId}`;
  }

  let body: string | undefined;

  if (method === "GET" && params) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.set(key, String(value));
    }
    url += `?${queryParams}`;
  } else if (method === "POST" && params) {
    body = JSON.stringify(params);
  }

  return { url, method, body };
}

/**
 * Handle `call_dvm` in user-wallet mode: on 402, ask the frontend for payment
 * via SSE and wait for confirmation through the /payment-confirmed endpoint.
 */
async function handleCallDvmWithUserPayment(
  input: Record<string, unknown>,
  sendEvent: SendEventFn,
  requestId: string,
): Promise<string> {
  const dvmId = input.dvm_id as string;
  const params = input.params as Record<string, unknown> | undefined;

  const { url, method, body } = await buildDvmRequest(dvmId, params);

  // First attempt — no payment header
  const initialRes = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });

  if (initialRes.status !== 402) {
    const data = await initialRes.json().catch(() => initialRes.text());
    return JSON.stringify(data, null, 2);
  }

  // Parse 402 requirements
  const paymentRequiredHeader = initialRes.headers.get("x-payment-required");
  let requirements: { amount: string; payTo: string; asset: string; network: string; maxTimeoutSeconds: number };
  let dvmName: string | undefined;

  if (paymentRequiredHeader) {
    const decoded = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"),
    );
    requirements = decoded.accepts[0];
  } else {
    const errorBody = await initialRes.json();
    requirements =
      errorBody.accepts?.[0] ?? errorBody.requirements?.accepts?.[0];
    dvmName = errorBody.dvm?.name;
  }

  if (!requirements) {
    throw new Error("Could not parse payment requirements from 402 response");
  }

  const amountReadable =
    (Number(requirements.amount) / 1_000_000).toFixed(2) + " USDT";

  // Ask the frontend for payment via SSE
  const paymentPromise = new Promise<string>((resolve, reject) => {
    paymentRequests.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (paymentRequests.has(requestId)) {
        paymentRequests.delete(requestId);
        reject(new Error("Payment timeout — user did not confirm in time"));
      }
    }, PAYMENT_TIMEOUT_MS);
  });

  sendEvent("payment_required", {
    requestId,
    dvmId,
    dvmName: dvmName ?? dvmId,
    amount: requirements.amount,
    amountReadable,
    payTo: requirements.payTo,
    asset: requirements.asset,
    network: requirements.network,
  });

  // Block until the frontend confirms payment
  const txHash = await paymentPromise;

  // Retry the DVM call with proof-of-payment header
  const paidRes = await fetch(url, {
    method,
    headers: {
      "X-PAYMENT-TX": txHash,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });

  const data = await paidRes.json().catch(() => paidRes.text());

  sendEvent("payment_confirmed", {
    txHash,
    amount: amountReadable,
    dvmName: dvmName ?? dvmId,
  });

  // Log the payment
  paymentLog.push({
    type: "payment",
    dvm: url,
    dvmName: dvmName ?? dvmId,
    amount: requirements.amount,
    recipient: requirements.payTo,
    timestamp: Date.now(),
  });

  return JSON.stringify(data, null, 2);
}

async function handleToolCallWithEvents(
  name: string,
  input: Record<string, unknown>,
  sendEvent: SendEventFn,
  requestId?: string,
): Promise<string> {
  sendEvent("tool_call", { tool: name, input });

  let result: string;

  // In user-wallet mode (requestId present), intercept call_dvm to delegate
  // payment to the frontend instead of auto-paying with the agent wallet.
  if (name === "call_dvm" && requestId) {
    try {
      result = await handleCallDvmWithUserPayment(input, sendEvent, requestId);
    } catch (error) {
      result = `Error calling DVM: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    const logLenBefore = paymentLog.length;
    result = await handleToolCall(name, input);

    // Check if a payment happened during this tool call (auto-pay fallback)
    if (paymentLog.length > logLenBefore) {
      const lastPayment = paymentLog[paymentLog.length - 1];
      sendEvent("payment", {
        amount:
          (Number(lastPayment.amount) / 1_000_000).toFixed(2) + " USDT",
        dvm: lastPayment.dvmName ?? lastPayment.dvm,
      });
    }
  }

  const truncated =
    result.length > 200 ? result.slice(0, 200) + "..." : result;
  sendEvent("tool_result", { tool: name, result: truncated });

  return result;
}

export async function runAgentWithEvents(
  userMessage: string,
  sendEvent: SendEventFn,
  userApiKey?: string,
): Promise<string> {
  paymentLog.length = 0;

  const client = userApiKey
    ? new Anthropic({ apiKey: userApiKey })
    : anthropic;

  if (!client) {
    throw new Error("No API key available — provide an apiKey in the request body or set ANTHROPIC_API_KEY");
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  sendEvent("thinking", {});

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: meshAgentTools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return textBlocks.map((b) => b.text).join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`[TOOL] ${block.name}(${JSON.stringify(block.input)})`);
        const result = await handleToolCallWithEvents(
          block.name,
          block.input as Record<string, unknown>,
          sendEvent,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    sendEvent("thinking", {});
  }

  return "Agent reached maximum iteration limit. Please try a simpler request.";
}

// HTTP server mode or CLI mode
const PORT = process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT) : null;

if (PORT) {
  const [{ default: express }, { default: corsModule }] = await Promise.all([
    import("express"),
    import("cors"),
  ]);

  const app = express();
  app.use(corsModule({ origin: "*" }));
  app.use(express.json());

  app.post("/run", async (req, res) => {
    const { prompt, apiKey, walletAddress } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    if (ALLOWED_WALLETS.length > 0) {
      const normalized = (walletAddress || "").toLowerCase();
      if (!walletAddress || !ALLOWED_WALLETS.some(w => normalized.includes(w))) {
        res.status(403).json({ error: "Your wallet is not authorized to use this service" });
        return;
      }
    }
    console.log(`\n[HTTP] Agent processing: "${prompt}"`);
    try {
      const result = await runAgent(prompt, apiKey);
      res.json({
        response: result,
        payments: paymentLog.map((p) => ({
          amount: (Number(p.amount) / 1_000_000).toFixed(2) + " USDT",
          dvm: p.dvmName ?? p.dvm,
          timestamp: p.timestamp,
        })),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Agent failed",
      });
    }
  });

  app.post("/run/stream", async (req, res) => {
    const { prompt, apiKey, walletAddress } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Check wallet whitelist (if configured)
    if (ALLOWED_WALLETS.length > 0) {
      const normalized = (walletAddress || "").toLowerCase();
      if (!walletAddress || !ALLOWED_WALLETS.some(w => normalized.includes(w))) {
        res.status(403).json({ error: "Your wallet is not authorized to use this service" });
        return;
      }
    }

    console.log(`\n[HTTP/SSE] Agent streaming: "${prompt}"`);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (type: string, data: unknown) => {
      res.write(`data: ${JSON.stringify({ type, ...data as Record<string, unknown> })}\n\n`);
    };

    try {
      const result = await runAgentWithEvents(prompt, sendEvent, apiKey);
      sendEvent("done", {
        response: result,
        payments: paymentLog.map((p) => ({
          amount: (Number(p.amount) / 1_000_000).toFixed(2) + " USDT",
          dvm: p.dvmName ?? p.dvm,
          timestamp: p.timestamp,
        })),
      });
    } catch (err) {
      sendEvent("error", {
        message: err instanceof Error ? err.message : "Agent failed",
      });
    }

    res.end();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", wallet: agentWallet.address.toString() });
  });

  app.listen(PORT, () => {
    console.log(`Agent HTTP server on port ${PORT}`);
    console.log(`POST /run { "prompt": "..." }`);
  });
} else {
  const userInput = process.argv.slice(2).join(" ");
  if (userInput) {
    console.log(`\nAgent processing: "${userInput}"\n`);
    runAgent(userInput)
      .then((result) => {
        console.log("\n--- Agent Response ---");
        console.log(result);
        console.log("\n--- Payment Log ---");
        paymentLog.forEach((p) => {
          const amount = (Number(p.amount) / 1_000_000).toFixed(2);
          console.log(`  ${amount} USDT -> ${p.dvmName ?? p.dvm}`);
        });
      })
      .catch(console.error);
  } else {
    console.log('Usage: tsx src/agent.ts "Get me the weather in Paris and translate it to French"');
    console.log("Or set AGENT_PORT=4001 to run as HTTP server");
  }
}
