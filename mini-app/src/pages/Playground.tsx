import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Wifi, WifiOff, Send, Zap, ArrowRight, DollarSign, Info, Wallet } from "lucide-react";
import TransactionCard, { type Transaction } from "../components/payment/TransactionCard";
import { useWebSocket } from "../hooks/useWebSocket";
import { useTonConnect } from "../hooks/useTonConnect";

const AGENT_URL =
  import.meta.env.VITE_AGENT_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://vendton-agent.up.railway.app");

const PRESET_PROMPTS = [
  "What's the weather like in Lausanne right now?",
  "What's the current price of Bitcoin?",
  "Get the weather in Lausanne and the price of Bitcoin, then add the temperature in Celsius to the price in USD",
];

export default function Playground() {
  const { events, isConnected } = useWebSocket();
  const { connected, shortAddress, address, connect: connectWallet, sendJettonTransfer } = useTonConnect();
  const [prompt, setPrompt] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentPayments, setAgentPayments] = useState<
    Array<{ amount: string; dvm: string }>
  >([]);
  const [agentSteps, setAgentSteps] = useState<
    Array<{ type: string; text: string; timestamp: number }>
  >([]);
  const [paymentRequest, setPaymentRequest] = useState<{
    requestId: string;
    dvmId: string;
    dvmName: string;
    amount: string;
    amountReadable: string;
    payTo: string;
    asset: string;
  } | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const transactions = useMemo<Transaction[]>(
    () =>
      events.map((evt, i) => ({
        id: `${evt.transaction}-${i}`,
        dvm: evt.dvmName || `Payment to ${evt.payer?.slice(0, 8) || "unknown"}...`,
        amount: `${(Number(evt.amount) / 1_000_000).toFixed(2)} USDT`,
        status: "confirmed" as const,
        timestamp: typeof evt.timestamp === "number" ? evt.timestamp : Date.now(),
        txHash: evt.transaction,
      })),
    [events],
  );

  function handleAgentEvent(event: Record<string, unknown>) {
    const addStep = (text: string) => {
      setAgentSteps((prev) => [
        ...prev,
        { type: event.type as string, text, timestamp: Date.now() },
      ]);
    };

    switch (event.type) {
      case "thinking":
        addStep("Thinking...");
        break;
      case "tool_call":
        if (event.tool === "discover_dvms") {
          addStep(
            `Searching for "${event.input && (event.input as Record<string, unknown>).query}"...`,
          );
        } else if (event.tool === "call_dvm") {
          addStep(
            `Calling DVM: ${event.input && (event.input as Record<string, unknown>).dvm_id}`,
          );
        } else if (event.tool === "check_balance") {
          addStep("Checking wallet balance...");
        } else {
          addStep(`Using: ${event.tool}`);
        }
        break;
      case "tool_result":
        addStep(`Received data from ${event.tool}`);
        break;
      case "payment":
        addStep(`Paid ${event.amount} USDT for ${event.dvm}`);
        break;
      case "done":
        setAgentResponse(event.response as string);
        setAgentPayments(
          (event.payments as Array<{ amount: string; dvm: string }>) ?? [],
        );
        break;
      case "payment_required":
        setPaymentRequest({
          requestId: event.requestId as string,
          dvmId: event.dvmId as string,
          dvmName: event.dvmName as string,
          amount: event.amount as string,
          amountReadable: event.amountReadable as string,
          payTo: event.payTo as string,
          asset: event.asset as string,
        });
        addStep(`Payment required: ${event.amountReadable} for ${event.dvmName}`);
        break;

      case "payment_confirmed":
        addStep(`Payment confirmed: ${event.amount} USDT`);
        setPaymentRequest(null);
        setPaymentProcessing(false);
        break;

      case "error":
        setAgentError(event.message as string);
        break;
    }
  }

  async function handleApprovePayment() {
    if (!paymentRequest) return;
    setPaymentProcessing(true);

    const addStep = (text: string) => {
      setAgentSteps((prev) => [
        ...prev,
        { type: "payment", text, timestamp: Date.now() },
      ]);
    };

    try {
      // Send Jetton transfer via TON Connect
      const result = await sendJettonTransfer(
        paymentRequest.payTo,      // recipient (DVM owner's Jetton wallet)
        paymentRequest.amount,     // amount in micro-units
        paymentRequest.asset,      // USDT Jetton master address
      );

      // Notify the agent that payment was made
      await fetch(`${AGENT_URL}/payment-confirmed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: paymentRequest.requestId,
          txHash: result || "tonconnect-pending",
        }),
      });

      addStep("Payment sent via TON Connect!");
    } catch (err) {
      addStep(`Payment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setPaymentProcessing(false);
      setPaymentRequest(null);
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
        body: JSON.stringify({ prompt: input, walletAddress: address || undefined }),
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
        err instanceof Error ? err.message : "Could not reach the agent. Please try again.",
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
          <Sparkles className="w-7 h-7 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Ask AI
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Ask anything -- the agent pays for DVMs automatically
          </p>
        </div>
      </section>

      {/* Wallet Status */}
      {connected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-600">Wallet: {shortAddress}</span>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Connect Wallet to Pay for DVMs
        </button>
      )}

      {/* How it works */}
      <section className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Info className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">
            How it works
          </span>
        </div>
        <ol className="text-[11px] text-[var(--color-hint)] leading-relaxed space-y-0.5 list-decimal list-inside">
          <li>Connect your TON wallet</li>
          <li>Ask anything — AI discovers and uses paid DVMs</li>
          <li>Approve each payment from your wallet</li>
        </ol>
      </section>

      {/* Agent Input */}
      <section className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connected && runAgent(prompt)}
            placeholder={connected ? "Ask anything..." : "Connect wallet first"}
            disabled={agentLoading || !connected}
            className="flex-1 px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none disabled:opacity-50"
          />
          <button
            onClick={() => runAgent(prompt)}
            disabled={agentLoading || !prompt.trim() || !connected}
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
              disabled={agentLoading || !connected}
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
              Working on it...
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

        {paymentRequest && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-[var(--color-text)]">Payment Required</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-text)]">
                <strong>{paymentRequest.dvmName}</strong> costs{" "}
                <span className="text-amber-500 font-bold">{paymentRequest.amountReadable}</span>
              </p>
              <p className="text-xs text-[var(--color-hint)]">
                Pay from your connected wallet to continue
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApprovePayment}
                disabled={paymentProcessing || !connected}
                className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 bg-emerald-500"
              >
                {paymentProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Approve & Pay"
                )}
              </button>
              <button
                onClick={() => setPaymentRequest(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
              >
                Cancel
              </button>
            </div>
            {!connected && (
              <button
                onClick={connectWallet}
                className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Connect Wallet First
              </button>
            )}
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
                      <span className="truncate">{p.dvm}</span>
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
            Live feed connected
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            Connecting...
          </>
        )}
      </div>

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
            Payments will appear here in real time
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
