import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const product = db.prepare("SELECT * FROM products WHERE id = ? OR slug = ?").get(id, id) as any;
  if (!product) {
    return apiError("NOT_FOUND", "المنتج غير موجود.", 404);
  }

  const colors = db
    .prepare("SELECT * FROM product_colors WHERE product_id = ? ORDER BY position ASC")
    .all(product.id) as any[];

  const variants = db
    .prepare("SELECT * FROM variants WHERE product_id = ?")
    .all(product.id) as any[];

  const placements = db
    .prepare(`
      SELECT p.*, a.sha256
      FROM image_placements p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.slot_key = 'product' AND p.owner_id = ?
      ORDER BY p.position ASC
    `)
    .all(product.id) as any[];

  const images = placements.map((p) => {
    let meta = {};
    try {
      meta = JSON.parse(p.meta || "{}");
    } catch {}
    const sourceUrl = (meta as any).sourceUrl;
    return {
      id: p.id,
      url: sourceUrl || `/media/${p.sha256}.webp`,
      thumbUrl: sourceUrl || `/media/${p.sha256}-thumb.webp`,
      alt: p.alt_ar,
      position: p.position,
    };
  });

  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));

  return apiSuccess({
    ...product,
    name: product.name_ar,
    nameAr: product.name_ar,
    nameEn: product.name_en,
    description: product.description_ar,
    descriptionAr: product.description_ar,
    descriptionEn: product.description_en,
    priceCents: product.price_cents,
    compareAtCents: product.compare_at_cents,
    forceSoldOut: product.force_sold_out === 1,
    colors,
    sizes,
    variants,
    images,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const product = db.prepare("SELECT * FROM products WHERE id = ? OR slug = ?").get(id, id) as any;
  if (!product) {
    return apiError("NOT_FOUND", "المنتج المطلوب تعديله غير موجود.", 404);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات التعديل غير صالحة.", 400);
  }

  // Revision conflict check
  if (typeof body.ifRevision === "number" && product.revision !== body.ifRevision) {
    return apiError(
      "REVISION_CONFLICT",
      "تم تعديل هذا المنتج من قبل مستخدم آخر، يرجى تحديث الصفحة والمحاولة مجدداً.",
      409
    );
  }

  const nameAr = body.nameAr !== undefined ? body.nameAr : (body.name !== undefined ? body.name : product.name_ar);
  const nameEn = body.nameEn !== undefined ? body.nameEn : product.name_en;
  const descriptionAr = body.descriptionAr !== undefined ? body.descriptionAr : (body.description !== undefined ? body.description : product.description_ar);
  const descriptionEn = body.descriptionEn !== undefined ? body.descriptionEn : product.description_en;
  const priceCents = body.priceCents !== undefined ? Number(body.priceCents) : product.price_cents;
  const compareAtCents = body.compareAtCents !== undefined ? (body.compareAtCents ? Number(body.compareAtCents) : null) : product.compare_at_cents;
  const status = body.status !== undefined ? body.status : product.status;
  const forceSoldOut = body.forceSoldOut !== undefined ? (body.forceSoldOut ? 1 : 0) : product.force_sold_out;
  const lowStockThreshold = body.lowStockThreshold !== undefined ? (body.lowStockThreshold ? Number(body.lowStockThreshold) : null) : product.low_stock_threshold;

  let details = product.details;
  if (body.details) {
    try {
      const parsedOld = JSON.parse(product.details || "{}");
      details = JSON.stringify({ ...parsedOld, ...body.details });
    } catch {
      details = JSON.stringify(body.details);
    }
  }

  const nextRevision = (product.revision || 1) + 1;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products
    SET 
      name_ar = ?, name_en = ?, description_ar = ?, description_en = ?,
      price_cents = ?, compare_at_cents = ?, status = ?, force_sold_out = ?,
      low_stock_threshold = ?, details = ?, revision = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nameAr,
    nameEn,
    descriptionAr,
    descriptionEn,
    priceCents,
    compareAtCents,
    status,
    forceSoldOut,
    lowStockThreshold,
    details,
    nextRevision,
    now,
    product.id
  );

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(product.id) as any;

  recordChange("products", "products", product.id, nextRevision);
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_PRODUCT",
    entity: "products",
    entityId: id,
    before: product,
    after: updated,
  });

  return apiSuccess(updated, {
    revision: nextRevision,
    topic: "products",
    topicRevision: nextRevision,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const product = db.prepare("SELECT * FROM products WHERE id = ? OR slug = ?").get(id, id) as any;
  if (!product) {
    return apiSuccess({ deleted: true, id, alreadyDeleted: true });
  }

  // Check if active orders exist
  const openOrderItems = db
    .prepare(`
      SELECT oi.id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ? AND o.status IN ('AWAITING_APPROVAL', 'PENDING_EMAIL')
    `)
    .all(product.id) as any[];

  if (openOrderItems.length > 0) {
    return apiError(
      "IN_USE",
      "لا يمكن حذف هذا المنتج لأن هناك طلبات معلقة نشطة مرتبطة به. يرجى معالجة الطلبات أولاً.",
      409
    );
  }

  db.transaction(() => {
    // Delete product images placement
    db.prepare("DELETE FROM image_placements WHERE slot_key = 'product' AND owner_id = ?").run(product.id);
    // Delete variants & colors (cascade)
    db.prepare("DELETE FROM variants WHERE product_id = ?").run(product.id);
    db.prepare("DELETE FROM product_colors WHERE product_id = ?").run(product.id);
    // Delete product
    db.prepare("DELETE FROM products WHERE id = ?").run(product.id);
  })();

  const nextRevision = (product.revision || 1) + 1;
  recordChange("products", "products", product.id, nextRevision);
  recordAudit({
    actor: auth.user.email,
    action: "DELETE_PRODUCT",
    entity: "products",
    entityId: product.id,
    before: product,
  });

  return apiSuccess(
    { deleted: true, id: product.id },
    { revision: nextRevision, topic: "products", topicRevision: nextRevision }
  );
}
