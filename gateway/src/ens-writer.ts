import { createPublicClient, createWalletClient, http, type Hex, namehash } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { addEnsContracts } from "@ensdomains/ensjs";
import { createSubname, deleteSubname } from "@ensdomains/ensjs/wallet";

const ENS_PRIVATE_KEY = process.env.ENS_PRIVATE_KEY || "0x101dd834ae7067d5a10ae39be95dbd917b0642b1412a96c7a35235668db9b384";
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const account = privateKeyToAccount(ENS_PRIVATE_KEY as Hex);
const chain = addEnsContracts(sepolia);

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

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
] as const;

export interface SubnameData {
  label: string;        // e.g., "weather" (just the first part)
  parentName: string;   // e.g., "eqawwaqaaz.vendton.eth"
  tonAddress: string;   // owner's TON address
  description: string;  // DVM description
}

export async function createDVMSubname(data: SubnameData): Promise<{ success: boolean; ensName: string; txHash?: string; error?: string }> {
  const fullName = `${data.label}.${data.parentName}`;

  try {
    // Step 1: Create the owner subname if needed (e.g., eqawwaqaaz.vendton.eth)
    const parentParts = data.parentName.split(".");
    const ownerLabel = parentParts[0]; // "eqawwaqaaz"

    try {
      const parentTx = await createSubname(walletClient, {
        name: `${ownerLabel}.vendton.eth`,
        contract: "nameWrapper",
        owner: account.address,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: parentTx });
      console.log(`[ens] Created owner subname: ${ownerLabel}.vendton.eth`);
    } catch (e: any) {
      // May already exist, that's fine
      if (!e.message?.includes("already") && !e.message?.includes("revert")) {
        console.log(`[ens] Owner subname may already exist: ${e.message?.slice(0, 60)}`);
      }
    }

    // Step 2: Create the DVM subname (e.g., weather.eqawwaqaaz.vendton.eth)
    try {
      const tx = await createSubname(walletClient, {
        name: fullName,
        contract: "nameWrapper",
        owner: account.address,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`[ens] Created DVM subname: ${fullName} (tx: ${tx.slice(0, 10)}...)`);
    } catch (e: any) {
      if (!e.message?.includes("already")) {
        console.log(`[ens] DVM subname creation warning: ${e.message?.slice(0, 60)}`);
      }
    }

    // Step 3: Set text records on the DVM subname
    const node = namehash(fullName);

    // Set address.ton
    const tx1 = await walletClient.writeContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [node, "address.ton", data.tonAddress],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    // Set description
    const tx2 = await walletClient.writeContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [node, "description", data.description],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    console.log(`[ens] Set text records for ${fullName}`);

    return { success: true, ensName: fullName, txHash: tx1 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ens] Failed to create subname ${fullName}:`, msg.slice(0, 100));
    return { success: false, ensName: fullName, error: msg };
  }
}

export async function deleteDVMSubname(ensName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const tx = await deleteSubname(walletClient, {
      name: ensName,
      contract: "nameWrapper",
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`[ens] Deleted subdomain: ${ensName}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ens] Failed to delete ${ensName}:`, msg.slice(0, 100));
    return { success: false, error: msg };
  }
}
