import {
  TonClient,
  WalletContractV5R1,
  internal,
  SendMode,
  JettonMaster,
} from "@ton/ton";
import {
  Cell,
  beginCell,
  Address,
  contractAddress,
  toNano,
  Dictionary,
} from "@ton/core";
import nacl from "tweetnacl";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Op codes for stablecoin-contract
const Op = {
  mint: 0x642b7d07,
  internal_transfer: 0x178d4519,
};

function sha256(str: string): bigint {
  const hash = crypto.createHash("sha256").update(str).digest();
  return BigInt("0x" + hash.toString("hex"));
}

function makeSnakeCell(str: string): Cell {
  return beginCell().storeUint(0, 8).storeStringTail(str).endCell();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(fn: () => Promise<T>, retries = 5, delayMs = 3000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (i < retries - 1 && (status === 542 || status === 429 || status >= 500)) {
        console.log(`  API error (${status}), retrying in ${delayMs / 1000}s... (${i + 1}/${retries})`);
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Retry limit reached");
}

async function main() {
  const apiKey = process.env.TON_API_KEY;
  const rpcUrl = process.env.TON_RPC_URL;
  const privateKeyHex = process.env.AGENT_PRIVATE_KEY;
  const existingUsdtMaster = process.env.USDT_MASTER_ADDRESS;

  if (!apiKey || !rpcUrl || !privateKeyHex) {
    throw new Error("Missing required environment variables (TON_API_KEY, TON_RPC_URL, AGENT_PRIVATE_KEY)");
  }

  // Restore keypair using tweetnacl (same as agent/src/wallet.ts)
  const secretKey = Buffer.from(privateKeyHex, "hex");
  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
  const publicKey = Buffer.from(keypair.publicKey);

  // Use WalletContractV5R1 (same as agent)
  const wallet = WalletContractV5R1.create({ publicKey, workchain: 0 });

  console.log("Agent wallet address:", wallet.address.toString());
  console.log(
    "Agent wallet address (friendly, testnet):",
    wallet.address.toString({ testOnly: true, bounceable: false })
  );

  // Create TonClient
  const client = new TonClient({ endpoint: rpcUrl, apiKey });
  const walletContract = client.open(wallet);

  let seqno: number;
  try {
    seqno = await retry(() => walletContract.getSeqno());
  } catch {
    seqno = 0;
  }
  console.log("Current wallet seqno:", seqno);

  // Check wallet balance
  const balance = await retry(() => client.getBalance(wallet.address));
  console.log("Wallet balance:", Number(balance) / 1e9, "TON");

  if (balance < toNano("0.5")) {
    console.error(
      "\nInsufficient balance. Need at least 0.5 TON.",
      "\nGet testnet TON from https://t.me/testgiver_ton_bot",
      "\nSend to:", wallet.address.toString({ testOnly: true, bounceable: false })
    );
    process.exit(1);
  }

  // Fetch minter code and wallet code from the existing testnet USDT contract.
  // This ensures we use the exact same contract version (stablecoin-contract TEP-74).
  const referenceAddr = existingUsdtMaster
    ? Address.parse(existingUsdtMaster)
    : Address.parse("kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy");

  console.log("\nFetching contract code from reference USDT master:", referenceAddr.toString());

  // Get minter code from on-chain state
  const refState = await retry(() => client.getContractState(referenceAddr));
  if (refState.state !== "active" || !refState.code || !refState.data) {
    throw new Error("Reference USDT master contract is not active or has no code/data");
  }
  const minterCode = Cell.fromBoc(refState.code)[0];
  console.log("Minter code hash:", minterCode.hash().toString("hex"));

  // Get wallet code from the minter's on-chain data via get_jetton_data
  const jettonMaster = client.open(JettonMaster.create(referenceAddr));
  const jettonData = await retry(() => jettonMaster.getJettonData());
  const walletCode = jettonData.walletCode;
  console.log("Wallet code hash:", walletCode.hash().toString("hex"));

  // Build on-chain metadata content cell (TEP-64 on-chain format)
  const metadataDict = Dictionary.empty(
    Dictionary.Keys.BigUint(256),
    Dictionary.Values.Cell()
  );

  metadataDict.set(sha256("name"), makeSnakeCell("Test USDT"));
  metadataDict.set(sha256("symbol"), makeSnakeCell("USDT"));
  metadataDict.set(sha256("decimals"), makeSnakeCell("6"));
  metadataDict.set(sha256("description"), makeSnakeCell("Test USDT Jetton on TON Testnet"));

  const contentCell = beginCell()
    .storeUint(0x00, 8) // on-chain metadata prefix
    .storeDict(metadataDict)
    .endCell();

  // Build initial data cell for stablecoin-contract minter:
  // total_supply:Coins admin:MsgAddress transfer_admin:MsgAddress wallet_code:^Cell jetton_content:^Cell
  const dataCell = beginCell()
    .storeCoins(0)
    .storeAddress(wallet.address)
    .storeAddress(null)
    .storeRef(walletCode)
    .storeRef(contentCell)
    .endCell();

  const init = { code: minterCode, data: dataCell };
  const minterAddress = contractAddress(0, init);

  console.log("\nJetton Minter address:", minterAddress.toRawString());
  console.log(
    "Jetton Minter address (friendly, testnet):",
    minterAddress.toString({ testOnly: true, bounceable: true })
  );

  // Check if already deployed
  const contractState = await retry(() => client.getContractState(minterAddress));
  if (contractState.state === "active") {
    console.log("\nContract already deployed! Skipping deployment.");
  } else {
    console.log("\nDeploying Jetton Minter...");

    await walletContract.sendTransfer({
      seqno,
      secretKey: Buffer.from(keypair.secretKey),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      messages: [
        internal({
          to: minterAddress,
          value: toNano("0.15"),
          init,
          body: beginCell().endCell(),
        }),
      ],
    });

    // Wait for deployment
    console.log("Waiting for deployment confirmation...");
    let deployed = false;
    for (let i = 0; i < 40; i++) {
      await sleep(3000);
      try {
        const state = await retry(() => client.getContractState(minterAddress));
        if (state.state === "active") {
          deployed = true;
          break;
        }
      } catch {
        // ignore transient errors
      }
      process.stdout.write(".");
    }

    if (!deployed) {
      console.error("\nDeployment timed out. Check the transaction on explorer.");
      process.exit(1);
    }
    console.log("\nMinter deployed successfully!");

    // Wait for seqno to update
    await sleep(5000);
  }

  // Mint 1,000,000 USDT (with 6 decimals = 1_000_000_000_000 smallest units)
  const mintAmount = 1_000_000_000_000n;
  const forwardTonAmount = toNano("0.05");
  const totalTonAmount = toNano("0.2");

  // Build mint message for stablecoin-contract
  const internalTransferMsg = beginCell()
    .storeUint(Op.internal_transfer, 32)
    .storeUint(0, 64)
    .storeCoins(mintAmount)
    .storeAddress(null)
    .storeAddress(wallet.address)
    .storeCoins(forwardTonAmount)
    .storeBit(false)
    .endCell();

  const mintBody = beginCell()
    .storeUint(Op.mint, 32)
    .storeUint(0, 64)
    .storeAddress(wallet.address)
    .storeCoins(totalTonAmount)
    .storeRef(internalTransferMsg)
    .endCell();

  console.log("\nMinting 1,000,000 Test USDT to agent wallet...");

  const seqno2 = await retry(() => walletContract.getSeqno());
  await walletContract.sendTransfer({
    seqno: seqno2,
    secretKey: Buffer.from(keypair.secretKey),
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: minterAddress,
        value: totalTonAmount + toNano("0.05"),
        body: mintBody,
      }),
    ],
  });

  // Wait for mint to complete
  console.log("Waiting for mint confirmation...");
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    try {
      const newSeqno = await retry(() => walletContract.getSeqno());
      if (newSeqno > seqno2) {
        break;
      }
    } catch {
      // ignore transient errors
    }
    process.stdout.write(".");
  }

  console.log("\nMint transaction sent!");
  console.log("\n========================================");
  console.log("Deployed Jetton Master Address:");
  console.log("  Raw:", minterAddress.toRawString());
  console.log(
    "  Friendly (testnet):",
    minterAddress.toString({ testOnly: true, bounceable: true })
  );
  console.log("========================================");
  console.log(
    "\nView on explorer: https://testnet.tonviewer.com/" +
      minterAddress.toString({ testOnly: true, bounceable: true })
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
