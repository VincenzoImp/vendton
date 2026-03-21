import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  endpoint: string;
}

const services: Service[] = [
  {
    id: "weather",
    name: "Weather Data",
    description: "Current weather for any city worldwide",
    price: "0.01 TON",
    endpoint: "/api/weather",
  },
  {
    id: "translate",
    name: "Translation",
    description: "Translate text between 50+ languages",
    price: "0.02 TON",
    endpoint: "/api/translate",
  },
  {
    id: "image",
    name: "Image Analysis",
    description: "Analyze and describe image contents",
    price: "0.05 TON",
    endpoint: "/api/image-analyze",
  },
  {
    id: "sentiment",
    name: "Sentiment Analysis",
    description: "Analyze sentiment of any text",
    price: "0.01 TON",
    endpoint: "/api/sentiment",
  },
  {
    id: "oracle",
    name: "Price Oracle",
    description: "Real-time crypto price feeds",
    price: "0.03 TON",
    endpoint: "/api/price-feed",
  },
];

type PayState = "idle" | "paying" | "success";

export default function ManualPay() {
  const { connected, connect } = useTonConnect();
  const [payStates, setPayStates] = useState<Record<string, PayState>>({});
  const [responses, setResponses] = useState<Record<string, string>>({});

  async function handlePay(service: Service) {
    if (!connected) {
      connect();
      return;
    }

    setPayStates((s) => ({ ...s, [service.id]: "paying" }));

    // Simulate payment flow
    await new Promise((r) => setTimeout(r, 2000));

    setPayStates((s) => ({ ...s, [service.id]: "success" }));
    setResponses((s) => ({
      ...s,
      [service.id]: `Response from ${service.endpoint}: OK (200). Payment of ${service.price} confirmed.`,
    }));

    setTimeout(() => {
      setPayStates((s) => ({ ...s, [service.id]: "idle" }));
    }, 3000);
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

      {/* Services list */}
      <section className="space-y-3">
        {services.map((service) => {
          const state = payStates[service.id] || "idle";
          const response = responses[service.id];

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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium">
                      {service.price}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-hint)] mt-0.5">
                    {service.description}
                  </p>
                  <p className="text-[10px] text-[var(--color-hint)] mt-1 font-mono flex items-center gap-1">
                    <ExternalLink className="w-2.5 h-2.5" />
                    {service.endpoint}
                  </p>
                </div>
                <button
                  onClick={() => handlePay(service)}
                  disabled={state === "paying"}
                  className="shrink-0 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.95] disabled:opacity-60"
                  style={{
                    backgroundColor:
                      state === "success" ? "#10B981" : "var(--color-primary)",
                  }}
                >
                  {state === "paying" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : state === "success" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    "Pay"
                  )}
                </button>
              </div>

              <AnimatePresence>
                {response && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-3 pt-0">
                      <div className="p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-secondary-bg)]">
                        <p className="text-[11px] font-mono text-emerald-600 break-all">
                          {response}
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
    </div>
  );
}
