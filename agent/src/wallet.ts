import { WalletContractV5R1 } from "@ton/ton";
import { TonClient } from "@ton/ton";
import { Address, beginCell } from "@ton/core";
import nacl from "tweetnacl";

export interface AgentWallet {
  keypair: nacl.SignKeyPair;
  wallet: WalletContractV5R1;
  address: Address;
}

/**
 * Create or restore the agent's TON wallet.
 * Uses a deterministic seed from env or generates a new one.
 */
export function createAgentWallet(privateKeyHex?: string): AgentWallet {
  let keypair: nacl.SignKeyPair;

  if (privateKeyHex) {
    const secretKey = Buffer.from(privateKeyHex, "hex");
    keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
  } else {
    keypair = nacl.sign.keyPair();
    console.log(
      "Generated new agent wallet. Save this private key:",
      Buffer.from(keypair.secretKey).toString("hex"),
    );
  }

  const publicKey = Buffer.from(keypair.publicKey);
  const wallet = WalletContractV5R1.create({ publicKey, workchain: 0 });

  return {
    keypair,
    wallet,
    address: wallet.address,
  };
}

/**
 * Get the agent's current wallet seqno.
 */
export async function getWalletSeqno(
  tonClient: TonClient,
  wallet: WalletContractV5R1,
): Promise<number> {
  try {
    const contract = tonClient.open(wallet);
    return await contract.getSeqno();
  } catch {
    return 0; // New wallet, not deployed yet
  }
}

/**
 * Get the agent's Jetton wallet address for a given Jetton master.
 */
export async function getJettonWalletAddress(
  tonClient: TonClient,
  ownerAddress: Address,
  jettonMaster: Address,
): Promise<Address> {
  const result = await tonClient.runMethod(
    jettonMaster,
    "get_wallet_address",
    [
      {
        type: "slice",
        cell: beginCell().storeAddress(ownerAddress).endCell(),
      },
    ],
  );
  return result.stack.readAddress();
}

/**
 * Get Jetton (USDT) balance for an address.
 */
export async function getJettonBalance(
  tonClient: TonClient,
  jettonWalletAddress: Address,
): Promise<bigint> {
  try {
    const result = await tonClient.runMethod(
      jettonWalletAddress,
      "get_wallet_data",
    );
    return result.stack.readBigNumber();
  } catch {
    return 0n;
  }
}
