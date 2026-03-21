import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Play, Square, Loader2 } from "lucide-react";
import PaymentFlow from "../components/payment/PaymentFlow";
import TransactionCard, { type Transaction } from "../components/payment/TransactionCard";

const sampleServices = [
  "Weather API",
  "Translation API",
  "Image Recognition",
  "Sentiment Analysis",
  "Price Feed Oracle",
];

function randomTx(): Transaction {
  const service = sampleServices[Math.floor(Math.random() * sampleServices.length)];
  const amount = (Math.random() * 0.5 + 0.01).toFixed(3);
  return {
    id: crypto.randomUUID(),
    service,
    amount: `${amount} TON`,
    status: "confirmed",
    timestamp: Date.now(),
  };
}

export default function AgentDemo() {
  const [running, setRunning] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [flowKey, setFlowKey] = useState(0);

  const startAgent = useCallback(() => {
    setRunning(true);
    setFlowKey((k) => k + 1);
  }, []);

  const stopAgent = useCallback(() => {
    setRunning(false);
  }, []);

  const handleFlowComplete = useCallback(() => {
    setTransactions((prev) => [randomTx(), ...prev].slice(0, 20));
    if (running) {
      setTimeout(() => setFlowKey((k) => k + 1), 800);
    }
  }, [running]);

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10">
          <Bot className="w-7 h-7 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Agent Demo
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Autonomous agent paying for API calls
          </p>
        </div>
      </section>

      {/* Controls */}
      <section className="flex gap-3">
        {!running ? (
          <button
            onClick={startAgent}
            className="flex items-center gap-2 flex-1 justify-center px-4 py-3 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.97]"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Play className="w-4 h-4" />
            Start Agent
          </button>
        ) : (
          <button
            onClick={stopAgent}
            className="flex items-center gap-2 flex-1 justify-center px-4 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm transition-transform active:scale-[0.97]"
          >
            <Square className="w-4 h-4" />
            Stop Agent
          </button>
        )}
      </section>

      {/* Status */}
      {running && (
        <div className="flex items-center gap-2 justify-center text-xs text-[var(--color-hint)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Agent is running...
        </div>
      )}

      {/* Payment flow visualization */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Payment Flow
        </h2>
        <PaymentFlow
          key={flowKey}
          autoPlay={running}
          onComplete={handleFlowComplete}
        />
      </section>

      {/* Transaction feed */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Transaction Feed
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-hint)]">
            Start the agent to see transactions appear here
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TransactionCard {...tx} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
