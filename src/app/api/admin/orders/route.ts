import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { markOrderDeliveredAndPaid } from "@/lib/server/ambassadors/qualification";
import { notifyAdminsAmbassadorGoalReached } from "@/lib/server/push";
import { decryptCode } from "@/lib/server/security";
import { sendOrderAcceptedEmail, sendOrderRejectedEmail } from "@/lib/server/mailer";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  seedDatabaseIfNeeded();
  const db = getDb();

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  let query = "SELECT * FROM orders";
  const params: any[] = [];
  if (statusFilter && statusFilter !== "all") {
    query += " WHERE status = ?";
    params.push(statusFilter);
  }
  query += " ORDER BY created_at DESC";

  const orders = db.prepare(query).all(...params) as any[];
  const orderItems = db.prepare("SELECT * FROM order_items").all() as any[];

  const itemsByOrder = new Map<string, any[]>();
  for (const item of orderItems) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push({
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      colorName: item.color_name,
      size: item.size,
      qty: item.qty,
      priceCentsSnapshot: item.price_cents_snapshot,
      // For backwards compatibility
      id: item.id,
      productSlug: item.product_id,
      priceCents: item.price_cents_snapshot,
      price: Math.round(item.price_cents_snapshot / 100),
    });
    itemsByOrder.set(item.order_id, list);
  }

  const decryptedOrders = orders.map((o) => {
    let customer: any = { name: "عميل غير معروف", phone: "", city: "", address: "" };
    try {
      if (o.customer_enc) {
        customer = decryptCustomer(Buffer.from(o.customer_enc));
      }
    } catch {}

    const items = itemsByOrder.get(o.id) || [];

    const timeline: Array<{ at: string; type: string; actor: string; note?: string }> = [
      { at: o.created_at, type: "placed", actor: "customer" },
    ];
    if (o.status === "SOLD" && o.sold_at) {
      timeline.push({ at: o.sold_at, type: "sold", actor: "owner" });
    }
    if (o.status === "CANCELLED") {
      timeline.push({
        at: o.cancelled_at ?? o.created_at,
        type: "cancelled",
        actor: "owner",
        ...(o.cancel_reason ? { note: o.cancel_reason } : {}),
      });
    }

    return {
      id: o.id,
      number: o.number,
      source: o.source,
      status: o.status,
      customer: { email: "", ...customer },
      notes: o.notes ?? "",
      items,
      subtotalCents: o.subtotal_cents,
      shippingCents: o.shipping_cents,
      discountCents: o.discount_cents,
      promoCode: o.promo_code,
      totalCents: o.total_cents,
      createdAt: o.created_at,
      emailConfirmedAt: null,
      soldAt: o.sold_at ?? null,
      cancelledAt: o.cancelled_at ?? null,
      cancelReason: o.cancel_reason ?? null,
      timeline,
      ambassadorId: o.ambassador_id ?? null,
      ambassadorCode: o.ambassador_code ?? null,
      referralCodeId: o.referral_code_id ?? null,
      fulfilmentStatus: o.fulfilment_status ?? "NOT_SHIPPED",
      paymentStatus: o.payment_status ?? "UNPAID",
      deliveredAt: o.delivered_at ?? null,
      paidAt: o.paid_at ?? null,
      courierReference: o.courier_reference ?? null,
      // Compatibility
      subtotal: Math.round(o.subtotal_cents / 100),
      shipping: Math.round(o.shipping_cents / 100),
      discount: Math.round(o.discount_cents / 100),
      total: Math.round(o.total_cents / 100),
    };
  });

  return apiSuccess({
    orders: decryptedOrders,
    totalCount: decryptedOrders.length,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات التعديل غير صالحة.", 400);
  }

  const { orderId, status } = body;
  if (!orderId || !status) {
    return apiError("VALIDATION", "معرف الطلب (orderId) والحالة الجديدة (status) مطلوبان.", 400);
  }

  const validStatuses = ["AWAITING_APPROVAL", "SOLD", "CANCELLED", "PENDING_EMAIL"];
  if (!validStatuses.includes(status)) {
    return apiError("VALIDATION", `الحالة (${status}) غير صالحة.`, 400);
  }

  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
  if (!order) {
    return apiError("NOT_FOUND", "الطلب غير موجود في قاعدة البيانات.", 404);
  }

  const now = new Date().toISOString();
  const soldAt = status === "SOLD" ? now : order.sold_at ?? null;
  const cancelledAt = status === "CANCELLED" ? now : order.cancelled_at ?? null;
  const cancelReason =
    status === "CANCELLED"
      ? (typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "") || null
      : order.cancel_reason ?? null;

  if (status === "SOLD") {
    // Authoritatively mark delivered & paid: updates fulfilment_status to DELIVERED, payment_status to PAID,
    // and credits ambassador with a confirmed qualified sale
    markOrderDeliveredAndPaid(db, orderId, auth.user!.email);

    // Send Order Accepted Email with estimated delivery days
    try {
      const cust = decryptCustomer(order.customer_enc);
      if (cust?.email) {
        sendOrderAcceptedEmail(
          {
            number: order.number,
            customer: cust,
            totalCents: order.total_cents,
          },
          body.deliveryDays || "من 2 إلى 4 أيام عمل"
        ).catch((err) => {
          console.error("[Mailer] Failed to send order accepted email:", err);
        });
      }
    } catch (e) {
      console.error("[Mailer] Decrypt customer failed for accepted email:", e);
    }

    // Check if ambassador reached their max uses goal
    if (order.ambassador_id) {
      try {
        const amb = db.prepare("SELECT * FROM ambassadors WHERE id = ?").get(order.ambassador_id) as any;
        const refCode = db.prepare("SELECT * FROM referral_codes WHERE ambassador_id = ?").get(order.ambassador_id) as any;
        if (amb && refCode?.max_uses) {
          const soldCountRow = db
            .prepare("SELECT COUNT(*) as c FROM orders WHERE ambassador_id = ? AND (status = 'SOLD' OR fulfilment_status = 'DELIVERED')")
            .get(amb.id) as { c: number };
          const currentCount = Math.max(soldCountRow?.c ?? 0, refCode.used_count ?? 0);
          if (currentCount >= refCode.max_uses) {
            const milestoneKey = `goal_reached_${refCode.id}_${refCode.max_uses}`;
            const existingMilestone = db.prepare("SELECT id FROM ambassador_milestones WHERE id = ?").get(milestoneKey);
            if (!existingMilestone) {
              db.prepare(`
                INSERT INTO ambassador_milestones (id, ambassador_id, kind, order_id, description, occurred_at, created_by)
                VALUES (?, ?, 'LEVEL_REACHED', ?, ?, ?, 'system')
              `).run(
                milestoneKey,
                amb.id,
                order.id,
                `تم وصول الكود للحد المطلوب (${refCode.max_uses} استخدام ومبيعة). يستحق المكافأة.`,
                now
              );

              const decryptedCode = decryptCode(refCode.encrypted_code);
              notifyAdminsAmbassadorGoalReached({
                ambassadorName: amb.display_name || amb.full_name,
                code: decryptedCode || "الكود",
                targetCount: refCode.max_uses,
                currentCount,
              }).catch(() => {});
            }
          }
        }
      } catch {}
    }
  } else {
    db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET status = ?, sold_at = ?, cancelled_at = ?, cancel_reason = ?, revision = revision + 1
        WHERE id = ?
      `).run(status, soldAt, cancelledAt, cancelReason, orderId);

      // If cancelled, restore variant stock if was previously reserved or sold
      if (status === "CANCELLED" && order.status !== "CANCELLED") {
        const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId) as any[];
        const restoreStock = db.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?");
        const insertMovement = db.prepare(`
          INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, order_id, at, by)
          VALUES (?, ?, ?, 'order_cancel_restock', ?, 'استرجاع مخزون بعد إلغاء الطلب', ?, ?, ?)
        `);

        for (const item of items) {
          if (item.variant_id) {
            restoreStock.run(item.qty, item.variant_id);
            insertMovement.run(
              `mov_${crypto.randomUUID()}`,
              item.variant_id,
              item.product_id,
              item.qty,
              orderId,
              now,
              auth.user!.email
            );
          }
        }

        // Send Order Rejection Email with cancellation reason
        try {
          const cust = decryptCustomer(order.customer_enc);
          if (cust?.email) {
            sendOrderRejectedEmail(
              {
                number: order.number,
                customer: cust,
              },
              cancelReason || "تعذر تأكيد أو شحن الطلب في الوقت الحالي"
            ).catch((err) => {
              console.error("[Mailer] Failed to send order rejected email:", err);
            });
          }
        } catch (e) {
          console.error("[Mailer] Decrypt customer failed for rejected email:", e);
        }
      }
    })();
  }

  recordChange("orders", "orders", orderId, (order.revision || 1) + 1);
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_ORDER_STATUS",
    entity: "orders",
    entityId: orderId,
    before: { status: order.status },
    after: { status, soldAt },
  });

  return apiSuccess({ updated: true, orderId, status });
}
