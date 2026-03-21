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

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3002"
    : "https://x402-ton-demo-api.up.railway.app");

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  endpoint: string;
}

interface PaymentRequirement {
  amount: string;
  asset: string;
  payTo: string;
  network: string;
}

type PayState = "idle" | "loading" | "payment_required" | "error";

export default function ManualPay() {
  const { connected, connect } = useTonConnect();
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [payStates, setPayStates] = useState<Record<string, PayState>>({});
  const [paymentInfo, setPaymentInfo] = useState<
    Record<string, PaymentRequirement>
  >({});
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available services on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchServices() {
      setLoadingServices(true);
      setServicesError(null);
      try {
        const res = await fetch(`${API_URL}/api/services`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (!cancelled) {
          // Normalize: API returns { status, data: { services: [...] } }
          const list = Array.isArray(data)
            ? data
            : data.data?.services || data.services || [];
          setServices(
            list.map((s: Record<string, unknown>, i: number) => ({
              id: String(s.id ?? i),
              name: String(s.name ?? s.path ?? `Service ${i + 1}`),
              description: String(s.description ?? ""),
              price: String(s.costReadable ?? s.price ?? ""),
              endpoint: String(s.path ?? s.endpoint ?? ""),
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
        if (!cancelled) {
          setLoadingServices(false);
        }
      }
    }

    fetchServices();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePay(service: Service) {
    if (!connected) {
      connect();
      return;
    }

    setPayStates((s) => ({ ...s, [service.id]: "loading" }));
    setErrors((s) => ({ ...s, [service.id]: "" }));
    setResponses((s) => ({ ...s, [service.id]: "" }));
    setPaymentInfo((s) => {
      const copy = { ...s };
      delete copy[service.id];
      return copy;
    });

    try {
      const url = service.endpoint.startsWith("http")
        ? service.endpoint
        : `${API_URL}${service.endpoint}`;

      const res = await fetch(url);

      if (res.status === 402) {
        // Parse 402 Payment Required response
        const body = await res.json().catch(() => null);
        const accept = body?.requirements?.accepts?.[0] || body?.accepts?.[0] || body || {};
        const amountRaw = accept.amount || "0";
        const decimals = accept.extra?.decimals || 6;
        const requirement: PaymentRequirement = {
          amount: `${(Number(amountRaw) / Math.pow(10, decimals)).toFixed(decimals)} ${accept.extra?.name || "USDT"}`,
          asset: accept.asset || "USDT",
          payTo: accept.payTo || "",
          network: accept.network || "ton:0",
        };
        setPaymentInfo((s) => ({ ...s, [service.id]: requirement }));
        setPayStates((s) => ({ ...s, [service.id]: "payment_required" }));
      } else if (res.ok) {
        const data = await res.text();
        setResponses((s) => ({ ...s, [service.id]: data }));
        setPayStates((s) => ({ ...s, [service.id]: "idle" }));
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setErrors((s) => ({
        ...s,
        [service.id]:
          err instanceof Error ? err.message : "Request failed",
      }));
      setPayStates((s) => ({ ...s, [service.id]: "error" }));
    }
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10">
          <CreditCard className="w-7 h-7 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Manual Pay
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Try paid API endpoints directly
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

      {/* Loading state */}
      {loadingServices && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-hint)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading services...
        </div>
      )}

      {/* Error state */}
      {servicesError && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <p className="text-sm text-[var(--color-hint)]">
            Could not load services
          </p>
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

      {/* Empty state */}
      {!loadingServices && !servicesError && services.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--color-hint)]">
          No services available. Make sure the demo API is running.
        </div>
      )}

      {/* Services list */}
      {services.length > 0 && (
        <section className="space-y-3">
          {services.map((service) => {
            const state = payStates[service.id] || "idle";
            const response = responses[service.id];
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
                    {service.description && (
                      <p className="text-xs text-[var(--color-hint)] mt-0.5">
                        {service.description}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--color-hint)] mt-1 font-mono flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {service.endpoint}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePay(service)}
                    disabled={state === "loading"}
                    className="shrink-0 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.95] disabled:opacity-60"
                    style={{
                      backgroundColor:
                        state === "payment_required"
                          ? "#F5A623"
                          : state === "error"
                            ? "#EF4444"
                            : "var(--color-primary)",
                    }}
                  >
                    {state === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : state === "payment_required" ? (
                      "402"
                    ) : state === "error" ? (
                      "Retry"
                    ) : (
                      "Pay"
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {/* 402 Payment Required info */}
                  {payment && state === "payment_required" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-3 pt-0">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                            <Wallet className="w-3.5 h-3.5" />
                            Payment Required (HTTP 402)
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <span className="text-[var(--color-hint)]">
                              Amount:
                            </span>
                            <span className="font-mono text-[var(--color-text)] font-medium">
                              {payment.amount} {payment.asset}
                            </span>
                            <span className="text-[var(--color-hint)]">
                              Pay to:
                            </span>
                            <span className="font-mono text-[var(--color-text)] break-all">
                              {payment.payTo
                                ? `${payment.payTo.slice(0, 10)}...${payment.payTo.slice(-6)}`
                                : "N/A"}
                            </span>
                            <span className="text-[var(--color-hint)]">
                              Network:
                            </span>
                            <span className="text-[var(--color-text)]">
                              {payment.network}
                            </span>
                          </div>
                          {!connected && (
                            <button
                              onClick={connect}
                              className="w-full mt-1 px-3 py-2 rounded-lg text-white text-xs font-semibold"
                              style={{
                                backgroundColor: "var(--color-primary)",
                              }}
                            >
                              Connect Wallet to Pay
                            </button>
                          )}
                          {connected && (
                            <p className="text-[10px] text-[var(--color-hint)] text-center mt-1">
                              TON Connect payment integration coming soon
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Error message */}
                  {error && state === "error" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-3 pt-0">
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-[11px] font-mono text-red-500 break-all">
                            {error}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Success response */}
                  {response && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-3 pt-0">
                        <div className="p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-secondary-bg)]">
                          <div className="flex items-center gap-1 mb-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-600">
                              200 OK
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-[var(--color-text)] break-all">
                            {response.length > 500
                              ? response.slice(0, 500) + "..."
                              : response}
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
