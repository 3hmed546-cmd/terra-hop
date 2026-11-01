import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id: productId } = await context.params;
  const db = getDb();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات تعديل المخزون غير صالحة.", 400);
  }

  const variantId = body.variantId;
  const newStock = typeof body.stock === "number" ? body.stock : null;
  const delta = typeof body.delta === "number" ? body.delta : null;
  const note = (body.note || "تعديل يدوي من لوحة التحكم").trim();

  if (!variantId) {
    return apiError("VALIDATION", "معرف المتغير (variantId) مطلوب.", 400);
  }

  const variant = db
    .prepare("SELECT * FROM variants WHERE id = ? AND product_id = ?")
    .get(variantId, productId) as any;

  if (!variant) {
    return apiError("NOT_FOUND", "متغير المقاس/اللون غير موجود لهذا المنتج.", 404);
  }

  let finalStock = variant.stock;
  let movementDelta = 0;

  if (newStock !== null) {
    if (newStock < 0) return apiError("VALIDATION", "لا يمكن أن يكون المخزون سالباً.", 400);
    movementDelta = newStock - variant.stock;
    finalStock = newStock;
  } else if (delta !== null) {
    finalStock = variant.stock + delta;
    if (finalStock < 0) return apiError("VALIDATION", "الكمية المطلوبة تتجاوز المخزون المتاح.", 400);
    movementDelta = delta;
  } else {
    return apiError("VALIDATION", "يرجى تحديد المخزون الجديد (stock) أو الفرق (delta).", 400);
  }

  const movementId = `mov_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare("UPDATE variants SET stock = ? WHERE id = ?").run(finalStock, variantId);

    db.prepare(`
      INSERT INTO stock_movements (id, variant_id, product_id, kind, delta, note, at, by)
      VALUES (?, ?, ?, 'manual_adjustment', ?, ?, ?, ?)
    `).run(movementId, variantId, productId, movementDelta, note, now, auth.user!.email);

    // Update product revision
    db.prepare("UPDATE products SET revision = revision + 1, updated_at = ? WHERE id = ?").run(now, productId);
  })();

  const prod = db.prepare("SELECT revision FROM products WHERE id = ?").get(productId) as any;
  recordChange("products", "variants", variantId, prod.revision);
  recordAudit({
    actor: auth.user.email,
    action: "ADJUST_STOCK",
    entity: "variants",
    entityId: variantId,
    before: { stock: variant.stock },
    after: { stock: finalStock, delta: movementDelta, note },
  });

  return apiSuccess({
    variantId,
    stock: finalStock,
    delta: movementDelta,
    note,
  });
}
