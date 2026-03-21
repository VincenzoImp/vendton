import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, Wifi, WifiOff } from "lucide-react";
import PaymentFlow from "../components/payment/PaymentFlow";
import TransactionCard, {
  type Transaction,
} from "../components/payment/TransactionCard";
import { useWebSocket } from "../hooks/useWebSocket";

export default function AgentDemo() {
  const { events, isConnected, lastEvent } = useWebSocket();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [flowKey, setFlowKey] = useState(0);
  const [flowActive, setFlowActive] = useState(false);

  // Convert settlement events to transactions for display
  useEffect(() => {
    setTransactions(
      events.map((evt, i) => ({
        id: `${evt.transaction}-${i}`,
        service: `Payment to ${evt.payTo ? evt.payTo.slice(0, 8) + "..." : "unknown"}`,
        amount: `${evt.amount} ${evt.asset}`,
        status: "confirmed" as const,
        timestamp:
          typeof evt.timestamp === "number" ? evt.timestamp : Date.now(),
        txHash: evt.transaction,
      })),
    );
  }, [events]);

  // Trigger payment flow animation when a new settlement arrives
  useEffect(() => {
    if (lastEvent) {
      setFlowActive(true);
      setFlowKey((k) => k + 1);
    }
  }, [lastEvent]);

  const handleFlowComplete = useCallback(() => {
    setFlowActive(false);
  }, []);

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10">
          <Bot className="w-7 h-7 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Agent Demo
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Live agent transactions via WebSocket
          </p>
        </div>
      </section>

      {/* Connection Status */}
      <section>
        <div
          className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl text-sm font-medium ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              Connected to facilitator
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Connecting to facilitator...
            </>
          )}
        </div>
      </section>

      {/* Status */}
      {isConnected && transactions.length === 0 && (
        <div className="flex items-center gap-2 justify-center text-xs text-[var(--color-hint)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Waiting for agent transactions...
        </div>
      )}

      {/* Payment flow visualization */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Payment Flow
        </h2>
        <PaymentFlow
          key={flowKey}
          autoPlay={flowActive}
          onComplete={handleFlowComplete}
        />
      </section>

      {/* Transaction feed */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Transaction Feed
          {transactions.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">
              ({transactions.length})
            </span>
          )}
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            {isConnected
              ? "No transactions yet. Waiting for agent activity..."
              : "Connect to see live transactions"}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TransactionCard {...tx} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
