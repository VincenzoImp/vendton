import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";

const SEPOLIA_PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as const;

const client = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

const resolverAbi = [
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

async function getTextRecord(ensName: string, key: string): Promise<string | null> {
  try {
    const node = namehash(normalize(ensName));
    const result = await client.readContract({
      address: SEPOLIA_PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: "text",
      args: [node, key],
    });
    return result || null;
  } catch {
    return null;
  }
}

export async function resolveENSToTON(ensName: string): Promise<string | null> {
  return getTextRecord(ensName, "address.ton");
}

export async function getENSAvatar(ensName: string): Promise<string | null> {
  return getTextRecord(ensName, "avatar");
}

export async function getENSName(_address: string): Promise<string | null> {
  // Reverse resolution not available via direct resolver call on Sepolia
  return null;
}
