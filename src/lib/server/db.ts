import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  const storageDir = path.join(process.cwd(), "storage");
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  return path.join(storageDir, "terra.db");
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const db = new Database(dbPath);

  // Performance & Integrity PRAGMAs
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  initializeSchema(db);
  dbInstance = db;
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL UNIQUE,
      mime TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      original_name TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_slots (
      key TEXT PRIMARY KEY,
      label_ar TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('single','list')),
      min_items INTEGER NOT NULL DEFAULT 0,
      max_items INTEGER,
      aspect TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS image_placements (
      id TEXT PRIMARY KEY,
      slot_key TEXT NOT NULL REFERENCES image_slots(key),
      owner_id TEXT,
      asset_id TEXT NOT NULL REFERENCES assets(id),
      position INTEGER NOT NULL,
      alt_ar TEXT NOT NULL DEFAULT '',
      alt_en TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_pl ON image_placements(slot_key, owner_id, position);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '',
      description_ar TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      compare_at_cents INTEGER,
      status TEXT NOT NULL CHECK (status IN ('active','sold_out','draft','archived')),
      force_sold_out INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER,
      details TEXT NOT NULL DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_colors (
      id TEXT,
      product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
      name TEXT,
      hex TEXT,
      position INTEGER,
      PRIMARY KEY (product_id, id)
    );

    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color_id TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      UNIQUE (product_id, color_id, size)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      variant_id TEXT,
      product_id TEXT,
      kind TEXT,
      delta INTEGER,
      note TEXT,
      order_id TEXT,
      at TEXT,
      by TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      group_key TEXT,
      key TEXT,
      value TEXT,
      updated_at TEXT,
      updated_by TEXT,
      PRIMARY KEY (group_key, key)
    );

    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value_ar TEXT,
      value_en TEXT,
      revision INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      kind TEXT CHECK (kind IN ('percent','fixed')),
      value INTEGER,
      active INTEGER,
      starts_at TEXT,
      expires_at TEXT,
      max_uses INTEGER,
      used INTEGER DEFAULT 0,
      min_subtotal_cents INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      revision INTEGER NOT NULL,
      at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT,
      entity TEXT,
      entity_id TEXT,
      before TEXT,
      after TEXT,
      ip TEXT,
      at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE,
      source TEXT,
      status TEXT,
      customer_enc BLOB NOT NULL,
      notes TEXT,
      subtotal_cents INTEGER,
      shipping_cents INTEGER,
      discount_cents INTEGER,
      promo_code TEXT,
      total_cents INTEGER,
      created_at TEXT,
      sold_at TEXT,
      revision INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT,
      variant_id TEXT,
      product_name TEXT,
      color_name TEXT,
      size TEXT,
      qty INTEGER,
      price_cents_snapshot INTEGER
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,
      created_at TEXT,
      expires_at TEXT,
      revoked_at TEXT,
      ip TEXT,
      ua TEXT
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response TEXT,
      created_at TEXT
    );
  `);
}

/**
 * Log a change into change_log for live SSE & polling updates
 */
export function recordChange(
  topic: "media" | "products" | "settings" | "content" | "orders",
  entity: string,
  entityId: string | null,
  revision: number
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO change_log (topic, entity, entity_id, revision, at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(topic, entity, entityId, revision, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

/**
 * Get latest change_log revision for a topic or overall
 */
export function getLatestRevision(topic?: string): number {
  const db = getDb();
  if (topic) {
    const row = db
      .prepare(`SELECT MAX(revision) as rev FROM change_log WHERE topic = ?`)
      .get(topic) as { rev: number | null } | undefined;
    return row?.rev ?? 1;
  }
  const row = db.prepare(`SELECT MAX(id) as rev FROM change_log`).get() as
    | { rev: number | null }
    | undefined;
  return row?.rev ?? 1;
}

/**
 * Log an action into audit_log
 */
export function recordAudit(entry: {
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (actor, action, entity, entity_id, before, after, ip, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.actor,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.before ? JSON.stringify(entry.before) : null,
    entry.after ? JSON.stringify(entry.after) : null,
    entry.ip ?? null,
    new Date().toISOString()
  );
}
