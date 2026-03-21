import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, CheckCircle2, Loader2, AlertTriangle, Rocket } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";
import { useSkills } from "../hooks/useSkills";

const AVAILABLE_TAGS = ["weather", "data", "ai", "nlp", "translation", "entertainment", "sentiment", "text", "finance", "health", "image"];

export default function Deploy() {
  const { connected, connect, address } = useTonConnect();
  const { register } = useSkills();

  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.10");
  const [tags, setTags] = useState<string[]>([]);
  const [ensName, setEnsName] = useState("");

  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleDeploy() {
    if (!connected || !address) {
      connect();
      return;
    }

    if (!name || !description || tags.length === 0) {
      setError("Please fill in all required fields");
      return;
    }

    setDeploying(true);
    setError("");

    try {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setError("Please enter a valid price");
        setDeploying(false);
        return;
      }
      const priceUSDT = String(Math.round(priceNum * 1_000_000));
      const ownerAddr = address.includes(":") ? address : "0:" + address;

      await register({
        name,
        endpoint: endpoint || "__BUILTIN__",
        method,
        description,
        tags,
        priceUSDT,
        ownerAddress: ownerAddr,
        ensName: ensName || undefined,
      });

      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  }

  if (deployed) {
    return (
      <div className="px-4 py-6 space-y-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4 py-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            Skill Deployed!
          </h2>
          <p className="text-sm text-[var(--color-hint)]">
            <strong>{name}</strong> is now live on the mesh402 marketplace.
            AI agents can discover and pay for it automatically.
          </p>
          <button
            onClick={() => {
              setDeployed(false);
              setName("");
              setEndpoint("");
              setDescription("");
              setPrice("0.10");
              setTags([]);
              setEnsName("");
            }}
            className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Deploy Another Skill
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10">
          <PlusCircle className="w-7 h-7 text-blue-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Deploy Skill
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Publish your API as a skill and get paid in USDT
          </p>
        </div>
      </section>

      {!connected && (
        <button
          onClick={connect}
          className="w-full px-4 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Connect Wallet First
        </button>
      )}

      {connected && (
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weather API"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your skill do?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none resize-none"
            />
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              API Endpoint (leave empty for demo)
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/skill"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none"
            />
          </div>

          {/* Method + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
                Method
              </label>
              <div className="flex gap-2">
                {(["GET", "POST"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      method === m
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
                Price (USDT)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0.01"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] outline-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              Tags * (select at least 1)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    tags.includes(tag)
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-secondary-bg)] text-[var(--color-hint)]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ENS Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              ENS Name (optional)
            </label>
            <input
              type="text"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              placeholder="myskill.mesh402.eth"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <div className="flex items-center gap-2 text-red-500 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deploy button */}
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="w-full px-4 py-3.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy to Marketplace
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
