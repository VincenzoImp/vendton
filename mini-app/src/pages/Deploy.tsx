import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hammer, Loader2, AlertTriangle, Rocket, Code2, Globe, PartyPopper } from "lucide-react";
import { useTonConnect } from "../hooks/useTonConnect";
import { useDVMs } from "../hooks/useDVMs";

const AVAILABLE_TAGS = ["weather", "data", "ai", "nlp", "translation", "entertainment", "sentiment", "text", "finance", "health", "image"];

const CODE_PLACEHOLDER = `// Your DVM receives 'input' with query params and body
// Return any JSON — callers pay your price per call

const city = input.city || "London";
const res = await fetch(\`https://wttr.in/\${city}?format=j1\`);
const data = await res.json();
return { city, temp: data.current_condition[0].temp_C };`;

export default function Deploy() {
  const { connected, connect, address } = useTonConnect();
  const { register } = useDVMs();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
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
      setError("Please fill in the name, description, and select at least one tag.");
      return;
    }

    if (!code.trim() && !endpoint.trim()) {
      setError("Write some code above or paste an external API URL.");
      return;
    }

    setDeploying(true);
    setError("");

    try {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setError("Price must be a number greater than zero.");
        setDeploying(false);
        return;
      }
      const priceUSDT = String(Math.round(priceNum * 1_000_000));
      const ownerAddr = address.includes(":") ? address : "0:" + address;

      await register({
        name,
        code: code.trim() || undefined,
        endpoint: endpoint.trim() || undefined,
        method,
        description,
        tags,
        priceUSDT,
        ownerAddress: ownerAddr,
        ensName: ensName || undefined,
      });

      setDeployed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
            <PartyPopper className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            Your DVM is Live!
          </h2>
          <p className="text-sm text-[var(--color-hint)] max-w-xs mx-auto">
            <strong>{name}</strong> is now on the marketplace. Agents can discover and pay for it automatically.
          </p>
          <button
            onClick={() => {
              setDeployed(false);
              setName("");
              setDescription("");
              setCode("");
              setEndpoint("");
              setPrice("0.10");
              setTags([]);
              setEnsName("");
            }}
            className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Create Another
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <section className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10">
          <Hammer className="w-7 h-7 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Create a DVM
          </h1>
          <p className="text-xs text-[var(--color-hint)]">
            Write code, set a price, earn USDT per call
          </p>
        </div>
      </section>

      {!connected && (
        <button
          onClick={connect}
          className="w-full px-4 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Connect Wallet to Deploy
        </button>
      )}

      {connected && (
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider mb-1">
              Name *
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
              placeholder="Describe what your DVM does..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none resize-none"
            />
          </div>

          {/* Code Section */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Code2 className="w-3.5 h-3.5 text-green-400" />
              <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
                Code (JavaScript)
              </label>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={CODE_PLACEHOLDER}
              rows={8}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono bg-gray-900 text-green-400 placeholder:text-gray-600 outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
            <p className="text-[10px] text-[var(--color-hint)] mt-1">
              Runs serverlessly. Access parameters via <code className="text-green-400/70">input</code>, use <code className="text-green-400/70">fetch</code> for HTTP. Return JSON.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-secondary-bg)]" />
            <span className="text-[10px] font-semibold text-[var(--color-hint)] uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[var(--color-secondary-bg)]" />
          </div>

          {/* External URL */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <label className="block text-xs font-semibold text-[var(--color-hint)] uppercase tracking-wider">
                External API URL
              </label>
            </div>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-secondary-bg)] text-[var(--color-text)] placeholder:text-[var(--color-hint)] outline-none"
            />
            <p className="text-[10px] text-[var(--color-hint)] mt-1">
              Proxy calls to an existing API instead of writing code
            </p>
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
              Tags * (pick at least one)
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
              placeholder="mydvm.vendton.eth"
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
                Deploy
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
