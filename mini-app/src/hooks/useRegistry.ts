import { useState, useEffect, useCallback } from "react";

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://mesh402-gateway.up.railway.app");

export interface Service {
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

interface UseRegistryReturn {
  services: Service[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  search: (q: string, tags?: string[]) => void;
  register: (data: RegisterInput) => Promise<Service>;
}

interface RegisterInput {
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  description: string;
  tags: string[];
  priceUSDT: string;
  ownerAddress: string;
  ensName?: string;
}

export function useRegistry(): UseRegistryReturn {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async (q?: string, tags?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tags && tags.length > 0) params.set("tags", tags.join(","));

      const res = await fetch(`${GATEWAY_URL}/api/services?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const refresh = useCallback(() => {
    fetchServices();
  }, [fetchServices]);

  const search = useCallback(
    (q: string, tags?: string[]) => {
      fetchServices(q, tags);
    },
    [fetchServices],
  );

  const register = useCallback(async (data: RegisterInput): Promise<Service> => {
    const res = await fetch(`${GATEWAY_URL}/api/services/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    await fetchServices(); // refresh list
    return result.service;
  }, [fetchServices]);

  return { services, loading, error, refresh, search, register };
}

export { GATEWAY_URL };
