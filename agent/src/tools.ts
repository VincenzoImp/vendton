import type Anthropic from "@anthropic-ai/sdk";

export const meshAgentTools: Anthropic.Tool[] = [
  {
    name: "discover_skills",
    description:
      "Search the mesh402 marketplace for skills by capability, tags, or description. " +
      "Returns matching skills with their prices, IDs, and descriptions. " +
      "Always call this first to find available skills before calling them.",
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
    name: "call_skill",
    description:
      "Call a mesh402 skill by its ID. The payment is handled automatically via the x402 protocol. " +
      "Pass query parameters as part of the body for GET skills, or as JSON body for POST skills. " +
      "Returns the skill response data.",
    input_schema: {
      type: "object" as const,
      properties: {
        skill_id: {
          type: "string",
          description: "The skill ID from discover_skills results",
        },
        params: {
          type: "object",
          description: "Parameters to pass to the skill (query params for GET, body for POST)",
        },
      },
      required: ["skill_id"],
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
      "Resolve an ENS name to find the associated TON address and any skills registered under it. " +
      "Use this when you see .eth names to discover the owner and their skills.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "ENS name (e.g. weather.mesh402.eth)",
        },
      },
      required: ["name"],
    },
  },
];
