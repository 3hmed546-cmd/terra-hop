import crypto from "crypto";
import type Database from "better-sqlite3";
import { recordChange, recordAudit } from "../db";
import { markOrderDeliveredAndPaid } from "../ambassadors/qualification";

export interface PaymentWebhookPayload {
  paymentId: string;
  orderId: string;
  amountCents?: number;
  status: "PAID" | "FAILED" | "REFUNDED";
  raw?: unknown;
}

export interface PaymentTransitionResult {
  ok: boolean;
  orderId: string;
  isFirstConfirmation: boolean;
  message: string;
}

/**
 * Authoritative Idempotent Payment Confirmation
 * Prevents race conditions, double captures, and duplicate ambassador reward qualifications.
 */
export function handleIdempotentPaymentConfirmation(
  db: Database.Database,
  payload: PaymentWebhookPayload,
  adminOrSystemActor: string = "system_payment_webhook"
): PaymentTransitionResult {
  const now = new Date().toISOString();
  const idempotencyKey = `pay_hook_${payload.paymentId}_${payload.orderId}`;

  // 1. Check idempotency record
  const existingKey = db
    .prepare("SELECT * FROM idempotency_keys WHERE key = ?")
    .get(idempotencyKey) as any;

  if (existingKey && existingKey.status === "completed") {
    return {
      ok: true,
      orderId: payload.orderId,
      isFirstConfirmation: false,
      message: "تم معالجة وتأكيد الدفعة مسبقاً (إشعار متكرر).",
    };
  }

  // 2. Fetch order
  const order = db
    .prepare("SELECT id, number, payment_status, status, total_cents, ambassador_id FROM orders WHERE id = ? OR number = ?")
    .get(payload.orderId, payload.orderId) as any;

  if (!order) {
    throw new Error(`الطلب (${payload.orderId}) غير موجود.`);
  }

  let isFirstConfirmation = false;

  const runTx = db.transaction(() => {
    if (payload.status === "PAID") {
      const updateRes = db.prepare(`
        UPDATE orders
        SET 
          payment_status = 'PAID',
          paid_at = COALESCE(paid_at, ?),
          revision = revision + 1
        WHERE id = ? AND payment_status != 'PAID'
      `).run(now, order.id);

      if (updateRes.changes > 0) {
        isFirstConfirmation = true;

        // If order was already delivered, or if delivery auto-qualifies upon payment
        if (order.fulfilment_status === "DELIVERED") {
          markOrderDeliveredAndPaid(db, order.id, adminOrSystemActor, payload.paymentId);
        }
      }
    } else if (payload.status === "REFUNDED") {
      db.prepare(`
        UPDATE orders
        SET payment_status = 'REFUNDED', revision = revision + 1
        WHERE id = ? AND payment_status != 'REFUNDED'
      `).run(order.id);
    }

    // Record idempotency completed
    db.prepare(`
      INSERT INTO idempotency_keys (key, order_id, status, response, status_code, created_at, updated_at)
      VALUES (?, ?, 'completed', ?, 200, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        status = 'completed',
        updated_at = excluded.updated_at
    `).run(idempotencyKey, order.id, JSON.stringify({ ok: true, isFirstConfirmation }), now, now);
  });

  runTx.immediate();

  if (isFirstConfirmation) {
    recordChange("orders", "orders", order.id, Date.now());
    recordAudit({
      actor: adminOrSystemActor,
      action: "CONFIRM_PAYMENT",
      entity: "orders",
      entityId: order.id,
      after: {
        paymentId: payload.paymentId,
        status: payload.status,
      },
    });
  }

  return {
    ok: true,
    orderId: order.id,
    isFirstConfirmation,
    message: isFirstConfirmation ? "تم تسجيل الدفع بنجاح." : "الطلب مسجل كمدفوع مسبقاً.",
  };
}
