import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Send, Zap, ArrowRight, DollarSign, Wallet } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";

const AGENT_URL =
  import.meta.env.VITE_AGENT_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://vendton-agent.up.railway.app");

const PRESET_PROMPTS = [
  "What's the weather in Lausanne?",
  "What's the price of Bitcoin?",
  "Weather in Lausanne + Bitcoin price, sum them",
];

export default function Playground() {
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
          addStep(`Searching for "${(event.input as Record<string, unknown>)?.query}"...`);
        } else if (event.tool === "call_dvm") {
          addStep(`Calling DVM...`);
        } else if (event.tool === "check_balance") {
          addStep("Checking balance...");
        } else {
          addStep(`${event.tool}`);
        }
        break;
      case "tool_result":
        addStep(`Got result`);
        break;
      case "payment":
        addStep(`Paid ${event.amount} USDT`);
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
        addStep(`Payment required: ${event.amountReadable}`);
        break;
      case "payment_confirmed":
        addStep(`Payment confirmed`);
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

    try {
      const result = await sendJettonTransfer(
        paymentRequest.payTo,
        paymentRequest.amount,
        paymentRequest.asset,
      );

      await fetch(`${AGENT_URL}/payment-confirmed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: paymentRequest.requestId,
          txHash: result || "tonconnect-pending",
        }),
      });

      setAgentSteps((prev) => [...prev, { type: "payment", text: "Payment sent!", timestamp: Date.now() }]);
    } catch (err) {
      setAgentSteps((prev) => [...prev, { type: "error", text: `Payment failed: ${err instanceof Error ? err.message : "Unknown"}`, timestamp: Date.now() }]);
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

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

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
              handleAgentEvent(JSON.parse(line.slice(6)));
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Could not reach the AI");
    } finally {
      setAgentLoading(false);
    }
  }

  const totalSpent = agentPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10">
          <Sparkles className="w-7 h-7 text-purple-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Ask AI</h1>
          <p className="text-xs text-[var(--color-hint)]">
            {connected ? "Ask anything — approve payments from your wallet" : "Connect wallet to start"}
          </p>
        </div>
      </section>

      {/* Wallet */}
      {connected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-600">{shortAddress}</span>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      )}

      {/* Input */}
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
            {agentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPrompt(p); runAgent(p); }}
              disabled={agentLoading || !connected}
              className="px-2.5 py-1 rounded-full text-[10px] bg-[var(--color-secondary-bg)] text-[var(--color-hint)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
            >
              <Zap className="w-2.5 h-2.5 inline mr-0.5" />{p}
            </button>
          ))}
        </div>
      </section>

      {/* Steps + Payment + Response */}
      <AnimatePresence>
        {agentLoading && agentSteps.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-600 text-sm"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Working...
          </motion.div>
        )}

        {agentSteps.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
            {agentSteps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                  step.type === "payment" || step.type === "payment_confirmed"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : step.type === "payment_required"
                      ? "bg-amber-500/10 text-amber-600"
                      : step.type === "tool_call"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  step.type === "payment" ? "bg-emerald-500"
                    : step.type === "payment_required" ? "bg-amber-500"
                      : step.type === "tool_call" ? "bg-blue-500"
                        : "bg-[var(--color-hint)]"
                }`} />
                {step.text}
              </motion.div>
            ))}
          </motion.div>
        )}

        {paymentRequest && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3"
          >
            <p className="text-sm text-[var(--color-text)]">
              <strong>{paymentRequest.dvmName}</strong>{" "}
              <span className="text-amber-500 font-bold">{paymentRequest.amountReadable}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={handleApprovePayment} disabled={paymentProcessing}
                className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 bg-emerald-500"
              >
                {paymentProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />Paying...</> : "Approve & Pay"}
              </button>
              <button onClick={() => setPaymentRequest(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {agentError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-3 rounded-xl bg-red-500/10 text-sm text-red-500"
          >
            {agentError}
          </motion.div>
        )}

        {agentResponse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-4 rounded-xl bg-[var(--color-secondary-bg)] space-y-3"
          >
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{agentResponse}</p>
            {agentPayments.length > 0 && (
              <div className="border-t border-[var(--color-hint)]/20 pt-2">
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-[var(--color-hint)] font-semibold uppercase">
                    Total: {totalSpent.toFixed(2)} USDT
                  </span>
                </div>
                {agentPayments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-[var(--color-text)] py-0.5">
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
    </div>
  );
}
