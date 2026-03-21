export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  tonRpcUrl:
    process.env.TON_RPC_URL ??
    "https://testnet.toncenter.com/api/v2/jsonRPC",
  tonApiKey: process.env.TON_API_KEY,
  corsOrigins: process.env.CORS_ORIGINS ?? "*",
} as const;
