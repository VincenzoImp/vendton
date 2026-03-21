import { TonClient } from "@ton/ton";
import { config } from "./config.js";

export const tonClient = new TonClient({
  endpoint: config.tonRpcUrl,
  ...(config.tonApiKey ? { apiKey: config.tonApiKey } : {}),
});
