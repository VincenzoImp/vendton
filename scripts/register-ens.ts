/**
 * Register vendton.eth on ENS Sepolia testnet and set text records.
 * Uses @ensdomains/ensjs for correct ABI handling.
 *
 * Usage:
 *   npx tsx scripts/register-ens.ts
 */

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { addEnsContracts } from "@ensdomains/ensjs";
import { getAvailable, getPrice } from "@ensdomains/ensjs/public";
import { commitName, registerName } from "@ensdomains/ensjs/wallet";
import { randomSecret } from "@ensdomains/ensjs/utils";

// --- Config ---
const PRIVATE_KEY = "0x101dd834ae7067d5a10ae39be95dbd917b0642b1412a96c7a35235668db9b384" as Hex;
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const LABEL = "vendton";
const DURATION_SECONDS = 365 * 24 * 60 * 60; // 1 year
const TON_ADDRESS = "EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD";

const account = privateKeyToAccount(PRIVATE_KEY);
console.log("Wallet:", account.address);

const chain = addEnsContracts(sepolia);

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(RPC_URL),
});

async function main() {
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", Number(balance) / 1e18, "Sepolia ETH\n");

  if (balance === 0n) {
    console.error("No Sepolia ETH! Fund wallet first.");
    console.error("Address:", account.address);
    console.error("Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
    process.exit(1);
  }

  // Step 1: Check availability
  console.log("--- Checking availability ---");
  const available = await getAvailable(publicClient, { name: `${LABEL}.eth` });
  console.log(`${LABEL}.eth available:`, available);

  if (!available) {
    console.log("Already registered — skipping to text records");
    await setTextRecords();
    return;
  }

  // Step 2: Get price
  console.log("\n--- Getting price ---");
  const price = await getPrice(publicClient, {
    nameOrNames: `${LABEL}.eth`,
    duration: DURATION_SECONDS,
  });
  console.log("Price:", Number(price.base) / 1e18, "ETH");

  // Step 3: Commit
  console.log("\n--- Committing ---");
  const secret = randomSecret();
  console.log("Secret:", secret, "(save this!)");
  const commitTx = await commitName(walletClient, {
    name: `${LABEL}.eth`,
    owner: account.address,
    duration: DURATION_SECONDS,
    secret,
    account,
  });
  console.log("Commit tx:", commitTx);
  console.log("Waiting for confirmation...");
  await publicClient.waitForTransactionReceipt({ hash: commitTx });
  console.log("Commit confirmed!");

  // Step 4: Wait for commitment to mature (60s on Sepolia)
  console.log("\n--- Waiting 70 seconds ---");
  for (let i = 70; i > 0; i -= 10) {
    process.stdout.write(`  ${i}s remaining...\r`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log("  Commitment matured!     ");

  // Step 5: Register
  console.log("\n--- Registering vendton.eth ---");
  const value = (price.base * 120n) / 100n; // 20% buffer
  const registerTx = await registerName(walletClient, {
    name: `${LABEL}.eth`,
    owner: account.address,
    duration: DURATION_SECONDS,
    secret,
    account,
    value,
  });
  console.log("Register tx:", registerTx);
  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx });
  console.log("Registered! Block:", receipt.blockNumber);
  console.log(`Explorer: https://sepolia.etherscan.io/tx/${registerTx}`);

  // Step 6: Set text records
  await setTextRecords();
}

async function setTextRecords() {
  const { namehash } = await import("viem");
  const { normalize } = await import("viem/ens");

  const node = namehash(normalize("vendton.eth"));
  const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as Hex;

  const resolverAbi = [
    {
      name: "setText",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "node", type: "bytes32" },
        { name: "key", type: "string" },
        { name: "value", type: "string" },
      ],
      outputs: [],
    },
    {
      name: "text",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "node", type: "bytes32" },
        { name: "key", type: "string" },
      ],
      outputs: [{ name: "", type: "string" }],
    },
  ] as const;

  const records = [
    { key: "address.ton", value: TON_ADDRESS },
    { key: "description", value: "vendton — Open marketplace for AI agent services on TON" },
    { key: "url", value: "https://vendton.vercel.app" },
  ];

  console.log("\n--- Setting text records ---");

  for (const record of records) {
    console.log(`  Setting ${record.key}...`);
    const tx = await walletClient.writeContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [node, record.key, record.value],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`  ${record.key} = "${record.value}" (tx: ${tx.slice(0, 10)}...)`);
  }

  // Verify
  console.log("\n--- Verification ---");
  for (const record of records) {
    const val = await publicClient.readContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "text",
      args: [node, record.key],
    });
    console.log(`  ${record.key} = "${val}"`);
  }

  console.log("\n=== DONE ===");
  console.log(`vendton.eth registered on Sepolia`);
  console.log(`TON address: ${TON_ADDRESS}`);
  console.log(`View: https://sepolia.app.ens.domains/vendton.eth`);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
