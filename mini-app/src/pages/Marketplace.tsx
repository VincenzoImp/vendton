import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Search, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useDVMs } from "../hooks/useDVMs";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTonConnect } from "../hooks/useTonConnect";
import DVMCard from "../components/marketplace/DVMCard";
import PaymentFlow from "../components/payment/PaymentFlow";

const ALL_TAGS = ["weather", "data", "crypto", "finance", "geolocation", "ai", "nlp", "text", "image", "health"];

export default function Marketplace() {
  const { dvms, loading, error, search } = useDVMs();
  const { isConnected } = useWebSocket();
  const { connected, connect } = useTonConnect();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    search(q, activeTags.length > 0 ? activeTags : undefined);
  }

  function toggleTag(tag: string) {
    const newTags = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    setActiveTags(newTags);
    search(searchQuery, newTags.length > 0 ? newTags : undefined);
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#3390EC]/10">
          <Compass className="w-7 h-7 text-[#3390EC]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Explore DVMs
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Discover paid APIs and let your agent use them
          </p>
        </div>
      </section>

      {/* Status */}
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
              Gateway connected
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Gateway offline
            </>
          )}
        </div>
      </section>

      {!connected && (
        <section className="flex justify-center">
          <button
            onClick={connect}
            className="w-full max-w-xs px-6 py-3 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.97]"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Connect Wallet
          </button>
        </section>
      )}

      {/* How it works */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          How x402 Payments Work
        </h2>
        <PaymentFlow />
      </section>

      {/* Search */}
      <section className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-hint)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, tag, or description..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none"
            />
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                activeTags.includes(tag)
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* DVMs list */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Available DVMs
          {dvms.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">({dvms.length})</span>
          )}
        </h2>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-hint)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading available DVMs...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-xs text-red-500">
            Could not load DVMs. Check your connection and try again.
          </div>
        )}

        {!loading && !error && dvms.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            No DVMs found. Try a different search or create your own.
          </div>
        )}

        <AnimatePresence initial={false}>
          {dvms.map((dvm) => (
            <motion.div
              key={dvm.id}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
            >
              <DVMCard dvm={dvm} />
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
    </div>
  );
}
