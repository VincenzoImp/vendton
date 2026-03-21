import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, Wifi, WifiOff, Send, Zap, ArrowRight, DollarSign } from "lucide-react";
import PaymentFlow from "../components/payment/PaymentFlow";
import TransactionCard, { type Transaction } from "../components/payment/TransactionCard";
import { useWebSocket } from "../hooks/useWebSocket";

const AGENT_URL =
  import.meta.env.VITE_AGENT_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://mesh402-agent.up.railway.app");

const PRESET_PROMPTS = [
  "Get me the weather in Paris and translate it to French",
  "Analyze the sentiment of: TON blockchain is amazing!",
  "Tell me a joke and translate it to Spanish",
  "What's the weather like in Tokyo?",
];

export default function Playground() {
  const { events, isConnected, lastEvent } = useWebSocket();
  const [flowKey, setFlowKey] = useState(0);
  const [flowActive, setFlowActive] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentPayments, setAgentPayments] = useState<
    Array<{ amount: string; service: string }>
  >([]);
  const [agentSteps, setAgentSteps] = useState<
    Array<{ type: string; text: string; timestamp: number }>
  >([]);

  const transactions = useMemo<Transaction[]>(
    () =>
      events.map((evt, i) => ({
        id: `${evt.transaction}-${i}`,
        service: evt.serviceName || `Payment to ${evt.payer?.slice(0, 8) || "unknown"}...`,
        amount: `${(Number(evt.amount) / 1_000_000).toFixed(2)} USDT`,
        status: "confirmed" as const,
        timestamp: typeof evt.timestamp === "number" ? evt.timestamp : Date.now(),
        txHash: evt.transaction,
      })),
    [events],
  );

  useEffect(() => {
    if (lastEvent) {
      setFlowActive(true);
      setFlowKey((k) => k + 1);
    }
  }, [lastEvent]);

  const handleFlowComplete = useCallback(() => {
    setFlowActive(false);
  }, []);

  function handleAgentEvent(event: Record<string, unknown>) {
    const addStep = (text: string) => {
      setAgentSteps((prev) => [
        ...prev,
        { type: event.type as string, text, timestamp: Date.now() },
      ]);
    };

    switch (event.type) {
      case "thinking":
        addStep("Agent is analyzing your request...");
        break;
      case "tool_call":
        if (event.tool === "discover_services") {
          addStep(
            `Searching marketplace for "${event.input && (event.input as Record<string, unknown>).query}"...`,
          );
        } else if (event.tool === "call_service") {
          addStep(
            `Calling service ${event.input && (event.input as Record<string, unknown>).service_id}...`,
          );
        } else if (event.tool === "check_balance") {
          addStep("Checking USDT balance...");
        } else {
          addStep(`Using tool: ${event.tool}`);
        }
        break;
      case "tool_result":
        addStep(`Got result from ${event.tool}`);
        break;
      case "payment":
        addStep(`Paid ${event.amount} for ${event.service}`);
        break;
      case "done":
        setAgentResponse(event.response as string);
        setAgentPayments(
          (event.payments as Array<{ amount: string; service: string }>) ?? [],
        );
        break;
      case "error":
        setAgentError(event.message as string);
        break;
    }
  }

  async function runAgent(input: string) {
    if (!input.trim()) return;
    setAgentLoading(true);
    setAgentError("");
    setAgentResponse("");
    setAgentPayments([]);
    setAgentSteps([]);

    try {
      const response = await fetch(`${AGENT_URL}/run/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              handleAgentEvent(event);
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch (err) {
      setAgentError(
        err instanceof Error ? err.message : "Failed to reach agent",
      );
    } finally {
      setAgentLoading(false);
    }
  }

  const totalSpent = agentPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10">
          <Bot className="w-7 h-7 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Agent Playground
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Give the agent a goal — watch it discover, chain, and pay for services
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

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPrompt(p); runAgent(p); }}
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
              Agent is discovering services and making payments...
            </div>
          </motion.div>
        )}

        {agentSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            {agentSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  step.type === "payment"
                    ? "bg-emerald-500/10 text-emerald-600 font-medium"
                    : step.type === "tool_call"
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    step.type === "payment"
                      ? "bg-emerald-500"
                      : step.type === "tool_call"
                        ? "bg-blue-500"
                        : step.type === "tool_result"
                          ? "bg-purple-500"
                          : "bg-[var(--color-hint)]"
                  }`}
                />
                {step.text}
              </motion.div>
            ))}
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
                <div className="flex items-center gap-1 mb-2">
                  <DollarSign className="w-3 h-3 text-emerald-500" />
                  <p className="text-[10px] text-[var(--color-hint)] font-semibold uppercase">
                    Payments Made — Total: {totalSpent.toFixed(2)} USDT
                  </p>
                </div>
                {agentPayments.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-[var(--color-text)] py-0.5"
                  >
                    <span className="flex items-center gap-1">
                      <ArrowRight className="w-2.5 h-2.5 text-[var(--color-hint)]" />
                      <span className="truncate">{p.service}</span>
                    </span>
                    <span className="font-mono font-medium shrink-0 ml-2">{p.amount}</span>
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

      {/* Payment flow */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Payment Flow
        </h2>
        <PaymentFlow key={flowKey} autoPlay={flowActive} onComplete={handleFlowComplete} />
      </section>

      {/* Transaction feed */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
          Live Transactions
          {transactions.length > 0 && (
            <span className="ml-2 text-[var(--color-text)]">({transactions.length})</span>
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
