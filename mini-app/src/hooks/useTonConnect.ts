import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useCallback, useMemo } from "react";
import { beginCell, toNano, Address } from "@ton/core";

const JETTON_TRANSFER_OP = 0xf8a7ea5;

export function useTonConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const connected = !!wallet;

  const address = useMemo(() => {
    if (!wallet) return null;
    return wallet.account.address;
  }, [wallet]);

  const shortAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [address]);

  const connect = useCallback(() => {
    tonConnectUI.openModal();
  }, [tonConnectUI]);

  const disconnect = useCallback(() => {
    tonConnectUI.disconnect();
  }, [tonConnectUI]);

  const sendTransaction = useCallback(
    async (to: string, amount: string, payload?: string) => {
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: to,
            amount,
            ...(payload ? { payload } : {}),
          },
        ],
      };
      return tonConnectUI.sendTransaction(tx);
    },
    [tonConnectUI],
  );

  /**
   * Send a Jetton (e.g. USDT) transfer via TON Connect.
   *
   * @param jettonWalletAddress - The sender's Jetton wallet address (not the master)
   * @param recipientAddress - The final recipient of the Jettons
   * @param jettonAmount - Amount in smallest units (e.g. 1000000 = 1 USDT)
   * @param responseAddress - Where to send excess TON (usually the sender)
   */
  const sendJettonTransfer = useCallback(
    async (
      jettonWalletAddress: string,
      recipientAddress: string,
      jettonAmount: string,
      responseAddress?: string,
    ) => {
      const destination = Address.parse(recipientAddress);
      const response = Address.parse(
        responseAddress ?? wallet?.account.address ?? recipientAddress,
      );

      // Build TEP-74 Jetton transfer body
      const jettonTransferBody = beginCell()
        .storeUint(JETTON_TRANSFER_OP, 32) // op: transfer
        .storeUint(0, 64) // query_id
        .storeCoins(BigInt(jettonAmount)) // amount
        .storeAddress(destination) // destination
        .storeAddress(response) // response_destination
        .storeBit(false) // no custom_payload
        .storeCoins(1n) // forward_ton_amount (minimal for notification)
        .storeBit(false) // no forward_payload
        .endCell();

      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: jettonWalletAddress,
            amount: toNano("0.1").toString(), // gas for Jetton transfer
            payload: jettonTransferBody.toBoc().toString("base64"),
          },
        ],
      };

      return tonConnectUI.sendTransaction(tx);
    },
    [tonConnectUI, wallet],
  );

  return {
    tonConnectUI,
    wallet,
    connected,
    address,
    shortAddress,
    connect,
    disconnect,
    sendTransaction,
    sendJettonTransfer,
  };
}
