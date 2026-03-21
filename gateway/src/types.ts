export interface ServiceRegistration {
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
  status: "active" | "inactive";
  inputSchema?: Record<string, unknown>;
  outputExample?: Record<string, unknown>;
}

export interface ServiceQuery {
  q?: string;
  tags?: string[];
  maxPrice?: string;
  owner?: string;
  ensName?: string;
  sortBy?: "price" | "calls" | "created" | "revenue";
  limit?: number;
  offset?: number;
}

export interface RegistryEvent {
  type: "service_registered" | "service_called" | "settlement" | "service_removed";
  serviceId?: string;
  serviceName?: string;
  payer?: string;
  amount?: string;
  transaction?: string;
  timestamp: number;
}
