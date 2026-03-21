import type { DVM } from "../../hooks/useDVMs";

interface DVMCardProps {
  dvm: DVM;
  onCall?: (dvm: DVM) => void;
  compact?: boolean;
}

const tagColors: Record<string, string> = {
  weather: "#3390EC",
  data: "#10B981",
  ai: "#8B5CF6",
  nlp: "#EC4899",
  translation: "#F5A623",
  language: "#F59E0B",
  entertainment: "#EF4444",
  jokes: "#F97316",
  fun: "#F97316",
  sentiment: "#6366F1",
  text: "#64748B",
  geolocation: "#0EA5E9",
};

export default function DVMCard({ dvm, onCall, compact }: DVMCardProps) {
  return (
    <div className="rounded-xl bg-[var(--color-secondary-bg)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                {dvm.name}
              </h3>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium">
                {dvm.priceReadable}
              </span>
            </div>
            {dvm.ensName && (
              <p className="text-[10px] font-mono text-purple-500 mt-0.5">
                {dvm.ensName}
              </p>
            )}
            {!compact && (
              <p className="text-xs text-[var(--color-hint)] mt-1 line-clamp-2">
                {dvm.description}
              </p>
            )}
          </div>
          {onCall && (
            <button
              onClick={() => onCall(dvm)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.95]"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Call
            </button>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {dvm.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: `${tagColors[tag] ?? "#64748B"}15`,
                  color: tagColors[tag] ?? "#64748B",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-hint)]">
            <span>{dvm.callCount} {dvm.callCount === 1 ? "call" : "calls"}</span>
            <span className="text-[var(--color-hint)]/60">|</span>
            <span>{dvm.method}</span>
            {dvm.totalRevenue !== "0" && (
              <>
                <span className="text-[var(--color-hint)]/60">|</span>
                <span className="text-emerald-600">
                  {(Number(dvm.totalRevenue) / 1_000_000).toFixed(2)} USDT earned
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
