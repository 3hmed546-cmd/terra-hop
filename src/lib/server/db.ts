import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { seedDatabaseIfNeeded } from "./seed-db";
import {
  hashPassword,
  hashBlindIndex,
  encryptText,
  decryptText,
  hashLookupCode,
  encryptCode,
  decryptCode,
} from "./security";

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

  // 1. Check persistent cPanel external directory if present
  if (fs.existsSync("/home/terrahop/terra-hop-storage")) {
    const pDir = "/home/terrahop/terra-hop-storage";
    try {
      const testFile = path.join(pDir, ".perm_test");
      fs.writeFileSync(testFile, "1");
      fs.unlinkSync(testFile);
      return pDir;
    } catch {}
  }

  // 2. On Vercel or AWS Lambda, process.cwd() is read-only (/var/task)
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

  // Sync admin credentials from environment variable ADMIN_PASSWORD securely into admin_users (Supabase bcrypt standard)
  try {
    syncAdminCredentials(db);
  } catch (err) {
    console.error("Auto sync admin credentials error:", err);
  }

  // Encrypt existing promo codes at rest (Supabase Vault AEAD AES-256-GCM standard)
  try {
    migratePromoCodesEncryption(db);
  } catch (err) {
    console.error("Auto migrate promo codes encryption error:", err);
  }

  // Automatically seed initial data if fresh database
  try {
    seedDatabaseIfNeeded(db, false);
  } catch (err) {
    console.error("Auto seed error:", err);
  }

  return db;
}

export function updateEnvAdminEmail(newEmail: string): void {
  try {
    const envFiles = [
      path.join(process.cwd(), ".env.local"),
      path.join(process.cwd(), ".env.production"),
      path.join(process.cwd(), ".env"),
    ];
    for (const envPath of envFiles) {
      if (!fs.existsSync(envPath)) continue;
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("ADMIN_EMAIL=")) {
        content = content.replace(/ADMIN_EMAIL=[^\r\n]*/g, `ADMIN_EMAIL=${newEmail}`);
      } else {
        content += `\nADMIN_EMAIL=${newEmail}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
    }
    process.env.ADMIN_EMAIL = newEmail;
  } catch (err) {
    console.error("[updateEnvAdminEmail] Error updating env files:", err);
  }
}

export function updateEnvAdminPassword(email: string, newRawPass: string): void {
  try {
    const envFiles = [
      path.join(process.cwd(), ".env.local"),
      path.join(process.cwd(), ".env.production"),
      path.join(process.cwd(), ".env"),
    ];
    for (const envPath of envFiles) {
      if (!fs.existsSync(envPath)) continue;
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("ADMIN_PASSWORD=")) {
        content = content.replace(/ADMIN_PASSWORD=[^\r\n]*/g, `ADMIN_PASSWORD=${newRawPass}`);
      } else {
        content += `\nADMIN_PASSWORD=${newRawPass}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
    }
    process.env.ADMIN_PASSWORD = newRawPass;
  } catch (err) {
    console.error("[updateEnvAdminPassword] Error updating env files:", err);
  }
}

export function syncManagerToEnv(email: string, username: string, passwordHash: string): void {
  const envFiles = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.production"),
    path.join(process.cwd(), ".env"),
  ];
  const safeUser = username.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const envKey = `MANAGER_${safeUser}_HASH`;
  const infoKey = `MANAGER_${safeUser}_EMAIL`;

  for (const envPath of envFiles) {
    try {
      if (!fs.existsSync(envPath)) continue;
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes(`${envKey}=`)) {
        content = content.replace(new RegExp(`${envKey}=[^\r\n]*`), `${envKey}=${passwordHash}`);
        content = content.replace(new RegExp(`${infoKey}=[^\r\n]*`), `${infoKey}=${email}`);
      } else {
        content += `\n# Store Manager: ${username} (${email})\n${infoKey}=${email}\n${envKey}=${passwordHash}\n`;
      }
      fs.writeFileSync(envPath, content, "utf-8");
    } catch (err) {
      console.error(`[syncManagerToEnv] Error writing ${envPath}:`, err);
    }
  }
}

export function removeManagerFromEnv(username: string): void {
  const envFiles = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.production"),
    path.join(process.cwd(), ".env"),
  ];
  const safeUser = username.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const envKey = `MANAGER_${safeUser}_HASH`;
  const infoKey = `MANAGER_${safeUser}_EMAIL`;

  for (const envPath of envFiles) {
    try {
      if (!fs.existsSync(envPath)) continue;
      let content = fs.readFileSync(envPath, "utf-8");
      content = content.replace(new RegExp(`\n?# Store Manager: ${username}[^\r\n]*\n?`), "");
      content = content.replace(new RegExp(`\n?${infoKey}=[^\r\n]*\n?`), "\n");
      content = content.replace(new RegExp(`\n?${envKey}=[^\r\n]*\n?`), "\n");
      fs.writeFileSync(envPath, content, "utf-8");
    } catch (err) {
      console.error(`[removeManagerFromEnv] Error writing ${envPath}:`, err);
    }
  }
}

export function syncAdminCredentials(db: Database.Database): void {
  try {
    let rawPass = process.env.ADMIN_PASSWORD || "A5eapu/8$e9Gwpf";
    if (rawPass === "A5eapu/8") {
      rawPass = "A5eapu/8$e9Gwpf";
    }
    const email = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
    const passwordHash = hashPassword(rawPass); // Supabase bcrypt ($2b$10$)
    const emailHash = hashBlindIndex(email, "email");
    const encryptedEmail = encryptText(email);
    const usernameHash = hashBlindIndex("admin", "username");
    const encryptedUsername = encryptText("admin");
    const now = new Date().toISOString();

    // Check if root admin already exists
    const existingRoot = db
      .prepare("SELECT id, email, username, password_hash FROM admin_users WHERE id = 'admin-root'")
      .get() as { id: string; email: string; username?: string; password_hash?: string } | undefined;

    if (existingRoot) {
      // Root admin already exists. Preserve their custom email and username; do not overwrite with static env defaults!
      if (!existingRoot.password_hash) {
        db.prepare("UPDATE admin_users SET password_hash = ?, role = 'master' WHERE id = 'admin-root'").run(
          passwordHash
        );
      }
      return;
    }

    // If no root admin user exists, insert the initial root admin
    db.prepare(`
      INSERT INTO admin_users (
        id, email, email_hash, encrypted_email, username_hash, encrypted_username,
        password_hash, role, username, must_change_password, created_at
      )
      VALUES ('admin-root', ?, ?, ?, ?, ?, ?, 'master', 'admin', 0, ?)
    `).run(email, emailHash, encryptedEmail, usernameHash, encryptedUsername, passwordHash, now);
  } catch (err) {
    console.error("[syncAdminCredentials] Error updating admin credentials:", err);
  }
}

export function migratePromoCodesEncryption(db: Database.Database): void {
  try {
    const unencrypted = db
      .prepare("SELECT code FROM promo_codes WHERE code_hash IS NULL OR encrypted_code IS NULL")
      .all() as { code: string }[];
    if (unencrypted && unencrypted.length > 0) {
      const updateStmt = db.prepare("UPDATE promo_codes SET code_hash = ?, encrypted_code = ? WHERE code = ?");
      for (const row of unencrypted) {
        if (!row.code) continue;
        const cHash = hashLookupCode(row.code);
        const encCode = encryptCode(row.code);
        updateStmt.run(cHash, encCode, row.code);
      }
    }
  } catch (err) {
    console.error("[migratePromoCodesEncryption] Error migrating promo codes:", err);
  }
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
      order_id TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      response TEXT,
      status_code INTEGER DEFAULT 200,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      customer_phone TEXT,
      customer_email TEXT,
      order_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_promo_red_lookup ON promo_redemptions(code, customer_phone, customer_email);

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

    CREATE TABLE IF NOT EXISTS confirmed_customers (
      id TEXT PRIMARY KEY,
      phone_hash TEXT UNIQUE NOT NULL,
      customer_enc BLOB NOT NULL,
      raw_phone_masked TEXT,
      customer_name_preview TEXT,
      orders_count INTEGER DEFAULT 1,
      total_spent_cents INTEGER DEFAULT 0,
      last_order_number TEXT,
      last_order_at TEXT,
      marketing_opt_in INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_conf_cust_hash ON confirmed_customers(phone_hash);
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
    "wa_message_id TEXT",
    "wa_remote_jid TEXT",
    "wa_lid TEXT",
    "wa_confirmed_at TEXT",
    "customer_phone TEXT",
    "email_confirmed_at TEXT",
  ];

  for (const col of orderColumns) {
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col}`);
    } catch {
      /* Column already exists */
    }
  }

  // Auto-heal: Ensure order TH-1017 is moved to AWAITING_APPROVAL as customer already confirmed it on WhatsApp
  try {
    db.prepare(`
      UPDATE orders 
      SET status = 'AWAITING_APPROVAL',
          wa_confirmed_at = COALESCE(wa_confirmed_at, '2026-11-07T19:02:00.000Z'),
          customer_phone = COALESCE(customer_phone, '01285694670'),
          revision = revision + 1
      WHERE number = 'TH-1017' AND status = 'PENDING_EMAIL'
    `).run();
  } catch {}

  // Auto-backfill confirmed customers from existing delivered / sold orders
  try {
    const { backfillExistingDeliveredCustomers } = require("./confirmed-customers");
    backfillExistingDeliveredCustomers(db);
  } catch {}

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

  // Idempotency and Race Condition Migration Columns
  const idempColumns = [
    "order_id TEXT",
    "status TEXT NOT NULL DEFAULT 'completed'",
    "status_code INTEGER DEFAULT 200",
    "updated_at TEXT",
  ];
  for (const col of idempColumns) {
    try {
      db.exec(`ALTER TABLE idempotency_keys ADD COLUMN ${col};`);
    } catch {
      /* Column already exists */
    }
  }

  try {
    db.exec("ALTER TABLE promo_codes ADD COLUMN per_customer_limit INTEGER DEFAULT 1;");
  } catch {
    /* Column already exists */
  }

  // Supabase-standard Vault encryption & blind index migrations for promo_codes
  try {
    db.exec("ALTER TABLE promo_codes ADD COLUMN code_hash TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("ALTER TABLE promo_codes ADD COLUMN encrypted_code TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS ix_promo_code_hash ON promo_codes(code_hash);");
  } catch {}

  // Supabase-standard Vault encryption & blind index migrations for admin_users
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN email_hash TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN encrypted_email TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN username_hash TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN encrypted_username TEXT;");
  } catch {
    /* Column already exists */
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS ix_admin_email_hash ON admin_users(email_hash);");
    db.exec("CREATE INDEX IF NOT EXISTS ix_admin_username_hash ON admin_users(username_hash);");
  } catch {}

  // Multi-manager & RBAC schema migrations
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'manager';");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN username TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN avatar_url TEXT;");
  } catch {}
  try {
    db.exec("UPDATE admin_users SET role = 'master' WHERE id = 'admin-root' OR LOWER(email) = 'admin@terrahop.com';");
  } catch {}

  // Password reset OTP table (Rate-limited Brevo OTP)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_password_resets (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        reset_token TEXT,
        attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_pw_resets_email ON admin_password_resets(email);
    `);
  } catch {}

  // Single Active Device / Session enforcement columns
  try {
    db.exec("ALTER TABLE admin_sessions ADD COLUMN device_summary TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_sessions ADD COLUMN superseded_by TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_sessions ADD COLUMN superseded_device TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_sessions ADD COLUMN superseded_at TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE admin_users ADD COLUMN active_session_id TEXT;");
  } catch {}

  try {
    db.exec("ALTER TABLE orders ADD COLUMN idempotency_key TEXT;");
  } catch {
    /* Column already exists */
  }

  try {
    db.exec("ALTER TABLE ambassador_sale_events ADD COLUMN idempotency_key TEXT;");
  } catch {
    /* Column already exists */
  }

  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_amb_events_idemp ON ambassador_sale_events(idempotency_key);");
  } catch {
    /* Index already exists */
  }

  // One-time cleanup to permanently remove all default pre-seeded demo promo codes
  try {
    const isCleaned = db.prepare("SELECT value FROM meta WHERE key = 'promos_cleaned_v2'").get();
    if (!isCleaned) {
      db.prepare("DELETE FROM promo_codes WHERE code IN ('708DDH', 'AHMED', 'AHMED10', 'DROP01', 'TERRA10', 'VIP20', 'WELCOME50', 'ONEUSE20', 'WELCOME10')").run();
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('promos_cleaned_v2', '1')").run();
    }
  } catch {}

  // Seed default Complete Look on Burgundy Hoodie if not yet configured
  try {
    const isLookSeeded = db.prepare("SELECT value FROM meta WHERE key = 'look_seeded_v1'").get();
    if (!isLookSeeded) {
      const prod = db.prepare("SELECT id, details FROM products WHERE slug = 'oversized-burgundy-hoodie'").get() as any;
      if (prod) {
        let det: any = {};
        try { det = JSON.parse(prod.details || "{}"); } catch {}
        if (!det.look) {
          det.look = {
            enabled: true,
            title: "إطلالة متكاملة",
            subtitle: "نسق هذا المنتج مع قطع مختارة للحصول على ستايل متكامل.",
            discountPercent: 10,
            productIds: ["obsidian-puff-print-hoodie", "midnight-navy-raw-edge-hoodie"],
          };
          db.prepare("UPDATE products SET details = ? WHERE id = ?").run(JSON.stringify(det), prod.id);
        }
      }
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('look_seeded_v1', '1')").run();
    }
  } catch {}

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

  // === Speed Engineer: High-Performance Database Indexes ===
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS ix_orders_status_created ON orders(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS ix_orders_created ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS ix_orders_number ON orders(number);
      CREATE INDEX IF NOT EXISTS ix_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS ix_order_items_product_id ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS ix_products_status_pos ON products(status, position ASC, created_at DESC);
      CREATE INDEX IF NOT EXISTS ix_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS ix_variants_prod_color ON variants(product_id, color_id);
      CREATE INDEX IF NOT EXISTS ix_stock_mov_var ON stock_movements(variant_id, at DESC);
      CREATE INDEX IF NOT EXISTS ix_pl_slot_active ON image_placements(slot_key, active, position);
      CREATE INDEX IF NOT EXISTS ix_pl_asset ON image_placements(asset_id);
      CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at DESC);
      CREATE INDEX IF NOT EXISTS ix_change_at ON change_log(at DESC);
    `);
  } catch (err) {
    console.error("Speed Engineer indexes creation error:", err);
  }
}

/**
 * Log a change into change_log for live SSE & polling updates
 */
export function recordChange(
  topic: "media" | "products" | "settings" | "content" | "orders" | "ambassadors" | "auth",
  entity: string,
  entityId: string | null,
  revision?: number
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO change_log (topic, entity, entity_id, revision, at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const rev = revision && revision > 1 ? revision : Date.now();
  const result = stmt.run(topic, entity, entityId, rev, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

/**
 * Get latest change_log revision for a topic or overall (strictly increasing primary key id)
 */
export function getLatestRevision(topic?: string): number {
  const db = getDb();
  if (topic) {
    const row = db
      .prepare(`SELECT MAX(id) as rev FROM change_log WHERE topic = ?`)
      .get(topic) as { rev: number | null } | undefined;
    return row?.rev ?? 0;
  }
  const row = db.prepare(`SELECT MAX(id) as rev FROM change_log`).get() as
    | { rev: number | null }
    | undefined;
  return row?.rev ?? 0;
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

/**
 * Parse user-agent string into a friendly device summary
 * Example: "iPhone (Safari)", "Android (Chrome)", "Windows (Chrome)"
 */
export function parseDeviceSummary(ua: string): string {
  if (!ua) return "جهاز غير معروف";
  let os = "كمبيوتر";
  if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/android/i.test(ua)) os = "Android";
  else if (/macintosh|mac os x/i.test(ua)) os = "Mac";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "متصفح";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  return `${os} (${browser})`;
}

/**
 * Format timestamp into Arabic 12-hour format
 * Example: "07:34 م", "2026/11/17"
 */
export function format12HourArabicTime(isoString: string): { time12: string; dateFormatted: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { time12: "--:--", dateFormatted: "--" };
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "م" : "ص";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");

    const time12 = `${hoursStr}:${minutes} ${ampm}`;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateFormatted = `${year}/${month}/${day}`;

    return { time12, dateFormatted };
  } catch {
    return { time12: "--:--", dateFormatted: "--" };
  }
}
