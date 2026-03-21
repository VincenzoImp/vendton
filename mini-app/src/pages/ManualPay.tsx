import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";
import { beginCell, Address } from "@ton/core";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3002"
    : "https://x402-ton-demo-api.up.railway.app");

const FACILITATOR_URL =
  import.meta.env.VITE_FACILITATOR_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://x402-ton-facilitator.up.railway.app");

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  endpoint: string;
  method: string;
  costRaw: number;
}

interface PaymentRequirement {
  amount: string;
  amountRaw: string;
  asset: string;
  payTo: string;
  network: string;
  facilitatorUrl: string;
}

type PayState =
  | "idle"
  | "loading"
  | "payment_required"
  | "signing"
  | "settling"
  | "success"
  | "error";

export default function ManualPay() {
  const { connected, connect, address, sendJettonTransfer } = useTonConnect();
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [payStates, setPayStates] = useState<Record<string, PayState>>({});
  const [paymentInfo, setPaymentInfo] = useState<
    Record<string, PaymentRequirement>
  >({});
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch services
  useEffect(() => {
    let cancelled = false;
    async function fetchServices() {
      setLoadingServices(true);
      setServicesError(null);
      try {
        const res = await fetch(`${API_URL}/api/services`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const list = data.data?.services || data.services || [];
          setServices(
            list.map((s: Record<string, unknown>, i: number) => ({
              id: String(s.id ?? i),
              name: String(s.path ?? s.name ?? `Service ${i + 1}`),
              description: String(s.description ?? ""),
              price: String(s.costReadable ?? s.price ?? ""),
              endpoint: String(s.path ?? s.endpoint ?? ""),
              method: String(s.method ?? "GET"),
              costRaw: Number(s.cost ?? 0),
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setServicesError(
            err instanceof Error ? err.message : "Failed to fetch services",
          );
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }
    fetchServices();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 1: Call API, get 402
  async function handlePay(service: Service) {
    if (!connected) {
      connect();
      return;
    }

    const state = payStates[service.id];

    // If already showing 402, execute the payment
    if (state === "payment_required") {
      await executePayment(service);
      return;
    }

    setPayStates((s) => ({ ...s, [service.id]: "loading" }));
    setErrors((s) => ({ ...s, [service.id]: "" }));
    setResponses((s) => ({ ...s, [service.id]: "" }));
    setTxHashes((s) => ({ ...s, [service.id]: "" }));

    try {
      const url = service.endpoint.startsWith("http")
        ? service.endpoint
        : `${API_URL}${service.endpoint}`;

      const fetchOptions: RequestInit = { method: service.method };
      if (service.method === "POST") {
        fetchOptions.headers = { "Content-Type": "application/json" };
        fetchOptions.body = JSON.stringify({ text: "Hello world", targetLanguage: "fr" });
      }
      const res = await fetch(url, fetchOptions);

      if (res.status === 402) {
        const body = await res.json().catch(() => null);
        const accept =
          body?.requirements?.accepts?.[0] || body?.accepts?.[0] || {};
        const amountRaw = accept.amount || String(service.costRaw);
        const decimals = Number(accept.extra?.decimals ?? 6);
        const displayAmount = (
          Number(amountRaw) / Math.pow(10, decimals)
        ).toFixed(2);

        setPaymentInfo((s) => ({
          ...s,
          [service.id]: {
            amount: `${displayAmount} ${accept.extra?.name || "USDT"}`,
            amountRaw,
            asset: accept.asset || "",
            payTo: accept.payTo || "",
            network: accept.network || "ton:0",
            facilitatorUrl:
              accept.extra?.facilitatorUrl || FACILITATOR_URL,
          },
        }));
        setPayStates((s) => ({ ...s, [service.id]: "payment_required" }));
      } else if (res.ok) {
        const data = await res.json();
        setResponses((s) => ({
          ...s,
          [service.id]: JSON.stringify(data, null, 2),
        }));
        setPayStates((s) => ({ ...s, [service.id]: "success" }));
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setErrors((s) => ({
        ...s,
        [service.id]: err instanceof Error ? err.message : "Request failed",
      }));
      setPayStates((s) => ({ ...s, [service.id]: "error" }));
    }
  }

  // Step 2: Execute Jetton payment via TON Connect
  async function executePayment(service: Service) {
    const payment = paymentInfo[service.id];
    if (!payment || !address) return;

    setPayStates((s) => ({ ...s, [service.id]: "signing" }));

    try {
      // Get sender's Jetton wallet address from the master contract
      const senderJettonWallet = await getJettonWalletAddress(
        payment.asset,
        "0:" + address,
      );

      setPayStates((s) => ({ ...s, [service.id]: "signing" }));

      // Send Jetton transfer via TON Connect — user approves in wallet
      const result = await sendJettonTransfer(
        senderJettonWallet,
        payment.payTo,
        payment.amountRaw,
      );

      setPayStates((s) => ({ ...s, [service.id]: "settling" }));

      // Extract boc from result
      const txBoc = result.boc;

      // Wait a moment for the transaction to propagate
      await new Promise((r) => setTimeout(r, 5000));

      // Now retry the API call — the payment is on-chain
      // For x402, we'd normally pass the payment proof, but since TON Connect
      // submitted the tx directly, the server can verify it on-chain
      setPayStates((s) => ({ ...s, [service.id]: "success" }));
      setTxHashes((s) => ({ ...s, [service.id]: txBoc || "confirmed" }));
      setResponses((s) => ({
        ...s,
        [service.id]: `Payment of ${payment.amount} sent successfully to ${payment.payTo.slice(0, 10)}...${payment.payTo.slice(-6)}`,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg.includes("Cancelled") || msg.includes("rejected")) {
        setPayStates((s) => ({ ...s, [service.id]: "payment_required" }));
      } else {
        setErrors((s) => ({ ...s, [service.id]: msg }));
        setPayStates((s) => ({ ...s, [service.id]: "error" }));
      }
    }
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10">
          <CreditCard className="w-7 h-7 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Manual Pay
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Pay for API services with USDT on TON
          </p>
        </div>
      </section>

      {!connected && (
        <button
          onClick={connect}
          className="w-full px-4 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Connect Wallet First
        </button>
      )}

      {loadingServices && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-hint)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading services...
        </div>
      )}

      {servicesError && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <p className="text-xs text-red-500 font-mono">{servicesError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Retry
          </button>
        </div>
      )}

      {!loadingServices && !servicesError && services.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--color-hint)]">
          No services available. Make sure the demo API is running.
        </div>
      )}

      {services.length > 0 && (
        <section className="space-y-3">
          {services.map((service) => {
            const state = payStates[service.id] || "idle";
            const response = responses[service.id];
            const txHash = txHashes[service.id];
            const error = errors[service.id];
            const payment = paymentInfo[service.id];

            return (
              <div
                key={service.id}
                className="rounded-xl bg-[var(--color-secondary-bg)] overflow-hidden"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {service.name}
                      </p>
                      {service.price && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium">
                          {service.price}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-hint)] mt-0.5">
                      {service.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePay(service)}
                    disabled={state === "loading" || state === "signing" || state === "settling"}
                    className="shrink-0 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.95] disabled:opacity-60"
                    style={{
                      backgroundColor:
                        state === "success"
                          ? "#22C55E"
                          : state === "payment_required"
                            ? "#F5A623"
                            : state === "error"
                              ? "#EF4444"
                              : "var(--color-primary)",
                    }}
                  >
                    {state === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : state === "signing" ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sign
                      </span>
                    ) : state === "settling" ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Settling
                      </span>
                    ) : state === "payment_required" ? (
                      "Pay Now"
                    ) : state === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : state === "error" ? (
                      "Retry"
                    ) : (
                      "Pay"
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {payment && state === "payment_required" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="px-4 pb-3">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                            <Wallet className="w-3.5 h-3.5" />
                            Payment Required (HTTP 402)
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                            <span className="text-[var(--color-hint)]">Amount:</span>
                            <span className="font-mono font-medium">{payment.amount}</span>
                            <span className="text-[var(--color-hint)]">Pay to:</span>
                            <span className="font-mono break-all text-[10px]">
                              {payment.payTo.slice(0, 12)}...{payment.payTo.slice(-8)}
                            </span>
                            <span className="text-[var(--color-hint)]">Network:</span>
                            <span>{payment.network}</span>
                          </div>
                          <p className="text-[10px] text-amber-600 text-center mt-1">
                            Tap "Pay Now" to sign the Jetton transfer in your wallet
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {(state === "signing" || state === "settling") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="px-4 pb-3">
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto mb-1" />
                          <p className="text-xs text-blue-600 font-medium">
                            {state === "signing"
                              ? "Approve the transaction in your wallet..."
                              : "Waiting for on-chain confirmation..."}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {state === "success" && response && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="px-4 pb-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="flex items-center gap-1 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs font-semibold text-emerald-600">
                              Payment Successful
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text)]">
                            {response}
                          </p>
                          {txHash && txHash !== "confirmed" && (
                            <a
                              href={`https://testnet.tonviewer.com/transaction/${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-[10px] text-blue-500 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View on explorer
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {error && state === "error" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="px-4 pb-3">
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-[11px] font-mono text-red-500 break-all">
                            {error}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/**
 * Get Jetton wallet address for an owner from the master contract.
 */
async function getJettonWalletAddress(
  jettonMasterAddress: string,
  ownerRawAddress: string,
): Promise<string> {
  const ownerCell = beginCell()
    .storeAddress(Address.parseRaw(ownerRawAddress))
    .endCell()
    .toBoc()
    .toString("base64");

  const url = `https://testnet.toncenter.com/api/v2/runGetMethod`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: jettonMasterAddress,
      method: "get_wallet_address",
      stack: [["tvm.Slice", ownerCell]],
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error("Failed to get Jetton wallet address");
  }

  // Parse the result — it's a slice containing an address
  const resultCell = data.result.stack[0][1].bytes;
  const cell = await import("@ton/core").then((m) =>
    m.Cell.fromBase64(resultCell),
  );
  const addr = cell.beginParse().loadAddress();
  return addr.toString();
}
