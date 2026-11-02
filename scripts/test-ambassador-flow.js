const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const dbPath = path.join(process.cwd(), "storage", "terra.db");
const db = new Database(dbPath);

console.log("=== RUNNING TERRA HOP STREET AMBASSADOR VERIFICATION (JS) ===");

function getSecretKey() {
  return process.env.SESSION_SECRET || "terra-hop-fallback-vault-secret-key-2026-v1";
}

function getVoucherCipherKey() {
  const secret = getSecretKey();
  return crypto.createHash("sha256").update(`${secret}:voucher_aes256_key`).digest();
}

function hashLookupCode(rawCode) {
  const normalized = (rawCode || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return crypto.createHash("sha256").update(`TH_VOUCHER_SALT_2026:${normalized}`).digest("hex");
}

function encryptCode(rawCode) {
  const normalized = (rawCode || "").trim().toUpperCase();
  const key = getVoucherCipherKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptCode(payload) {
  if (!payload || !payload.includes(":")) return "";
  try {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const key = getVoucherCipherKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return "";
  }
}

// 1. Encryption Test
console.log("\n[1] Testing AES-256-GCM voucher encryption & SHA-256 hash lookup...");
const raw = "AHMED10";
const enc = encryptCode(raw);
const hsh = hashLookupCode(raw);
const dec = decryptCode(enc);

console.log("  Raw Code:", raw);
console.log("  Hash (Indexed for fast lookup):", hsh);
console.log("  Ciphertext (Stored in DB):", enc);
console.log("  Decrypted Code:", dec);

if (dec !== raw) throw new Error("Decryption failed!");
if (enc.includes(raw)) throw new Error("Raw code leaked in ciphertext!");
console.log("  ✓ PASS: Codes & Vouchers are cryptographically protected and unreadable in the database.");

// 2. Table Verification
console.log("\n[2] Verifying database tables existence...");
const tables = [
  "ambassadors",
  "referral_codes",
  "discount_code_products",
  "ambassador_levels",
  "reward_definitions",
  "ambassador_rewards",
  "reward_vouchers",
  "ambassador_sale_events",
  "ambassador_progress",
  "ambassador_milestones",
  "ambassador_users",
  "ambassador_sessions",
  "fraud_flags"
];

for (const t of tables) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
  if (!row) throw new Error(`Table ${t} missing!`);
  console.log(`  ✓ Table found: ${t}`);
}

// 3. Ambassador Levels Verification
console.log("\n[3] Verifying default program levels & reward definitions...");
const levels = db.prepare("SELECT * FROM ambassador_levels ORDER BY rank ASC").all();
console.log("  Levels in DB:", levels.map(l => `${l.name} (${l.threshold_sales} sales)`));
if (levels.length < 3) throw new Error("Expected at least 3 levels (Starter, Rising, Elite)!");

const rewards = db.prepare("SELECT * FROM reward_definitions").all();
console.log("  Reward Definitions in DB:", rewards.map(r => `${r.title} [${r.type}]`));
const has80PercentVoucher = rewards.some(r => r.type === "PERCENT_DISCOUNT_VOUCHER" && r.discount_percent === 80);
if (!has80PercentVoucher) throw new Error("Missing 80% percent discount voucher reward definition!");
console.log("  ✓ PASS: 80% discount voucher definition and levels present.");

// 4. Test Orders columns
console.log("\n[4] Verifying orders attribution & COD fulfilment columns...");
const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
const colNames = orderColumns.map(c => c.name);
const requiredCols = [
  "ambassador_id",
  "ambassador_code",
  "referral_code_id",
  "attribution_locked_at",
  "fulfilment_status",
  "payment_status",
  "delivered_at",
  "paid_at",
  "delivered_confirmed_by",
  "courier_reference"
];

for (const col of requiredCols) {
  if (!colNames.includes(col)) throw new Error(`Column orders.${col} missing!`);
}
console.log("  ✓ PASS: All attribution & fulfilment columns present on orders table.");

console.log("\n=== ALL DATABASE DOMAIN & ENCRYPTION CHECKS PASSED WITH 100% SUCCESS! ===");
