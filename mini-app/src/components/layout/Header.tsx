import { TonConnectButton } from "@tonconnect/ui-react";
import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-[var(--color-secondary-bg)] bg-[var(--color-bg)]/90 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-primary)]">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">x402-TON</span>
      </div>
      <TonConnectButton />
    </header>
  );
}
