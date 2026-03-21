import { Tag } from "lucide-react";
import type { Service } from "../../hooks/useRegistry";

interface ServiceCardProps {
  service: Service;
  onCall?: (service: Service) => void;
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

export default function ServiceCard({ service, onCall, compact }: ServiceCardProps) {
  return (
    <div className="rounded-xl bg-[var(--color-secondary-bg)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                {service.name}
              </h3>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium">
                {service.priceReadable}
              </span>
            </div>
            {service.ensName && (
              <p className="text-[10px] font-mono text-purple-500 mt-0.5">
                {service.ensName}
              </p>
            )}
            {!compact && (
              <p className="text-xs text-[var(--color-hint)] mt-1 line-clamp-2">
                {service.description}
              </p>
            )}
          </div>
          {onCall && (
            <button
              onClick={() => onCall(service)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all active:scale-[0.95]"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Call
            </button>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {service.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${tagColors[tag] ?? "#64748B"}15`,
                  color: tagColors[tag] ?? "#64748B",
                }}
              >
                <Tag className="w-2 h-2" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-hint)]">
            <span>{service.callCount} calls</span>
            <span>{service.method}</span>
            {service.totalRevenue !== "0" && (
              <span>
                {(Number(service.totalRevenue) / 1_000_000).toFixed(2)} USDT earned
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
