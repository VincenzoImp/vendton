import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Wallet, Activity, Wifi, WifiOff, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import TransactionCard, { type Transaction } from "../components/payment/TransactionCard";
import { useTonConnect } from "../hooks/useTonConnect";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSkills } from "../hooks/useSkills";

type Tab = "spending" | "revenue";

export default function Dashboard() {
  const { connected, shortAddress, address } = useTonConnect();
  const { events, isConnected } = useWebSocket();
  const { skills } = useSkills();
  const [activeTab, setActiveTab] = useState<Tab>("spending");

  const transactions: Transaction[] = useMemo(() => {
    return events.map((evt, i) => ({
      id: `${evt.transaction}-${i}`,
      skill: evt.skillName || `Payment to ${evt.payer?.slice(0, 8) || "unknown"}...`,
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
      .toFixed(2);
  }, [transactions]);

  const ownedSkills = useMemo(() => {
    if (!address) return [];
    const ownerAddr = address.includes(":") ? address : "0:" + address;
    return skills.filter((s) => s.ownerAddress === ownerAddr);
  }, [skills, address]);

  const totalRevenue = useMemo(() => {
    return ownedSkills
      .reduce((sum, s) => sum + Number(s.totalRevenue) / 1_000_000, 0)
      .toFixed(2);
  }, [ownedSkills]);

  const totalCalls = useMemo(() => {
    return ownedSkills.reduce((sum, s) => sum + s.callCount, 0);
  }, [ownedSkills]);

  const stats = [
    {
      icon: activeTab === "spending" ? Wallet : ArrowDownLeft,
      label: activeTab === "spending" ? "Total Spent" : "Total Revenue",
      value: activeTab === "spending" ? totalSpent : totalRevenue,
      unit: "USDT",
      color: "#3390EC",
    },
    {
      icon: Activity,
      label: activeTab === "spending" ? "Transactions" : "Total Calls",
      value: activeTab === "spending" ? String(transactions.length) : String(totalCalls),
      color: "#8B5CF6",
    },
    {
      icon: TrendingUp,
      label: activeTab === "spending" ? "Success Rate" : "Skills",
      value: activeTab === "spending"
        ? transactions.length > 0 ? "100%" : "--"
        : String(ownedSkills.length),
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

      {/* Tab switcher */}
      <section className="flex gap-2">
        {([
          { key: "spending" as Tab, label: "Spending", icon: ArrowUpRight },
          { key: "revenue" as Tab, label: "Revenue", icon: ArrowDownLeft },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
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
            Live — receiving events
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            Connecting to gateway...
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

      {/* Revenue tab — owned skills */}
      {activeTab === "revenue" && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
            Your Skills
          </h2>
          {ownedSkills.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--color-hint)]">
              {connected
                ? "You haven't deployed any skills yet."
                : "Connect wallet to see your skills."}
            </div>
          ) : (
            <div className="space-y-2">
              {ownedSkills.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-secondary-bg)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{s.name}</p>
                    <p className="text-xs text-[var(--color-hint)]">{s.callCount} calls</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-500">
                      {(Number(s.totalRevenue) / 1_000_000).toFixed(2)} USDT
                    </p>
                    <p className="text-[10px] text-[var(--color-hint)]">{s.priceReadable}/call</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent activity */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Recent Activity
          {transactions.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">({transactions.length})</span>
          )}
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            {isConnected
              ? "No events yet. Transactions appear here in real time."
              : "Connecting to gateway..."}
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
