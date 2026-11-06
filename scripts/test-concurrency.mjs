import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import fs from "fs";

// Initialize a dedicated high-concurrency test SQLite database with WAL mode
const testDbPath = path.resolve("./storage/test-concurrency.db");
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 10000");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

// Create schema tables
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id TEXT NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    UNIQUE (product_id, color_id, size)
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
    per_customer_limit INTEGER DEFAULT 1,
    applies_to TEXT DEFAULT 'ALL_PRODUCTS'
  );

  CREATE TABLE IF NOT EXISTS promo_redemptions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    order_id TEXT NOT NULL,
    redeemed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_pr_lookup ON promo_redemptions(code, customer_phone, customer_email);

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    order_id TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    response TEXT,
    status_code INTEGER DEFAULT 200,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE,
    status TEXT,
    fulfilment_status TEXT DEFAULT 'NOT_SHIPPED',
    payment_status TEXT DEFAULT 'UNPAID',
    subtotal_cents INTEGER,
    total_cents INTEGER,
    idempotency_key TEXT,
    cancelled_at TEXT,
    cancel_reason TEXT,
    delivered_at TEXT,
    paid_at TEXT,
    revision INTEGER DEFAULT 1,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    variant_id TEXT,
    qty INTEGER
  );

  CREATE TABLE IF NOT EXISTS reward_vouchers (
    id TEXT PRIMARY KEY,
    code_hash TEXT UNIQUE,
    discount_percent INTEGER NOT NULL DEFAULT 80,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'REVOKED')),
    redeemed_order_id TEXT,
    redeemed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ambassador_sale_events (
    id TEXT PRIMARY KEY,
    ambassador_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    occurred_at TEXT NOT NULL
  );
`);

console.log("================================================================================");
console.log("       TERRA HOP - GLOBAL RACE CONDITION & CONCURRENCY TEST SUITE               ");
console.log("================================================================================");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${testName}: ${details}`);
    totalFailed++;
  }
}

async function runTestSuite() {
  // ---------------------------------------------------------------------------
  // TEST A: Single-Use Coupon under 20 Concurrent Requests
  // ---------------------------------------------------------------------------
  console.log("\n[TEST A] Single-Use Coupon with 20 Concurrent Requests");
  db.prepare(`
    INSERT INTO promo_codes (code, kind, value, active, max_uses, used)
    VALUES ('ONEUSE20', 'percent', 20, 1, 1, 0)
  `).run();

  const couponStmt = db.prepare(`
    UPDATE promo_codes
    SET used = used + 1
    WHERE code = ?
      AND active = 1
      AND (max_uses IS NULL OR max_uses = 0 OR used < max_uses)
  `);

  const couponTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      // Simulate concurrent async requests entering SQLite transaction
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            const res = couponStmt.run("ONEUSE20");
            return res.changes === 1;
          });
          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const couponResults = await Promise.all(couponTasks);
  const couponSuccesses = couponResults.filter((r) => r.success).length;
  const couponFailures = couponResults.filter((r) => !r.success).length;
  const couponInDb = db.prepare("SELECT used FROM promo_codes WHERE code = 'ONEUSE20'").get();

  assert(couponSuccesses === 1, "Exactly one customer redeems the single-use coupon", `Successes: ${couponSuccesses}`);
  assert(couponFailures === 19, "Remaining 19 concurrent customers are rejected", `Failures: ${couponFailures}`);
  assert(couponInDb.used === 1, "Coupon usage count in DB is exactly 1 (never exceeds max_uses)", `DB used: ${couponInDb.used}`);

  // ---------------------------------------------------------------------------
  // TEST B: Single-Unit Stock under 20 Concurrent Purchase Requests
  // ---------------------------------------------------------------------------
  console.log("\n[TEST B] Single-Unit Stock with 20 Concurrent Purchase Requests");
  db.prepare("INSERT INTO products (id, slug, name_ar, price_cents, status) VALUES ('p_single', 'hoodie-single', 'هودي سبشيل', 100000, 'active')").run();
  db.prepare("INSERT INTO variants (id, product_id, color_id, size, stock) VALUES ('var_single', 'p_single', 'c_black', 'L', 1)").run();

  const stockStmt = db.prepare(`
    UPDATE variants
    SET stock = stock - 1
    WHERE id = ? AND stock >= 1
  `);

  const singleStockTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            const res = stockStmt.run("var_single");
            return res.changes === 1;
          });
          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const singleStockResults = await Promise.all(singleStockTasks);
  const singleStockSuccesses = singleStockResults.filter((r) => r.success).length;
  const singleStockFailures = singleStockResults.filter((r) => !r.success).length;
  const singleStockInDb = db.prepare("SELECT stock FROM variants WHERE id = 'var_single'").get();

  assert(singleStockSuccesses === 1, "Exactly one customer purchases the single remaining unit", `Successes: ${singleStockSuccesses}`);
  assert(singleStockFailures === 19, "Remaining 19 customers receive out-of-stock response", `Failures: ${singleStockFailures}`);
  assert(singleStockInDb.stock === 0, "Stock is exactly 0 (no overselling, never negative)", `Final stock: ${singleStockInDb.stock}`);

  // ---------------------------------------------------------------------------
  // TEST C: Multi-Unit Stock (10 units) with 50 Concurrent Purchase Requests
  // ---------------------------------------------------------------------------
  console.log("\n[TEST C] Multi-Unit Stock (10 units) with 50 Concurrent Purchase Requests");
  db.prepare("INSERT INTO products (id, slug, name_ar, price_cents, status) VALUES ('p_multi', 'hoodie-multi', 'هودي دفعة محدودة', 100000, 'active')").run();
  db.prepare("INSERT INTO variants (id, product_id, color_id, size, stock) VALUES ('var_multi', 'p_multi', 'c_black', 'XL', 10)").run();

  const multiStockTasks = Array.from({ length: 50 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            const res = db.prepare("UPDATE variants SET stock = stock - 1 WHERE id = 'var_multi' AND stock >= 1").run();
            return res.changes === 1;
          });
          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 15));
    });
  });

  const multiStockResults = await Promise.all(multiStockTasks);
  const multiStockSuccesses = multiStockResults.filter((r) => r.success).length;
  const multiStockFailures = multiStockResults.filter((r) => !r.success).length;
  const multiStockInDb = db.prepare("SELECT stock FROM variants WHERE id = 'var_multi'").get();

  assert(multiStockSuccesses === 10, "Exactly 10 customers acquire the 10 available units", `Successes: ${multiStockSuccesses}`);
  assert(multiStockFailures === 40, "Remaining 40 customers receive out-of-stock response", `Failures: ${multiStockFailures}`);
  assert(multiStockInDb.stock === 0, "Inventory depleted cleanly to 0 (never negative)", `Final stock: ${multiStockInDb.stock}`);

  // ---------------------------------------------------------------------------
  // TEST D: Per-Customer Coupon Limit with Concurrent Requests
  // ---------------------------------------------------------------------------
  console.log("\n[TEST D] Per-Customer Coupon Limit (1 use per customer) with Concurrent Requests");
  db.prepare(`
    INSERT INTO promo_codes (code, kind, value, active, max_uses, used, per_customer_limit)
    VALUES ('WELCOME10', 'percent', 10, 1, 1000, 0, 1)
  `).run();

  const targetPhone = "01099887766";
  const targetEmail = "concurrency.shopper@terra-hop.com";

  const perCustTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            // Check per customer limit inside atomic immediate transaction
            const usedCount = db.prepare(`
              SELECT COUNT(*) as c FROM promo_redemptions
              WHERE code = 'WELCOME10' AND (customer_phone = ? OR customer_email = ?)
            `).get(targetPhone, targetEmail).c;

            if (usedCount >= 1) {
              return false;
            }

            db.prepare(`
              INSERT INTO promo_redemptions (id, code, customer_phone, customer_email, order_id, redeemed_at)
              VALUES (?, 'WELCOME10', ?, ?, ?, ?)
            `).run(`red_${crypto.randomUUID()}`, targetPhone, targetEmail, `ord_sim_${idx}`, new Date().toISOString());

            return true;
          });
          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const perCustResults = await Promise.all(perCustTasks);
  const perCustSuccesses = perCustResults.filter((r) => r.success).length;
  const perCustFailures = perCustResults.filter((r) => !r.success).length;
  const perCustRowsInDb = db.prepare("SELECT COUNT(*) as c FROM promo_redemptions WHERE code = 'WELCOME10'").get().c;

  assert(perCustSuccesses === 1, "Exactly one redemption allowed for the customer", `Successes: ${perCustSuccesses}`);
  assert(perCustFailures === 19, "Remaining 19 concurrent attempts rejected by per-customer limit", `Failures: ${perCustFailures}`);
  assert(perCustRowsInDb === 1, "Database records exactly 1 redemption for this customer", `DB rows: ${perCustRowsInDb}`);

  // ---------------------------------------------------------------------------
  // TEST E: Global Checkout Concurrency & Idempotency Key Replay
  // ---------------------------------------------------------------------------
  console.log("\n[TEST E] Duplicate Checkout Submissions with Identical Idempotency Key");
  const testIdempKey = "idemp_race_key_999";
  let ordersCreated = 0;

  const idempTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          // Check existing key
          const existing = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(testIdempKey);
          if (existing && existing.status === "completed") {
            resolve({ id: idx, outcome: "replayed", orderId: existing.order_id });
            return;
          }

          const runTx = db.transaction(() => {
            // Atomic acquire lock
            const lock = db.prepare("INSERT OR IGNORE INTO idempotency_keys (key, status, created_at, updated_at) VALUES (?, 'processing', ?, ?)")
              .run(testIdempKey, new Date().toISOString(), new Date().toISOString());

            if (lock.changes === 0) {
              const current = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(testIdempKey);
              if (current.status === "completed") {
                return { outcome: "replayed", orderId: current.order_id };
              }
              return { outcome: "in_progress" };
            }

            // Create order
            const orderId = `ord_idemp_${crypto.randomUUID()}`;
            db.prepare("INSERT INTO orders (id, number, status, idempotency_key, created_at) VALUES (?, ?, 'PENDING_EMAIL', ?, ?)")
              .run(orderId, `TH-IDEMP-${idx}`, testIdempKey, new Date().toISOString());

            db.prepare("UPDATE idempotency_keys SET status = 'completed', order_id = ?, response = ? WHERE key = ?")
              .run(orderId, JSON.stringify({ ok: true, orderId }), testIdempKey);

            ordersCreated++;
            return { outcome: "created", orderId };
          });

          const res = runTx.immediate();
          resolve({ id: idx, ...res });
        } catch (err) {
          resolve({ id: idx, outcome: "error", error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const idempResults = await Promise.all(idempTasks);
  const createdOrders = idempResults.filter((r) => r.outcome === "created");
  const inDbOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE idempotency_key = ?").get(testIdempKey).c;

  assert(createdOrders.length === 1, "Exactly one order created for 20 identical submissions", `Created count: ${createdOrders.length}`);
  assert(inDbOrders === 1, "Database orders table contains exactly 1 order row for this idempotency key", `DB count: ${inDbOrders}`);

  // ---------------------------------------------------------------------------
  // TEST F: Order Cancellation Stock Restock Concurrency
  // ---------------------------------------------------------------------------
  console.log("\n[TEST F] Concurrent Order Cancellation Restocking");
  db.prepare("INSERT INTO variants (id, product_id, color_id, size, stock) VALUES ('var_cancel', 'p_single', 'c_black', 'M', 2)").run();
  const cancelOrderId = "ord_to_cancel";
  db.prepare("INSERT INTO orders (id, number, status, created_at) VALUES (?, 'TH-CANCEL-1', 'PROCESSING', ?)").run(cancelOrderId, new Date().toISOString());
  db.prepare("INSERT INTO order_items (id, order_id, variant_id, qty) VALUES ('oi_cancel', ?, 'var_cancel', 3)").run(cancelOrderId);

  // 20 concurrent requests attempt to cancel this order
  const cancelTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            // Conditional atomic cancellation: only succeed if not already cancelled
            const updateRes = db.prepare(`
              UPDATE orders
              SET status = 'CANCELLED', cancelled_at = ?
              WHERE id = ? AND status NOT IN ('CANCELLED', 'SOLD')
            `).run(new Date().toISOString(), cancelOrderId);

            if (updateRes.changes === 0) {
              return false; // Already cancelled or sold
            }

            // Restore stock
            db.prepare("UPDATE variants SET stock = stock + 3 WHERE id = 'var_cancel'").run();
            return true;
          });

          const restored = runTx.immediate();
          resolve({ id: idx, restored });
        } catch (err) {
          resolve({ id: idx, restored: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const cancelResults = await Promise.all(cancelTasks);
  const restockSuccesses = cancelResults.filter((r) => r.restored).length;
  const finalCancelStock = db.prepare("SELECT stock FROM variants WHERE id = 'var_cancel'").get().stock;

  assert(restockSuccesses === 1, "Exactly one cancellation execution succeeds in restoring stock", `Successes: ${restockSuccesses}`);
  assert(finalCancelStock === 5, "Stock restored exactly once (2 + 3 = 5, not duplicated to 62)", `Final stock: ${finalCancelStock}`);

  // ---------------------------------------------------------------------------
  // TEST G: Reward Voucher Single-Use Concurrency
  // ---------------------------------------------------------------------------
  console.log("\n[TEST G] Reward Voucher Single-Use Concurrency");
  const voucherId = "vch_race_test";
  db.prepare("INSERT INTO reward_vouchers (id, code_hash, discount_percent, status) VALUES (?, 'hash_race', 80, 'ACTIVE')").run(voucherId);

  const voucherTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            const res = db.prepare(`
              UPDATE reward_vouchers
              SET status = 'REDEEMED', redeemed_order_id = ?, redeemed_at = ?
              WHERE id = ? AND status = 'ACTIVE'
            `).run(`ord_v_${idx}`, new Date().toISOString(), voucherId);
            return res.changes === 1;
          });
          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const voucherResults = await Promise.all(voucherTasks);
  const voucherSuccesses = voucherResults.filter((r) => r.success).length;
  const voucherFailures = voucherResults.filter((r) => !r.success).length;
  const voucherStatusInDb = db.prepare("SELECT status FROM reward_vouchers WHERE id = ?").get(voucherId).status;

  assert(voucherSuccesses === 1, "Exactly one redemption of the reward voucher succeeds", `Successes: ${voucherSuccesses}`);
  assert(voucherFailures === 19, "Remaining 19 concurrent voucher redemption attempts are rejected", `Failures: ${voucherFailures}`);
  assert(voucherStatusInDb === "REDEEMED", "Voucher status transitioned to REDEEMED", `Status: ${voucherStatusInDb}`);

  // ---------------------------------------------------------------------------
  // TEST H: State Machine Transition (Delivered & Paid) Concurrency
  // ---------------------------------------------------------------------------
  console.log("\n[TEST H] State Machine Transition (Delivered & Paid) Concurrency");
  const deliverOrderId = "ord_to_deliver";
  db.prepare("INSERT INTO orders (id, number, status, fulfilment_status, payment_status, created_at) VALUES (?, 'TH-DELIV-1', 'PROCESSING', 'SHIPPED', 'UNPAID', ?)")
    .run(deliverOrderId, new Date().toISOString());

  const deliverTasks = Array.from({ length: 20 }, (_, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const runTx = db.transaction(() => {
            const updateRes = db.prepare(`
              UPDATE orders
              SET fulfilment_status = 'DELIVERED', payment_status = 'PAID', status = 'SOLD'
              WHERE id = ? AND (fulfilment_status != 'DELIVERED' OR payment_status != 'PAID')
            `).run(deliverOrderId);

            if (updateRes.changes === 0) {
              return false;
            }

            // Insert sale event exactly once
            db.prepare(`
              INSERT OR IGNORE INTO ambassador_sale_events (id, ambassador_id, order_id, event_type, idempotency_key, occurred_at)
              VALUES (?, 'amb_test', ?, 'QUALIFIED', ?, ?)
            `).run(`evt_${crypto.randomUUID()}`, deliverOrderId, `q:${deliverOrderId}`, new Date().toISOString());

            return true;
          });

          const success = runTx.immediate();
          resolve({ id: idx, success });
        } catch (err) {
          resolve({ id: idx, success: false, error: err.message });
        }
      }, Math.floor(Math.random() * 10));
    });
  });

  const deliverResults = await Promise.all(deliverTasks);
  const deliverSuccesses = deliverResults.filter((r) => r.success).length;
  const saleEventsInDb = db.prepare("SELECT COUNT(*) as c FROM ambassador_sale_events WHERE order_id = ?").get(deliverOrderId).c;

  assert(deliverSuccesses === 1, "Exactly one delivery confirmation executes state transition", `Successes: ${deliverSuccesses}`);
  assert(saleEventsInDb === 1, "Ambassador qualified sale event recorded exactly once in ledger", `Event count: ${saleEventsInDb}`);

  console.log("\n================================================================================");
  console.log(`TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log("================================================================================");

  // Clean up test database
  db.close();
  try {
    fs.unlinkSync(testDbPath);
    const walFile = `${testDbPath}-wal`;
    const shmFile = `${testDbPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  } catch {}

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error("Test Suite Unhandled Exception:", e);
  process.exit(1);
});
