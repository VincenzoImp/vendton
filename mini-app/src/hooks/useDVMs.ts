import { useState, useEffect, useCallback } from "react";

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://mesh402-gateway.up.railway.app");

export interface DVM {
  id: string;
  name: string;
  slug: string;
  endpoint: string;
  method: "GET" | "POST";
  description: string;
  tags: string[];
  priceUSDT: string;
  priceReadable: string;
  ownerAddress: string;
  ensName?: string;
  createdAt: number;
  callCount: number;
  totalRevenue: string;
  status: string;
  inputSchema?: Record<string, unknown>;
  outputExample?: Record<string, unknown>;
}

interface UseDVMsReturn {
  dvms: DVM[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  search: (q: string, tags?: string[]) => void;
  register: (data: RegisterDVMInput) => Promise<DVM>;
}

interface RegisterDVMInput {
  name: string;
  code?: string;
  endpoint?: string;
  method: "GET" | "POST";
  description: string;
  tags: string[];
  priceUSDT: string;
  ownerAddress: string;
  ensName?: string;
}

export function useDVMs(): UseDVMsReturn {
  const [dvms, setDVMs] = useState<DVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDVMs = useCallback(async (q?: string, tags?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tags && tags.length > 0) params.set("tags", tags.join(","));

      const res = await fetch(`${GATEWAY_URL}/api/dvms?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDVMs(data.dvms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch DVMs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDVMs();
  }, [fetchDVMs]);

  const refresh = useCallback(() => {
    fetchDVMs();
  }, [fetchDVMs]);

  const search = useCallback(
    (q: string, tags?: string[]) => {
      fetchDVMs(q, tags);
    },
    [fetchDVMs],
  );

  const register = useCallback(async (data: RegisterDVMInput): Promise<DVM> => {
    const res = await fetch(`${GATEWAY_URL}/api/dvms/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    await fetchDVMs(); // refresh list
    return result.dvm;
  }, [fetchDVMs]);

  return { dvms, loading, error, refresh, search, register };
}

export { GATEWAY_URL };
