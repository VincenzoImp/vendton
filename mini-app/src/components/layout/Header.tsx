import { TonConnectButton } from "@tonconnect/ui-react";
import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-[var(--color-secondary-bg)] bg-[var(--color-bg)]/90 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#3390EC] to-[#0088CC]">
          <Zap className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
          VendTON
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-hint)] bg-[var(--color-secondary-bg)] px-1.5 py-0.5 rounded">
          Testnet
        </span>
      </div>
      <TonConnectButton />
    </header>
  );
}
