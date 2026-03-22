import type { DVMRegistration, DVMQuery } from "./types.js";
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

function rowToDVM(row: Record<string, unknown>): DVMRegistration {
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

class DVMRegistry {
  // Prepared statements
  private insertStmt = db.prepare(`
    INSERT INTO dvms (id, name, slug, endpoint, code, method, description, tags, price_usdt, price_readable, owner_address, ens_name, created_at, call_count, total_revenue, status, input_schema, output_example)
    VALUES (@id, @name, @slug, @endpoint, @code, @method, @description, @tags, @price_usdt, @price_readable, @owner_address, @ens_name, @created_at, @call_count, @total_revenue, @status, @input_schema, @output_example)
  `);

  private getByIdStmt = db.prepare(`SELECT * FROM dvms WHERE id = ?`);
  private getBySlugStmt = db.prepare(`SELECT * FROM dvms WHERE slug = ?`);
  private getActiveStmt = db.prepare(`SELECT * FROM dvms WHERE status = 'active'`);
  private getByOwnerStmt = db.prepare(`SELECT * FROM dvms WHERE owner_address = ? AND status = 'active'`);
  private incrementCallsStmt = db.prepare(`UPDATE dvms SET call_count = call_count + 1, total_revenue = CAST((CAST(total_revenue AS INTEGER) + CAST(? AS INTEGER)) AS TEXT) WHERE id = ?`);
  private removeStmt = db.prepare(`DELETE FROM dvms WHERE id = ?`);
  private countStmt = db.prepare(`SELECT COUNT(*) as count FROM dvms`);

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
  }): DVMRegistration {
    const id = generateId();
    const slug = slugify(input.name);
    const decimals = 6;
    const readable = (Number(input.priceUSDT) / Math.pow(10, decimals)).toFixed(2) + " USDT";

    // Auto-generate ENS name: <dvm>.<owner>.<platform>.eth
    const ownerShort = input.ownerAddress.replace(/^0:/, "").slice(0, 8).toLowerCase();
    const ensName = input.ensName || `${slug}.${ownerShort}.vendton.eth`;

    const dvm: DVMRegistration = {
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
      id: dvm.id,
      name: dvm.name,
      slug: dvm.slug,
      endpoint: dvm.endpoint ?? null,
      code: dvm.code ?? null,
      method: dvm.method,
      description: dvm.description,
      tags: JSON.stringify(dvm.tags),
      price_usdt: dvm.priceUSDT,
      price_readable: dvm.priceReadable,
      owner_address: dvm.ownerAddress,
      ens_name: dvm.ensName ?? null,
      created_at: dvm.createdAt,
      call_count: dvm.callCount,
      total_revenue: dvm.totalRevenue,
      status: dvm.status,
      input_schema: dvm.inputSchema ? JSON.stringify(dvm.inputSchema) : null,
      output_example: dvm.outputExample ? JSON.stringify(dvm.outputExample) : null,
    });

    return dvm;
  }

  get(id: string): DVMRegistration | undefined {
    const row = this.getByIdStmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToDVM(row) : undefined;
  }

  getBySlug(slug: string): DVMRegistration | undefined {
    const row = this.getBySlugStmt.get(slug) as Record<string, unknown> | undefined;
    return row ? rowToDVM(row) : undefined;
  }

  search(query: DVMQuery): { dvms: DVMRegistration[]; total: number } {
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

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM dvms WHERE ${where}`).get(...params) as { count: number };
    const rows = db.prepare(`SELECT * FROM dvms WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];

    let dvms = rows.map(rowToDVM);

    // Filter by tags in JS since they're stored as JSON
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map((t) => t.toLowerCase()));
      dvms = dvms.filter((s) =>
        s.tags.some((t) => tagSet.has(t.toLowerCase())),
      );
    }

    return { dvms, total: countRow.count };
  }

  remove(id: string): boolean {
    const result = this.removeStmt.run(id);
    return result.changes > 0;
  }

  incrementCalls(id: string, amount: string): void {
    this.incrementCallsStmt.run(amount, id);
  }

  getByOwner(address: string): DVMRegistration[] {
    const rows = this.getByOwnerStmt.all(address) as Record<string, unknown>[];
    return rows.map(rowToDVM);
  }

  getAll(): DVMRegistration[] {
    const rows = this.getActiveStmt.all() as Record<string, unknown>[];
    return rows.map(rowToDVM);
  }

  seed(): void {
    const { count } = this.countStmt.get() as { count: number };
    console.log(`Registry has ${count} DVMs`);
  }

  getByOwnerAndSlug(ownerPrefix: string, slug: string): DVMRegistration | undefined {
    const all = this.getAll();
    return all.find(d => {
      const short = d.ownerAddress.replace(/^0:/, "").slice(0, 8).toLowerCase();
      return short === ownerPrefix.toLowerCase() && d.slug === slug;
    });
  }
}

export const registry = new DVMRegistry();
