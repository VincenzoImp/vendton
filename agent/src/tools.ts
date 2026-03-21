import type Anthropic from "@anthropic-ai/sdk";

export const meshAgentTools: Anthropic.Tool[] = [
  {
    name: "discover_dvms",
    description:
      "Search the VendTON marketplace for DVMs (Data Vending Machines) by capability, tags, or description. " +
      "Returns matching DVMs with their prices, IDs, and descriptions. " +
      "Always call this first to find available DVMs before calling them.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. 'weather data', 'translation', 'sentiment')",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags (e.g. ['weather', 'data'])",
        },
        max_price: {
          type: "string",
          description: "Maximum price in USDT micro-units (e.g. '500000' for 0.5 USDT)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "call_dvm",
    description:
      "Call a VendTON DVM (Data Vending Machine) by its ID. The payment is handled automatically via the x402 protocol. " +
      "Pass query parameters as part of the body for GET DVMs, or as JSON body for POST DVMs. " +
      "Returns the DVM response data.",
    input_schema: {
      type: "object" as const,
      properties: {
        dvm_id: {
          type: "string",
          description: "The DVM ID from discover_dvms results",
        },
        params: {
          type: "object",
          description: "Parameters to pass to the DVM (query params for GET, body for POST)",
        },
      },
      required: ["dvm_id"],
    },
  },
  {
    name: "check_balance",
    description: "Check the agent's current USDT balance on TON blockchain",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "resolve_ens",
    description:
      "Resolve an ENS name to find the associated TON address and any DVMs registered under it. " +
      "Use this when you see .eth names to discover the owner and their DVMs.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "ENS name (e.g. weather.vendton.eth)",
        },
      },
      required: ["name"],
    },
  },
];
