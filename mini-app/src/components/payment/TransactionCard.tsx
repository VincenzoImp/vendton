import { CheckCircle2, Clock, XCircle } from "lucide-react";

export interface Transaction {
  id: string;
  service: string;
  amount: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "#F5A623",
    label: "Pending",
  },
  confirmed: {
    icon: CheckCircle2,
    color: "#10B981",
    label: "Confirmed",
  },
  failed: {
    icon: XCircle,
    color: "#EF4444",
    label: "Failed",
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TransactionCard({ service, amount, status, timestamp }: Transaction) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-secondary-bg)]">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] truncate">
          {service}
        </p>
        <p className="text-xs text-[var(--color-hint)]">{formatTime(timestamp)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">{amount}</p>
        <p className="text-xs" style={{ color: config.color }}>
          {config.label}
        </p>
      </div>
    </div>
  );
}
