import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { seedDatabaseIfNeeded } from "./seed-db";

let dbInstance: Database.Database | null = null;

export function getBaseStorageDir(): string {
  if (process.env.STORAGE_DIR) {
    try {
      if (!fs.existsSync(process.env.STORAGE_DIR)) {
        fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
      }
      return process.env.STORAGE_DIR;
    } catch {
      // fallback
    }
  }

  // 1. On Vercel or AWS Lambda, process.cwd() is read-only (/var/task)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpStorage = path.join(os.tmpdir(), "terra-storage");
    try {
      if (!fs.existsSync(tmpStorage)) {
        fs.mkdirSync(tmpStorage, { recursive: true });
      }
      return tmpStorage;
    } catch {
      return os.tmpdir();
    }
  }

  // 2. Standard persistent server (VPS, cPanel, local dev)
  const localDir = path.join(process.cwd(), "storage");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, ".perm_test");
    fs.writeFileSync(testFile, "1");
    fs.unlinkSync(testFile);
    return localDir;
  } catch {
    // If not writable (e.g. read-only container), fallback to os.tmpdir()
    const tmpStorage = path.join(os.tmpdir(), "terra-storage");
    try {
      if (!fs.existsSync(tmpStorage)) {
        fs.mkdirSync(tmpStorage, { recursive: true });
      }
      return tmpStorage;
    } catch {
      return os.tmpdir();
    }
  }
}

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    try {
      const dir = path.dirname(process.env.DATABASE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return process.env.DATABASE_PATH;
    } catch {
      // If writing to process.env.DATABASE_PATH fails (e.g. during build when volume is not yet mounted)
      // fallback to safe storage dir below
    }
  }
  const storageDir = getBaseStorageDir();
  return path.join(storageDir, "terra.db");
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  let dbPath = getDatabasePath();
  let db: Database.Database;
  try {
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    db = new Database(dbPath);
  } catch (err) {
    console.warn(`[getDb] Could not open database at ${dbPath}, falling back to tmpdir:`, err);
    const fallbackDir = path.join(os.tmpdir(), "terra-storage");
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    dbPath = path.join(fallbackDir, "terra.db");
    db = new Database(dbPath);
  }

  // Performance & Integrity PRAGMAs
  try {
    db.pragma("journal_mode = WAL");
  } catch {
    try {
      db.pragma("journal_mode = DELETE");
    } catch {
      // pragma ignored if unsupported
    }
  }
  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
  } catch {
    // ignore
  }

  initializeSchema(db);
  dbInstance = db;

  // Automatically seed initial data if fresh database
  try {
    seedDatabaseIfNeeded(db, false);
  } catch (err) {
    console.error("Auto seed error:", err);
  }

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
      image_url TEXT,
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
      min_subtotal_cents INTEGER DEFAULT 0,
      applies_to TEXT DEFAULT 'ALL_PRODUCTS'
    );

    CREATE TABLE IF NOT EXISTS promo_code_products (
      promo_code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      PRIMARY KEY (promo_code, product_id)
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

    -- =======================================================================
    -- STREET AMBASSADOR PROGRAM TABLES
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS ambassadors (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      instagram_handle TEXT,
      city TEXT,
      notes TEXT,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
      suspended_reason TEXT,
      joined_at TEXT NOT NULL,
      created_by_admin TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referral_codes (
      id TEXT PRIMARY KEY,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL UNIQUE,
      encrypted_code TEXT NOT NULL,
      discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
      applies_to TEXT NOT NULL CHECK (applies_to IN ('ALL_PRODUCTS', 'SELECTED')),
      is_active INTEGER NOT NULL DEFAULT 1,
      valid_from TEXT,
      valid_until TEXT,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      deactivated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_ref_code_hash ON referral_codes(code_hash);
    CREATE INDEX IF NOT EXISTS ix_ref_amb ON referral_codes(ambassador_id);

    CREATE TABLE IF NOT EXISTS discount_code_products (
      code_id TEXT NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      PRIMARY KEY (code_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS ambassador_levels (
      id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      threshold_sales INTEGER NOT NULL CHECK (threshold_sales > 0),
      description_en TEXT NOT NULL DEFAULT '',
      description_ar TEXT NOT NULL DEFAULT '',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reward_definitions (
      id TEXT PRIMARY KEY,
      level_id TEXT NOT NULL REFERENCES ambassador_levels(id) ON DELETE CASCADE,
      gift_cost_cents INTEGER,
      type TEXT NOT NULL CHECK (type IN ('FREE_GIFT', 'PERCENT_DISCOUNT_VOUCHER', 'FIXED_VOUCHER', 'CUSTOM_MANUAL')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      discount_percent INTEGER,
      max_discount_cents INTEGER,
      eligible_category TEXT DEFAULT 'Hoodies',
      max_items_per_voucher INTEGER DEFAULT 1,
      stackable INTEGER DEFAULT 0,
      validity_days INTEGER DEFAULT 30,
      requires_admin_approval INTEGER DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ambassador_rewards (
      id TEXT PRIMARY KEY,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      level_id TEXT NOT NULL REFERENCES ambassador_levels(id),
      reward_definition_id TEXT NOT NULL REFERENCES reward_definitions(id),
      definition_snapshot TEXT NOT NULL DEFAULT '{}',
      cycle INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'EARNED', 'ISSUED', 'REDEEMED', 'EXPIRED', 'REVOKED', 'REJECTED')),
      earned_at TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      rejected_reason TEXT,
      issued_at TEXT,
      expires_at TEXT,
      revoked_reason TEXT,
      UNIQUE (ambassador_id, reward_definition_id, cycle)
    );
    CREATE INDEX IF NOT EXISTS ix_amb_rewards_amb ON ambassador_rewards(ambassador_id);

    CREATE TABLE IF NOT EXISTS reward_vouchers (
      id TEXT PRIMARY KEY,
      reward_id TEXT NOT NULL UNIQUE REFERENCES ambassador_rewards(id) ON DELETE CASCADE,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id),
      code_hash TEXT NOT NULL UNIQUE,
      encrypted_code TEXT NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 80,
      max_discount_cents INTEGER,
      eligible_category TEXT DEFAULT 'Hoodies',
      eligible_product_ids TEXT DEFAULT '[]',
      max_items INTEGER DEFAULT 1,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'REVOKED')),
      redeemed_order_id TEXT,
      redeemed_at TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_voucher_hash ON reward_vouchers(code_hash);

    CREATE TABLE IF NOT EXISTS ambassador_sale_events (
      id TEXT PRIMARY KEY,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('QUALIFIED', 'REVERSED_RETURN', 'REVERSED_REFUND', 'REVERSED_ADMIN', 'REINSTATED')),
      units INTEGER NOT NULL DEFAULT 1,
      basis_snapshot TEXT NOT NULL DEFAULT 'orders',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      occurred_at TEXT NOT NULL,
      recorded_by_admin TEXT,
      source TEXT NOT NULL DEFAULT 'delivered_confirmation',
      idempotency_key TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS ix_sale_events_amb ON ambassador_sale_events(ambassador_id);
    CREATE INDEX IF NOT EXISTS ix_sale_events_ord ON ambassador_sale_events(order_id);

    CREATE TABLE IF NOT EXISTS ambassador_progress (
      ambassador_id TEXT PRIMARY KEY REFERENCES ambassadors(id) ON DELETE CASCADE,
      qualified_count INTEGER NOT NULL DEFAULT 0,
      reversed_count INTEGER NOT NULL DEFAULT 0,
      net_count INTEGER NOT NULL DEFAULT 0,
      pending_count INTEGER NOT NULL DEFAULT 0,
      cancelled_count INTEGER NOT NULL DEFAULT 0,
      refunded_count INTEGER NOT NULL DEFAULT 0,
      current_level_id TEXT REFERENCES ambassador_levels(id),
      first_qualified_at TEXT,
      last_qualified_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ambassador_milestones (
      id TEXT PRIMARY KEY,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('FIRST_SALE_CONFIRMED', 'LEVEL_REACHED', 'REWARD_ISSUED', 'REWARD_REDEEMED', 'SUSPENDED', 'REACTIVATED')),
      order_id TEXT,
      level_id TEXT,
      description TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system'
    );
    CREATE INDEX IF NOT EXISTS ix_milestones_amb ON ambassador_milestones(ambassador_id);

    CREATE TABLE IF NOT EXISTS ambassador_users (
      id TEXT PRIMARY KEY,
      ambassador_id TEXT NOT NULL UNIQUE REFERENCES ambassadors(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ambassador_sessions (
      id TEXT PRIMARY KEY,
      ambassador_user_id TEXT NOT NULL REFERENCES ambassador_users(id) ON DELETE CASCADE,
      ambassador_id TEXT NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip TEXT,
      ua TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_amb_sess ON ambassador_sessions(ambassador_user_id);

    CREATE TABLE IF NOT EXISTS fraud_flags (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      ambassador_id TEXT REFERENCES ambassadors(id) ON DELETE SET NULL,
      rule TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
      details TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLEARED', 'CONFIRMED')),
      created_at TEXT NOT NULL,
      resolved_by TEXT,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_admin_push_endpoint ON admin_push_subscriptions(endpoint);
  `);

  const orderColumns = [
    "cancelled_at TEXT",
    "cancel_reason TEXT",
    "ambassador_id TEXT",
    "ambassador_code TEXT",
    "referral_code_id TEXT",
    "attribution_locked_at TEXT",
    "fulfilment_status TEXT DEFAULT 'NOT_SHIPPED'",
    "payment_status TEXT DEFAULT 'UNPAID'",
    "delivered_at TEXT",
    "paid_at TEXT",
    "delivered_confirmed_by TEXT",
    "courier_reference TEXT",
    "code_discount_percent_applied INTEGER",
    "code_discount_cents INTEGER",
  ];

  for (const col of orderColumns) {
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col}`);
    } catch {
      /* Column already exists */
    }
  }

  try {
    db.exec("ALTER TABLE product_colors ADD COLUMN image_url TEXT;");
  } catch {
    /* Column already exists */
  }

  try {
    db.exec("ALTER TABLE promo_codes ADD COLUMN applies_to TEXT DEFAULT 'ALL_PRODUCTS';");
  } catch {
    /* Column already exists */
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS promo_code_products (
        promo_code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        PRIMARY KEY (promo_code, product_id)
      );
    `);
  } catch {
    /* Table already exists */
  }

  // Seed default ambassador levels & rewards if missing
  try {
    const existingLevels = db.prepare("SELECT COUNT(*) as c FROM ambassador_levels").get() as { c: number };
    if (!existingLevels || existingLevels.c === 0) {
      const now = new Date().toISOString();
      const insertLevel = db.prepare(`
        INSERT OR IGNORE INTO ambassador_levels (id, rank, name, threshold_sales, description_en, description_ar, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      const insertRewardDef = db.prepare(`
        INSERT OR IGNORE INTO reward_definitions (id, level_id, gift_cost_cents, type, title, description, discount_percent, max_discount_cents, eligible_category, max_items_per_voucher, stackable, validity_days, requires_admin_approval, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 30, 0, 1, ?, ?)
      `);

      // Level 1: Starter (10 sales)
      insertLevel.run("lvl_starter", 1, "Starter", 10, "Starter Ambassador - Free Brand Gift", "سفير مبتدئ - هدية مجانية خاصة من البراند", now, now);
      insertRewardDef.run("rwd_starter_gift", "lvl_starter", 25000, "FREE_GIFT", "هدية خاصة من TERRA HOP", "هدية مميزة حصرية مقدمة لسفراء المستوى الأول", null, null, null, now, now);

      // Level 2: Rising (20 sales)
      insertLevel.run("lvl_rising", 2, "Rising", 20, "Rising Ambassador - 80% Off Hoodie Voucher", "سفير صاعد - كود خصم 80% على هودي إضافي", now, now);
      insertRewardDef.run("rwd_rising_hoodie", "lvl_rising", null, "PERCENT_DISCOUNT_VOUCHER", "كود خصم 80% على أي هودي", "كود مشفر للاستخدام مرة واحدة صالح لمدة 30 يوماً على هودي من اختيارك", 80, 150000, "Hoodies", now, now);

      // Level 3: Elite (30 sales)
      insertLevel.run("lvl_elite", 3, "Elite", 30, "Elite Ambassador - VIP Drop Box", "سفير نخبة - صندوق VIP حصري من الدفعة القادمة", now, now);
      insertRewardDef.run("rwd_elite_box", "lvl_elite", 50000, "FREE_GIFT", "صندوق VIP الحصري", "صندوق هدايا وإصدار حصري قبل طرحه للجمهور", null, null, null, now, now);
    }

    try {
      const { seedAmbassadorsIfNeeded } = require("./seed-db");
      seedAmbassadorsIfNeeded(db);
    } catch {}
  } catch (err) {
    console.error("Ambassador levels seed error:", err);
  }
}

/**
 * Log a change into change_log for live SSE & polling updates
 */
export function recordChange(
  topic: "media" | "products" | "settings" | "content" | "orders" | "ambassadors",
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
