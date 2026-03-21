import { useState, useEffect, useCallback } from "react";

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://mesh402-gateway.up.railway.app");

export interface Skill {
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

interface UseSkillsReturn {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  search: (q: string, tags?: string[]) => void;
  register: (data: RegisterSkillInput) => Promise<Skill>;
}

interface RegisterSkillInput {
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

export function useSkills(): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async (q?: string, tags?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tags && tags.length > 0) params.set("tags", tags.join(","));

      const res = await fetch(`${GATEWAY_URL}/api/skills?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const refresh = useCallback(() => {
    fetchSkills();
  }, [fetchSkills]);

  const search = useCallback(
    (q: string, tags?: string[]) => {
      fetchSkills(q, tags);
    },
    [fetchSkills],
  );

  const register = useCallback(async (data: RegisterSkillInput): Promise<Skill> => {
    const res = await fetch(`${GATEWAY_URL}/api/skills/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    await fetchSkills(); // refresh list
    return result.skill;
  }, [fetchSkills]);

  return { skills, loading, error, refresh, search, register };
}

export { GATEWAY_URL };
