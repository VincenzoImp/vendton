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
      ensName: input.ensName,
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
      name: "Weather API",
      method: "GET",
      description: "Real-time weather data for any major city worldwide. Returns temperature, conditions, humidity, and wind speed.",
      tags: ["weather", "data", "geolocation"],
      priceUSDT: "100000",
      ownerAddress: defaultOwner,
      ensName: "weather.mesh402.eth",
      inputSchema: { type: "object", properties: { city: { type: "string", description: "City name (e.g. Paris, Tokyo, London)" } }, required: ["city"] },
      outputExample: { city: "Paris", temperature: 22, condition: "Sunny", humidity: 45, wind: "12 km/h" },
      code: `const city = input.city || input.q || "London";
const res = await fetch(\`https://wttr.in/\${encodeURIComponent(city)}?format=j1\`);
if (!res.ok) throw new Error(\`wttr.in returned \${res.status}\`);
const data = await res.json();
const current = data.current_condition[0];
return {
  city,
  temperature: parseInt(current.temp_C),
  feelsLike: parseInt(current.FeelsLikeC),
  condition: current.weatherDesc[0].value,
  humidity: parseInt(current.humidity),
  windSpeed: current.windspeedKmph + " km/h",
  source: "wttr.in"
};`,
    });

    this.register({
      name: "Joke Generator",
      method: "GET",
      description: "Random programming and crypto jokes. Perfect for entertainment or chatbot integrations.",
      tags: ["entertainment", "jokes", "fun"],
      priceUSDT: "50000",
      ownerAddress: defaultOwner,
      ensName: "jokes.mesh402.eth",
      outputExample: { joke: "Why do programmers prefer dark mode? Because light attracts bugs." },
      code: `const jokes = [
  { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs." },
  { setup: "Why did the blockchain developer go broke?", punchline: "He lost his private key." },
  { setup: "What's a smart contract's favorite food?", punchline: "Gas fees." },
  { setup: "Why don't Bitcoin holders ever get cold?", punchline: "They're always holding." },
  { setup: "How does a TON validator relax?", punchline: "By staking out a good spot." },
  { setup: "Why did the API go to therapy?", punchline: "Too many broken promises." },
  { setup: "What do you call a mass of Telegram users?", punchline: "A ton of messages." },
  { setup: "Why is USDT's favorite dance the waltz?", punchline: "It always stays stable." },
];
return jokes[Math.floor(Math.random() * jokes.length)];`,
    });

    this.register({
      name: "Translation Service",
      method: "POST",
      description: "Translate text between languages. Supports French, German, Spanish, and Japanese.",
      tags: ["translation", "language", "ai", "text"],
      priceUSDT: "500000",
      ownerAddress: defaultOwner,
      ensName: "translate.mesh402.eth",
      inputSchema: { type: "object", properties: { text: { type: "string" }, targetLanguage: { type: "string", enum: ["fr", "de", "es", "ja"] } }, required: ["text", "targetLanguage"] },
      outputExample: { original: "Hello, how are you?", translated: "Bonjour, comment allez-vous?", language: "French" },
      code: `const text = input.text || input.q || "";
const lang = (input.lang || input.language || "fr").toLowerCase();
if (!text) throw new Error("Missing 'text' parameter");
const langNames = { fr: "French", de: "German", es: "Spanish", ja: "Japanese" };
const langName = langNames[lang] || lang;
const dict = {
  fr: { hello: "bonjour", goodbye: "au revoir", "thank you": "merci", yes: "oui", no: "non", weather: "m\\u00e9t\\u00e9o", blockchain: "cha\\u00eene de blocs" },
  de: { hello: "hallo", goodbye: "auf wiedersehen", "thank you": "danke", yes: "ja", no: "nein", weather: "Wetter", blockchain: "Blockchain" },
  es: { hello: "hola", goodbye: "adi\\u00f3s", "thank you": "gracias", yes: "s\\u00ed", no: "no", weather: "clima", blockchain: "cadena de bloques" },
  ja: { hello: "\\u3053\\u3093\\u306b\\u3061\\u306f", goodbye: "\\u3055\\u3088\\u3046\\u306a\\u3089", "thank you": "\\u3042\\u308a\\u304c\\u3068\\u3046", yes: "\\u306f\\u3044", no: "\\u3044\\u3044\\u3048", weather: "\\u5929\\u6c17", blockchain: "\\u30d6\\u30ed\\u30c3\\u30af\\u30c1\\u30a7\\u30fc\\u30f3" },
};
const d = dict[lang] || {};
const lower = text.toLowerCase();
if (d[lower]) return { original: text, translated: d[lower], language: langName };
return { original: text, translated: \`[\${lang.toUpperCase()}] \${text}\`, language: langName, note: "Basic translation — full neural MT in production" };`,
    });

    this.register({
      name: "Sentiment Analysis",
      method: "POST",
      description: "Analyze the sentiment of any text. Returns positive, negative, or neutral with confidence score.",
      tags: ["ai", "nlp", "sentiment", "text"],
      priceUSDT: "200000",
      ownerAddress: defaultOwner,
      ensName: "sentiment.mesh402.eth",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      outputExample: { sentiment: "positive", confidence: 0.92, keywords: ["great", "excellent"] },
      code: `const text = input.text || input.q || "";
if (!text) throw new Error("Missing 'text' parameter");
const positive = ["good","great","excellent","amazing","love","happy","wonderful","fantastic","beautiful","best","awesome","brilliant","perfect","outstanding","superb"];
const negative = ["bad","terrible","awful","hate","sad","worst","horrible","ugly","poor","disappointing","boring","stupid","broken","useless","annoying"];
const words = text.toLowerCase().split(/\\W+/);
let score = 0;
for (const w of words) {
  if (positive.includes(w)) score++;
  if (negative.includes(w)) score--;
}
const normalized = words.length > 0 ? score / words.length : 0;
const sentiment = normalized > 0.1 ? "positive" : normalized < -0.1 ? "negative" : "neutral";
return { text, sentiment, score: normalized.toFixed(3), wordCount: words.length };`,
    });

    const { count: newCount } = this.countStmt.get() as { count: number };
    console.log(`Registry seeded with ${newCount} skills`);
  }
}

export const registry = new SkillRegistry();
