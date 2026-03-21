import Anthropic from "@anthropic-ai/sdk";
import { TonClient } from "@ton/ton";
import { Address } from "@ton/core";
import { agentTools } from "./tools.js";
import {
  createAgentWallet,
  getJettonBalance,
  getJettonWalletAddress,
} from "./wallet.js";
import { makePayableRequest, type PaymentEvent } from "./x402-client.js";

// Config
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TON_RPC_URL =
  process.env.TON_RPC_URL ??
  "https://testnet.toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = process.env.TON_API_KEY;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const USDT_MASTER =
  process.env.USDT_MASTER_ADDRESS ??
  "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy";
const DEMO_API_URL = process.env.DEMO_API_URL ?? "http://localhost:3002";

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required");
  process.exit(1);
}

// Initialize
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const tonClient = new TonClient({
  endpoint: TON_RPC_URL,
  apiKey: TON_API_KEY,
});
const agentWallet = createAgentWallet(AGENT_PRIVATE_KEY);

console.log(`Agent wallet: ${agentWallet.address.toString()}`);

// Payment event log
const paymentLog: PaymentEvent[] = [];

function onPayment(event: PaymentEvent) {
  paymentLog.push(event);
  const amountUSDT = (Number(event.amount) / 1_000_000).toFixed(2);
  console.log(`[PAYMENT] ${amountUSDT} USDT → ${event.service}`);
}

/**
 * Handle a tool call from the LLM.
 */
async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "call_paid_api": {
      const url = input.url as string;
      const method = (input.method as string) ?? "GET";
      const body = input.body as string | undefined;

      try {
        const result = await makePayableRequest(
          url,
          method,
          body,
          agentWallet,
          tonClient,
          onPayment,
        );
        return JSON.stringify(result.data, null, 2);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "check_balance": {
      try {
        const jettonMaster = Address.parse(USDT_MASTER);
        const jettonWallet = await getJettonWalletAddress(
          tonClient,
          agentWallet.address,
          jettonMaster,
        );
        const balance = await getJettonBalance(tonClient, jettonWallet);
        const usdtBalance = (Number(balance) / 1_000_000).toFixed(6);
        return `Agent USDT balance: ${usdtBalance} USDT\nWallet: ${agentWallet.address.toString()}`;
      } catch (error) {
        return `Could not fetch balance: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "list_services": {
      const apiUrl = (input.api_url as string) ?? DEMO_API_URL;
      try {
        const res = await fetch(`${apiUrl}/api/services`);
        const services = await res.json();
        return JSON.stringify(services, null, 2);
      } catch (error) {
        return `Could not list services: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Run the agent loop for a user message.
 */
export async function runAgent(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const systemPrompt =
    "You are an autonomous AI agent with a TON blockchain wallet containing USDT. " +
    "You can call paid API services using the x402 payment protocol. " +
    "When asked to do something that requires an API call, use the available tools. " +
    "First list available services, then call the appropriate one. " +
    "Always check your balance before making expensive calls. " +
    `Available API server: ${DEMO_API_URL}`;

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: agentTools,
      messages,
    });

    // If no tool use, return the text response
    if (response.stop_reason !== "tool_use") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return textBlocks.map((b) => b.text).join("\n");
    }

    // Process tool calls
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
}

// CLI mode
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
        console.log(`  ${amount} USDT → ${p.service}`);
      });
    })
    .catch(console.error);
} else {
  console.log('Usage: tsx src/agent.ts "Get me the weather in Paris"');
}
