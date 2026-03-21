import { Link } from "react-router-dom";
import { useTonConnect } from "../hooks/useTonConnect";
import { useWebSocket } from "../hooks/useWebSocket";
import PaymentFlow from "../components/payment/PaymentFlow";
import { Bot, CreditCard, BarChart3, Zap, Wifi, WifiOff } from "lucide-react";

const USDT_CONTRACT = "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA";
const NETWORK = "TON Testnet";

const navCards = [
  {
    to: "/agent-demo",
    icon: Bot,
    title: "Agent Demo",
    desc: "Watch an autonomous agent pay for API calls",
    color: "#8B5CF6",
  },
  {
    to: "/manual-pay",
    icon: CreditCard,
    title: "Manual Pay",
    desc: "Try paid endpoints yourself",
    color: "#10B981",
  },
  {
    to: "/dashboard",
    icon: BarChart3,
    title: "Dashboard",
    desc: "View transaction history and analytics",
    color: "#F5A623",
  },
];

export default function Home() {
  const { connected, connect } = useTonConnect();
  const { isConnected } = useWebSocket();

  const stats = [
    { label: "Protocol", value: "x402" },
    { label: "Network", value: NETWORK.replace("TON ", "") },
    { label: "Asset", value: "USDT" },
    {
      label: "Facilitator",
      value: isConnected ? "Online" : "Offline",
    },
  ];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Hero */}
      <section className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] mx-auto">
          <Zap className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          x402 on TON
        </h1>
        <p className="text-sm text-[var(--color-hint)] max-w-xs mx-auto leading-relaxed">
          HTTP 402 payments, natively on the TON blockchain. Pay for APIs with a
          single transaction, no subscriptions required.
        </p>
      </section>

      {/* Facilitator connection status */}
      <section className="flex justify-center">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3" />
              Facilitator connected
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Facilitator offline
            </>
          )}
        </div>
      </section>

      {/* Connect Wallet */}
      {!connected && (
        <section className="flex justify-center">
          <button
            onClick={connect}
            className="w-full max-w-xs px-6 py-3 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.97]"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Connect Wallet to Start
          </button>
        </section>
      )}

      {/* Payment Flow Demo */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          How It Works
        </h2>
        <PaymentFlow />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center p-3 rounded-xl bg-[var(--color-secondary-bg)]"
          >
            <span className="text-base font-bold text-[var(--color-text)]">
              {s.value}
            </span>
            <span className="text-[10px] text-[var(--color-hint)] mt-0.5">
              {s.label}
            </span>
          </div>
        ))}
      </section>

      {/* Contract info */}
      <section className="p-3 rounded-xl bg-[var(--color-secondary-bg)]">
        <p className="text-[10px] text-[var(--color-hint)] uppercase tracking-wider mb-1">
          USDT Contract ({NETWORK})
        </p>
        <a
          href={`https://testnet.tonviewer.com/${USDT_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-[var(--color-primary)] break-all hover:underline"
        >
          {USDT_CONTRACT}
        </a>
      </section>

      {/* Navigation cards */}
      <section className="space-y-3">
        {navCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-secondary-bg)] transition-transform active:scale-[0.98]"
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{ backgroundColor: `${card.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {card.title}
                </p>
                <p className="text-xs text-[var(--color-hint)] mt-0.5">
                  {card.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
