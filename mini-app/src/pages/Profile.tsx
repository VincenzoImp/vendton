import { useMemo } from "react";
import { User, TrendingUp, Trash2 } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";
import { useDVMs } from "../hooks/useDVMs";

export default function Profile() {
  const { connected, shortAddress, address } = useTonConnect();
  const { dvms, remove } = useDVMs();

  const ownedDVMs = useMemo(() => {
    if (!address) return [];
    const ownerAddr = address.includes(":") ? address : "0:" + address;
    return dvms.filter((d) => d.ownerAddress === ownerAddr);
  }, [dvms, address]);

  const totalRevenue = useMemo(() => {
    return ownedDVMs.reduce((sum, d) => sum + Number(d.totalRevenue) / 1_000_000, 0);
  }, [ownedDVMs]);

  const totalCalls = useMemo(() => {
    return ownedDVMs.reduce((sum, d) => sum + d.callCount, 0);
  }, [ownedDVMs]);

  async function handleDelete(dvmId: string, dvmName: string) {
    if (!confirm(`Delete "${dvmName}"? This cannot be undone.`)) return;
    if (!address) return;
    try {
      const ownerAddr = address.includes(":") ? address : "0:" + address;
      await remove(dvmId, ownerAddr);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
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
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Profile</h1>
          <p className="text-xs text-[var(--color-hint)]">{shortAddress}</p>
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
                    onClick={() => handleDelete(d.id, d.name)}
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
    </div>
  );
}
