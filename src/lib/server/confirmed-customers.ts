import crypto from "crypto";
import type Database from "better-sqlite3";
import { encryptCustomer, decryptCustomer } from "./vault";
import { normalizePhone } from "./phone";

export interface DecryptedConfirmedCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  ordersCount: number;
  totalSpentCents: number;
  lastOrderNumber: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function getSecretKey(): string {
  return process.env.SESSION_SECRET || "terra_vault_secret_2026";
}

/**
 * Creates an HMAC-SHA256 hash of the normalized phone number.
 * Allows duplicate detection in O(1) without storing plaintext phone unencrypted.
 */
export function hashCustomerPhone(phone: string): string {
  const norm = normalizePhone(phone.trim().replace(/[^0-9]/g, ""));
  return crypto.createHmac("sha256", getSecretKey()).update(norm).digest("hex");
}

/**
 * Masks phone number for safe admin preview (e.g. 012****4670)
 */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length >= 8) {
    return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
  }
  return "****";
}

/**
 * Initialize table if not exists
 */
export function initConfirmedCustomersTable(db: Database.Database): void {
  db.exec(`
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
}

/**
 * Saves a customer to the encrypted confirmed_customers vault upon delivery confirmation.
 */
export function saveConfirmedCustomer(
  db: Database.Database,
  order: {
    id: string;
    number: string;
    customer_enc?: any;
    customer_phone?: string | null;
    total_cents?: number;
    sold_at?: string | null;
    delivered_at?: string | null;
  }
): { id: string; name: string; phone: string } | null {
  initConfirmedCustomersTable(db);

  let cust: any = null;
  if (order.customer_enc) {
    try {
      cust = decryptCustomer(Buffer.from(order.customer_enc));
    } catch {}
  }

  const rawPhone = cust?.phone || order.customer_phone || "";
  const phone = normalizePhone(rawPhone.replace(/[^0-9]/g, ""));
  if (!phone || phone.length < 8) {
    console.warn("[ConfirmedCustomers] Cannot save customer without valid phone:", rawPhone);
    return null;
  }

  const name = (cust?.name || "عميلنا العزيز").trim();
  const phoneHash = hashCustomerPhone(phone);
  const now = new Date().toISOString();
  const orderTime = order.sold_at || order.delivered_at || now;
  const totalCents = Number(order.total_cents) || 0;

  // Encrypt full customer object using AES-256-GCM vault
  const customerBlob = encryptCustomer({
    name,
    phone,
    email: cust?.email || "",
    city: cust?.city || "",
    address: cust?.address || "",
    savedAt: now,
    lastOrderNumber: order.number,
  });

  const existing = db
    .prepare("SELECT * FROM confirmed_customers WHERE phone_hash = ?")
    .get(phoneHash) as any;

  if (existing) {
    db.prepare(`
      UPDATE confirmed_customers
      SET orders_count = orders_count + 1,
          total_spent_cents = total_spent_cents + ?,
          customer_enc = ?,
          customer_name_preview = ?,
          last_order_number = ?,
          last_order_at = ?,
          updated_at = ?
      WHERE phone_hash = ?
    `).run(
      totalCents,
      customerBlob,
      name,
      order.number,
      orderTime,
      now,
      phoneHash
    );
    return { id: existing.id, name, phone };
  } else {
    const custId = `cust_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO confirmed_customers (
        id, phone_hash, customer_enc, raw_phone_masked, customer_name_preview,
        orders_count, total_spent_cents, last_order_number, last_order_at,
        marketing_opt_in, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?)
    `).run(
      custId,
      phoneHash,
      customerBlob,
      maskPhone(phone),
      name,
      totalCents,
      order.number,
      orderTime,
      now,
      now
    );
    return { id: custId, name, phone };
  }
}

/**
 * Returns total count of confirmed customers in the encrypted vault
 */
export function getConfirmedCustomersCount(db: Database.Database): number {
  try {
    initConfirmedCustomersTable(db);
    const row = db.prepare("SELECT COUNT(*) as c FROM confirmed_customers").get() as { c: number };
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Retrieves all confirmed customers with decrypted details for marketing and broadcasting
 */
export function getConfirmedCustomers(db: Database.Database): DecryptedConfirmedCustomer[] {
  try {
    initConfirmedCustomersTable(db);
    const rows = db
      .prepare(`
        SELECT * FROM confirmed_customers
        WHERE marketing_opt_in = 1
        ORDER BY last_order_at DESC, created_at DESC
      `)
      .all() as any[];

    const result: DecryptedConfirmedCustomer[] = [];
    for (const r of rows) {
      try {
        const cust = decryptCustomer(Buffer.from(r.customer_enc));
        if (cust?.phone) {
          result.push({
            id: r.id,
            name: cust.name || r.customer_name_preview || "عميلنا العزيز",
            phone: cust.phone,
            email: cust.email,
            city: cust.city,
            address: cust.address,
            ordersCount: r.orders_count || 1,
            totalSpentCents: r.total_spent_cents || 0,
            lastOrderNumber: r.last_order_number,
            lastOrderAt: r.last_order_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          });
        }
      } catch (decErr) {
        console.error(`[ConfirmedCustomers:DecryptError] cust ${r.id}:`, decErr);
      }
    }
    return result;
  } catch (err) {
    console.error("[ConfirmedCustomers:ListError]", err);
    return [];
  }
}

/**
 * Backfills past confirmed/sold orders into the confirmed_customers vault.
 */
export function backfillExistingDeliveredCustomers(db: Database.Database): void {
  try {
    initConfirmedCustomersTable(db);
    const deliveredOrders = db
      .prepare(`
        SELECT * FROM orders
        WHERE status = 'SOLD' OR fulfilment_status = 'DELIVERED'
        ORDER BY created_at ASC
      `)
      .all() as any[];

    for (const ord of deliveredOrders) {
      saveConfirmedCustomer(db, ord);
    }
  } catch (err) {
    console.error("[ConfirmedCustomers:BackfillError]", err);
  }
}
