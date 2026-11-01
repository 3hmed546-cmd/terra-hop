import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";

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
      id: item.id,
      productId: item.product_id,
      productSlug: item.product_id,
      productName: item.product_name,
      colorName: item.color_name,
      size: item.size,
      qty: item.qty,
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

    return {
      id: o.id,
      number: o.number,
      source: o.source,
      status: o.status,
      customer,
      notes: o.notes,
      subtotalCents: o.subtotal_cents,
      subtotal: Math.round(o.subtotal_cents / 100),
      shippingCents: o.shipping_cents,
      shipping: Math.round(o.shipping_cents / 100),
      discountCents: o.discount_cents,
      discount: Math.round(o.discount_cents / 100),
      promoCode: o.promo_code,
      totalCents: o.total_cents,
      total: Math.round(o.total_cents / 100),
      createdAt: o.created_at,
      soldAt: o.sold_at,
      items,
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
  const soldAt = status === "SOLD" ? now : order.sold_at;

  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = ?, sold_at = ?, revision = revision + 1
      WHERE id = ?
    `).run(status, soldAt, orderId);

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
    }
  })();

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
