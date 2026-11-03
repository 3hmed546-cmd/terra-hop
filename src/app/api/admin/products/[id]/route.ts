import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { syncProductsVault } from "@/lib/server/vault-sync";

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
  
  // Status & sold out normalization
  let status = body.status !== undefined ? body.status : product.status;
  let forceSoldOut = product.force_sold_out;

  if (body.status === "sold_out" || body.forceSoldOut === true) {
    status = "active";
    forceSoldOut = 1;
  } else if (body.status === "available" || body.forceSoldOut === false) {
    status = "active";
    forceSoldOut = 0;
  } else if (body.status === "draft") {
    status = "draft";
    forceSoldOut = 0;
  } else if (body.forceSoldOut !== undefined) {
    forceSoldOut = body.forceSoldOut ? 1 : 0;
  }

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

  db.transaction(() => {
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

    // Update colors if provided
    if (Array.isArray(body.colors) && body.colors.length > 0) {
      db.prepare("DELETE FROM product_colors WHERE product_id = ?").run(product.id);
      const insColor = db.prepare("INSERT INTO product_colors (id, product_id, name, hex, position) VALUES (?, ?, ?, ?, ?)");
      body.colors.forEach((c: any, idx: number) => {
        insColor.run(c.id, product.id, c.name, c.hex, idx + 1);
      });
    }

    // Update variants if provided
    if (Array.isArray(body.variants) && body.variants.length > 0) {
      db.prepare("DELETE FROM variants WHERE product_id = ?").run(product.id);
      const insVariant = db.prepare("INSERT INTO variants (id, product_id, color_id, size, stock) VALUES (?, ?, ?, ?, ?)");
      body.variants.forEach((v: any) => {
        insVariant.run(v.id || `var_${crypto.randomUUID()}`, product.id, v.colorId, v.size, v.stock ?? 10);
      });
    }
  })();

  // Synchronize to persistent vault immediately
  syncProductsVault(db);

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
  const rawId = decodeURIComponent(id || "").trim();
  const db = getDb();

  const product = db.prepare("SELECT * FROM products WHERE id = ? OR slug = ?").get(rawId, rawId) as any;
  if (!product) {
    return apiSuccess({ deleted: true, id: rawId, alreadyDeleted: true });
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
    // Delete discount code relations if any
    try {
      db.prepare("DELETE FROM discount_code_products WHERE product_id = ?").run(product.id);
    } catch {}
    // Delete variants & colors (cascade)
    db.prepare("DELETE FROM variants WHERE product_id = ?").run(product.id);
    db.prepare("DELETE FROM product_colors WHERE product_id = ?").run(product.id);
    // Delete product
    db.prepare("DELETE FROM products WHERE id = ?").run(product.id);
  })();

  syncProductsVault(db);

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
