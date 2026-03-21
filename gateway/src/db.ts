import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "mesh402.db");

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create skills table
db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    description TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    price_usdt TEXT NOT NULL,
    price_readable TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    ens_name TEXT,
    created_at INTEGER NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0,
    total_revenue TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'active',
    input_schema TEXT,
    output_example TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);
  CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
  CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_address);
`);

export default db;
