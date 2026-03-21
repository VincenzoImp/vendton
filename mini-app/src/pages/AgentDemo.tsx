import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, Wifi, WifiOff, Send, Zap } from "lucide-react";
import PaymentFlow from "../components/payment/PaymentFlow";
import TransactionCard, {
  type Transaction,
} from "../components/payment/TransactionCard";
import { useWebSocket } from "../hooks/useWebSocket";

const AGENT_URL =
  import.meta.env.VITE_AGENT_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3003"
    : "https://x402-ton-agent.up.railway.app");

const PRESET_PROMPTS = [
  "Get me the weather in Paris and tell me a joke",
  "Tell me a programming joke",
  "What's the weather like in Tokyo?",
];

export default function AgentDemo() {
  const { events, isConnected, lastEvent } = useWebSocket();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [flowKey, setFlowKey] = useState(0);
  const [flowActive, setFlowActive] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentPayments, setAgentPayments] = useState<
    Array<{ amount: string; service: string }>
  >([]);

  useEffect(() => {
    setTransactions(
      events.map((evt, i) => ({
        id: `${evt.transaction}-${i}`,
        service: `Payment to ${evt.payTo ? evt.payTo.slice(0, 8) + "..." : "unknown"}`,
        amount:
          Number(evt.amount) > 1000
            ? `${(Number(evt.amount) / 1_000_000).toFixed(2)} USDT`
            : `${evt.amount} USDT`,
        status: "confirmed" as const,
        timestamp:
          typeof evt.timestamp === "number" ? evt.timestamp : Date.now(),
        txHash: evt.transaction,
      })),
    );
  }, [events]);

  useEffect(() => {
    if (lastEvent) {
      setFlowActive(true);
      setFlowKey((k) => k + 1);
    }
  }, [lastEvent]);

  const handleFlowComplete = useCallback(() => {
    setFlowActive(false);
  }, []);

  async function runAgent(input: string) {
    if (!input.trim()) return;
    setAgentLoading(true);
    setAgentError("");
    setAgentResponse("");
    setAgentPayments([]);

    try {
      const res = await fetch(`${AGENT_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAgentResponse(data.response);
      setAgentPayments(data.payments || []);
    } catch (err) {
      setAgentError(
        err instanceof Error ? err.message : "Failed to reach agent",
      );
    } finally {
      setAgentLoading(false);
    }
  }

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
            Watch an AI agent pay for APIs autonomously
          </p>
        </div>
      </section>

      {/* Agent Input */}
      <section className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAgent(prompt)}
            placeholder="Ask the agent to do something..."
            disabled={agentLoading}
            className="flex-1 px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none disabled:opacity-50"
          />
          <button
            onClick={() => runAgent(prompt)}
            disabled={agentLoading || !prompt.trim()}
            className="px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {agentLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Preset prompts */}
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setPrompt(p);
                runAgent(p);
              }}
              disabled={agentLoading}
              className="px-3 py-1.5 rounded-lg text-[11px] bg-[var(--color-secondary-bg)] text-[var(--color-hint)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
            >
              <Zap className="w-3 h-3 inline mr-1" />
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Agent Response */}
      <AnimatePresence>
        {agentLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 text-purple-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Agent is thinking and making payments...
            </div>
          </motion.div>
        )}

        {agentError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <p className="text-sm text-red-500">{agentError}</p>
          </motion.div>
        )}

        {agentResponse && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-[var(--color-secondary-bg)] space-y-3"
          >
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {agentResponse}
            </p>
            {agentPayments.length > 0 && (
              <div className="border-t border-[var(--color-hint)]/20 pt-2">
                <p className="text-[10px] text-[var(--color-hint)] font-semibold uppercase mb-1">
                  Payments Made
                </p>
                {agentPayments.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-[var(--color-text)]"
                  >
                    <span className="font-mono">{p.amount}</span>
                    <span className="text-[var(--color-hint)] truncate ml-2">
                      {p.service}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Status */}
      <div
        className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg text-xs font-medium ${
          isConnected
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-red-500/10 text-red-500"
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3 h-3" />
            Live transaction feed connected
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            Connecting to live feed...
          </>
        )}
      </div>

      {/* Payment flow visualization */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Payment Flow
        </h2>
        <PaymentFlow
          key={flowKey}
          autoPlay={flowActive}
          onComplete={handleFlowComplete}
        />
      </section>

      {/* Transaction feed */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          On-chain Transactions
          {transactions.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">
              ({transactions.length})
            </span>
          )}
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--color-hint)]">
            Transactions will appear here as the agent makes payments
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
