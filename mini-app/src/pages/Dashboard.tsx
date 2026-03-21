import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Wallet, Activity, Wifi, WifiOff } from "lucide-react";
import TransactionCard, {
  type Transaction,
} from "../components/payment/TransactionCard";
import { useTonConnect } from "../hooks/useTonConnect";
import { useWebSocket } from "../hooks/useWebSocket";

export default function Dashboard() {
  const { connected, shortAddress } = useTonConnect();
  const { events, isConnected } = useWebSocket();

  // Convert settlement events to transactions
  const transactions: Transaction[] = useMemo(() => {
    return events.map((evt, i) => ({
      id: `${evt.transaction}-${i}`,
      service: `Payment to ${evt.payTo ? evt.payTo.slice(0, 8) + "..." : "unknown"}`,
      amount: `${(Number(evt.amount) / 1_000_000).toFixed(2)} USDT`,
      status: "confirmed" as const,
      timestamp: typeof evt.timestamp === "number" ? evt.timestamp : Date.now(),
      txHash: evt.transaction,
    }));
  }, [events]);

  const totalSpent = useMemo(() => {
    return transactions
      .reduce((sum, tx) => {
        const num = parseFloat(tx.amount);
        return sum + (isNaN(num) ? 0 : num);
      }, 0)
      .toFixed(3);
  }, [transactions]);

  const stats = [
    {
      icon: Wallet,
      label: "Total Spent",
      value: transactions.length > 0 ? totalSpent : "0",
      color: "#3390EC",
    },
    {
      icon: Activity,
      label: "Transactions",
      value: String(transactions.length),
      color: "#8B5CF6",
    },
    {
      icon: TrendingUp,
      label: "Success Rate",
      value: transactions.length > 0 ? "100%" : "--",
      color: "#10B981",
    },
  ];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10">
          <BarChart3 className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Dashboard
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            {connected
              ? `Connected: ${shortAddress}`
              : "Connect wallet to see your data"}
          </p>
        </div>
      </section>

      {/* Connection status */}
      <div
        className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg text-xs font-medium ${
          isConnected
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-red-500/10 text-red-500"
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            Live — receiving settlement events
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            Connecting to facilitator...
          </>
        )}
      </div>

      {/* Stats grid */}
      <section className="grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col items-center p-3 rounded-xl bg-[var(--color-secondary-bg)] gap-1"
            >
              <Icon className="w-5 h-5" style={{ color: stat.color }} />
              <span className="text-base font-bold text-[var(--color-text)]">
                {stat.value}
              </span>
              <span className="text-[10px] text-[var(--color-hint)]">
                {stat.label}
              </span>
            </div>
          );
        })}
      </section>

      {/* Recent activity */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Recent Activity
          {transactions.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">
              ({transactions.length})
            </span>
          )}
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            {isConnected
              ? "No settlement events yet this session. Transactions will appear here in real time."
              : "Connecting to facilitator..."}
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
