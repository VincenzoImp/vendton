export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  tonRpcUrl:
    process.env.TON_RPC_URL ??
    "https://testnet.toncenter.com/api/v2/jsonRPC",
  tonApiKey: process.env.TON_API_KEY,
  corsOrigins: process.env.CORS_ORIGINS ?? "*",
  usdtAssetAddress:
    process.env.USDT_ASSET_ADDRESS ??
    "EQAAYQf_d4ekMhxzZ-DQeKXK_KMFwdmK7SvFRxNlkHhN0VBi",
} as const;
