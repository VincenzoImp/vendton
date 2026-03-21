import type { SkillRegistration, SkillQuery } from "./types.js";
import db from "./db.js";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rowToSkill(row: Record<string, unknown>): SkillRegistration {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    endpoint: (row.endpoint as string) || undefined,
    code: (row.code as string) || undefined,
    method: row.method as "GET" | "POST",
    description: row.description as string,
    tags: JSON.parse(row.tags as string),
    priceUSDT: row.price_usdt as string,
    priceReadable: row.price_readable as string,
    ownerAddress: row.owner_address as string,
    ensName: (row.ens_name as string) || undefined,
    createdAt: row.created_at as number,
    callCount: row.call_count as number,
    totalRevenue: row.total_revenue as string,
    status: row.status as "active" | "inactive",
    inputSchema: row.input_schema ? JSON.parse(row.input_schema as string) : undefined,
    outputExample: row.output_example ? JSON.parse(row.output_example as string) : undefined,
  };
}

class SkillRegistry {
  // Prepared statements
  private insertStmt = db.prepare(`
    INSERT INTO skills (id, name, slug, endpoint, code, method, description, tags, price_usdt, price_readable, owner_address, ens_name, created_at, call_count, total_revenue, status, input_schema, output_example)
    VALUES (@id, @name, @slug, @endpoint, @code, @method, @description, @tags, @price_usdt, @price_readable, @owner_address, @ens_name, @created_at, @call_count, @total_revenue, @status, @input_schema, @output_example)
  `);

  private getByIdStmt = db.prepare(`SELECT * FROM skills WHERE id = ?`);
  private getBySlugStmt = db.prepare(`SELECT * FROM skills WHERE slug = ?`);
  private getActiveStmt = db.prepare(`SELECT * FROM skills WHERE status = 'active'`);
  private getByOwnerStmt = db.prepare(`SELECT * FROM skills WHERE owner_address = ? AND status = 'active'`);
  private incrementCallsStmt = db.prepare(`UPDATE skills SET call_count = call_count + 1, total_revenue = CAST((CAST(total_revenue AS INTEGER) + CAST(? AS INTEGER)) AS TEXT) WHERE id = ?`);
  private removeStmt = db.prepare(`UPDATE skills SET status = 'inactive' WHERE id = ?`);
  private countStmt = db.prepare(`SELECT COUNT(*) as count FROM skills`);

  register(input: {
    name: string;
    endpoint?: string;
    code?: string;
    method: "GET" | "POST";
    description: string;
    tags: string[];
    priceUSDT: string;
    ownerAddress: string;
    ensName?: string;
    inputSchema?: Record<string, unknown>;
    outputExample?: Record<string, unknown>;
  }): SkillRegistration {
    const id = generateId();
    const slug = slugify(input.name);
    const decimals = 6;
    const readable = (Number(input.priceUSDT) / Math.pow(10, decimals)).toFixed(2) + " USDT";

    // Auto-generate ENS name: <skill>.<owner>.<platform>.eth
    const ownerShort = input.ownerAddress.replace(/^0:/, "").slice(0, 8).toLowerCase();
    const ensName = input.ensName || `${slug}.${ownerShort}.mesh402.eth`;

    const skill: SkillRegistration = {
      id,
      slug,
      name: input.name,
      endpoint: input.endpoint,
      code: input.code,
      method: input.method,
      description: input.description,
      tags: input.tags,
      priceUSDT: input.priceUSDT,
      priceReadable: readable,
      ownerAddress: input.ownerAddress,
      ensName,
      createdAt: Date.now(),
      callCount: 0,
      totalRevenue: "0",
      status: "active",
      inputSchema: input.inputSchema,
      outputExample: input.outputExample,
    };

    this.insertStmt.run({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      endpoint: skill.endpoint ?? null,
      code: skill.code ?? null,
      method: skill.method,
      description: skill.description,
      tags: JSON.stringify(skill.tags),
      price_usdt: skill.priceUSDT,
      price_readable: skill.priceReadable,
      owner_address: skill.ownerAddress,
      ens_name: skill.ensName ?? null,
      created_at: skill.createdAt,
      call_count: skill.callCount,
      total_revenue: skill.totalRevenue,
      status: skill.status,
      input_schema: skill.inputSchema ? JSON.stringify(skill.inputSchema) : null,
      output_example: skill.outputExample ? JSON.stringify(skill.outputExample) : null,
    });

    return skill;
  }

  get(id: string): SkillRegistration | undefined {
    const row = this.getByIdStmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToSkill(row) : undefined;
  }

  getBySlug(slug: string): SkillRegistration | undefined {
    const row = this.getBySlugStmt.get(slug) as Record<string, unknown> | undefined;
    return row ? rowToSkill(row) : undefined;
  }

  search(query: SkillQuery): { skills: SkillRegistration[]; total: number } {
    // Build dynamic query
    const conditions: string[] = ["status = 'active'"];
    const params: unknown[] = [];

    if (query.q) {
      conditions.push("(name LIKE ? OR description LIKE ? OR tags LIKE ? OR ens_name LIKE ?)");
      const q = `%${query.q}%`;
      params.push(q, q, q, q);
    }

    if (query.maxPrice) {
      conditions.push("CAST(price_usdt AS INTEGER) <= ?");
      params.push(query.maxPrice);
    }

    if (query.owner) {
      conditions.push("owner_address = ?");
      params.push(query.owner);
    }

    if (query.ensName) {
      conditions.push("ens_name = ?");
      params.push(query.ensName);
    }

    let orderBy: string;
    switch (query.sortBy) {
      case "price":
        orderBy = "CAST(price_usdt AS INTEGER) ASC";
        break;
      case "calls":
        orderBy = "call_count DESC";
        break;
      case "revenue":
        orderBy = "CAST(total_revenue AS INTEGER) DESC";
        break;
      case "created":
      default:
        orderBy = "created_at DESC";
        break;
    }

    const where = conditions.join(" AND ");
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM skills WHERE ${where}`).get(...params) as { count: number };
    const rows = db.prepare(`SELECT * FROM skills WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];

    let skills = rows.map(rowToSkill);

    // Filter by tags in JS since they're stored as JSON
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map((t) => t.toLowerCase()));
      skills = skills.filter((s) =>
        s.tags.some((t) => tagSet.has(t.toLowerCase())),
      );
    }

    return { skills, total: countRow.count };
  }

  remove(id: string): boolean {
    const result = this.removeStmt.run(id);
    return result.changes > 0;
  }

  incrementCalls(id: string, amount: string): void {
    this.incrementCallsStmt.run(amount, id);
  }

  getByOwner(address: string): SkillRegistration[] {
    const rows = this.getByOwnerStmt.all(address) as Record<string, unknown>[];
    return rows.map(rowToSkill);
  }

  getAll(): SkillRegistration[] {
    const rows = this.getActiveStmt.all() as Record<string, unknown>[];
    return rows.map(rowToSkill);
  }

  seed(): void {
    // Only seed if the table is empty
    const { count } = this.countStmt.get() as { count: number };
    if (count > 0) {
      console.log(`Registry already has ${count} skills, skipping seed`);
      return;
    }

    const defaultOwner = process.env.DEFAULT_OWNER_ADDRESS ?? "EQAWWAQAZJl_njQR85ySavDNhB0S0DiAzBCGj5IoGif0MITD";

    this.register({
      name: "Weather Data",
      method: "GET",
      description: "Real-time weather data for any city worldwide. Returns temperature, humidity, wind, visibility, UV index.",
      tags: ["weather", "data", "geolocation"],
      priceUSDT: "100000",
      ownerAddress: defaultOwner,
      ensName: "weather.eqawwaqaaz.mesh402.eth",
      inputSchema: { type: "object", properties: { city: { type: "string", description: "City name (e.g. Paris, Tokyo, London)" } }, required: ["city"] },
      outputExample: { city: "Paris", temperature: 22, feelsLike: 20, condition: "Sunny", humidity: "45%", wind: "12 km/h NW", visibility: "10 km", uvIndex: "3" },
      code: `const city = input.city || input.q || "London";
const res = await fetch(\`https://wttr.in/\${encodeURIComponent(city)}?format=j1\`);
if (!res.ok) throw new Error("Weather service unavailable");
const data = await res.json();
const c = data.current_condition[0];
return {
  city,
  temperature: parseInt(c.temp_C),
  feelsLike: parseInt(c.FeelsLikeC),
  condition: c.weatherDesc[0].value,
  humidity: parseInt(c.humidity) + "%",
  wind: c.windspeedKmph + " km/h " + c.winddir16Point,
  visibility: c.visibility + " km",
  uvIndex: c.uvIndex,
  source: "wttr.in",
  timestamp: new Date().toISOString()
};`,
    });

    this.register({
      name: "Crypto Price",
      method: "GET",
      description: "Real-time cryptocurrency prices in USD, EUR, BTC with 24h change and market cap. Supports thousands of coins.",
      tags: ["crypto", "data", "finance"],
      priceUSDT: "50000",
      ownerAddress: defaultOwner,
      ensName: "crypto-price.eqawwaqaaz.mesh402.eth",
      inputSchema: { type: "object", properties: { coin: { type: "string", description: "Coin ID (e.g. bitcoin, ethereum, the-open-network)" } }, required: ["coin"] },
      outputExample: { coin: "bitcoin", price_usd: 67000, price_eur: 62000, price_btc: 1, change_24h: "2.50%", market_cap_usd: 1300000000000 },
      code: `const coin = (input.coin || input.q || "bitcoin").toLowerCase();
const res = await fetch(\`https://api.coingecko.com/api/v3/simple/price?ids=\${encodeURIComponent(coin)}&vs_currencies=usd,eur,btc&include_24hr_change=true&include_market_cap=true\`);
if (!res.ok) throw new Error("Price service unavailable");
const data = await res.json();
const info = data[coin];
if (!info) throw new Error(\`Coin '\${coin}' not found. Try: bitcoin, ethereum, the-open-network\`);
return {
  coin,
  price_usd: info.usd,
  price_eur: info.eur,
  price_btc: info.btc,
  change_24h: (info.usd_24h_change || 0).toFixed(2) + "%",
  market_cap_usd: info.usd_market_cap,
  source: "coingecko",
  timestamp: new Date().toISOString()
};`,
    });

    const { count: newCount } = this.countStmt.get() as { count: number };
    console.log(`Registry seeded with ${newCount} skills`);
  }
}

export const registry = new SkillRegistry();
