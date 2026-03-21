import { CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";

export interface Transaction {
  id: string;
  service: string;
  amount: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  txHash?: string;
}

const statusConfig = {
  pending: { icon: Clock, color: "#F5A623", label: "Pending" },
  confirmed: { icon: CheckCircle2, color: "#10B981", label: "Confirmed" },
  failed: { icon: XCircle, color: "#EF4444", label: "Failed" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TransactionCard({
  service,
  amount,
  status,
  timestamp,
  txHash,
}: Transaction) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  const txUrl = txHash
    ? `https://testnet.tonviewer.com/transaction/${txHash}`
    : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-secondary-bg)]">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
        style={{ backgroundColor: `${cfg.color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] truncate">
          {service}
        </p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-[var(--color-hint)]">
            {formatTime(timestamp)}
          </p>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-[var(--color-primary)] hover:underline"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              <span className="font-mono">
                {txHash?.slice(0, 6)}...{txHash?.slice(-4)}
              </span>
            </a>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">
          {amount}
        </p>
        <p className="text-xs" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
      </div>
    </div>
  );
}
