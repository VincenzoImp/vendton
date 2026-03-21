import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useCallback, useMemo } from "react";

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

  return {
    tonConnectUI,
    wallet,
    connected,
    address,
    shortAddress,
    connect,
    disconnect,
    sendTransaction,
  };
}
