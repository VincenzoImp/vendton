import { useMemo } from "react";
import { BarChart3, TrendingUp, Wallet, Activity } from "lucide-react";
import TransactionCard, { type Transaction } from "../components/payment/TransactionCard";
import { useTonConnect } from "../hooks/useTonConnect";

const mockTransactions: Transaction[] = [
  {
    id: "1",
    service: "Weather API",
    amount: "0.01 TON",
    status: "confirmed",
    timestamp: Date.now() - 120_000,
  },
  {
    id: "2",
    service: "Translation API",
    amount: "0.02 TON",
    status: "confirmed",
    timestamp: Date.now() - 300_000,
  },
  {
    id: "3",
    service: "Image Analysis",
    amount: "0.05 TON",
    status: "pending",
    timestamp: Date.now() - 600_000,
  },
  {
    id: "4",
    service: "Price Feed Oracle",
    amount: "0.03 TON",
    status: "confirmed",
    timestamp: Date.now() - 900_000,
  },
  {
    id: "5",
    service: "Sentiment Analysis",
    amount: "0.01 TON",
    status: "failed",
    timestamp: Date.now() - 1_200_000,
  },
  {
    id: "6",
    service: "Translation API",
    amount: "0.02 TON",
    status: "confirmed",
    timestamp: Date.now() - 1_800_000,
  },
];

export default function Dashboard() {
  const { connected, shortAddress } = useTonConnect();

  const totalSpent = useMemo(() => {
    return mockTransactions
      .filter((tx) => tx.status === "confirmed")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
      .toFixed(3);
  }, []);

  const confirmedCount = mockTransactions.filter(
    (tx) => tx.status === "confirmed",
  ).length;

  const stats = [
    {
      icon: Wallet,
      label: "Total Spent",
      value: `${totalSpent} TON`,
      color: "#3390EC",
    },
    {
      icon: Activity,
      label: "Transactions",
      value: String(mockTransactions.length),
      color: "#8B5CF6",
    },
    {
      icon: TrendingUp,
      label: "Success Rate",
      value: `${Math.round((confirmedCount / mockTransactions.length) * 100)}%`,
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
        </h2>
        <div className="space-y-2">
          {mockTransactions.map((tx) => (
            <TransactionCard key={tx.id} {...tx} />
          ))}
        </div>
      </section>
    </div>
  );
}
