import crypto from "crypto";
import type Database from "better-sqlite3";
import { evaluateAmbassadorRewards } from "./rewards";
import { recordAudit, recordChange } from "../db";

export interface DeliveredResult {
  ok: boolean;
  orderId: string;
  orderNumber: string;
  ambassadorCredited: boolean;
  newRewards: any[];
  message: string;
}

/**
 * Authoritative Delivery & Payment Confirmation (Owner Decision R3 / R4).
 * Single transactional event that:
 * 1. Sets fulfilment_status = DELIVERED, payment_status = PAID, status = SOLD
 * 2. Confirms real stock deduction (or records final movement)
 * 3. Records QUALIFIED sale in the append-only ledger for the ambassador
 * 4. Logs first sale milestone on the ambassador profile if applicable
 * 5. Evaluates and unlocks rewards (e.g. 80% hoodie voucher)
 */
export function markOrderDeliveredAndPaid(
  db: Database.Database,
  orderId: string,
  adminEmail: string,
  courierReference?: string
): DeliveredResult {
  const now = new Date().toISOString();

  const order = db
    .prepare("SELECT * FROM orders WHERE id = ? OR number = ?")
    .get(orderId, orderId) as any;

  if (!order) {
    throw new Error("الطلب غير موجود.");
  }

  // Idempotent guard
  if (order.fulfilment_status === "DELIVERED" && order.payment_status === "PAID") {
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      ambassadorCredited: Boolean(order.ambassador_id),
      newRewards: [],
      message: "الطلب مسجل بالفعل كمسلّم ومحصّل.",
    };
  }

  let newRewards: any[] = [];
  let ambassadorCredited = false;

  const runTx = db.transaction(() => {
    // 1. Update Order State atomically and conditionally
    const orderUpdateRes = db.prepare(`
      UPDATE orders
      SET 
        fulfilment_status = 'DELIVERED',
        payment_status = 'PAID',
        status = 'SOLD',
        delivered_at = ?,
        paid_at = ?,
        delivered_confirmed_by = ?,
        courier_reference = ?,
        sold_at = COALESCE(sold_at, ?)
      WHERE id = ? AND (fulfilment_status != 'DELIVERED' OR payment_status != 'PAID')
    `).run(
      now,
      now,
      adminEmail,
      courierReference || null,
      now,
      order.id
    );

    if (orderUpdateRes.changes === 0) {
      // Order was already marked delivered and paid by a concurrent process
      return;
    }

    // 2. Record Delivery Stock Movement if not already recorded
    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ?")
      .all(order.id) as any[];

    for (const it of items) {
      db.prepare(`
        INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, order_id, at, by)
        VALUES (?, ?, ?, 'delivered_sale', 0, 'تأكيد التسليم والتحصيل للطلب', ?, ?, ?)
      `).run(
        `mov_${crypto.randomUUID()}`,
        it.variant_id,
        it.product_id,
        order.id,
        now,
        adminEmail
      );
    }

    // 3. Ambassador Attribution & Counting
    if (order.ambassador_id) {
      const amb = db
        .prepare("SELECT * FROM ambassadors WHERE id = ?")
        .get(order.ambassador_id) as any;

      if (amb && amb.status === "ACTIVE") {
        const idempotencyKey = `q:${order.id}`;

        // Insert QUALIFIED event into append-only ledger
        const insertEvent = db.prepare(`
          INSERT OR IGNORE INTO ambassador_sale_events (
            id, ambassador_id, order_id, event_type, units,
            basis_snapshot, amount_cents, occurred_at,
            recorded_by_admin, source, idempotency_key
          ) VALUES (?, ?, ?, 'QUALIFIED', 1, 'orders', ?, ?, ?, 'delivered_confirmation', ?)
        `);

        const res = insertEvent.run(
          `evt_${crypto.randomUUID()}`,
          amb.id,
          order.id,
          order.total_cents || 0,
          now,
          adminEmail,
          idempotencyKey
        );

        if (res.changes > 0) {
          ambassadorCredited = true;

          // Check if first qualified sale milestone (R3b)
          const progress = db
            .prepare("SELECT first_qualified_at FROM ambassador_progress WHERE ambassador_id = ?")
            .get(amb.id) as { first_qualified_at: string | null } | undefined;

          if (!progress || !progress.first_qualified_at) {
            db.prepare(`
              UPDATE ambassador_progress 
              SET first_qualified_at = ?
              WHERE ambassador_id = ?
            `).run(now, amb.id);

            db.prepare(`
              INSERT INTO ambassador_milestones (
                id, ambassador_id, kind, order_id, description, occurred_at, created_by
              ) VALUES (?, ?, 'FIRST_SALE_CONFIRMED', ?, ?, ?, ?)
            `).run(
              `mls_${crypto.randomUUID()}`,
              amb.id,
              order.id,
              `تم تسجيل أول عملية بيع ناجحة ومؤكدة بالتسليم للطلب رقم (${order.number})`,
              now,
              adminEmail
            );
          }

          // Evaluate Rewards
          const evalResult = evaluateAmbassadorRewards(db, amb.id);
          newRewards = evalResult.newRewardsEarned;
        }
      }
    }
  });

  runTx.immediate();

  recordChange("orders", "orders", order.id, Date.now());
  recordChange("ambassadors", "ambassador_sales", order.ambassador_id, Date.now());
  recordAudit({
    actor: adminEmail,
    action: "MARK_DELIVERED_PAID",
    entity: "orders",
    entityId: order.id,
    after: {
      orderNumber: order.number,
      courierReference,
      ambassadorCredited,
      newRewardsCount: newRewards.length,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.number,
    ambassadorCredited,
    newRewards,
    message: ambassadorCredited
      ? `تم تأكيد التسليم والتحصيل، واحتساب عملية البيع للسفير بنجاح (${newRewards.length > 0 ? "تم فتح مكافآت جديدة!" : ""}).`
      : "تم تأكيد التسليم والتحصيل للطلب بنجاح.",
  };
}

/**
 * Handle returns or cancellations (compensating ledger events)
 */
export function recordOrderReversal(
  db: Database.Database,
  orderId: string,
  kind: "RETURN" | "REFUND" | "CANCEL",
  adminEmail: string,
  reason?: string
) {
  const now = new Date().toISOString();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  if (!order) throw new Error("الطلب غير موجود.");

  const eventType =
    kind === "RETURN"
      ? "REVERSED_RETURN"
      : kind === "REFUND"
      ? "REVERSED_REFUND"
      : "REVERSED_ADMIN";

  const runTx = db.transaction(() => {
    // 1. Restock products if returning
    if (kind === "RETURN" || kind === "CANCEL") {
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id) as any[];
      for (const it of items) {
        db.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?").run(it.qty, it.variant_id);
        db.prepare(`
          INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, order_id, at, by)
          VALUES (?, ?, ?, 'reversal_restock', ?, ?, ?, ?, ?)
        `).run(
          `mov_${crypto.randomUUID()}`,
          it.variant_id,
          it.product_id,
          it.qty,
          reason || `إرجاع المخزون بسبب ${kind}`,
          order.id,
          now,
          adminEmail
        );
      }
    }

    // 2. Compensating event in ledger if previously qualified
    if (order.ambassador_id) {
      const qualEvent = db
        .prepare("SELECT id FROM ambassador_sale_events WHERE order_id = ? AND event_type = 'QUALIFIED'")
        .get(order.id);

      if (qualEvent) {
        db.prepare(`
          INSERT INTO ambassador_sale_events (
            id, ambassador_id, order_id, event_type, units,
            basis_snapshot, amount_cents, occurred_at,
            recorded_by_admin, source, idempotency_key
          ) VALUES (?, ?, ?, ?, 1, 'orders', ?, ?, ?, 'reversal', ?)
        `).run(
          `evt_${crypto.randomUUID()}`,
          order.ambassador_id,
          order.id,
          eventType,
          order.total_cents || 0,
          now,
          adminEmail,
          `r:${order.id}:${kind.toLowerCase()}`
        );

        // Re-evaluate rewards & progress
        evaluateAmbassadorRewards(db, order.ambassador_id);
      }
    }

    // 3. Update Order status
    db.prepare(`
      UPDATE orders
      SET 
        status = ?,
        fulfilment_status = ?,
        cancelled_at = ?,
        cancel_reason = ?
      WHERE id = ?
    `).run(
      kind === "CANCEL" ? "CANCELLED" : order.status,
      kind === "RETURN" ? "RETURNED" : order.fulfilment_status,
      now,
      reason || null,
      order.id
    );
  });

  runTx.immediate();

  recordChange("orders", "orders", order.id, Date.now());
  recordAudit({
    actor: adminEmail,
    action: `ORDER_${kind}`,
    entity: "orders",
    entityId: order.id,
    after: { reason },
  });
}
