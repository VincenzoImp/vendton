import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, TrendingUp, Trash2, AlertTriangle } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";
import { useDVMs } from "../hooks/useDVMs";

export default function Profile() {
  const { connected, address } = useTonConnect();
  const { dvms, remove } = useDVMs();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ownedDVMs = useMemo(() => {
    if (!address) return [];
    const ownerAddr = address;
    return dvms.filter((d) => d.ownerAddress === ownerAddr);
  }, [dvms, address]);

  const totalRevenue = useMemo(() => {
    return ownedDVMs.reduce((sum, d) => sum + Number(d.totalRevenue) / 1_000_000, 0);
  }, [ownedDVMs]);

  const totalCalls = useMemo(() => {
    return ownedDVMs.reduce((sum, d) => sum + d.callCount, 0);
  }, [ownedDVMs]);

  async function confirmDelete() {
    if (!deleteTarget || !address) return;
    setDeleting(true);
    try {
      const ownerAddr = address;
      await remove(deleteTarget.id, ownerAddr);
    } catch { /* silently fail */ }
    setDeleting(false);
    setDeleteTarget(null);
  }

  if (!connected) {
    return (
      <div className="px-4 py-6 space-y-5">
        <section className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10">
            <User className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Profile</h1>
            <p className="text-xs text-[var(--color-hint)]">Connect wallet to see your DVMs</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10">
          <User className="w-7 h-7 text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-[var(--color-text)]">Profile</h1>
          <p className="text-[10px] text-[var(--color-hint)] font-mono truncate">{address}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-3 rounded-xl bg-[var(--color-secondary-bg)]">
          <span className="text-base font-bold text-emerald-500">{totalRevenue.toFixed(2)}</span>
          <span className="text-[10px] text-[var(--color-hint)]">USDT Earned</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-[var(--color-secondary-bg)]">
          <span className="text-base font-bold text-[var(--color-text)]">{totalCalls}</span>
          <span className="text-[10px] text-[var(--color-hint)]">Total Calls</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-[var(--color-secondary-bg)]">
          <span className="text-base font-bold text-[var(--color-text)]">{ownedDVMs.length}</span>
          <span className="text-[10px] text-[var(--color-hint)]">DVMs</span>
        </div>
      </section>

      {/* My DVMs */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Your DVMs
        </h2>

        {ownedDVMs.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            You haven't deployed any DVMs yet.
          </div>
        ) : (
          <div className="space-y-2">
            {ownedDVMs.map((d) => (
              <div key={d.id} className="p-3 rounded-xl bg-[var(--color-secondary-bg)] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{d.name}</p>
                    <p className="text-[10px] text-[var(--color-hint)] font-mono">{d.ensName}</p>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
                    className="p-1.5 rounded-lg text-[var(--color-hint)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-500 font-medium">
                    <TrendingUp className="w-3 h-3" />
                    {(Number(d.totalRevenue) / 1_000_000).toFixed(2)} USDT
                  </span>
                  <span className="text-[var(--color-hint)]">{d.callCount} calls</span>
                  <span className="text-[var(--color-hint)]">{d.priceReadable}/call</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm p-5 rounded-2xl bg-[var(--color-bg)] space-y-4"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-[var(--color-text)]">Delete DVM</h3>
              </div>
              <p className="text-sm text-[var(--color-hint)]">
                Are you sure you want to delete <strong className="text-[var(--color-text)]">{deleteTarget.name}</strong>? This will also revoke its ENS identity.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm bg-red-500 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
