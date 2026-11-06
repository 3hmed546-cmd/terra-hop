import crypto from "crypto";
import type Database from "better-sqlite3";

export interface IdempotencyRecord {
  key: string;
  order_id: string | null;
  status: "processing" | "completed" | "failed";
  response: string | null;
  status_code: number;
  created_at: string;
  updated_at: string;
}

export type IdempotencyCheckResult =
  | { hit: false }
  | {
      hit: true;
      status: "completed";
      response: any;
      statusCode: number;
      orderId: string | null;
    }
  | {
      hit: true;
      status: "processing";
      message: string;
    };

/**
 * Checks if an idempotency key already exists.
 * - If completed: returns cached response for instant replay.
 * - If currently processing (within recent TTL): returns 409 conflict indication.
 * - If stale (> 45s) or failed: allows re-execution.
 */
export function checkIdempotency(
  db: Database.Database,
  key: string,
  processingTimeoutMs: number = 45000
): IdempotencyCheckResult {
  const row = db
    .prepare("SELECT * FROM idempotency_keys WHERE key = ?")
    .get(key) as IdempotencyRecord | undefined;

  if (!row) {
    return { hit: false };
  }

  if (row.status === "completed" && row.response) {
    try {
      const parsed = JSON.parse(row.response);
      return {
        hit: true,
        status: "completed",
        response: parsed,
        statusCode: row.status_code || 200,
        orderId: row.order_id,
      };
    } catch {
      // In case of parsing error, allow re-execution
      return { hit: false };
    }
  }

  if (row.status === "processing") {
    const createdAtTime = new Date(row.updated_at || row.created_at).getTime();
    const isStale = Date.now() - createdAtTime > processingTimeoutMs;

    if (!isStale) {
      return {
        hit: true,
        status: "processing",
        message: "طلبك قيد المعالجة حالياً، يرجى الانتظار بضع ثوانٍ لتجنب تكرار الطلب.",
      };
    }
  }

  return { hit: false };
}

/**
 * Atomically marks an idempotency key as 'processing' in the database.
 * If already processing and not stale, returns false to prevent concurrent duplicate execution.
 */
export function acquireIdempotencyLock(
  db: Database.Database,
  key: string,
  processingTimeoutMs: number = 45000
): boolean {
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM idempotency_keys WHERE key = ?")
    .get(key) as IdempotencyRecord | undefined;

  if (existing) {
    if (existing.status === "completed") {
      return false; // Already done
    }
    if (existing.status === "processing") {
      const age = Date.now() - new Date(existing.updated_at || existing.created_at).getTime();
      if (age < processingTimeoutMs) {
        return false; // Active lock held
      }
    }
    // Take over stale lock
    db.prepare(`
      UPDATE idempotency_keys 
      SET status = 'processing', updated_at = ?
      WHERE key = ?
    `).run(now, key);
    return true;
  }

  try {
    db.prepare(`
      INSERT INTO idempotency_keys (key, status, created_at, updated_at)
      VALUES (?, 'processing', ?, ?)
    `).run(key, now, now);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stores the successful response for an idempotency key.
 */
export function completeIdempotentOperation(
  db: Database.Database,
  key: string,
  orderId: string,
  responseBody: unknown,
  statusCode: number = 200
): void {
  const now = new Date().toISOString();
  const payload = JSON.stringify(responseBody);

  db.prepare(`
    INSERT INTO idempotency_keys (key, order_id, status, response, status_code, created_at, updated_at)
    VALUES (?, ?, 'completed', ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      order_id = excluded.order_id,
      status = 'completed',
      response = excluded.response,
      status_code = excluded.status_code,
      updated_at = excluded.updated_at
  `).run(key, orderId, payload, statusCode, now, now);
}

/**
 * Releases or marks an idempotency key as failed if the operation encounters an error.
 */
export function releaseIdempotencyLock(db: Database.Database, key: string): void {
  try {
    db.prepare("DELETE FROM idempotency_keys WHERE key = ? AND status = 'processing'").run(key);
  } catch {}
}

/**
 * Computes a deterministic payload hash for requests that do not provide an explicit key.
 */
export function computeCheckoutIdempotencyKey(
  phone: string,
  email: string,
  items: Array<{ productId?: string; variantId?: string; qty: number; size?: string }>,
  promoCode: string | null = null
): string {
  const normalizedItems = items
    .map((i) => `${i.variantId || i.productId}_${i.size || ""}_${i.qty}`)
    .sort()
    .join("|");
  const base = `${phone.trim()}:${email.trim().toLowerCase()}:${normalizedItems}:${promoCode || ""}`;
  return `chk_${crypto.createHash("sha256").update(base).digest("hex").slice(0, 32)}`;
}
