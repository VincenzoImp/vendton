export interface SkillRegistration {
  id: string;
  name: string;
  slug: string;
  endpoint?: string;
  code?: string;
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
  status: "active" | "inactive";
  inputSchema?: Record<string, unknown>;
  outputExample?: Record<string, unknown>;
}

export interface SkillQuery {
  q?: string;
  tags?: string[];
  maxPrice?: string;
  owner?: string;
  ensName?: string;
  sortBy?: "price" | "calls" | "created" | "revenue";
  limit?: number;
  offset?: number;
}
