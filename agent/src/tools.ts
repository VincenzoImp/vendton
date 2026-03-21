import type Anthropic from "@anthropic-ai/sdk";

export const agentTools: Anthropic.Tool[] = [
  {
    name: "call_paid_api",
    description:
      "Call an API endpoint that may require x402 USDT payment on TON. " +
      "If the endpoint returns 402, the payment will be handled automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL of the API endpoint to call",
        },
        method: {
          type: "string",
          enum: ["GET", "POST"],
          description: "HTTP method (default: GET)",
        },
        body: {
          type: "string",
          description: "JSON body for POST requests",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "check_balance",
    description: "Check the agent's current USDT balance on TON",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_services",
    description:
      "List available paid API services and their costs in USDT",
    input_schema: {
      type: "object" as const,
      properties: {
        api_url: {
          type: "string",
          description: "Base URL of the API server (e.g. http://localhost:3002)",
        },
      },
      required: [],
    },
  },
];
