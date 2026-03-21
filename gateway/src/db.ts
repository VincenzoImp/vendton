import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "mesh402.db");

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create dvms table
db.exec(`
  CREATE TABLE IF NOT EXISTS dvms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    endpoint TEXT,
    code TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_dvms_slug ON dvms(slug);
  CREATE INDEX IF NOT EXISTS idx_dvms_status ON dvms(status);
  CREATE INDEX IF NOT EXISTS idx_dvms_owner ON dvms(owner_address);
`);

export default db;
