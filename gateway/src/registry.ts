import type { ServiceRegistration, ServiceQuery } from "./types.js";
import { config } from "./config.js";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

class ServiceRegistry {
  private services: Map<string, ServiceRegistration> = new Map();
  private slugIndex: Map<string, string> = new Map();

  register(input: {
    name: string;
    endpoint: string;
    method: "GET" | "POST";
    description: string;
    tags: string[];
    priceUSDT: string;
    ownerAddress: string;
    ensName?: string;
    inputSchema?: Record<string, unknown>;
    outputExample?: Record<string, unknown>;
  }): ServiceRegistration {
    const id = generateId();
    const slug = slugify(input.name);
    const decimals = 6;
    const readable = (Number(input.priceUSDT) / Math.pow(10, decimals)).toFixed(2) + " USDT";

    const service: ServiceRegistration = {
      id,
      slug,
      name: input.name,
      endpoint: input.endpoint,
      method: input.method,
      description: input.description,
      tags: input.tags,
      priceUSDT: input.priceUSDT,
      priceReadable: readable,
      ownerAddress: input.ownerAddress,
      ensName: input.ensName,
      createdAt: Date.now(),
      callCount: 0,
      totalRevenue: "0",
      status: "active",
      inputSchema: input.inputSchema,
      outputExample: input.outputExample,
    };

    this.services.set(id, service);
    this.slugIndex.set(slug, id);
    return service;
  }

  get(id: string): ServiceRegistration | undefined {
    return this.services.get(id);
  }

  getBySlug(slug: string): ServiceRegistration | undefined {
    const id = this.slugIndex.get(slug);
    return id ? this.services.get(id) : undefined;
  }

  search(query: ServiceQuery): { services: ServiceRegistration[]; total: number } {
    let results = Array.from(this.services.values()).filter(
      (s) => s.status === "active",
    );

    if (query.q) {
      const q = query.q.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          (s.ensName && s.ensName.toLowerCase().includes(q)),
      );
    }

    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map((t) => t.toLowerCase()));
      results = results.filter((s) =>
        s.tags.some((t) => tagSet.has(t.toLowerCase())),
      );
    }

    if (query.maxPrice) {
      const max = BigInt(query.maxPrice);
      results = results.filter((s) => BigInt(s.priceUSDT) <= max);
    }

    if (query.owner) {
      results = results.filter((s) => s.ownerAddress === query.owner);
    }

    if (query.ensName) {
      results = results.filter((s) => s.ensName === query.ensName);
    }

    const total = results.length;

    switch (query.sortBy) {
      case "price":
        results.sort((a, b) => Number(BigInt(a.priceUSDT) - BigInt(b.priceUSDT)));
        break;
      case "calls":
        results.sort((a, b) => b.callCount - a.callCount);
        break;
      case "revenue":
        results.sort((a, b) => Number(BigInt(b.totalRevenue) - BigInt(a.totalRevenue)));
        break;
      case "created":
      default:
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    results = results.slice(offset, offset + limit);

    return { services: results, total };
  }

  remove(id: string): boolean {
    const service = this.services.get(id);
    if (!service) return false;
    service.status = "inactive";
    return true;
  }

  incrementCalls(id: string, amount: string): void {
    const service = this.services.get(id);
    if (!service) return;
    service.callCount += 1;
    service.totalRevenue = String(BigInt(service.totalRevenue) + BigInt(amount));
  }

  getByOwner(address: string): ServiceRegistration[] {
    return Array.from(this.services.values()).filter(
      (s) => s.ownerAddress === address && s.status === "active",
    );
  }

  getAll(): ServiceRegistration[] {
    return Array.from(this.services.values()).filter(
      (s) => s.status === "active",
    );
  }

  seed(): void {
    const defaultOwner = process.env.DEFAULT_OWNER_ADDRESS ?? "EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD";

    this.register({
      name: "Weather API",
      endpoint: "__BUILTIN__",
      method: "GET",
      description: "Real-time weather data for any major city worldwide. Returns temperature, conditions, humidity, and wind speed.",
      tags: ["weather", "data", "geolocation"],
      priceUSDT: "100000",
      ownerAddress: defaultOwner,
      ensName: "weather.mesh402.eth",
      inputSchema: { type: "object", properties: { city: { type: "string", description: "City name (e.g. Paris, Tokyo, London)" } }, required: ["city"] },
      outputExample: { city: "Paris", temperature: 22, condition: "Sunny", humidity: 45, wind: "12 km/h" },
    });

    this.register({
      name: "Joke Generator",
      endpoint: "__BUILTIN__",
      method: "GET",
      description: "Random programming and crypto jokes. Perfect for entertainment or chatbot integrations.",
      tags: ["entertainment", "jokes", "fun"],
      priceUSDT: "50000",
      ownerAddress: defaultOwner,
      ensName: "jokes.mesh402.eth",
      outputExample: { joke: "Why do programmers prefer dark mode? Because light attracts bugs." },
    });

    this.register({
      name: "Translation Service",
      endpoint: "__BUILTIN__",
      method: "POST",
      description: "Translate text between languages. Supports French, German, Spanish, and Japanese.",
      tags: ["translation", "language", "ai", "text"],
      priceUSDT: "500000",
      ownerAddress: defaultOwner,
      ensName: "translate.mesh402.eth",
      inputSchema: { type: "object", properties: { text: { type: "string" }, targetLanguage: { type: "string", enum: ["fr", "de", "es", "ja"] } }, required: ["text", "targetLanguage"] },
      outputExample: { original: "Hello, how are you?", translated: "Bonjour, comment allez-vous?", language: "French" },
    });

    this.register({
      name: "Sentiment Analysis",
      endpoint: "__BUILTIN__",
      method: "POST",
      description: "Analyze the sentiment of any text. Returns positive, negative, or neutral with confidence score.",
      tags: ["ai", "nlp", "sentiment", "text"],
      priceUSDT: "200000",
      ownerAddress: defaultOwner,
      ensName: "sentiment.mesh402.eth",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      outputExample: { sentiment: "positive", confidence: 0.92, keywords: ["great", "excellent"] },
    });

    console.log(`Registry seeded with ${this.services.size} services`);
  }
}

export const registry = new ServiceRegistry();
