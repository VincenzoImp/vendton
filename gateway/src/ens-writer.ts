import { createPublicClient, createWalletClient, http, type Hex, namehash, labelhash } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const ENS_PRIVATE_KEY = process.env.ENS_PRIVATE_KEY || "0x101dd834ae7067d5a10ae39be95dbd917b0642b1412a96c7a35235668db9b384";
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const account = privateKeyToAccount(ENS_PRIVATE_KEY as Hex);

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Hex;
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as Hex;

/**
 * ENS Registry ABI — we use setSubnodeRecord to create subnames directly
 * on the registry (not the NameWrapper). This works for names registered
 * via ETHRegistrarController that are NOT wrapped in the NameWrapper.
 *
 * setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)
 *   - Creates the subname
 *   - Sets owner, resolver, and TTL in one transaction
 */
const registryAbi = [
  {
    name: "setSubnodeRecord",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

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

export interface SubnameData {
  label: string;        // e.g., "weather" (just the first part)
  parentName: string;   // e.g., "eqawwaqaaz.vendton.eth"
  tonAddress: string;   // owner's TON address
  description: string;  // DVM description
}

/**
 * Creates a subname under vendton.eth using the ENS Registry directly.
 *
 * Why not NameWrapper? vendton.eth was registered via ETHRegistrarController
 * which does NOT automatically wrap the name in the NameWrapper on Sepolia.
 * Calling createSubname with contract: "nameWrapper" reverts because the
 * parent name is not wrapped. Using the registry directly works correctly.
 *
 * Flow:
 * 1. setSubnodeRecord on parent to create owner-level subname (e.g., eqawwaqaaz.vendton.eth)
 * 2. setSubnodeRecord on that to create DVM subname (e.g., weather.eqawwaqaaz.vendton.eth)
 * 3. setText on resolver for address.ton and description
 */
export async function createDVMSubname(data: SubnameData): Promise<{ success: boolean; ensName: string; txHash?: string; error?: string }> {
  const fullName = `${data.label}.${data.parentName}`;

  try {
    const parentParts = data.parentName.split(".");
    const ownerLabel = parentParts[0]; // e.g., "eqawwaqaaz"

    // Step 1: Create the owner subname (e.g., eqawwaqaaz.vendton.eth)
    // Parent node is namehash("vendton.eth"), label is keccak256("eqawwaqaaz")
    const vendtonNode = namehash("vendton.eth");
    const ownerLabelHash = labelhash(ownerLabel);

    const ownerSubnameNode = namehash(`${ownerLabel}.vendton.eth`);

    // Check if subname already exists (has an owner)
    const existingOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: "owner",
      args: [ownerSubnameNode],
    });

    if (existingOwner === "0x0000000000000000000000000000000000000000") {
      console.log(`[ens] Creating owner subname: ${ownerLabel}.vendton.eth`);
      const tx = await walletClient.writeContract({
        address: ENS_REGISTRY,
        abi: registryAbi,
        functionName: "setSubnodeRecord",
        args: [vendtonNode, ownerLabelHash, account.address, PUBLIC_RESOLVER, 0n],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`[ens] Created owner subname: ${ownerLabel}.vendton.eth (tx: ${tx.slice(0, 10)}...)`);
    } else {
      console.log(`[ens] Owner subname already exists: ${ownerLabel}.vendton.eth (owner: ${existingOwner.slice(0, 10)}...)`);
    }

    // Step 2: Create the DVM subname (e.g., weather.eqawwaqaaz.vendton.eth)
    const dvmLabelHash = labelhash(data.label);
    const dvmNode = namehash(fullName);

    const existingDvmOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: "owner",
      args: [dvmNode],
    });

    if (existingDvmOwner === "0x0000000000000000000000000000000000000000") {
      console.log(`[ens] Creating DVM subname: ${fullName}`);
      const tx = await walletClient.writeContract({
        address: ENS_REGISTRY,
        abi: registryAbi,
        functionName: "setSubnodeRecord",
        args: [ownerSubnameNode, dvmLabelHash, account.address, PUBLIC_RESOLVER, 0n],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`[ens] Created DVM subname: ${fullName} (tx: ${tx.slice(0, 10)}...)`);
    } else {
      console.log(`[ens] DVM subname already exists: ${fullName}`);
      // Ensure resolver is set even if subname exists
      const currentResolver = await publicClient.readContract({
        address: ENS_REGISTRY,
        abi: registryAbi,
        functionName: "resolver",
        args: [dvmNode],
      });
      if (currentResolver === "0x0000000000000000000000000000000000000000") {
        console.log(`[ens] Resolver not set, re-creating subname with resolver...`);
        const tx = await walletClient.writeContract({
          address: ENS_REGISTRY,
          abi: registryAbi,
          functionName: "setSubnodeRecord",
          args: [ownerSubnameNode, dvmLabelHash, account.address, PUBLIC_RESOLVER, 0n],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
    }

    // Step 3: Set text records
    console.log(`[ens] Setting text records for ${fullName}...`);

    const tx1 = await walletClient.writeContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [dvmNode, "address.ton", data.tonAddress],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    console.log(`[ens] Set address.ton = ${data.tonAddress}`);

    const tx2 = await walletClient.writeContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [dvmNode, "description", data.description],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    console.log(`[ens] Set description = ${data.description.slice(0, 50)}...`);

    console.log(`[ens] Done: ${fullName}`);
    return { success: true, ensName: fullName, txHash: tx1 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ens] Failed to create subname ${fullName}:`, msg.slice(0, 200));
    return { success: false, ensName: fullName, error: msg };
  }
}

/**
 * Deletes a DVM subname by setting its owner to the zero address in the registry.
 * This effectively "deletes" it — the resolver records become inaccessible.
 */
export async function deleteDVMSubname(ensName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const parts = ensName.split(".");
    if (parts.length < 3) {
      return { success: false, error: "Invalid subname format" };
    }

    const label = parts[0];
    const parentName = parts.slice(1).join(".");
    const parentNode = namehash(parentName);
    const labelHash = labelhash(label);

    const tx = await walletClient.writeContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: "setSubnodeRecord",
      args: [parentNode, labelHash, "0x0000000000000000000000000000000000000000" as Hex, "0x0000000000000000000000000000000000000000" as Hex, 0n],
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
